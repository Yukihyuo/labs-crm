import axios from "axios"

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token")
      window.location.href = "/login"
    }
    return Promise.reject(error)
  }
)

function parseFileNameFromContentDisposition(contentDisposition?: string, fallback = "documento.pdf") {
  if (!contentDisposition) return fallback

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1])
  }

  const asciiMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
  if (asciiMatch?.[1]) {
    return asciiMatch[1]
  }

  return fallback
}

function triggerBrowserDownload(fileBlob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(fileBlob)

  const link = document.createElement("a")
  link.href = objectUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(objectUrl)
}

export async function downloadDocumentFromEndpoint(endpoint: string, fallbackFileName = "documento.pdf") {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`
  const response = await api.get<Blob>(normalizedEndpoint, {
    responseType: "blob",
  })

  const contentDisposition = response.headers["content-disposition"] as string | undefined
  const contentType = (response.headers["content-type"] as string | undefined) ?? "application/pdf"

  const defaultName = fallbackFileName.toLowerCase().endsWith(".pdf")
    ? fallbackFileName
    : `${fallbackFileName}.pdf`

  const fileName = parseFileNameFromContentDisposition(contentDisposition, defaultName)
  const blob = new Blob([response.data], { type: contentType })
  triggerBrowserDownload(blob, fileName)
}

export async function postDownloadDocumentFromEndpoint(
  endpoint: string,
  payload: Record<string, unknown>,
  fallbackFileName = "documento.pdf"
) {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`

  const response = await api.post<Blob>(normalizedEndpoint, payload, {
    responseType: "blob",
  })

  const contentDisposition = response.headers["content-disposition"] as string | undefined
  const contentType = (response.headers["content-type"] as string | undefined) ?? "application/pdf"

  const defaultName = fallbackFileName.toLowerCase().endsWith(".pdf")
    ? fallbackFileName
    : `${fallbackFileName}.pdf`

  const fileName = parseFileNameFromContentDisposition(contentDisposition, defaultName)
  const blob = new Blob([response.data], { type: contentType })
  triggerBrowserDownload(blob, fileName)
}

export default api
