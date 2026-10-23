import mongoose from 'mongoose';

const UploadItemProgressSchema = new mongoose.Schema({
  uploadCatalogId: { type: String, ref: 'UploadCatalog', required: true },
  status: { type: String, enum: ['pending', 'uploaded', 'rejected'], default: 'pending' },
  fileUrl: { type: String, default: null },
  fileName: { type: String, default: null },
  uploadedAt: { type: Date }
}, { _id: true });

const FormItemProgressSchema = new mongoose.Schema({
  documentId: { type: String, ref: 'Document', required: true },
  status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
  completedAt: { type: Date }
}, { _id: true });

const DocumentRequestSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  presetId: { type: String, ref: 'DocumentFolderPreset' },
  userId: { type: String, required: true, index: true },
  assignedAdminEmail: { type: String, required: true, trim: true },
  forms: [FormItemProgressSchema],
  uploads: [UploadItemProgressSchema],
  attachments: [{
    title: { type: String, required: true },
    fileUrl: { type: String, required: true },
    description: { type: String }
  }],
  status: { type: String, enum: ['pending', 'in_progress', 'completed', 'sent'], default: 'pending' },
  zipSentAt: { type: Date },
  expiresAt: { type: Date }
}, { timestamps: true });

DocumentRequestSchema.index({ userId: 1, status: 1 });

DocumentRequestSchema.methods.refreshStatusFromProgress = function refreshStatusFromProgress() {
  if (this.status === 'sent') {
    return this.status;
  }

  const forms = Array.isArray(this.forms) ? this.forms : [];
  const uploads = Array.isArray(this.uploads) ? this.uploads : [];

  const allFormsCompleted = forms.every((item) => item.status === 'completed');
  const allUploadsUploaded = uploads.every((item) => item.status === 'uploaded');

  const hasStartedForms = forms.some((item) => item.status === 'in_progress' || item.status === 'completed');
  const hasStartedUploads = uploads.some((item) => item.status === 'uploaded' || item.status === 'rejected');

  if (allFormsCompleted && allUploadsUploaded) {
    this.status = 'completed';
    return this.status;
  }

  this.status = (hasStartedForms || hasStartedUploads) ? 'in_progress' : 'pending';
  return this.status;
};

DocumentRequestSchema.pre('save', function preSave() {
  this.refreshStatusFromProgress();
});

const DocumentRequest = mongoose.model('DocumentRequest', DocumentRequestSchema);
export default DocumentRequest;