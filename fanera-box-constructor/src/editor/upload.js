/**
 * Turns an uploaded file into an engraving in panel millimetres.
 * The outline of the panel is not an input that this module writes.
 */
import { createLogo } from "../models/Logo.js";

export const ENGRAVING_LIMITS = {
  maxFileBytes: 10 * 1024 * 1024,
  maxWidth: 100,
  maxHeight: 60,
};

const MIME_SOURCE = {
  "image/svg+xml": "svg",
  "image/png": "png",
  "image/jpeg": "jpg",
};

export function sourceFromFile(name = "", mime = "") {
  const type = MIME_SOURCE[String(mime).toLowerCase()];
  if (type) return type;
  const extension = String(name).toLowerCase().split(".").pop();
  if (extension === "svg") return "svg";
  if (extension === "png") return "png";
  if (extension === "jpg" || extension === "jpeg") return "jpg";
  return null;
}

export function validateLogoFile({ name, type, size, maxFileBytes = ENGRAVING_LIMITS.maxFileBytes } = {}) {
  const source = sourceFromFile(name, type);
  if (!source) return { ok: false, message: "Поддерживаются SVG, PNG и JPG." };
  if (!(size >= 0) || size > maxFileBytes) {
    const megabytes = Math.round((maxFileBytes / (1024 * 1024)) * 10) / 10;
    return { ok: false, message: `Файл больше ${megabytes} МБ.` };
  }
  return { ok: true, source };
}

export function sanitizeSvg(source) {
  return String(source)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*\/?>/gi, "")
    .replace(/<(iframe|object|embed|foreignObject)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(iframe|object|embed|foreignObject)\b[^>]*\/?>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(\s(?:href|xlink:href)\s*=\s*)(["'])\s*javascript:[^"']*\2/gi, "$1$2$2");
}

export function svgIntrinsicSize(source) {
  const text = String(source);
  const viewBox = text.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (viewBox) {
    const parts = viewBox[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) return { width: parts[2], height: parts[3] };
  }
  const width = readLength(text, "width");
  const height = readLength(text, "height");
  if (width > 0 && height > 0) return { width, height };
  return null;
}

/**
 * Fits the picture into the configured millimetre box, then into the panel.
 * The image aspect ratio stays the same.
 */
export function fitLogoSize({
  imageWidth,
  imageHeight,
  panelWidth,
  panelHeight,
  maxWidth = ENGRAVING_LIMITS.maxWidth,
  maxHeight = ENGRAVING_LIMITS.maxHeight,
}) {
  if (!(imageWidth > 0) || !(imageHeight > 0)) return null;
  const aspect = imageWidth / imageHeight;
  let width = maxWidth;
  let height = width / aspect;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspect;
  }
  if (panelWidth > 0 && width > panelWidth) {
    width = panelWidth;
    height = width / aspect;
  }
  if (panelHeight > 0 && height > panelHeight) {
    height = panelHeight;
    width = height * aspect;
  }
  return { width, height };
}

export function centerOnPanel(panelWidth, panelHeight, width, height) {
  return {
    x: Math.max(0, (panelWidth - width) / 2),
    y: Math.max(0, (panelHeight - height) / 2),
  };
}

export function buildEngraving({
  id,
  panel,
  name = "",
  source,
  data,
  imageWidth,
  imageHeight,
  limits = ENGRAVING_LIMITS,
}) {
  const size = fitLogoSize({
    imageWidth,
    imageHeight,
    panelWidth: panel.width,
    panelHeight: panel.height,
    maxWidth: limits.maxWidth,
    maxHeight: limits.maxHeight,
  });
  if (!size) return { ok: false, message: "Не удалось прочитать размер изображения." };
  const place = centerOnPanel(panel.width, panel.height, size.width, size.height);
  return {
    ok: true,
    engraving: createLogo({
      id,
      panelId: panel.id,
      x: place.x,
      y: place.y,
      width: size.width,
      height: size.height,
      rotation: 0,
      source,
      data,
      name,
    }),
  };
}

export async function readLogoFile(file, { panel, id, limits = ENGRAVING_LIMITS } = {}) {
  const check = validateLogoFile({
    name: file?.name,
    type: file?.type,
    size: file?.size,
    maxFileBytes: limits.maxFileBytes,
  });
  if (!check.ok) return check;
  if (!panel) return { ok: false, message: "Сначала выберите панель" };

  if (check.source === "svg") {
    const text = sanitizeSvg(await file.text());
    const intrinsic = svgIntrinsicSize(text) ?? { width: limits.maxWidth, height: limits.maxHeight };
    return buildEngraving({
      id,
      panel,
      name: file.name,
      source: "svg",
      data: text,
      imageWidth: intrinsic.width,
      imageHeight: intrinsic.height,
      limits,
    });
  }

  const data = await readDataUrl(file);
  const intrinsic = await measureImage(data);
  if (!intrinsic) return { ok: false, message: "Не удалось прочитать изображение." };
  return buildEngraving({
    id,
    panel,
    name: file.name,
    source: check.source,
    data,
    imageWidth: intrinsic.width,
    imageHeight: intrinsic.height,
    limits,
  });
}

function readLength(text, attribute) {
  const match = text.match(new RegExp(`<svg\\b[^>]*\\b${attribute}\\s*=\\s*["']([^"']+)["']`, "i"));
  if (!match) return 0;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : 0;
}

function readDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function measureImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = src;
  });
}
