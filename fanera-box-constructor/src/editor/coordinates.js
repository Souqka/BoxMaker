/**
 * Screen pixels and the SVG window. The window is millimetres, y down,
 * the same space as the viewBox. Layout storage stays y-up.
 * Callers convert a screen delta into a layout delta with svgDeltaToLayout.
 */

export function screenToWorld({ clientX, clientY, viewport, rect }) {
  const frame = meetFrame(viewport, rect);
  return {
    x: viewport.x + (clientX - rect.left - frame.offsetX) / frame.scale,
    y: viewport.y + (clientY - rect.top - frame.offsetY) / frame.scale,
  };
}

export function worldToScreen({ x, y, viewport, rect }) {
  const frame = meetFrame(viewport, rect);
  return {
    x: rect.left + frame.offsetX + (x - viewport.x) * frame.scale,
    y: rect.top + frame.offsetY + (y - viewport.y) * frame.scale,
  };
}

/**
 * SVG y grows downward. Layout y grows upward. A screen drag maps like this.
 */
export function svgDeltaToLayout(dx, dy) {
  return { x: dx, y: -dy };
}

function meetFrame(viewport, rect) {
  const width = rect.width ?? rect.right - rect.left;
  const height = rect.height ?? rect.bottom - rect.top;
  const scale = Math.min(width / viewport.width, height / viewport.height);
  return {
    scale: scale > 0 ? scale : 1,
    offsetX: (width - viewport.width * (scale > 0 ? scale : 1)) / 2,
    offsetY: (height - viewport.height * (scale > 0 ? scale : 1)) / 2,
  };
}
