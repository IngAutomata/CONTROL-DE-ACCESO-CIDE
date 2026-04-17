const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const UPLOAD_ROOT = path.resolve(__dirname, "../public/uploads/solicitudes");
const ALLOWED_MIME_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/pdf": ".pdf",
};

function sanitizeBaseName(value) {
  return String(value || "adjunto")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "adjunto";
}

function parseAttachmentPayload(filePayload, label) {
  if (!filePayload || typeof filePayload !== "object") {
    throw new Error(`Debes adjuntar el archivo de ${label}.`);
  }

  const { fileName, mimeType, base64Data } = filePayload;

  if (!mimeType || !ALLOWED_MIME_TYPES[mimeType]) {
    throw new Error(`El archivo de ${label} debe ser JPG, PNG o PDF.`);
  }

  if (!base64Data || typeof base64Data !== "string") {
    throw new Error(`El archivo de ${label} no pudo procesarse correctamente.`);
  }

  const buffer = Buffer.from(base64Data, "base64");

  if (!buffer.length) {
    throw new Error(`El archivo de ${label} está vacío o corrupto.`);
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`El archivo de ${label} supera el máximo permitido de 5 MB.`);
  }

  return {
    buffer,
    extension: ALLOWED_MIME_TYPES[mimeType],
    baseName: sanitizeBaseName(path.parse(fileName || label).name),
  };
}

async function storeAttachment(filePayload, { label, prefix }) {
  const parsed = parseAttachmentPayload(filePayload, label);
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });

  const uniquePart = `${Date.now()}-${crypto.randomUUID()}`;
  const fileName = `${sanitizeBaseName(prefix)}-${uniquePart}${parsed.extension}`;
  const absolutePath = path.join(UPLOAD_ROOT, fileName);

  await fs.writeFile(absolutePath, parsed.buffer);

  return {
    absolutePath,
    publicUrl: `/uploads/solicitudes/${fileName}`,
  };
}

async function removeStoredFiles(paths = []) {
  await Promise.all(
    paths.map(async (filePath) => {
      if (!filePath) return;
      try {
        await fs.unlink(filePath);
      } catch (_) {
        // no-op
      }
    })
  );
}

module.exports = {
  MAX_FILE_SIZE_BYTES,
  storeAttachment,
  removeStoredFiles,
};
