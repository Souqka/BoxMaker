import { engravingCorners } from "../engraving/engraving.ts";
import { boundsOf, type Vec2 } from "../geometry/vec.ts";
import type { Panel, SheetLayout } from "../model/types.ts";

export interface SvgRenderInput {
  layout: SheetLayout;
  panels: readonly Panel[];
  kerfCompensation: boolean;
  /** Millimetres. Zero or less draws no grid. */
  gridStep?: number;
}

/**
 * Sheet drawing in millimetres. SVG user units are millimetres; the Y axis is
 * flipped here and nowhere else. Geometry stays y-up.
 */
export function renderSvg(input: SvgRenderInput): string {
  const { layout, panels } = input;
  const panelById = new Map(panels.map((panel) => [panel.id, panel]));
  const cut: string[] = [];
  const engraving: string[] = [];
  const construction: string[] = [];
  const dimensions: string[] = [];
  construction.push(gridMarkup(layout.width, layout.height, input.gridStep ?? 0));

  for (const placement of layout.placements) {
    const panel = panelById.get(placement.panelId);
    if (!panel) continue;
    const bounds = boundsOf(panel.geometry.outline);
    const toSheet = (point: Vec2): Vec2 => ({
      x: placement.x + (point.x - bounds.minX),
      y: placement.y + (point.y - bounds.minY),
    });

    const cutRing = input.kerfCompensation ? panel.geometry.cutOutline : panel.geometry.outline;
    cut.push(
      `<g id="panel-${panel.id}" data-panel="${panel.id}" data-role="cut">` +
        `<path d="${pathFrom(cutRing.map(toSheet), layout.height)}" fill="#fffdf8" stroke="#1c1915" stroke-width="1.15" vector-effect="non-scaling-stroke" />` +
        `</g>`,
    );

    const nominal = [
      { x: 0, y: 0 },
      { x: panel.nominalWidth, y: 0 },
      { x: panel.nominalWidth, y: panel.nominalHeight },
      { x: 0, y: panel.nominalHeight },
    ];
    construction.push(
      `<g data-panel="${panel.id}" data-role="construction">` +
        `<path d="${pathFrom(nominal.map(toSheet), layout.height)}" fill="none" stroke="#b7ab9a" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="3 2" />` +
        `</g>`,
    );

    const label = toSheet({ x: panel.nominalWidth / 2, y: panel.nominalHeight / 2 });
    const svgLabel = flip(label, layout.height);
    dimensions.push(
      `<g data-panel="${panel.id}" data-role="dimension">` +
        `<text x="${fmt(svgLabel.x)}" y="${fmt(svgLabel.y)}" text-anchor="middle" dominant-baseline="middle" font-family="ui-sans-serif, sans-serif" font-size="3.2" fill="#5c5346">` +
        `${escapeXml(panelLabel(panel.id))} ${fmt(panel.nominalWidth)}×${fmt(panel.nominalHeight)}` +
        `</text></g>`,
    );

    for (const item of panel.engraving) {
      const corners = engravingCorners(item).map(toSheet).map((point) => flip(point, layout.height));
      const center = flip(toSheet({ x: item.x, y: item.y }), layout.height);
      const content = imageHref(item.content, item.source);
      engraving.push(
        `<g id="${escapeXml(item.id)}" data-panel="${panel.id}" data-engraving="${escapeXml(item.id)}" data-rotation="${fmt(item.rotation)}">` +
          `<polygon points="${corners.map((point) => `${fmt(point.x)},${fmt(point.y)}`).join(" ")}" fill="rgba(15,111,140,0.12)" stroke="#0f6f8c" stroke-width="1.2" vector-effect="non-scaling-stroke" />` +
          (content
            ? `<image href="${escapeXml(content)}" x="${fmt(center.x - item.width / 2)}" y="${fmt(center.y - item.height / 2)}" width="${fmt(item.width)}" height="${fmt(item.height)}" transform="rotate(${fmt(-item.rotation)} ${fmt(center.x)} ${fmt(center.y)})" />`
            : "") +
          `</g>`,
      );
    }
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${fmt(layout.width)} ${fmt(layout.height)}" width="${fmt(layout.width)}mm" height="${fmt(layout.height)}mm" data-units="mm">`,
    `<desc>units=mm; construction=closed-box; kerfCompensation=${input.kerfCompensation ? "true" : "false"}</desc>`,
    `<g id="constructionLayer">${construction.join("")}</g>`,
    `<g id="cutLayer">${cut.join("")}</g>`,
    `<g id="engravingLayer">${engraving.join("")}</g>`,
    `<g id="dimensionLayer">${dimensions.join("")}</g>`,
    `</svg>`,
  ].join("");
}

function gridMarkup(width: number, height: number, step: number): string {
  if (!(step >= 1) || width <= 0 || height <= 0) return "";
  if (width / step > 2000 || height / step > 2000) return "";
  const lines: string[] = [];
  for (let x = 0; x <= width + 1e-6; x += step) {
    lines.push(`<line x1="${fmt(x)}" y1="0" x2="${fmt(x)}" y2="${fmt(height)}" />`);
  }
  for (let y = 0; y <= height + 1e-6; y += step) {
    const svgY = height - y;
    lines.push(`<line x1="0" y1="${fmt(svgY)}" x2="${fmt(width)}" y2="${fmt(svgY)}" />`);
  }
  return `<g data-role="grid" fill="none" stroke="#e3d9c8" stroke-width="0.15">${lines.join("")}</g>`;
}

function panelLabel(id: string): string {
  switch (id) {
    case "front":
      return "перед";
    case "back":
      return "зад";
    case "left":
      return "лево";
    case "right":
      return "право";
    case "bottom":
      return "дно";
    case "lid":
      return "крышка";
    default:
      return id;
  }
}

function pathFrom(points: readonly Vec2[], sheetHeight: number): string {
  const mapped = points.map((point) => flip(point, sheetHeight));
  if (mapped.length === 0) return "";
  const [first, ...rest] = mapped;
  return `M ${fmt(first!.x)} ${fmt(first!.y)} ${rest.map((point) => `L ${fmt(point.x)} ${fmt(point.y)}`).join(" ")} Z`;
}

function flip(point: Vec2, sheetHeight: number): Vec2 {
  return { x: point.x, y: sheetHeight - point.y };
}

function fmt(value: number): string {
  const rounded = Math.round(value * 10000) / 10000;
  return String(rounded);
}

function imageHref(content: string, source: "svg" | "png" | "jpg"): string {
  if (!content) return "";
  if (content.startsWith("data:")) return content;
  if (source === "svg") {
    return `data:image/svg+xml;utf8,${encodeURIComponent(content)}`;
  }
  return content;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
