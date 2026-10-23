import React, { useState } from "react"
import { ArrowDownIcon, ArrowUpIcon, PlusCircleIcon, PlusIcon, Trash2Icon } from "lucide-react"
import api from "@/utils/api"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

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

interface FieldOption {
  label: string
  value: string | number | boolean
}

interface YesNoConfig {
  commentPlaceholder: string
  commentRequired: boolean
}

interface ObjectFieldConfig {
  key: string
  tag: string
  description: string
  dataType: ObjectFieldDataType
  required: boolean
}

interface FieldConfig {
  fieldKey: string
  tag: string
  type: FieldType
  required: boolean
  placeholder: string
  options: FieldOption[]
  yesNoConfig?: YesNoConfig
  objectFields?: ObjectFieldConfig[]
}

interface SectionConfig {
  title: string
  description: string
  fields: FieldConfig[]
}

interface DocumentForm {
  key: string
  name: string
  downloadEndpoint: string
  status: boolean
  structureTitle: string
}

const FIELD_TYPES: { label: string; value: FieldType }[] = [
  { label: "Texto", value: "text" },
  { label: "Numero", value: "number" },
  { label: "Fecha", value: "date" },
  { label: "Lista desplegable", value: "select" },
  { label: "Casilla de verificacion", value: "checkbox" },
  { label: "Area de texto", value: "textarea" },
  { label: "Si/No con observaciones", value: "yes_no_comment" },
  { label: "Lista dinamica de texto", value: "string_list" },
  { label: "Lista de objetos", value: "object_list" },
]

const OBJECT_FIELD_DATA_TYPES: { label: string; value: ObjectFieldDataType }[] = [
  { label: "Texto", value: "string" },
  { label: "Numero", value: "number" },
  { label: "Si/No", value: "boolean" },
  { label: "Archivo", value: "file" },
]

function emptyYesNoConfig(): YesNoConfig {
  return {
    commentPlaceholder: "Observaciones...",
    commentRequired: false,
  }
}

function emptyObjectField(): ObjectFieldConfig {
  return {
    key: "",
    tag: "",
    description: "",
    dataType: "string",
    required: false,
  }
}

function emptyField(): FieldConfig {
  return {
    fieldKey: "",
    tag: "",
    type: "text",
    required: false,
    placeholder: "",
    options: [],
  }
}

function emptySection(sectionNumber: number): SectionConfig {
  return {
    title: `Seccion ${sectionNumber}`,
    description: "",
    fields: [emptyField()],
  }
}

interface NewDocumentModalProps {
  onSuccess?: () => void
}

export default function NewDocumentModal({ onSuccess }: NewDocumentModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<DocumentForm>({
    key: "",
    name: "",
    downloadEndpoint: "",
    status: true,
    structureTitle: "",
  })

  const [sections, setSections] = useState<SectionConfig[]>([emptySection(1)])

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }))
  }

  function updateFieldType(field: FieldConfig, nextType: FieldType): FieldConfig {
    return {
      ...field,
      type: nextType,
      options: nextType === "select" ? field.options ?? [] : [],
      yesNoConfig:
        nextType === "yes_no_comment"
          ? field.yesNoConfig ?? emptyYesNoConfig()
          : undefined,
      objectFields:
        nextType === "object_list"
          ? field.objectFields && field.objectFields.length > 0
            ? field.objectFields
            : [emptyObjectField()]
          : undefined,
    }
  }

  function handleFieldChange(
    sectionIndex: number,
    fieldIndex: number,
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value, type } = event.target
    const checked = (event.target as HTMLInputElement).checked

    setSections((prev) =>
      prev.map((section, currentSectionIndex) =>
        currentSectionIndex === sectionIndex
          ? {
              ...section,
              fields: section.fields.map((field, currentFieldIndex) => {
                if (currentFieldIndex !== fieldIndex) return field

                if (name === "type") {
                  return updateFieldType(field, value as FieldType)
                }

                return { ...field, [name]: type === "checkbox" ? checked : value }
              }),
            }
          : section
      )
    )
  }

  function addSection() {
    setSections((prev) => [...prev, emptySection(prev.length + 1)])
  }

  function removeSection(sectionIndex: number) {
    setSections((prev) => prev.filter((_, index) => index !== sectionIndex))
  }

  function moveSection(sectionIndex: number, direction: -1 | 1) {
    setSections((prev) => {
      const nextIndex = sectionIndex + direction
      if (nextIndex < 0 || nextIndex >= prev.length) {
        return prev
      }

      const next = [...prev]
      const current = next[sectionIndex]
      next[sectionIndex] = next[nextIndex]
      next[nextIndex] = current
      return next
    })
  }

  function handleSectionChange(sectionIndex: number, key: "title" | "description", value: string) {
    setSections((prev) =>
      prev.map((section, currentIndex) =>
        currentIndex === sectionIndex ? { ...section, [key]: value } : section
      )
    )
  }

  function addField(sectionIndex: number) {
    setSections((prev) =>
      prev.map((section, currentIndex) =>
        currentIndex === sectionIndex
          ? { ...section, fields: [...section.fields, emptyField()] }
          : section
      )
    )
  }

  function removeField(sectionIndex: number, fieldIndex: number) {
    setSections((prev) =>
      prev.map((section, currentIndex) =>
        currentIndex === sectionIndex
          ? { ...section, fields: section.fields.filter((_, index) => index !== fieldIndex) }
          : section
      )
    )
  }

  function moveField(sectionIndex: number, fieldIndex: number, direction: -1 | 1) {
    setSections((prev) =>
      prev.map((section, currentSectionIndex) => {
        if (currentSectionIndex !== sectionIndex) {
          return section
        }

        const nextIndex = fieldIndex + direction
        if (nextIndex < 0 || nextIndex >= section.fields.length) {
          return section
        }

        const nextFields = [...section.fields]
        const current = nextFields[fieldIndex]
        nextFields[fieldIndex] = nextFields[nextIndex]
        nextFields[nextIndex] = current

        return { ...section, fields: nextFields }
      })
    )
  }

  function addOption(sectionIndex: number, fieldIndex: number) {
    setSections((prev) =>
      prev.map((section, currentSectionIndex) =>
        currentSectionIndex === sectionIndex
          ? {
              ...section,
              fields: section.fields.map((field, currentFieldIndex) =>
                currentFieldIndex === fieldIndex
                  ? { ...field, options: [...field.options, { label: "", value: "" }] }
                  : field
              ),
            }
          : section
      )
    )
  }

  function removeOption(sectionIndex: number, fieldIndex: number, optionIndex: number) {
    setSections((prev) =>
      prev.map((section, currentSectionIndex) =>
        currentSectionIndex === sectionIndex
          ? {
              ...section,
              fields: section.fields.map((field, currentFieldIndex) =>
                currentFieldIndex === fieldIndex
                  ? {
                      ...field,
                      options: field.options.filter((_, currentOptionIndex) => currentOptionIndex !== optionIndex),
                    }
                  : field
              ),
            }
          : section
      )
    )
  }

  function handleOptionChange(
    sectionIndex: number,
    fieldIndex: number,
    optionIndex: number,
    key: "label" | "value",
    value: string
  ) {
    setSections((prev) =>
      prev.map((section, currentSectionIndex) =>
        currentSectionIndex === sectionIndex
          ? {
              ...section,
              fields: section.fields.map((field, currentFieldIndex) =>
                currentFieldIndex === fieldIndex
                  ? {
                      ...field,
                      options: field.options.map((option, currentOptionIndex) =>
                        currentOptionIndex === optionIndex ? { ...option, [key]: value } : option
                      ),
                    }
                  : field
              ),
            }
          : section
      )
    )
  }

  function updateYesNoConfig(
    sectionIndex: number,
    fieldIndex: number,
    patch: Partial<YesNoConfig>
  ) {
    setSections((prev) =>
      prev.map((section, currentSectionIndex) =>
        currentSectionIndex === sectionIndex
          ? {
              ...section,
              fields: section.fields.map((field, currentFieldIndex) =>
                currentFieldIndex === fieldIndex
                  ? {
                      ...field,
                      yesNoConfig: {
                        ...(field.yesNoConfig ?? emptyYesNoConfig()),
                        ...patch,
                      },
                    }
                  : field
              ),
            }
          : section
      )
    )
  }

  function addObjectField(sectionIndex: number, fieldIndex: number) {
    setSections((prev) =>
      prev.map((section, currentSectionIndex) =>
        currentSectionIndex === sectionIndex
          ? {
              ...section,
              fields: section.fields.map((field, currentFieldIndex) =>
                currentFieldIndex === fieldIndex
                  ? { ...field, objectFields: [...(field.objectFields ?? []), emptyObjectField()] }
                  : field
              ),
            }
          : section
      )
    )
  }

  function removeObjectField(sectionIndex: number, fieldIndex: number, objectFieldIndex: number) {
    setSections((prev) =>
      prev.map((section, currentSectionIndex) =>
        currentSectionIndex === sectionIndex
          ? {
              ...section,
              fields: section.fields.map((field, currentFieldIndex) =>
                currentFieldIndex === fieldIndex
                  ? {
                      ...field,
                      objectFields: (field.objectFields ?? []).filter(
                        (_, currentObjectFieldIndex) => currentObjectFieldIndex !== objectFieldIndex
                      ),
                    }
                  : field
              ),
            }
          : section
      )
    )
  }

  function handleObjectFieldChange(
    sectionIndex: number,
    fieldIndex: number,
    objectFieldIndex: number,
    patch: Partial<ObjectFieldConfig>
  ) {
    setSections((prev) =>
      prev.map((section, currentSectionIndex) =>
        currentSectionIndex === sectionIndex
          ? {
              ...section,
              fields: section.fields.map((field, currentFieldIndex) =>
                currentFieldIndex === fieldIndex
                  ? {
                      ...field,
                      objectFields: (field.objectFields ?? []).map((objectField, currentObjectFieldIndex) =>
                        currentObjectFieldIndex === objectFieldIndex ? { ...objectField, ...patch } : objectField
                      ),
                    }
                  : field
              ),
            }
          : section
      )
    )
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.post("/api/documents", { ...form, sections })
      setOpen(false)
      resetForm()
      onSuccess?.()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Error al crear el documento"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setForm({ key: "", name: "", downloadEndpoint: "", status: true, structureTitle: "" })
    setSections([emptySection(1)])
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetForm() }}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon />
          Nuevo documento
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo documento</DialogTitle>
          <DialogDescription>
            Define los datos del documento y los campos que necesitara el formulario de generacion de PDF.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <section className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Datos del documento
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" name="name" value={form.name} onChange={handleFormChange} required />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="key">Clave unica (key)</Label>
                <Input id="key" name="key" value={form.key} onChange={handleFormChange} required />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="downloadEndpoint">Endpoint de descarga</Label>
                <Input
                  id="downloadEndpoint"
                  name="downloadEndpoint"
                  value={form.downloadEndpoint}
                  onChange={handleFormChange}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="structureTitle">Titulo de la estructura</Label>
                <Input
                  id="structureTitle"
                  name="structureTitle"
                  value={form.structureTitle}
                  onChange={handleFormChange}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="status"
                  name="status"
                  type="checkbox"
                  checked={form.status}
                  onChange={handleFormChange}
                  className="size-4 rounded border"
                />
                <Label htmlFor="status">Activo</Label>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Secciones del formulario
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={addSection}>
                <PlusCircleIcon className="size-4" />
                Agregar seccion
              </Button>
            </div>

            <div className="flex flex-col gap-4">
              {sections.map((section, sectionIndex) => (
                <div key={sectionIndex} className="rounded-lg border p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Seccion #{sectionIndex + 1}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => moveSection(sectionIndex, -1)}
                        disabled={sectionIndex === 0}
                      >
                        <ArrowUpIcon className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => moveSection(sectionIndex, 1)}
                        disabled={sectionIndex === sections.length - 1}
                      >
                        <ArrowDownIcon className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeSection(sectionIndex)}
                        disabled={sections.length === 1}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label>Titulo de seccion</Label>
                      <Input
                        value={section.title}
                        onChange={(event) => handleSectionChange(sectionIndex, "title", event.target.value)}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Descripcion</Label>
                      <Input
                        value={section.description}
                        onChange={(event) => handleSectionChange(sectionIndex, "description", event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-muted-foreground">Campos</h4>
                    <Button type="button" variant="outline" size="sm" onClick={() => addField(sectionIndex)}>
                      <PlusCircleIcon className="size-4" />
                      Agregar campo
                    </Button>
                  </div>

                  <div className="mt-3 flex flex-col gap-3">
                    {section.fields.map((field, fieldIndex) => (
                      <FieldRow
                        key={`${sectionIndex}-${fieldIndex}`}
                        index={fieldIndex}
                        field={field}
                        onChange={(event) => handleFieldChange(sectionIndex, fieldIndex, event)}
                        onRemove={() => removeField(sectionIndex, fieldIndex)}
                        onMoveUp={() => moveField(sectionIndex, fieldIndex, -1)}
                        onMoveDown={() => moveField(sectionIndex, fieldIndex, 1)}
                        canMoveUp={fieldIndex > 0}
                        canMoveDown={fieldIndex < section.fields.length - 1}
                        canRemove={section.fields.length > 1}
                        onAddOption={() => addOption(sectionIndex, fieldIndex)}
                        onRemoveOption={(optionIndex) => removeOption(sectionIndex, fieldIndex, optionIndex)}
                        onOptionChange={(optionIndex, key, value) =>
                          handleOptionChange(sectionIndex, fieldIndex, optionIndex, key, value)
                        }
                        onYesNoConfigChange={(patch) => updateYesNoConfig(sectionIndex, fieldIndex, patch)}
                        onAddObjectField={() => addObjectField(sectionIndex, fieldIndex)}
                        onRemoveObjectField={(objectFieldIndex) =>
                          removeObjectField(sectionIndex, fieldIndex, objectFieldIndex)
                        }
                        onObjectFieldChange={(objectFieldIndex, patch) =>
                          handleObjectFieldChange(sectionIndex, fieldIndex, objectFieldIndex, patch)
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm() }} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Crear documento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface FieldRowProps {
  index: number
  field: FieldConfig
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  canRemove: boolean
  onAddOption: () => void
  onRemoveOption: (optionIndex: number) => void
  onOptionChange: (optionIndex: number, key: "label" | "value", value: string) => void
  onYesNoConfigChange: (patch: Partial<YesNoConfig>) => void
  onAddObjectField: () => void
  onRemoveObjectField: (objectFieldIndex: number) => void
  onObjectFieldChange: (objectFieldIndex: number, patch: Partial<ObjectFieldConfig>) => void
}

function FieldRow({
  index,
  field,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  canRemove,
  onAddOption,
  onRemoveOption,
  onOptionChange,
  onYesNoConfigChange,
  onAddObjectField,
  onRemoveObjectField,
  onObjectFieldChange,
}: FieldRowProps) {
  return (
    <div className="relative flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Campo #{index + 1}</span>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onMoveUp} disabled={!canMoveUp}>
            <ArrowUpIcon className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onMoveDown} disabled={!canMoveDown}>
            <ArrowDownIcon className="size-4" />
          </Button>
          {canRemove ? (
            <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-destructive hover:text-destructive">
              <Trash2Icon className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Clave del campo (fieldKey)</Label>
          <Input name="fieldKey" value={field.fieldKey} onChange={onChange} required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Etiqueta (tag)</Label>
          <Input name="tag" value={field.tag} onChange={onChange} required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Tipo de campo</Label>
          <select
            name="type"
            value={field.type}
            onChange={onChange}
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1"
          >
            {FIELD_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Placeholder</Label>
          <Input name="placeholder" value={field.placeholder} onChange={onChange} />
        </div>

        <div className="flex items-center gap-2 sm:col-span-2">
          <input name="required" type="checkbox" checked={field.required} onChange={onChange} className="size-4 rounded border" />
          <Label>Campo obligatorio</Label>
        </div>
      </div>

      {field.type === "yes_no_comment" ? (
        <div className="mt-1 flex flex-col gap-2 border-t pt-2">
          <span className="text-xs font-medium text-muted-foreground">Configuracion Si/No con observaciones</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Placeholder de observaciones</Label>
              <Input
                value={field.yesNoConfig?.commentPlaceholder ?? "Observaciones..."}
                onChange={(event) => onYesNoConfigChange({ commentPlaceholder: event.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                checked={Boolean(field.yesNoConfig?.commentRequired)}
                onChange={(event) => onYesNoConfigChange({ commentRequired: event.target.checked })}
                className="size-4 rounded border"
              />
              <Label>Observacion obligatoria</Label>
            </div>
          </div>
        </div>
      ) : null}

      {field.type === "select" ? (
        <div className="mt-1 flex flex-col gap-2 border-t pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Opciones del desplegable</span>
            <Button type="button" variant="outline" size="sm" onClick={onAddOption}>
              <PlusIcon className="size-3" />
              Opcion
            </Button>
          </div>

          {field.options.map((option, optionIndex) => (
            <div key={optionIndex} className="flex items-center gap-2">
              <Input
                placeholder="Etiqueta"
                value={option.label}
                onChange={(event) => onOptionChange(optionIndex, "label", event.target.value)}
                required
              />
              <Input
                placeholder="Valor"
                value={String(option.value)}
                onChange={(event) => onOptionChange(optionIndex, "value", event.target.value)}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemoveOption(optionIndex)}
                className="shrink-0 text-destructive hover:text-destructive"
              >
                <Trash2Icon className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {field.type === "object_list" ? (
        <div className="mt-1 flex flex-col gap-2 border-t pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Campos del objeto (cada elemento de la lista tendra estos campos)
            </span>
            <Button type="button" variant="outline" size="sm" onClick={onAddObjectField}>
              <PlusIcon className="size-3" />
              Campo
            </Button>
          </div>

          {(field.objectFields ?? []).map((objectField, objectFieldIndex) => (
            <div key={objectFieldIndex} className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Clave (key)</Label>
                <Input
                  value={objectField.key}
                  onChange={(event) => onObjectFieldChange(objectFieldIndex, { key: event.target.value })}
                  placeholder="Ej: doc, name, qty"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Etiqueta (tag)</Label>
                <Input
                  value={objectField.tag}
                  onChange={(event) => onObjectFieldChange(objectFieldIndex, { tag: event.target.value })}
                  placeholder="Ej: Documento"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label>Descripcion (ayuda para el formulario)</Label>
                <Input
                  value={objectField.description}
                  onChange={(event) => onObjectFieldChange(objectFieldIndex, { description: event.target.value })}
                  placeholder="Descripcion opcional"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Tipo de dato</Label>
                <select
                  value={objectField.dataType}
                  onChange={(event) =>
                    onObjectFieldChange(objectFieldIndex, { dataType: event.target.value as ObjectFieldDataType })
                  }
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1"
                >
                  {OBJECT_FIELD_DATA_TYPES.map((dataType) => (
                    <option key={dataType.value} value={dataType.value}>
                      {dataType.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={objectField.required}
                    onChange={(event) => onObjectFieldChange(objectFieldIndex, { required: event.target.checked })}
                    className="size-4 rounded border"
                  />
                  <Label>Obligatorio</Label>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveObjectField(objectFieldIndex)}
                  className="shrink-0 text-destructive hover:text-destructive"
                  disabled={(field.objectFields ?? []).length <= 1}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
