import mongoose from "mongoose";
// Sub-schema para opciones de campos tipo select
const FieldOptionSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
}, { _id: false });

// Sub-schema para configuracion adicional de yes_no_comment
const YesNoConfigSchema = new mongoose.Schema({
  commentPlaceholder: { type: String, default: 'Observaciones...' },
  commentRequired: { type: Boolean, default: false },
}, { _id: false });

// Sub-schema para cada propiedad de un objeto dentro de object_list
const ObjectItemFieldSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  tag: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  dataType: {
    type: String,
    required: true,
    enum: ['string', 'number', 'boolean'], // 'file' se eliminó: requiere almacenamiento persistente
  },
  required: { type: Boolean, default: false },
}, { _id: false });

// Sub-schema base para campos
const FieldConfigSchema = new mongoose.Schema({
  fieldKey: { type: String, required: true, trim: true },
  tag: { type: String, required: true, trim: true },
  type: {
    type: String,
    required: true,
    enum: ['text', 'number', 'date', 'select', 'checkbox', 'textarea', 'yes_no_comment', 'string_list', 'object_list'],
  },
  required: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  options: { type: [FieldOptionSchema], default: undefined },
  yesNoConfig: { type: YesNoConfigSchema, default: undefined },
  objectFields: { type: [ObjectItemFieldSchema], default: undefined },
  validations: {
    min: Number,
    max: Number,
    regex: String,
  },
}, { _id: false });

// Sub-schema para secciones
const SectionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  fields: { type: [FieldConfigSchema], default: [] },
}, { _id: false });

const DocumentStructureSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => new mongoose.Types.ObjectId().toString(),
  },
  brandId: {
    type: String,
    required: true,
    ref: 'Brand',
    index: true,
    description: 'Laboratorio/marca al que pertenece la estructura',
  },
  title: { type: String, required: true, trim: true },
  sections: { type: [SectionSchema], default: [] },
  version: {
    type: Number,
    min: 1,
    default: 1,
    description: 'Versión del esquema; al modificar se crea una nueva versión',
  },
  supersedes: {
    type: String,
    ref: 'DocumentStructure',
    default: null,
    description: 'Referencia a la versión anterior del esquema',
  },
}, {
  timestamps: true,
});

// Garantiza que no existan fieldKey duplicados dentro de la estructura
DocumentStructureSchema.pre('validate', function preValidate() {
  const seen = new Set();
  for (const section of this.sections || []) {
    for (const field of section.fields || []) {
      const fieldKey = typeof field?.fieldKey === 'string' ? field.fieldKey.trim() : '';
      if (!fieldKey) continue;
      if (seen.has(fieldKey)) {
        throw new Error(`fieldKey duplicado: "${fieldKey}"`);
      }
      seen.add(fieldKey);
    }
  }
});

const DocumentStructure = mongoose.model('DocumentStructure', DocumentStructureSchema);
export default DocumentStructure;