import { useEffect, useMemo, useState } from "react"
import { PlusCircleIcon, Trash2Icon } from "lucide-react"
import { toast } from "react-toastify"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuthStore } from "@/store/authStore"
import api, { postDownloadDocumentFromEndpoint } from "@/utils/api"

type FieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "checkbox"
  | "textarea"
  | "yes_no_comment"
  | "string_list"
  | "object_list"

type ObjectFieldDataType = "string" | "number" | "boolean" | "file"
type ApiUserRole = "client" | "company"

const CLIENT_ROLE_ID = "6a156a603a5d7ea978fbb13c"
const COMPANY_ROLE_ID = "6a156a6d3a5d7ea978fbb13d"

interface FieldOption {
  label: string
  value: string | number | boolean
}

interface FieldValidations {
  min?: number
  max?: number
  regex?: string
}

interface YesNoValue {
  answer: "SI" | "NO"
  comment: string
}

interface YesNoConfig {
  commentPlaceholder?: string
  commentRequired?: boolean
}

interface ObjectFieldConfig {
  key: string
  tag: string
  description?: string
  dataType: ObjectFieldDataType
  required?: boolean
}

interface ObjectFileValue {
  fileUrl: string
  fileName: string
}

type ObjectItemValue = Record<string, string | number | boolean | ObjectFileValue | undefined>

interface DocumentField {
  fieldKey: string
  tag: string
  type: FieldType
  required?: boolean
  placeholder?: string
  options?: FieldOption[]
  validations?: FieldValidations
  yesNoConfig?: YesNoConfig
  objectFields?: ObjectFieldConfig[]
}

interface DocumentSection {
  title: string
  description?: string
  fields: DocumentField[]
}

interface DocumentStructure {
  title?: string
  sections?: DocumentSection[]
  fields?: DocumentField[]
}

interface DocumentDetails {
  _id: string
  key: string
  name: string
  downloadEndpoint: string
  userType: ApiUserRole
  documentStructureId?: DocumentStructure
}

interface StructureResponse {
  document: DocumentDetails
  structure?: DocumentStructure
}

interface DownloadDocumentModalProps {
  documentId: string
  documentRequestId?: string | null
  formProgressId?: string | null
  onSuccess?: () => void | Promise<void>
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

interface RoleUser {
  _id: string
  label: string
  subtitle?: string
}

type FieldValue = string | boolean | YesNoValue | string[] | ObjectItemValue[]
type FieldValues = Record<string, FieldValue>
type ListDraftValues = Record<string, string>
type ObjectDraftValues = Record<string, ObjectItemValue>

function defaultObjectDraft(objectFields: ObjectFieldConfig[] = []): ObjectItemValue {
  const draft: ObjectItemValue = {}
  objectFields.forEach((objectField) => {
    draft[objectField.key] = objectField.dataType === "boolean" ? false : ""
  })
  return draft
}

function normalizeField(field: DocumentField): DocumentField {
  return {
    fieldKey: field.fieldKey,
    tag: field.tag,
    type: field.type,
    required: field.required,
    placeholder: field.placeholder,
    options: field.options ?? [],
    validations: field.validations,
    yesNoConfig:
      field.type === "yes_no_comment"
        ? {
          commentPlaceholder: field.yesNoConfig?.commentPlaceholder ?? "Observaciones...",
          commentRequired: Boolean(field.yesNoConfig?.commentRequired),
        }
        : undefined,
    objectFields:
      field.type === "object_list"
        ? (field.objectFields ?? []).map((objectField) => ({
            key: objectField.key,
            tag: objectField.tag,
            description: objectField.description ?? "",
            dataType: objectField.dataType,
            required: Boolean(objectField.required),
          }))
        : undefined,
  }
}

function normalizeSectionsFromStructure(
  structure?: DocumentStructure,
  fallbackStructure?: DocumentStructure
): DocumentSection[] {
  const source = structure ?? fallbackStructure

  if (Array.isArray(source?.sections) && source.sections.length > 0) {
    return source.sections.map((section, sectionIndex) => ({
      title: section.title || `Sección ${sectionIndex + 1}`,
      description: section.description || "",
      fields: (section.fields ?? []).map((field) => normalizeField(field)),
    }))
  }

  if (Array.isArray(source?.fields) && source.fields.length > 0) {
    return [
      {
        title: "Sección general",
        description: "",
        fields: source.fields.map((field) => normalizeField(field)),
      },
    ]
  }

  return []
}

function getInitialValue(field: DocumentField): FieldValue {
  if (field.type === "checkbox") return false
  if (field.type === "yes_no_comment") return { answer: "NO", comment: "" }
  if (field.type === "string_list") return []
  if (field.type === "object_list") return []
  return ""
}

function getObjectItemError(objectFields: ObjectFieldConfig[], item: ObjectItemValue): string | null {
  for (const objectField of objectFields) {
    const value = item[objectField.key]

    if (objectField.dataType === "boolean") continue

    if (objectField.dataType === "file") {
      if (objectField.required && !value) {
        return `${objectField.tag} es requerido`
      }
      continue
    }

    const isEmpty = value === undefined || value === null || String(value).trim() === ""
    if (objectField.required && isEmpty) {
      return `${objectField.tag} es requerido`
    }

    if (!isEmpty && objectField.dataType === "number" && Number.isNaN(Number(value))) {
      return `${objectField.tag} debe ser un número válido`
    }
  }

  return null
}

function getPrimitiveFieldError(field: DocumentField, rawValue: unknown): string | null {
  const isEmpty = rawValue === "" || rawValue === null || rawValue === undefined

  if (field.required) {
    if (field.type === "checkbox") {
      if (rawValue !== true) {
        return `${field.tag} es requerido`
      }
    } else if (isEmpty) {
      return `${field.tag} es requerido`
    }
  }

  if (isEmpty || field.type === "checkbox") return null

  if (field.type === "number") {
    const numberValue = Number(rawValue)
    if (Number.isNaN(numberValue)) {
      return `${field.tag} debe ser un número válido`
    }
    if (field.validations?.min !== undefined && numberValue < field.validations.min) {
      return `${field.tag} debe ser mayor o igual a ${field.validations.min}`
    }
    if (field.validations?.max !== undefined && numberValue > field.validations.max) {
      return `${field.tag} debe ser menor o igual a ${field.validations.max}`
    }
  }

  if (field.validations?.regex && typeof rawValue === "string") {
    try {
      const regex = new RegExp(field.validations.regex)
      if (!regex.test(rawValue)) {
        return `${field.tag} no cumple con el formato requerido`
      }
    } catch {
      return "Validación regex inválida en la configuración del documento"
    }
  }

  return null
}

function getFieldError(field: DocumentField, rawValue: unknown): string | null {
  if (field.type === "yes_no_comment") {
    const value = rawValue as YesNoValue | undefined
    if (!value?.answer) {
      return `${field.tag} es requerido`
    }
    if (field.yesNoConfig?.commentRequired && !String(value.comment ?? "").trim()) {
      return `La observación de ${field.tag} es requerida`
    }
    return null
  }

  if (field.type === "string_list") {
    const items = Array.isArray(rawValue) ? rawValue : []
    const nonEmptyItems = items
      .map((item) => String(item ?? "").trim())
      .filter((item) => item.length > 0)

    if (field.required && nonEmptyItems.length === 0) {
      return `${field.tag} requiere al menos un elemento`
    }

    return null
  }

  if (field.type === "object_list") {
    const items = Array.isArray(rawValue) ? (rawValue as ObjectItemValue[]) : []

    if (field.required && items.length === 0) {
      return `${field.tag} requiere al menos un elemento`
    }

    return null
  }

  return getPrimitiveFieldError(field, rawValue)
}

function normalizePrimitiveForPayload(field: DocumentField, rawValue: unknown) {
  if (field.type === "checkbox") {
    return Boolean(rawValue)
  }

  if (rawValue === "" || rawValue === null || rawValue === undefined) {
    return undefined
  }

  if (field.type === "number") {
    return Number(rawValue)
  }

  if (field.type === "select") {
    const selectedOption = field.options?.find((option) => String(option.value) === String(rawValue))
    return selectedOption ? selectedOption.value : rawValue
  }

  return rawValue
}

export default function DownloadDocumentModal({
  documentId,
  documentRequestId = null,
  formProgressId = null,
  onSuccess,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: DownloadDocumentModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [documentDetails, setDocumentDetails] = useState<DocumentDetails | null>(null)
  const [sections, setSections] = useState<DocumentSection[]>([])
  const [values, setValues] = useState<FieldValues>({})
  const [listDrafts, setListDrafts] = useState<ListDraftValues>({})
  const [objectDrafts, setObjectDrafts] = useState<ObjectDraftValues>({})
  const [uploadingObjectFile, setUploadingObjectFile] = useState<Record<string, boolean>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [requestError, setRequestError] = useState<string | null>(null)
  const [users, setUsers] = useState<RoleUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState("")
  const currentUserId = useAuthStore((state) => state.getUserId())
  const currentRole = useAuthStore((state) => state.getRole())
  const isSuperAdmin = (currentRole?.name ?? "").trim().toLowerCase() === "super admin"

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen)
    }

    if (!nextOpen) {
      resetModalState()
    }

    onOpenChange?.(nextOpen)
  }

  const hasFields = sections.some((section) => section.fields.length > 0)
  const targetUserRoleId = documentDetails?.userType === "company" ? COMPANY_ROLE_ID : CLIENT_ROLE_ID

  const title = useMemo(() => {
    if (!documentDetails) return "Descargar documento"
    return `Descargar ${documentDetails.name}`
  }, [documentDetails])

  const resetModalState = () => {
    setLoading(false)
    setSubmitting(false)
    setDocumentDetails(null)
    setSections([])
    setValues({})
    setListDrafts({})
    setObjectDrafts({})
    setUploadingObjectFile({})
    setFieldErrors({})
    setRequestError(null)
    setUsers([])
    setSelectedUserId("")
  }

  useEffect(() => {
    if (!open) return

    const load = async () => {
      setLoading(true)
      setRequestError(null)

      try {
        const { data } = await api.get<StructureResponse>(`/api/documents/${documentId}`)
        const responseSections = normalizeSectionsFromStructure(data.structure, data.document.documentStructureId)

        const initialValues: FieldValues = {}
        const initialListDrafts: ListDraftValues = {}
        const initialObjectDrafts: ObjectDraftValues = {}

        responseSections.forEach((section) => {
          section.fields.forEach((field) => {
            initialValues[field.fieldKey] = getInitialValue(field)
            if (field.type === "string_list") {
              initialListDrafts[field.fieldKey] = ""
            }
            if (field.type === "object_list") {
              initialObjectDrafts[field.fieldKey] = defaultObjectDraft(field.objectFields)
            }
          })
        })

        setDocumentDetails(data.document)
        setSections(responseSections)
        setValues(initialValues)
        setListDrafts(initialListDrafts)
        setObjectDrafts(initialObjectDrafts)
        setFieldErrors({})
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "No fue posible cargar la estructura del documento"

        setRequestError(message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [documentId, open])

  useEffect(() => {
    if (!open) return

    if (!isSuperAdmin) {
      setUsers([])
      setSelectedUserId(currentUserId ?? "")
      return
    }

    if (!documentDetails?.userType) return

    const loadUsers = async () => {
      setSelectedUserId("")
      setLoadingUsers(true)
      try {
        const { data } = await api.get<RoleUser[]>(`/v1/staff/by-role/${targetUserRoleId}`)
        setUsers(data || [])
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "No fue posible cargar los usuarios del rol seleccionado"

        toast.error(message)
      } finally {
        setLoadingUsers(false)
      }
    }

    loadUsers()
  }, [currentUserId, documentDetails?.userType, isSuperAdmin, open, targetUserRoleId])

  const setFieldValue = (fieldKey: string, value: FieldValue) => {
    setValues((prev) => ({ ...prev, [fieldKey]: value }))
    setFieldErrors((prev) => {
      if (!prev[fieldKey]) return prev
      const next = { ...prev }
      delete next[fieldKey]
      return next
    })
  }

  const setListDraftValue = (fieldKey: string, value: string) => {
    setListDrafts((prev) => ({ ...prev, [fieldKey]: value }))
  }

  const addStringListItem = (fieldKey: string) => {
    const draft = String(listDrafts[fieldKey] ?? "").trim()
    if (!draft) return

    const current = Array.isArray(values[fieldKey]) ? (values[fieldKey] as string[]) : []
    setFieldValue(fieldKey, [...current, draft])
    setListDraftValue(fieldKey, "")
  }

  const removeStringListItem = (fieldKey: string, indexToRemove: number) => {
    const current = Array.isArray(values[fieldKey]) ? (values[fieldKey] as string[]) : []
    const next = current.filter((_, index) => index !== indexToRemove)
    setFieldValue(fieldKey, next)
  }

  const updateObjectDraftValue = (
    fieldKey: string,
    objectKey: string,
    value: string | number | boolean | ObjectFileValue
  ) => {
    setObjectDrafts((prev) => ({
      ...prev,
      [fieldKey]: { ...(prev[fieldKey] ?? {}), [objectKey]: value },
    }))
  }

  const handleObjectFileSelect = async (fieldKey: string, objectKey: string, file: File | null) => {
    if (!file) return

    const uploadKey = `${fieldKey}.${objectKey}`
    setUploadingObjectFile((prev) => ({ ...prev, [uploadKey]: true }))

    try {
      const formData = new FormData()
      formData.append("file", file)
      const { data } = await api.post<{ fileUrl: string; fileName: string }>(
        "/api/documents/upload-field-file",
        formData
      )
      updateObjectDraftValue(fieldKey, objectKey, { fileUrl: data.fileUrl, fileName: data.fileName })
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "No fue posible subir el archivo"
      toast.error(message)
    } finally {
      setUploadingObjectFile((prev) => ({ ...prev, [uploadKey]: false }))
    }
  }

  const addObjectListItem = (field: DocumentField) => {
    const objectFields = field.objectFields ?? []
    const draft = objectDrafts[field.fieldKey] ?? defaultObjectDraft(objectFields)

    const itemError = getObjectItemError(objectFields, draft)
    if (itemError) {
      toast.error(itemError)
      return
    }

    const current = Array.isArray(values[field.fieldKey]) ? (values[field.fieldKey] as ObjectItemValue[]) : []
    setFieldValue(field.fieldKey, [...current, draft])
    setObjectDrafts((prev) => ({ ...prev, [field.fieldKey]: defaultObjectDraft(objectFields) }))
  }

  const removeObjectListItem = (fieldKey: string, indexToRemove: number) => {
    const current = Array.isArray(values[fieldKey]) ? (values[fieldKey] as ObjectItemValue[]) : []
    const next = current.filter((_, index) => index !== indexToRemove)
    setFieldValue(fieldKey, next)
  }

  const handleFormKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Enter") return

    const target = event.target as HTMLElement
    const isTextArea = target instanceof HTMLTextAreaElement

    if (!isTextArea) {
      event.preventDefault()
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!documentDetails) return

    const nextErrors: Record<string, string> = {}

    for (const section of sections) {
      for (const field of section.fields) {
        const fieldError = getFieldError(field, values[field.fieldKey])
        if (fieldError) {
          nextErrors[field.fieldKey] = fieldError
        }
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      return
    }

    const payload = sections.reduce<Record<string, unknown>>((acc, section) => {
      section.fields.forEach((field) => {
        const rawValue = values[field.fieldKey]

        if (field.type === "yes_no_comment") {
          const yesNoValue = rawValue as YesNoValue
          acc[field.fieldKey] = {
            answer: yesNoValue?.answer ?? "NO",
            comment: yesNoValue?.comment ?? "",
          }
          return
        }

        if (field.type === "string_list") {
          const items = Array.isArray(rawValue) ? rawValue : []
          const normalizedList = items
            .map((item) => String(item ?? "").trim())
            .filter((item) => item.length > 0)
          acc[field.fieldKey] = normalizedList
          return
        }

        if (field.type === "object_list") {
          const items = Array.isArray(rawValue) ? (rawValue as ObjectItemValue[]) : []
          acc[field.fieldKey] = items.map((item) => {
            const normalizedItem: Record<string, unknown> = {}
            ;(field.objectFields ?? []).forEach((objectField) => {
              const itemValue = item[objectField.key]

              if (objectField.dataType === "number") {
                normalizedItem[objectField.key] =
                  itemValue === undefined || itemValue === "" ? undefined : Number(itemValue)
              } else if (objectField.dataType === "boolean") {
                normalizedItem[objectField.key] = Boolean(itemValue)
              } else if (objectField.dataType === "file") {
                normalizedItem[objectField.key] = itemValue ?? undefined
              } else {
                normalizedItem[objectField.key] = itemValue ?? ""
              }
            })
            return normalizedItem
          })
          return
        }

        const normalized = normalizePrimitiveForPayload(field, rawValue)
        if (normalized !== undefined) {
          acc[field.fieldKey] = normalized
        }
      })

      return acc
    }, {})

    if (!selectedUserId) {
      toast.error("Debes seleccionar un usuario")
      return
    }

    payload.userId = selectedUserId

    setSubmitting(true)
    setRequestError(null)

    try {
      await postDownloadDocumentFromEndpoint(
        documentDetails.downloadEndpoint,
        payload,
        documentDetails.key
      )

      if (documentRequestId) {
        try {
          if (formProgressId) {
            await api.patch(`/api/document-requests/${documentRequestId}/forms/${formProgressId}/status`, {
              status: "completed",
            })
          } else {
            await api.patch(`/api/document-requests/${documentRequestId}/status`, {
              status: "completed",
            })
          }
        } catch {
          toast.warn("El documento se genero, pero no fue posible actualizar la solicitud")
        }
      }

      await onSuccess?.()

      toast.success("Documento generado correctamente")
      handleOpenChange(false)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "No fue posible generar el documento"

      setRequestError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      ) : null}

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Completa los campos requeridos para generar y descargar el PDF.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando configuración del documento...</p>
        ) : requestError ? (
          <p className="text-sm text-destructive">{requestError}</p>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
            {isSuperAdmin ? (
              <div className="grid gap-2">
                <Label>Usuario</Label>
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                  disabled={!documentDetails || loadingUsers || submitting}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={loadingUsers ? "Cargando usuarios..." : "Selecciona un usuario"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user._id} value={user._id}>
                        {user.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {hasFields ? (
              sections.map((section, sectionIndex) => (
                <section className="rounded-lg border p-4" key={`${section.title}-${sectionIndex}`}>
                  <div className="mb-4 border-b pb-3">
                    <h3 className="text-base font-semibold">{section.title}</h3>
                    {section.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
                    ) : null}
                  </div>

                  <div className="space-y-4">
                    {section.fields.map((field) => {
                      const value = values[field.fieldKey]
                      const error = fieldErrors[field.fieldKey]

                      return (
                        <div className="grid gap-2" key={field.fieldKey}>
                          <Label htmlFor={field.fieldKey}>
                            {field.tag}
                            {field.required ? <span className="text-destructive"> *</span> : null}
                          </Label>

                          {field.type === "text" ? (
                            <Input
                              id={field.fieldKey}
                              value={String(value ?? "")}
                              onChange={(event) => setFieldValue(field.fieldKey, event.target.value)}
                              placeholder={field.placeholder || ""}
                              disabled={submitting}
                            />
                          ) : null}

                          {field.type === "number" ? (
                            <Input
                              id={field.fieldKey}
                              type="number"
                              value={String(value ?? "")}
                              onChange={(event) => setFieldValue(field.fieldKey, event.target.value)}
                              placeholder={field.placeholder || ""}
                              disabled={submitting}
                            />
                          ) : null}

                          {field.type === "date" ? (
                            <Input
                              id={field.fieldKey}
                              type="date"
                              value={String(value ?? "")}
                              onChange={(event) => setFieldValue(field.fieldKey, event.target.value)}
                              disabled={submitting}
                            />
                          ) : null}

                          {field.type === "textarea" ? (
                            <textarea
                              id={field.fieldKey}
                              value={String(value ?? "")}
                              onChange={(event) => setFieldValue(field.fieldKey, event.target.value)}
                              placeholder={field.placeholder || ""}
                              disabled={submitting}
                              rows={4}
                              className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          ) : null}

                          {field.type === "select" ? (
                            <Select
                              value={String(value ?? "")}
                              onValueChange={(nextValue) => setFieldValue(field.fieldKey, nextValue)}
                              disabled={submitting}
                            >
                              <SelectTrigger id={field.fieldKey}>
                                <SelectValue placeholder={field.placeholder || "Selecciona una opción"} />
                              </SelectTrigger>
                              <SelectContent>
                                {(field.options || []).map((option) => (
                                  <SelectItem key={`${field.fieldKey}-${String(option.value)}`} value={String(option.value)}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : null}

                          {field.type === "checkbox" ? (
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={field.fieldKey}
                                checked={Boolean(value)}
                                onCheckedChange={(checked) => setFieldValue(field.fieldKey, checked === true)}
                                disabled={submitting}
                              />
                              <Label htmlFor={field.fieldKey}>{field.placeholder || field.tag}</Label>
                            </div>
                          ) : null}

                          {field.type === "yes_no_comment" ? (
                            <div className="space-y-3 rounded-md border p-3">
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant={(value as YesNoValue | undefined)?.answer === "SI" ? "default" : "outline"}
                                  onClick={() => {
                                    const current = (value as YesNoValue | undefined) ?? { answer: "NO", comment: "" }
                                    setFieldValue(field.fieldKey, { ...current, answer: "SI" })
                                  }}
                                  disabled={submitting}
                                >
                                  Si
                                </Button>
                                <Button
                                  type="button"
                                  variant={(value as YesNoValue | undefined)?.answer === "NO" ? "default" : "outline"}
                                  onClick={() => {
                                    const current = (value as YesNoValue | undefined) ?? { answer: "NO", comment: "" }
                                    setFieldValue(field.fieldKey, { ...current, answer: "NO" })
                                  }}
                                  disabled={submitting}
                                >
                                  No
                                </Button>
                              </div>

                              <textarea
                                value={(value as YesNoValue | undefined)?.comment ?? ""}
                                onChange={(event) => {
                                  const current = (value as YesNoValue | undefined) ?? { answer: "NO", comment: "" }
                                  setFieldValue(field.fieldKey, { ...current, comment: event.target.value })
                                }}
                                placeholder={field.yesNoConfig?.commentPlaceholder || "Observaciones..."}
                                disabled={submitting}
                                rows={3}
                                className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                              />
                            </div>
                          ) : null}

                          {field.type === "string_list" ? (
                            <div className="space-y-3 rounded-md border p-3">
                              <div className="flex items-center gap-2">
                                <Input
                                  value={listDrafts[field.fieldKey] ?? ""}
                                  onChange={(event) => setListDraftValue(field.fieldKey, event.target.value)}
                                  placeholder={field.placeholder || "Escribe un elemento"}
                                  disabled={submitting}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addStringListItem(field.fieldKey)}
                                  disabled={submitting || !String(listDrafts[field.fieldKey] ?? "").trim()}
                                >
                                  <PlusCircleIcon className="size-4" />
                                  Agregar elemento
                                </Button>
                              </div>

                              <div className="space-y-2">
                                {(Array.isArray(value) ? (value as string[]) : []).map((item, itemIndex) => (
                                  <div
                                    key={`${field.fieldKey}-${itemIndex}`}
                                    className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
                                  >
                                    <p className="text-sm">{item}</p>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="shrink-0 text-destructive hover:text-destructive"
                                    onClick={() => removeStringListItem(field.fieldKey, itemIndex)}
                                    disabled={submitting}
                                  >
                                    <Trash2Icon className="size-4" />
                                  </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {field.type === "object_list" ? (
                            <div className="space-y-3 rounded-md border p-3">
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {(field.objectFields ?? []).map((objectField) => {
                                  const draftValue = objectDrafts[field.fieldKey]?.[objectField.key]
                                  const uploadKey = `${field.fieldKey}.${objectField.key}`
                                  const isUploading = Boolean(uploadingObjectFile[uploadKey])

                                  return (
                                    <div className="flex flex-col gap-1.5" key={objectField.key}>
                                      <Label>
                                        {objectField.tag}
                                        {objectField.required ? <span className="text-destructive"> *</span> : null}
                                      </Label>
                                      {objectField.description ? (
                                        <p className="text-xs text-muted-foreground">{objectField.description}</p>
                                      ) : null}

                                      {objectField.dataType === "string" ? (
                                        <Input
                                          value={String(draftValue ?? "")}
                                          onChange={(event) =>
                                            updateObjectDraftValue(field.fieldKey, objectField.key, event.target.value)
                                          }
                                          disabled={submitting}
                                        />
                                      ) : null}

                                      {objectField.dataType === "number" ? (
                                        <Input
                                          type="number"
                                          value={String(draftValue ?? "")}
                                          onChange={(event) =>
                                            updateObjectDraftValue(field.fieldKey, objectField.key, event.target.value)
                                          }
                                          disabled={submitting}
                                        />
                                      ) : null}

                                      {objectField.dataType === "boolean" ? (
                                        <div className="flex gap-2">
                                          <Button
                                            type="button"
                                            variant={draftValue === true ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => updateObjectDraftValue(field.fieldKey, objectField.key, true)}
                                            disabled={submitting}
                                          >
                                            Si
                                          </Button>
                                          <Button
                                            type="button"
                                            variant={draftValue === false || draftValue === undefined ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => updateObjectDraftValue(field.fieldKey, objectField.key, false)}
                                            disabled={submitting}
                                          >
                                            No
                                          </Button>
                                        </div>
                                      ) : null}

                                      {objectField.dataType === "file" ? (
                                        <div className="flex flex-col gap-1">
                                          <Input
                                            type="file"
                                            onChange={(event) =>
                                              handleObjectFileSelect(
                                                field.fieldKey,
                                                objectField.key,
                                                event.target.files?.[0] ?? null
                                              )
                                            }
                                            disabled={submitting || isUploading}
                                          />
                                          {isUploading ? (
                                            <p className="text-xs text-muted-foreground">Subiendo archivo...</p>
                                          ) : (draftValue as ObjectFileValue | undefined)?.fileName ? (
                                            <p className="text-xs text-muted-foreground">
                                              {(draftValue as ObjectFileValue).fileName}
                                            </p>
                                          ) : null}
                                        </div>
                                      ) : null}
                                    </div>
                                  )
                                })}
                              </div>

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addObjectListItem(field)}
                                disabled={submitting}
                              >
                                <PlusCircleIcon className="size-4" />
                                Agregar elemento
                              </Button>

                              <div className="space-y-2">
                                {(Array.isArray(value) ? (value as ObjectItemValue[]) : []).map((item, itemIndex) => (
                                  <div
                                    key={`${field.fieldKey}-${itemIndex}`}
                                    className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
                                  >
                                    <p className="text-sm">
                                      {(field.objectFields ?? [])
                                        .map((objectField) => {
                                          const itemValue = item[objectField.key]
                                          if (objectField.dataType === "boolean") {
                                            return `${objectField.tag}: ${itemValue ? "Si" : "No"}`
                                          }
                                          if (objectField.dataType === "file") {
                                            return `${objectField.tag}: ${(itemValue as ObjectFileValue | undefined)?.fileName ?? "-"}`
                                          }
                                          return `${objectField.tag}: ${itemValue ?? "-"}`
                                        })
                                        .join(" · ")}
                                    </p>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="shrink-0 text-destructive hover:text-destructive"
                                      onClick={() => removeObjectListItem(field.fieldKey, itemIndex)}
                                      disabled={submitting}
                                    >
                                      <Trash2Icon className="size-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {error ? <p className="text-sm text-destructive">{error}</p> : null}
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Este documento no requiere datos adicionales. Puedes generar el PDF directamente.
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  handleOpenChange(false)
                  resetModalState()
                }}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Generando..." : "Generar y descargar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
