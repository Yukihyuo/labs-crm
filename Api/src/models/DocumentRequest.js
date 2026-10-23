import mongoose from 'mongoose';

// Progreso por formulario dentro de una solicitud/orden de estudios
const FormItemProgressSchema = new mongoose.Schema({
  documentId: { type: String, ref: 'Document', required: true },
  status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
  // Snapshot de los valores capturados: el resultado no debe cambiar si la estructura se edita después
  values: { type: mongoose.Schema.Types.Mixed, default: null },
  resultPdfUrl: { type: String, default: null },
  renderedAt: { type: Date, default: null },
  completedAt: { type: Date }
}, { _id: true });

const DocumentRequestSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  brandId: { type: String, required: true, ref: 'Brand', index: true },
  // Quién levantó la orden de estudios (staff que crea la solicitud)
  requestedBy: { type: String, required: true, ref: 'Staff', index: true },
  // A quién pertenece la orden: el usuario destino (cliente/paciente o empresa)
  userId: { type: String, required: true, index: true },
  targetUserType: { type: String, enum: ['client', 'company'], default: 'client' },
  assignedAdminEmail: { type: String, required: true, trim: true },
  forms: [FormItemProgressSchema],
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
DocumentRequestSchema.index({ requestedBy: 1, status: 1 });
DocumentRequestSchema.index({ brandId: 1, status: 1 });

DocumentRequestSchema.methods.refreshStatusFromProgress = function refreshStatusFromProgress() {
  if (this.status === 'sent') {
    return this.status;
  }

  const forms = Array.isArray(this.forms) ? this.forms : [];

  const allFormsCompleted = forms.length > 0 && forms.every((item) => item.status === 'completed');
  const hasStartedForms = forms.some((item) => item.status === 'in_progress' || item.status === 'completed');

  if (allFormsCompleted) {
    this.status = 'completed';
    return this.status;
  }

  this.status = hasStartedForms ? 'in_progress' : 'pending';
  return this.status;
};

DocumentRequestSchema.pre('save', function preSave() {
  this.refreshStatusFromProgress();
});

const DocumentRequest = mongoose.model('DocumentRequest', DocumentRequestSchema);
export default DocumentRequest;