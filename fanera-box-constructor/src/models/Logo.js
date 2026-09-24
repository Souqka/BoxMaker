export const ENGRAVING_SOURCES = ["svg", "png", "jpg"];

/**
 * Engraving placement in one panel's own millimetre coordinates.
 * `x` and `y` are the bottom-left corner before rotation.
 * `rotation` is degrees counter-clockwise around the rectangle center.
 * Screen pixels are not stored here.
 */
export function createLogo(input) {
  if (!ENGRAVING_SOURCES.includes(input.source)) {
    throw new Error(`Источник «${input.source}» не поддерживается. Доступны svg, png и jpg.`);
  }

  return {
    id: input.id,
    panelId: input.panelId,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    rotation: input.rotation ?? 0,
    source: input.source,
    data: input.data ?? "",
  };
}
