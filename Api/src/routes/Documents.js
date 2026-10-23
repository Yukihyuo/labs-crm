import express from "express";
import Document from "../models/Document.js";
import DocumentStructure from "../models/DocumentStructure.js";

const router = express.Router();

const DEFAULT_SECTION_TITLE = "Seccion general";
const ALLOWED_FIELD_TYPES = new Set([
  "text",
  "number",
  "date",
  "select",
  "checkbox",
  "textarea",
  "yes_no_comment",
  "string_list",
  "object_list",
]);
const ALLOWED_OBJECT_DATA_TYPES = new Set(["string", "number", "boolean", "file"]);

const normalizeField = (field = {}) => {
  const normalized = {
    fieldKey: typeof field.fieldKey === "string" ? field.fieldKey.trim() : "",
    tag: typeof field.tag === "string" ? field.tag.trim() : "",
    type: ALLOWED_FIELD_TYPES.has(field.type) ? field.type : "text",
    required: Boolean(field.required),
    placeholder: typeof field.placeholder === "string" ? field.placeholder : "",
  };

  if (Array.isArray(field.options) && field.options.length > 0) {
    normalized.options = field.options
      .filter((option) => option && typeof option.label === "string")
      .map((option) => ({ label: option.label, value: option.value }));
  }

  if (field.yesNoConfig) {
    normalized.yesNoConfig = {
      commentPlaceholder:
        typeof field.yesNoConfig.commentPlaceholder === "string"
          ? field.yesNoConfig.commentPlaceholder
          : "Observaciones...",
      commentRequired: Boolean(field.yesNoConfig.commentRequired),
    };
  }

  if (Array.isArray(field.objectFields) && field.objectFields.length > 0) {
    normalized.objectFields = field.objectFields
      .filter((objectField) => objectField && typeof objectField.key === "string" && objectField.key.trim())
      .map((objectField) => ({
        key: objectField.key.trim(),
        tag: typeof objectField.tag === "string" && objectField.tag.trim() ? objectField.tag.trim() : objectField.key.trim(),
        description: typeof objectField.description === "string" ? objectField.description : "",
        dataType: ALLOWED_OBJECT_DATA_TYPES.has(objectField.dataType) ? objectField.dataType : "string",
        required: Boolean(objectField.required),
      }));
  }

  if (field.validations && typeof field.validations === "object") {
    normalized.validations = {
      min: field.validations.min,
      max: field.validations.max,
      regex: field.validations.regex,
    };
  }

  return normalized;
};

const normalizeSections = (sections = []) => {
  if (!Array.isArray(sections)) {
    return [];
  }

  return sections.map((section, index) => ({
    title:
      typeof section?.title === "string" && section.title.trim().length > 0
        ? section.title.trim()
        : `${DEFAULT_SECTION_TITLE} ${index + 1}`,
    description: typeof section?.description === "string" ? section.description : "",
    fields: Array.isArray(section?.fields)
      ? section.fields.map((field) => normalizeField(field))
      : [],
  }));
};

const mapLegacyFieldsToSections = (fields = []) => {
  if (!Array.isArray(fields)) {
    return [];
  }

  return [
    {
      title: DEFAULT_SECTION_TITLE,
      description: "",
      fields: fields.map((field) => normalizeField(field)),
    },
  ];
};

const resolveStructurePayload = ({ body, fallbackTitle }) => {
  const title =
    (typeof body.structureTitle === "string" && body.structureTitle.trim()) ||
    (typeof body.title === "string" && body.title.trim()) ||
    fallbackTitle ||
    "Estructura de documento";

  if (Array.isArray(body.sections)) {
    return { title, sections: normalizeSections(body.sections) };
  }

  if (Array.isArray(body.fields)) {
    return { title, sections: mapLegacyFieldsToSections(body.fields) };
  }

  return { title, sections: [] };
};

// ─── GET ALL ─────────────────────────────────────────────────────────────────
// GET /api/documents
router.get("/", async (req, res) => {
  try {
    const documents = await Document.find();
    return res.status(200).json(documents);
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener documentos", error: error.message });
  }
});



// ─── GET BY ID (document + structure) ────────────────────────────────────────
// GET /api/documents/:id
router.get("/:id", async (req, res) => {
  try {
    const document = await Document.findById(req.params.id)
      .populate("documentStructureId")
      .lean();
    if (!document) return res.status(404).json({ message: "Documento no encontrado" });

    const structureId =
      typeof document.documentStructureId === "string"
        ? document.documentStructureId
        : document.documentStructureId?._id;

    const structure = structureId ? await DocumentStructure.findById(structureId) : null;
    return res.status(200).json({ document, structure });
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener el documento", error: error.message });
  }
});

// ─── CREATE (document + structure together) ───────────────────────────────────
// POST /api/documents
// Body: { key, name, downloadEndpoint, status?, structureTitle?, sections?, fields? }
router.post("/", async (req, res) => {
  try {
    const { key, name, downloadEndpoint, status, userType } = req.body;

    const structurePayload = resolveStructurePayload({
      body: req.body,
      fallbackTitle: typeof name === "string" ? name : undefined,
    });

    const structure = await DocumentStructure.create(structurePayload);

    const document = await Document.create({
      documentStructureId: structure._id,
      key,
      name,
      downloadEndpoint,
      status,
      userType,
    });

    return res.status(201).json({ document, structure });
  } catch (error) {
    return res.status(400).json({ message: "Error al crear el documento", error: error.message });
  }
});

// ─── UPDATE DOCUMENT (metadata only) ─────────────────────────────────────────
// PUT /api/documents/:id/document
// Body: { key?, name?, downloadEndpoint?, status?, userType?, structureTitle?, title?, sections?, fields? }
router.put("/:id/document", async (req, res) => {
  try {
    const { key, name, downloadEndpoint, status, userType, sections, fields, structureTitle, title } = req.body;

    const document = await Document.findByIdAndUpdate(
      req.params.id,
      { key, name, downloadEndpoint, status, userType },
      { new: true, runValidators: true, omitUndefined: true }
    );

    if (!document) return res.status(404).json({ message: "Documento no encontrado" });

    let structure = null;

    const shouldUpdateStructure =
      Array.isArray(sections) ||
      Array.isArray(fields) ||
      typeof structureTitle === "string" ||
      typeof title === "string";

    if (shouldUpdateStructure) {
      const nextStructure = resolveStructurePayload({
        body: req.body,
        fallbackTitle: name || document.name,
      });

      const updatePayload = {
        title: nextStructure.title,
      };

      if (Array.isArray(sections) || Array.isArray(fields)) {
        updatePayload.sections = nextStructure.sections;
      }

      structure = await DocumentStructure.findByIdAndUpdate(
        document.documentStructureId,
        updatePayload,
        { new: true, runValidators: true, omitUndefined: true }
      );

      if (!structure) return res.status(404).json({ message: "Estructura no encontrada" });
    }

    return res.status(200).json({ document, structure });
  } catch (error) {
    return res.status(400).json({ message: "Error al actualizar el documento", error: error.message });
  }
});

// ─── UPDATE STRUCTURE (fields only) ──────────────────────────────────────────
// PUT /api/documents/:id/structure
// Body: { structureTitle?, title?, sections?, fields? }
router.put("/:id/structure", async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) return res.status(404).json({ message: "Documento no encontrado" });

    const nextStructure = resolveStructurePayload({
      body: req.body,
      fallbackTitle: req.body.title || req.body.structureTitle || undefined,
    });

    const updatePayload = {
      title: nextStructure.title,
    };

    if (Array.isArray(req.body.sections) || Array.isArray(req.body.fields)) {
      updatePayload.sections = nextStructure.sections;
    }

    const structure = await DocumentStructure.findByIdAndUpdate(
      document.documentStructureId,
      updatePayload,
      { new: true, runValidators: true, omitUndefined: true }
    );

    if (!structure) return res.status(404).json({ message: "Estructura no encontrada" });

    return res.status(200).json(structure);
  } catch (error) {
    return res.status(400).json({ message: "Error al actualizar la estructura", error: error.message });
  }
});

// ─── DELETE (document + structure) ───────────────────────────────────────────
// DELETE /api/documents/:id
router.delete("/:id", async (req, res) => {
  try {
    const document = await Document.findByIdAndDelete(req.params.id);
    if (!document) return res.status(404).json({ message: "Documento no encontrado" });

    await DocumentStructure.findByIdAndDelete(document.documentStructureId);

    return res.status(200).json({ message: "Documento y estructura eliminados correctamente" });
  } catch (error) {
    return res.status(500).json({ message: "Error al eliminar el documento", error: error.message });
  }
});


export const routeConfig = { path: "/api/documents", router }