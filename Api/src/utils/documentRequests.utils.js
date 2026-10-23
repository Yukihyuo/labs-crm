import DocumentRequest from "../models/DocumentRequest.js";

const GLOBAL_STATUSES = new Set(["pending", "in_progress", "completed", "sent"])

export const documentRequestPopulate = [
	{ path: "presetId", select: "title userType" },
	{ path: "forms.documentId", select: "key name downloadEndpoint userType status" },
	{ path: "uploads.uploadCatalogId", select: "key title description maxSizeMB allowedExtensions isActive" },
]

export async function updateDocumentRequestStatus(documentRequestId, newStatus) {
	if (!GLOBAL_STATUSES.has(newStatus)) {
		throw new Error("Status de solicitud invalido")
	}

	const updatePayload = { status: newStatus }

	if (newStatus === "sent") {
		updatePayload.zipSentAt = new Date()
	}

	const documentRequest = await DocumentRequest.findByIdAndUpdate(
		documentRequestId,
		updatePayload,
		{
			new: true,
			runValidators: true,
		}
	)
		.populate(documentRequestPopulate)
		.lean();

	if (!documentRequest) {
		throw new Error("Solicitud de documento no encontrada");
	}

	return documentRequest;
}
