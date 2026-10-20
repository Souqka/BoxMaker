/**
 * SVG renderer. Geometry and layout stay in millimetres.
 * This file reads outlines, placements and bounding boxes. It does not
 * rebuild the box, and it does not write back into the panel model.
 *
 * 1 geometry unit = 1 mm. The viewBox is the sheet window. CSS may scale
 * that window, and preserveAspectRatio keeps one scale for both axes.
 */
import { placementFootprint, rotateLocalPoint } from "../geometry/layout.js";
import { calculateLayoutBounds } from "./viewport.js";

const LAYERS = [
  "background-layer",
  "construction-layer",
  "cut-layer",
  "engraving-layer",
  "dimension-layer",
  "selection-layer",
];

export function renderSvg({ panels = [], layout = {}, viewport, options = {} } = {}) {
  if (options.validation && options.validation.valid === false) {
    return renderIssues(options.validation.errors ?? []);
  }

  const bounds = calculateLayoutBounds(layout);
  const view = viewport ?? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  const byId = new Map(panels.map((panel) => [panel.id, panel]));
  const layers = {
    "background-layer": [],
    "construction-layer": [],
    "cut-layer": [],
    "engraving-layer": [],
    "dimension-layer": [],
    "selection-layer": [],
  };

  if (options.grid) {
    layers["background-layer"].push(...gridLines(view, options.gridStep ?? 10));
  }

  layers["construction-layer"].push(
    `<rect data-sheet="frame" x="${fmt(bounds.x)}" y="${fmt(bounds.y)}" width="${fmt(bounds.width)}" height="${fmt(bounds.height)}" fill="none" stroke="#d9d0c3" stroke-width="0.4" />`,
  );

  for (const placement of layout.placements ?? []) {
    const panel = byId.get(placement.panelId);
    if (!panel) continue;
    const selected = options.selectedPanelId === panel.id;
    const hovered = options.hoveredPanelId === panel.id;
    const outline = Array.isArray(panel.outline) ? panel.outline : [];
    const path = pathFrom(outline, placement, bounds.height, panel);

    layers["cut-layer"].push(
      `<g data-panel-id="${escapeXml(panel.id)}" data-selected="${selected ? "true" : "false"}" data-hovered="${hovered ? "true" : "false"}" data-rotation="${fmt(placement.rotation ?? 0)}" data-panel="${escapeXml(panel.id)}">` +
        `<path d="${path}" fill="#fffdf8" stroke="#241e18" stroke-width="1.6" vector-effect="non-scaling-stroke" />` +
        `</g>`,
    );

    for (const item of panel.engraving ?? []) {
      const corners = engravingCorners(item).map((point) => toSheet(point, placement, bounds.height, panel));
      layers["engraving-layer"].push(
        `<polygon data-engraving="${escapeXml(item.id)}" points="${corners
          .map((point) => `${fmt(point.x)},${fmt(point.y)}`)
          .join(" ")}" fill="rgba(15,111,140,0.12)" stroke="#0f6f8c" stroke-width="0.5" />`,
      );
    }

    const center = toSheet(
      { x: panel.width / 2, y: panel.height / 2 },
      placement,
      bounds.height,
      panel,
    );
    layers["dimension-layer"].push(
      `<text data-label="${escapeXml(panel.id)}" x="${fmt(center.x)}" y="${fmt(center.y)}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="8" fill="#5c5346">` +
        `${escapeXml(panelLabel(panel.id))}` +
        `</text>`,
    );
    layers["dimension-layer"].push(
      `<text data-dimension="${escapeXml(panel.id)}" x="${fmt(center.x)}" y="${fmt(center.y + 12)}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="6" fill="#6d645a">` +
        `${fmt(panel.width)} × ${fmt(panel.height)} мм` +
        `</text>`,
    );

    if (selected) {
      const footprint = placementFootprint(panel, placement);
      const top = bounds.height - (footprint.y + footprint.height);
      layers["selection-layer"].push(
        `<rect data-selection="${escapeXml(panel.id)}" x="${fmt(footprint.x)}" y="${fmt(top)}" width="${fmt(footprint.width)}" height="${fmt(footprint.height)}" fill="rgba(122,59,46,0.14)" stroke="#7a3b2e" stroke-width="1.8" vector-effect="non-scaling-stroke" pointer-events="none" />`,
      );
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(view.x)} ${fmt(view.y)} ${fmt(view.width)} ${fmt(view.height)}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" data-units="mm" role="img" aria-label="Развёртка панелей">`,
    ...LAYERS.map((id) => {
      const events = id === "cut-layer" ? "" : ` pointer-events="none"`;
      return `<g id="${id}"${events}>${layers[id].join("")}</g>`;
    }),
    `</svg>`,
  ].join("");
}

export function renderBoxToSvg(geometry, options = {}) {
  return renderSvg({
    panels: geometry?.panels ?? [],
    layout: geometry?.layout ?? {},
    viewport: options.viewport,
    options,
  });
}

function renderIssues(errors) {
  const message = errors.map((error) => error.message).filter(Boolean).join(" ") || "Модель не собрана.";
  const layers = {
    "background-layer": [],
    "construction-layer": [
      `<text x="12" y="28" font-family="sans-serif" font-size="8" fill="#8a2e22">${escapeXml(message)}</text>`,
    ],
    "cut-layer": [],
    "engraving-layer": [],
    "dimension-layer": [],
    "selection-layer": [],
  };
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 48" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" data-units="mm" role="img" aria-label="Ошибка модели">`,
    ...LAYERS.map((id) => `<g id="${id}">${layers[id].join("")}</g>`),
    `</svg>`,
  ].join("");
}

function gridLines(view, step) {
  if (!(step > 0)) return [];
  const lines = [];
  const right = view.x + view.width;
  const bottom = view.y + view.height;
  const startX = Math.ceil(view.x / step) * step;
  const startY = Math.ceil(view.y / step) * step;
  for (let x = startX; x <= right + 1e-6; x += step) {
    lines.push(
      `<line data-grid="x" x1="${fmt(x)}" y1="${fmt(view.y)}" x2="${fmt(x)}" y2="${fmt(bottom)}" stroke="#e4d9c8" stroke-width="0.25" />`,
    );
  }
  for (let y = startY; y <= bottom + 1e-6; y += step) {
    lines.push(
      `<line data-grid="y" x1="${fmt(view.x)}" y1="${fmt(y)}" x2="${fmt(right)}" y2="${fmt(y)}" stroke="#e4d9c8" stroke-width="0.25" />`,
    );
  }
  return lines;
}

function toSheet(point, placement, sheetHeight, panel) {
  const local = rotateLocalPoint(point, placement.rotation ?? 0, panel.width, panel.height);
  return {
    x: placement.x + local.x,
    y: sheetHeight - (placement.y + local.y),
  };
}

function pathFrom(points, placement, sheetHeight, panel) {
  if (!points.length) return "";
  const mapped = points.map((point) => toSheet(point, placement, sheetHeight, panel));
  const [first, ...rest] = mapped;
  return `M ${fmt(first.x)} ${fmt(first.y)} ${rest.map((point) => `L ${fmt(point.x)} ${fmt(point.y)}`).join(" ")} Z`;
}

function engravingCorners(item) {
  const centerX = item.x + item.width / 2;
  const centerY = item.y + item.height / 2;
  const radians = ((item.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const local = [
    { x: item.x, y: item.y },
    { x: item.x + item.width, y: item.y },
    { x: item.x + item.width, y: item.y + item.height },
    { x: item.x, y: item.y + item.height },
  ];
  return local.map((point) => {
    const dx = point.x - centerX;
    const dy = point.y - centerY;
    return {
      x: centerX + dx * cos - dy * sin,
      y: centerY + dx * sin + dy * cos,
    };
  });
}

function panelLabel(id) {
  const labels = {
    lid: "крышка",
    "side-1": "1 бок",
    front: "перед",
    bottom: "дно",
    back: "зад",
    "side-2": "2 бок",
  };
  return labels[id] ?? id;
}

function fmt(value) {
  return String(Math.round(value * 1000) / 1000);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
