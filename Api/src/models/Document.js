import mongoose from 'mongoose';

const DocumentSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  documentStructureId: {
    type: String,
    required: true,
    ref: 'DocumentStructure', // Relación con la colección de Estructuras de Documentos
    description: 'Referencia al esquema de campos que define este documento'
  },
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    description: 'Identificador único del documento, ej: CONTRATO_RENTA_V1'
  },
  name: {
    type: String,
    required: true,
    trim: true,
    description: 'Nombre comercial/público del documento'
  },
  downloadEndpoint: {
    type: String,
    required: true,
    trim: true,
    description: 'Ruta del backend que procesa el PDF, ej: /api/v1/pdf/contrato-renta'
  },
  userType:{
    type: String,
    enum: ['client', 'company'],
    default: 'client',
    required: true,
    description: 'Tipo de usuario al que va dirigido el documento'
  },
  status: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true // Te genera automáticamente `createdAt` y `updatedAt`
});

const Document = mongoose.model('Document', DocumentSchema);
export default Document;