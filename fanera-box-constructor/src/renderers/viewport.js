/**
 * Viewport math in millimetres. Zoom and pan change only the window
 * onto the sheet. They do not change panel geometry or layout positions.
 */

export function calculateLayoutBounds(layout) {
  const width = Number(layout?.width);
  const height = Number(layout?.height);
  return {
    x: 0,
    y: 0,
    width: Number.isFinite(width) ? width : 0,
    height: Number.isFinite(height) ? height : 0,
  };
}

/**
 * One scale for the whole sheet. scaleX and scaleY are reported so a caller
 * can see the fit, but the value to use is their minimum.
 */
export function calculateUniformScale({
  geometryBounds,
  viewportWidth,
  viewportHeight,
  padding = 0,
}) {
  const boundsWidth = geometryBounds?.width || 0;
  const boundsHeight = geometryBounds?.height || 0;
  const innerWidth = Math.max((viewportWidth ?? 0) - padding * 2, 0);
  const innerHeight = Math.max((viewportHeight ?? 0) - padding * 2, 0);
  const scaleX = boundsWidth > 0 ? innerWidth / boundsWidth : 1;
  const scaleY = boundsHeight > 0 ? innerHeight / boundsHeight : 1;
  return {
    scaleX,
    scaleY,
    scale: Math.min(scaleX, scaleY),
  };
}

/**
 * View box that shows the whole layout inside the viewport.
 * Padding is converted with the same scale on both axes.
 */
export function fitLayoutToViewport({
  layoutBounds,
  viewportWidth,
  viewportHeight,
  padding = 0,
}) {
  const fitted = calculateUniformScale({
    geometryBounds: layoutBounds,
    viewportWidth,
    viewportHeight,
    padding,
  });
  const pad = fitted.scale > 0 ? padding / fitted.scale : 0;
  return {
    x: layoutBounds.x - pad,
    y: layoutBounds.y - pad,
    width: layoutBounds.width + pad * 2,
    height: layoutBounds.height + pad * 2,
    scale: fitted.scale,
  };
}

/** factor > 1 zooms in. Both axes use that same factor. */
export function zoomView(view, factor, anchor) {
  const nextWidth = view.width / factor;
  const nextHeight = view.height / factor;
  const ax = anchor?.x ?? view.x + view.width / 2;
  const ay = anchor?.y ?? view.y + view.height / 2;
  const rx = view.width === 0 ? 0.5 : (ax - view.x) / view.width;
  const ry = view.height === 0 ? 0.5 : (ay - view.y) / view.height;
  return {
    x: ax - rx * nextWidth,
    y: ay - ry * nextHeight,
    width: nextWidth,
    height: nextHeight,
  };
}

export function panView(view, dx, dy) {
  return {
    x: view.x + dx,
    y: view.y + dy,
    width: view.width,
    height: view.height,
  };
}
