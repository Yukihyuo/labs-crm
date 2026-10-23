import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { PlusIcon } from 'lucide-react'
import api from '@/utils/api'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'

type ApiUserRole = 'client' | 'company'

const CLIENT_ROLE_ID = '6a156a603a5d7ea978fbb13c'
const COMPANY_ROLE_ID = '6a156a6d3a5d7ea978fbb13d'

type UserRoleId = typeof CLIENT_ROLE_ID | typeof COMPANY_ROLE_ID

interface RoleUser {
  _id: string
  label: string
  subtitle?: string
}

interface DocumentItem {
  _id: string
  key: string
  name: string
  downloadEndpoint: string
  userType: ApiUserRole
  status: boolean
}

interface UploadCatalogItem {
  _id: string
  key: string
  title: string
  description?: string
  maxSizeMB: number
  isActive: boolean
}

interface PresetAttachment {
  title: string
  fileUrl: string
  description?: string
}

interface DocumentFolderPresetItem {
  _id: string
  title: string
  userType: ApiUserRole
  uploads: UploadCatalogItem[]
  documents: DocumentItem[]
  attachments: PresetAttachment[]
  isActive: boolean
}

interface DocumentFoldersOverview {
  uploads: UploadCatalogItem[]
  documents: DocumentItem[]
  presets: DocumentFolderPresetItem[]
}

interface NewDownloadRequestProps {
  onSuccess?: () => void | Promise<void>
}

function normalizeRoleById(roleId: UserRoleId): ApiUserRole {
  return roleId === COMPANY_ROLE_ID ? 'company' : 'client'
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export default function NewDownloadRequest({ onSuccess }: NewDownloadRequestProps) {
  const [open, setOpen] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingOverview, setLoadingOverview] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [selectedRoleId, setSelectedRoleId] = useState<UserRoleId | ''>('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [assignedAdminEmail, setAssignedAdminEmail] = useState('')
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [users, setUsers] = useState<RoleUser[]>([])
  const [presets, setPresets] = useState<DocumentFolderPresetItem[]>([])
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [uploads, setUploads] = useState<UploadCatalogItem[]>([])
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([])
  const [selectedUploadIds, setSelectedUploadIds] = useState<string[]>([])

  const selectedPreset = useMemo(
    () => presets.find((preset) => preset._id === selectedPresetId) ?? null,
    [presets, selectedPresetId]
  )

  const filteredDocuments = useMemo(() => {
    if (!selectedRoleId) return []
    const role = normalizeRoleById(selectedRoleId)
    return documents.filter((document) => document.userType === role)
  }, [documents, selectedRoleId])

  const visiblePresets = useMemo(() => {
    if (!selectedRoleId) return []
    const role = normalizeRoleById(selectedRoleId)
    return presets.filter((preset) => preset.userType === role)
  }, [presets, selectedRoleId])

  const resetState = () => {
    setSelectedRoleId('')
    setSelectedUserId('')
    setAssignedAdminEmail('')
    setSelectedPresetId('')
    setUsers([])
    setPresets([])
    setDocuments([])
    setUploads([])
    setSelectedDocumentIds([])
    setSelectedUploadIds([])
  }

  useEffect(() => {
    if (!open) return

    const loadOverview = async () => {
      setLoadingOverview(true)
      try {
        const { data } = await api.get<DocumentFoldersOverview>('/api/document-folders/overview')
        setPresets(data.presets ?? [])
        setDocuments(data.documents ?? [])
        setUploads(data.uploads ?? [])
      } catch (err: unknown) {
        console.error(err)
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'No fue posible cargar la configuracion de carpetas documentales'
        toast.error(message)
      } finally {
        setLoadingOverview(false)
      }
    }

    loadOverview()
  }, [open])

  const handleRoleChange = async (roleId: UserRoleId) => {
    setSelectedRoleId(roleId)
    setSelectedUserId('')
    setSelectedPresetId('')
    setSelectedDocumentIds([])
    setSelectedUploadIds([])
    setUsers([])
    setLoadingUsers(true)

    try {
      const { data } = await api.get<RoleUser[]>(`/v1/staff/by-role/${roleId}`)
      setUsers(data || [])
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No fue posible cargar los usuarios del rol seleccionado'
      toast.error(message)
    } finally {
      setLoadingUsers(false)
    }
  }

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId)

    const preset = presets.find((item) => item._id === presetId)
    if (!preset) {
      setSelectedDocumentIds([])
      setSelectedUploadIds([])
      return
    }

    setSelectedDocumentIds(preset.documents.map((document) => document._id))
    setSelectedUploadIds(preset.uploads.map((upload) => upload._id))
  }

  const toggleDocument = (documentId: string, checked: boolean) => {
    setSelectedDocumentIds((prev) => {
      if (checked) {
        if (prev.includes(documentId)) return prev
        return [...prev, documentId]
      }

      return prev.filter((id) => id !== documentId)
    })
  }

  const toggleUpload = (uploadId: string, checked: boolean) => {
    setSelectedUploadIds((prev) => {
      if (checked) {
        if (prev.includes(uploadId)) return prev
        return [...prev, uploadId]
      }

      return prev.filter((id) => id !== uploadId)
    })
  }

  const handleSubmit = async () => {
    if (!selectedRoleId) {
      toast.error('Debes seleccionar un tipo de usuario')
      return
    }

    if (!selectedUserId) {
      toast.error('Debes seleccionar un usuario')
      return
    }

    if (!assignedAdminEmail.trim() || !isValidEmail(assignedAdminEmail)) {
      toast.error('Debes ingresar un correo de administrador valido')
      return
    }

    if (selectedDocumentIds.length === 0 && selectedUploadIds.length === 0) {
      toast.error('Debes seleccionar al menos un formulario o un archivo por subir')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/api/document-requests', {
        userId: selectedUserId,
        assignedAdminEmail: assignedAdminEmail.trim(),
        selectedDocumentIds,
        selectedUploadIds,
        attachments: selectedPreset?.attachments ?? [],
        presetId: selectedPreset?._id,
      })

      toast.success('Expediente creado correctamente')
      await onSuccess?.()
      setOpen(false)
      resetState()
    } catch (err: unknown) {
      console.error(err)
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No fue posible crear las solicitudes'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) resetState()
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <PlusIcon className="mr-2 h-4 w-4" />
          Nueva solicitud
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[92vh] overflow-hidden p-0 sm:max-w-6xl">
        <div className="flex h-full max-h-[92vh] flex-col">
          <DialogHeader className="border-b px-6 pt-6 pb-4">
            <DialogTitle>Nueva solicitud de documentos</DialogTitle>
            <DialogDescription>
              Crea un expediente agrupado con formularios, archivos por subir y anexos del administrador.
            </DialogDescription>
          </DialogHeader>

          <div className="grid flex-1 gap-6 overflow-y-auto px-6 py-5 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Tipo de usuario</Label>
                <Select value={selectedRoleId} onValueChange={(value) => void handleRoleChange(value as UserRoleId)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CLIENT_ROLE_ID}>Persona Física</SelectItem>
                    <SelectItem value={COMPANY_ROLE_ID}>Persona Moral</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Usuario</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={!selectedRoleId || loadingUsers}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingUsers ? 'Cargando usuarios...' : 'Selecciona un usuario'} />
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

              <div className="grid gap-2">
                <Label htmlFor="assignedAdminEmail">Correo del administrador responsable</Label>
                <Input
                  id="assignedAdminEmail"
                  type="email"
                  value={assignedAdminEmail}
                  onChange={(event) => setAssignedAdminEmail(event.target.value)}
                  placeholder="admin@empresa.com"
                />
              </div>

              <div className="grid gap-2">
                <Label>Preset de expediente</Label>
                <Select
                  value={selectedPresetId}
                  onValueChange={handlePresetChange}
                  disabled={!selectedRoleId || loadingOverview || visiblePresets.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !selectedRoleId
                          ? 'Selecciona un tipo de usuario'
                          : loadingOverview
                            ? 'Cargando presets...'
                            : visiblePresets.length === 0
                              ? 'No hay presets para este tipo'
                              : 'Selecciona un preset'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {visiblePresets.map((preset) => (
                      <SelectItem key={preset._id} value={preset._id}>
                        {preset.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedPreset ? (
                <div className="grid gap-2 rounded-md border p-3">
                  <Label>Anexos del preset</Label>
                  {selectedPreset.attachments.length > 0 ? (
                    selectedPreset.attachments.map((attachment, index) => (
                      <div key={`${attachment.title}-${index}`} className="rounded-md border p-2">
                        <p className="font-medium">{attachment.title}</p>
                        <p className="text-xs text-muted-foreground">{attachment.fileUrl}</p>
                        {attachment.description ? (
                          <p className="text-xs text-muted-foreground">{attachment.description}</p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Este preset no tiene anexos.</p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Formularios por llenar</Label>
                  <span className="text-xs text-muted-foreground">{selectedDocumentIds.length} seleccionado(s)</span>
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
                  {loadingOverview ? (
                    <p className="text-sm text-muted-foreground">Cargando formularios...</p>
                  ) : !selectedRoleId ? (
                    <p className="text-sm text-muted-foreground">
                      Selecciona un tipo de usuario para ver formularios
                    </p>
                  ) : filteredDocuments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay formularios disponibles</p>
                  ) : (
                    filteredDocuments.map((document) => {
                      const checked = selectedDocumentIds.includes(document._id)

                      return (
                        <div key={document._id} className="flex items-start gap-3 rounded-md border p-2">
                          <Checkbox
                            id={`document-${document._id}`}
                            checked={checked}
                            onCheckedChange={(value) => toggleDocument(document._id, value === true)}
                          />
                          <div className="flex-1">
                            <Label htmlFor={`document-${document._id}`} className="cursor-pointer font-medium">
                              {document.name}
                            </Label>
                            <p className="text-xs text-muted-foreground">{document.key}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Archivos por subir</Label>
                  <span className="text-xs text-muted-foreground">{selectedUploadIds.length} seleccionado(s)</span>
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
                  {loadingOverview ? (
                    <p className="text-sm text-muted-foreground">Cargando requisitos...</p>
                  ) : uploads.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay requisitos de subida disponibles</p>
                  ) : (
                    uploads.map((upload) => {
                      const checked = selectedUploadIds.includes(upload._id)

                      return (
                        <div key={upload._id} className="flex items-start gap-3 rounded-md border p-2">
                          <Checkbox
                            id={`upload-${upload._id}`}
                            checked={checked}
                            onCheckedChange={(value) => toggleUpload(upload._id, value === true)}
                          />
                          <div className="flex-1">
                            <Label htmlFor={`upload-${upload._id}`} className="cursor-pointer font-medium">
                              {upload.title}
                            </Label>
                            <p className="text-xs text-muted-foreground">{upload.description || upload.key}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t bg-background px-6 py-4">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
