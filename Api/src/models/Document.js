import mongoose from 'mongoose';

const DocumentSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  brandId: {
    type: String,
    required: true,
    ref: 'Brand',
    index: true,
    description: 'Laboratorio/marca al que pertenece el documento'
  },
  storeId: {
    type: String,
    ref: 'Store',
    default: null,
    description: 'Sucursal específica (opcional). Si es null, el documento aplica a toda la marca'
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
    trim: true,
    description: 'Identificador único del documento dentro de la marca, ej: CONTRATO_RENTA_V1'
  },
  name: {
    type: String,
    required: true,
    trim: true,
    description: 'Nombre comercial/público del documento'
  },
  area: {
    type: String,
    trim: true,
    default: '',
    description: 'Área/categoría del documento (ej: hematología, química, urinálisis, consentimiento)'
  },
  version: {
    type: Number,
    min: 1,
    default: 1,
    description: 'Versión de la definición del documento/estudio'
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

// La `key` es única dentro de cada marca, no global
DocumentSchema.index({ brandId: 1, key: 1 }, { unique: true });

const Document = mongoose.model('Document', DocumentSchema);
export default Document;