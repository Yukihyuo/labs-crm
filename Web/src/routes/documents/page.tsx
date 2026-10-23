import { Suspense, use, useState } from 'react'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import NewDocumentModal from "@/components/documents/NewDocumentModal"
import EditDocumentModal from '@/components/documents/EditDocumentModal'
import NewDownloadRequest from '@/components/documents/NewDownloadRequest'
import DownloadDocumentModal from '@/components/documents/DownloadDocumentModal'
import api from "@/utils/api"
import { downloadDocumentFromEndpoint } from '@/utils/api'
import { PageHeader } from '@/components/global/PageHeader'
import { File, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'react-toastify'

interface DocumentItem {
  _id: string
  documentStructureId: string
  key: string
  name: string
  downloadEndpoint: string
  userType: "client" | "company"
  status: boolean
  createdAt: string
  updatedAt: string
}

interface DocumentsResponse {
  documents: DocumentItem[]
  error: string | null
}

async function getDocuments(): Promise<DocumentsResponse> {
  try {
    const { data } = await api.get<DocumentItem[]>("/api/documents")
    return { documents: data, error: null }
  } catch (err: unknown) {
    const message =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      "No fue posible cargar los documentos"

    return { documents: [], error: message }
  }
}

export default function Home() {
  const [documentsPromise, setDocumentsPromise] = useState<Promise<DocumentsResponse>>(() => getDocuments())
  const refreshDocuments = () => setDocumentsPromise(getDocuments())

  return (
    <div className="space-y-6">
      <PageHeader
        title='Documentos'
        description='Pagina para poder ver los documentos'
        icon={<File size={20} />}
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Documents' },
        ]}
        actions={
          <div className='flex items-center gap-2'>
            <NewDownloadRequest />
            <NewDocumentModal onSuccess={refreshDocuments} />
          </div>
        }
      />

      <Suspense fallback={(
        <p className='text-sm text-muted-foreground'>Cargando documentos...</p>
      )}>
        <DocumentsContent documentsPromise={documentsPromise} onRefresh={refreshDocuments} />
      </Suspense>
    </div>
  )
}

interface DocumentsContentProps {
  documentsPromise: Promise<DocumentsResponse>
  onRefresh: () => void
}

function DocumentsContent({ documentsPromise, onRefresh }: DocumentsContentProps) {
  const { documents, error } = use(documentsPromise)

  if (error) {
    return <p className='text-sm text-destructive'>{error}</p>
  }

  return <DocumentsTable documents={documents} onRefresh={onRefresh} />
}

interface DocumentsTableProps {
  documents: DocumentItem[]
  onRefresh: () => void
}

function DocumentsTable({ documents, onRefresh }: DocumentsTableProps) {
  const [globalFilter, setGlobalFilter] = useState('')

  const columns: ColumnDef<DocumentItem>[] = [
    {
      accessorKey: 'name',
      header: 'Nombre',
      cell: ({ row }) => <span className='font-medium'>{row.original.name}</span>,
    },
    {
      accessorKey: 'userType',
      header: 'Dirigido a',
      cell: ({ row }) =>
        row.original.userType === 'client' ? 'Clientes' : 'Empresa',
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={row.original.status ? 'default' : 'secondary'}>
          {row.original.status ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      accessorKey: 'downloadEndpoint',
      header: 'Endpoint',
      cell: ({ row }) => (
        <span className='whitespace-normal break-all'>
          {row.original.downloadEndpoint}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => <DownloadButton document={row.original} onRefresh={onRefresh} />,
    },
  ]

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: documents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    state: { globalFilter },
  })

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-end'>
        <Input
          placeholder='Buscar documentos...'
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          className='max-w-sm'
        />
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className='h-24 text-center'>
                  Aun no hay documentos registrados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className='flex items-center justify-between'>
        <p className='text-sm text-muted-foreground'>
          {table.getFilteredRowModel().rows.length} documento(s)
        </p>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Anterior
          </Button>
          <p className='text-sm'>
            Pagina {table.getState().pagination.pageIndex + 1} de {table.getPageCount() || 1}
          </p>
          <Button
            variant='outline'
            size='sm'
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  )
}

interface DownloadButtonProps {
  document: DocumentItem
  onRefresh: () => void
}

function DownloadButton({ document, onRefresh }: DownloadButtonProps) {
  const [downloadModalOpen, setDownloadModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [isDirectDownloadLoading, setIsDirectDownloadLoading] = useState(false)

  const handleDirectDownload = async () => {
    setIsDirectDownloadLoading(true)
    try {
      await downloadDocumentFromEndpoint(document.downloadEndpoint, document.key)
      toast.success('Documento descargado correctamente')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No fue posible descargar el documento'
      toast.error(message)
    } finally {
      setIsDirectDownloadLoading(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='outline' size='icon' aria-label='Abrir acciones de documento'>
            <MoreHorizontal className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align='end' className='w-52'>
          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setEditModalOpen(true)}>
            Editar documento
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDownloadModalOpen(true)}>
            Descargar con formulario
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isDirectDownloadLoading}
            onSelect={() => {
              void handleDirectDownload()
            }}
          >
            {isDirectDownloadLoading ? 'Descargando...' : 'Descarga directa'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DownloadDocumentModal
        documentId={document._id}
        open={downloadModalOpen}
        onOpenChange={setDownloadModalOpen}
      />

      <EditDocumentModal
        documentId={document._id}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSuccess={onRefresh}
      />
    </>
  )
}