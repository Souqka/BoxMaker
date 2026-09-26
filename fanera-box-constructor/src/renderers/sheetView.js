/**
 * Page viewport. Zoom, pan, fit and selection change the drawing only.
 * Geometry and layout objects passed in are not modified.
 */
import { renderSvg } from "./svg.js";
import {
  calculateLayoutBounds,
  fitLayoutToViewport,
  panView,
  zoomView,
} from "./viewport.js";

export function createSheetView(container, { onSelect } = {}) {
  let geometry = null;
  let issues = [];
  let view = null;
  let selectedId = null;
  let spaceDown = false;
  let drag = null;

  container.addEventListener("wheel", onWheel, { passive: false });
  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerup", onPointerUp);
  container.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("keydown", (event) => {
    if (event.code !== "Space") return;
    const tag = event.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || event.target?.isContentEditable) return;
    event.preventDefault();
    spaceDown = true;
  });
  window.addEventListener("keyup", (event) => {
    if (event.code === "Space") spaceDown = false;
  });

  function show(next) {
    geometry = next;
    issues = [];
    fitToView();
  }

  function showIssues(nextIssues) {
    geometry = null;
    issues = nextIssues ?? [];
    view = null;
    selectedId = null;
    draw();
  }

  function fitToView() {
    if (!geometry?.layout) return null;
    const bounds = calculateLayoutBounds(geometry.layout);
    const viewport = containerSize();
    view = fitLayoutToViewport({
      layoutBounds: bounds,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      padding: 16,
    });
    draw();
    return getViewport();
  }

  function zoom(factor, anchor) {
    if (!view) return null;
    view = zoomView(view, factor, anchor);
    draw();
    return getViewport();
  }

  function pan(dx, dy) {
    if (!view) return null;
    view = panView(view, dx, dy);
    draw();
    return getViewport();
  }

  function selectPanel(panelId) {
    selectedId = panelId;
    draw();
    onSelect?.(selectedId);
    return selectedId;
  }

  function getPanelElement(panelId) {
    return container.querySelector(`[data-panel-id="${cssEscape(panelId)}"]`);
  }

  function setViewportTransform(next) {
    view = { x: next.x, y: next.y, width: next.width, height: next.height };
    draw();
    return getViewport();
  }

  function getViewport() {
    return view ? { ...view } : null;
  }

  function draw() {
    if (!geometry) {
      container.innerHTML = renderSvg({
        options: { validation: { valid: false, errors: issues } },
      });
      return;
    }
    container.innerHTML = renderSvg({
      panels: geometry.panels,
      layout: geometry.layout,
      viewport: view,
      options: {
        grid: true,
        gridStep: 10,
        selectedPanelId: selectedId,
      },
    });
  }

  function onWheel(event) {
    const svg = container.querySelector("svg");
    if (!svg || !view || !geometry) return;
    event.preventDefault();
    const anchor = clientToUser(svg, event.clientX, event.clientY);
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    view = zoomView(view, factor, anchor);
    draw();
  }

  function onPointerDown(event) {
    const svg = container.querySelector("svg");
    if (!svg || !view || !geometry) return;
    if (event.button !== 0 && event.button !== 1) return;
    if (event.button === 1) event.preventDefault();
    const panel = event.target.closest?.("[data-panel-id]");
    const pan = event.button === 1 || spaceDown || !panel;
    drag = pan
      ? { mode: "pan", x: event.clientX, y: event.clientY, origin: { ...view } }
      : { mode: "select", id: panel.dataset.panelId, x: event.clientX, y: event.clientY, moved: false };
    container.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (drag.mode === "select") {
      if (Math.hypot(dx, dy) <= 4) return;
      drag.mode = "pan";
      drag.origin = { ...view };
      drag.x = event.clientX;
      drag.y = event.clientY;
      return;
    }
    const svg = container.querySelector("svg");
    if (!svg || !drag.origin) return;
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / drag.origin.width, rect.height / drag.origin.height);
    if (!(scale > 0)) return;
    view = panView(drag.origin, (event.clientX - drag.x) / scale, (event.clientY - drag.y) / scale);
    draw();
  }

  function onPointerUp(event) {
    if (!drag) return;
    if (drag.mode === "select" && !drag.moved) selectPanel(drag.id);
    drag = null;
    if (container.hasPointerCapture?.(event.pointerId)) container.releasePointerCapture(event.pointerId);
  }

  function containerSize() {
    const rect = container.getBoundingClientRect();
    return {
      width: rect.width || 640,
      height: rect.height || 420,
    };
  }

  return {
    show,
    showIssues,
    selectPanel,
    getPanelElement,
    setViewportTransform,
    fitToView,
    zoom,
    pan,
    getViewport,
  };
}

function clientToUser(svg, clientX, clientY) {
  const inverse = svg.getScreenCTM()?.inverse();
  if (!inverse) return { x: 0, y: 0 };
  return clientToUserWith(svg, inverse, clientX, clientY);
}

function clientToUserWith(svg, inverse, clientX, clientY) {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const mapped = point.matrixTransform(inverse);
  return { x: mapped.x, y: mapped.y };
}

function cssEscape(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}
