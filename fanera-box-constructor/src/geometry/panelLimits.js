/**
 * Stock limit for one finished flat part.
 *
 * 700 × 500 mm is a bounding box. Turning the part on the sheet does not
 * change it: 700 × 500 and 500 × 700 both fit. This is not a check of the
 * box width, depth or height. Geometry Engine calls validatePanelSize with
 * the finished panel.
 */

export const PANEL_LIMITS = {
  maxWidth: 700,
  maxHeight: 500,
  unit: "mm",
};

export function validatePanelSize(panel, limits = PANEL_LIMITS) {
  const width = panel?.width;
  const height = panel?.height;
  if (fitsPanelLimit(width, height, limits)) return null;

  const panelId = panel?.id ?? panel?.panelId;
  return {
    panelId,
    width,
    height,
    maxWidth: limits.maxWidth,
    maxHeight: limits.maxHeight,
    actual: { width, height },
    allowed: { width: limits.maxWidth, height: limits.maxHeight },
    code: "PANEL_TOO_LARGE",
    message: `Panel ${panelId} exceeds ${limits.maxWidth} × ${limits.maxHeight} mm.`,
  };
}

export function fitsPanelLimit(width, height, limits = PANEL_LIMITS) {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return false;
  const [partShort, partLong] = orderedSides(width, height);
  const [limitShort, limitLong] = orderedSides(limits.maxWidth, limits.maxHeight);
  return partShort <= limitShort && partLong <= limitLong;
}

function orderedSides(a, b) {
  return a <= b ? [a, b] : [b, a];
}
