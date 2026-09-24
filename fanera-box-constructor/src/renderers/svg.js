/**
 * SVG renderer. Input is the geometry object from `buildBoxGeometry`.
 * User units are millimetres. The Y flip lives only in this file.
 */
export function renderBoxToSvg(geometry) {
  const { layout, panels } = geometry;
  const byId = new Map(panels.map((panel) => [panel.id, panel]));
  const cut = [];
  const engraving = [];
  const construction = [];
  const dimensions = [];

  construction.push(
    `<rect x="0" y="0" width="${fmt(layout.width)}" height="${fmt(layout.height)}" fill="none" stroke="#d9d0c3" stroke-width="0.4" />`,
  );

  for (const placement of layout.placements) {
    const panel = byId.get(placement.panelId);
    if (!panel) continue;

    cut.push(
      `<g data-panel="${escapeXml(panel.id)}">` +
        `<path d="${pathFrom(panel.outline, placement, layout.height)}" fill="#fffdf8" stroke="#241e18" stroke-width="0.6" />` +
        `</g>`,
    );

    for (const item of panel.engraving) {
      const corners = engravingCorners(item).map((point) => toSheet(point, placement, layout.height));
      engraving.push(
        `<polygon data-engraving="${escapeXml(item.id)}" points="${corners
          .map((point) => `${fmt(point.x)},${fmt(point.y)}`)
          .join(" ")}" fill="rgba(15,111,140,0.12)" stroke="#0f6f8c" stroke-width="0.5" />`,
      );
    }

    const label = toSheet(
      { x: panel.width / 2, y: panel.height / 2 },
      placement,
      layout.height,
    );
    dimensions.push(
      `<text x="${fmt(label.x)}" y="${fmt(label.y)}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="8" fill="#5c5346">` +
        `${escapeXml(panelLabel(panel.id))} ${fmt(panel.width)}×${fmt(panel.height)}` +
        `</text>`,
    );
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(layout.width)} ${fmt(layout.height)}" width="100%" height="100%" data-units="mm" role="img" aria-label="Развёртка панелей">`,
    `<g id="constructionLayer">${construction.join("")}</g>`,
    `<g id="cutLayer">${cut.join("")}</g>`,
    `<g id="engravingLayer">${engraving.join("")}</g>`,
    `<g id="dimensionLayer">${dimensions.join("")}</g>`,
    `</svg>`,
  ].join("");
}

function toSheet(point, placement, sheetHeight) {
  const x = placement.x + point.x;
  const y = placement.y + point.y;
  return { x, y: sheetHeight - y };
}

function pathFrom(points, placement, sheetHeight) {
  if (points.length === 0) return "";
  const mapped = points.map((point) => toSheet(point, placement, sheetHeight));
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
    front: "перед",
    back: "зад",
    left: "лево",
    right: "право",
    bottom: "дно",
    lid: "крышка",
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
