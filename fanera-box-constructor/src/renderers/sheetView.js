/**
 * Interactive sheet. Pointer events update editor state and layout.
 * Panel outlines stay on the geometry object and are not written here.
 */
import { screenToWorld } from "../editor/coordinates.js";
import {
  applyShortcut,
  createEditorState,
  createHistory,
  describePanel,
  draggedPlacement,
  geometryFingerprint,
  getPanelBounds,
  layoutWarnings,
  movePanel,
  pointerIntent,
  resolvePointerRelease,
  viewBounds,
  visibleGridStep,
  zoomAround,
} from "../editor/scene.js";
import { renderSvg } from "./svg.js";
import {
  fitLayoutToViewport,
  panView,
} from "./viewport.js";

const DRAG_THRESHOLD = 4;

export function createSheetView(container, { onSelect, onChange, minZoom = 0.1, maxZoom = 20 } = {}) {
  const editor = createEditorState({ minZoom, maxZoom });
  const history = createHistory();
  let geometry = null;
  let layout = null;
  let issues = [];
  let view = null;
  let referenceWidth = null;
  let spaceDown = false;
  let drag = null;

  container.addEventListener("wheel", onWheel, { passive: false });
  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerup", onPointerUp);
  container.addEventListener("pointercancel", onPointerUp);
  container.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  function show(next) {
    geometry = next;
    layout = cloneLayout(next.layout);
    issues = [];
    editor.selectPanel(null);
    editor.hover(null);
    history.clear();
    fitToView();
  }

  function showIssues(nextIssues) {
    geometry = null;
    layout = null;
    issues = nextIssues ?? [];
    view = null;
    referenceWidth = null;
    drag = null;
    editor.selectPanel(null);
    editor.hover(null);
    history.clear();
    draw();
  }

  function fitToView() {
    if (!layout || !geometry) return null;
    const bounds = viewBounds(geometry.panels, layout);
    const viewport = containerSize();
    const fitted = fitLayoutToViewport({
      layoutBounds: bounds,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      padding: 16,
    });
    referenceWidth = fitted.width;
    view = { x: fitted.x, y: fitted.y, width: fitted.width, height: fitted.height, scale: 1 };
    draw();
    return getViewport();
  }

  function resetView() {
    return fitToView();
  }

  function zoom(factor, anchor) {
    if (!view || !(referenceWidth > 0)) return null;
    const point = anchor ?? { x: view.x + view.width / 2, y: view.y + view.height / 2 };
    editor.begin("zoom");
    view = zoomAround(view, factor, point, { minZoom, maxZoom, referenceWidth });
    editor.end();
    draw();
    return getViewport();
  }

  function pan(dx, dy) {
    if (!view) return null;
    view = { ...panView(view, dx, dy), scale: view.scale };
    draw();
    return getViewport();
  }

  function selectPanel(panelId) {
    const selection = editor.selectPanel(panelId);
    draw();
    onSelect?.(selection?.id ?? null);
    return selection?.id ?? null;
  }

  function getPanelElement(panelId) {
    return container.querySelector(`[data-panel-id="${cssEscape(panelId)}"]`);
  }

  function setViewportTransform(next) {
    const zoomFactor = referenceWidth && next.width ? referenceWidth / next.width : next.scale ?? 1;
    view = { x: next.x, y: next.y, width: next.width, height: next.height, scale: zoomFactor };
    draw();
    return getViewport();
  }

  function getViewport() {
    return view ? { x: view.x, y: view.y, width: view.width, height: view.height, scale: view.scale } : null;
  }

  function setSnap(enabled, grid) {
    editor.setSnap(enabled, grid);
    publish();
    return editor.snap;
  }

  function undo() {
    if (!layout || drag) return null;
    const previous = history.undo(clonePlacements(layout));
    if (!previous) return null;
    layout = { ...layout, placements: previous };
    draw();
    return getViewport();
  }

  function redo() {
    if (!layout || drag) return null;
    const next = history.redo(clonePlacements(layout));
    if (!next) return null;
    layout = { ...layout, placements: next };
    draw();
    return getViewport();
  }

  function boundsFor(panelId) {
    const found = findPanel(panelId);
    if (!found) return null;
    return getPanelBounds(found.panel, found.placement);
  }

  function geometryHash() {
    return geometry ? geometryFingerprint(geometry.panels) : null;
  }

  function draw() {
    container.classList.toggle("is-panning", editor.interaction.mode === "pan");
    container.classList.toggle("is-dragging", editor.interaction.mode === "drag-panel");
    if (!geometry || !layout) {
      container.innerHTML = renderSvg({
        options: { validation: { valid: false, errors: issues } },
      });
      publish();
      return;
    }
    const size = containerSize();
    container.innerHTML = renderSvg({
      panels: geometry.panels,
      layout,
      viewport: view,
      options: {
        grid: true,
        gridStep: view ? visibleGridStep(view, size.width, { screenHeight: size.height }) : 10,
        selectedPanelId: editor.selection?.id ?? null,
        hoveredPanelId: editor.hoveredPanelId,
      },
    });
    publish();
  }

  function publish() {
    const selected = findPanel(editor.selection?.id);
    onChange?.({
      selection: editor.selection,
      hoveredPanelId: editor.hoveredPanelId,
      viewport: getViewport(),
      interaction: editor.interaction,
      snap: editor.snap,
      warnings: geometry && layout ? layoutWarnings(geometry.panels, layout) : { overlap: false, tight: false, messages: [] },
      info: selected ? describePanel(selected.panel, selected.placement) : null,
      invalid: !geometry,
      issues,
    });
  }

  function onWheel(event) {
    const svg = container.querySelector("svg");
    if (!svg || !view || !geometry || drag) return;
    event.preventDefault();
    const anchor = screenToWorld({
      clientX: event.clientX,
      clientY: event.clientY,
      viewport: view,
      rect: svg.getBoundingClientRect(),
    });
    zoom(event.deltaY < 0 ? 1.12 : 1 / 1.12, anchor);
  }

  function onPointerDown(event) {
    const svg = container.querySelector("svg");
    if (!svg || !view || !geometry || !layout) return;
    if (event.button !== 0 && event.button !== 1) return;
    if (event.button === 1) event.preventDefault();
    const panel = event.target.closest?.("[data-panel-id]");
    const panelId = panel?.dataset.panelId ?? null;
    const intent = pointerIntent({ button: event.button, space: spaceDown, onPanel: Boolean(panelId) });
    const world = screenToWorld({
      clientX: event.clientX,
      clientY: event.clientY,
      viewport: view,
      rect: svg.getBoundingClientRect(),
    });
    if (intent === "select") {
      const found = findPanel(panelId);
      editor.selectPanel(panelId);
      onSelect?.(panelId);
      drag = {
        mode: "select",
        id: panelId,
        x: event.clientX,
        y: event.clientY,
        world,
        placement: { x: found.placement.x, y: found.placement.y },
        placementsBefore: clonePlacements(layout),
        moved: false,
      };
    } else {
      editor.begin("pan", { x: world.x, y: world.y });
      drag = {
        mode: "pan",
        id: panelId,
        x: event.clientX,
        y: event.clientY,
        origin: { ...view },
        moved: false,
      };
    }
    container.setPointerCapture?.(event.pointerId);
    draw();
  }

  function onPointerMove(event) {
    if (!drag) {
      updateHover(event);
      return;
    }
    const distance = Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
    if (drag.mode === "select") {
      if (distance <= DRAG_THRESHOLD) return;
      drag.mode = "drag-panel";
      drag.moved = true;
      editor.begin("drag-panel", { x: drag.world.x, y: drag.world.y }, { ...drag.placement });
    }
    if (drag.mode === "drag-panel") {
      const svg = container.querySelector("svg");
      if (!svg) return;
      const world = screenToWorld({
        clientX: event.clientX,
        clientY: event.clientY,
        viewport: view,
        rect: svg.getBoundingClientRect(),
      });
      const next = draggedPlacement(
        drag.placement,
        { x: world.x - drag.world.x, y: world.y - drag.world.y },
        editor.snap,
      );
      layout = movePanel(layout, drag.id, next.x, next.y);
      draw();
      return;
    }
    if (distance <= DRAG_THRESHOLD) return;
    drag.moved = true;
    const svg = container.querySelector("svg");
    if (!svg || !drag.origin) return;
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / drag.origin.width, rect.height / drag.origin.height);
    if (!(scale > 0)) return;
    const panned = panView(drag.origin, (event.clientX - drag.x) / scale, (event.clientY - drag.y) / scale);
    view = { ...panned, scale: drag.origin.scale };
    draw();
  }

  function onPointerUp(event) {
    if (!drag) return;
    const distance = Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
    const moved = drag.moved || distance > DRAG_THRESHOLD;
    if (drag.mode === "drag-panel" && moved) {
      const found = findPanel(drag.id);
      if (found && (found.placement.x !== drag.placement.x || found.placement.y !== drag.placement.y)) {
        history.push(drag.placementsBefore);
      }
    }
    const release = resolvePointerRelease({
      intent: drag.mode === "select" && moved ? "drag-panel" : drag.mode,
      moved,
      panelId: drag.id,
    });
    drag = null;
    editor.end();
    if (release.clear) editor.clearSelection();
    if (container.hasPointerCapture?.(event.pointerId)) container.releasePointerCapture(event.pointerId);
    draw();
    if (release.clear) onSelect?.(null);
  }

  function onPointerLeave() {
    if (drag) return;
    if (editor.hoveredPanelId) {
      editor.hover(null);
      draw();
    }
  }

  function updateHover(event) {
    const panel = event.target?.closest?.("[data-panel-id]");
    const id = panel?.dataset.panelId ?? null;
    if (id === editor.hoveredPanelId) return;
    editor.hover(id);
    draw();
  }

  function onKeyDown(event) {
    const typing = isTypingTarget(event.target);
    if (event.code === "Space") {
      if (typing) return;
      event.preventDefault();
      spaceDown = true;
      return;
    }
    const action = applyShortcut(event.key, {
      ctrl: event.ctrlKey || event.metaKey,
      shift: event.shiftKey,
      typing,
    });
    if (action.type === "ignore") return;
    if (action.type === "noop-delete") {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    if (action.type === "fit") {
      if (!drag) fitToView();
      return;
    }
    if (action.type === "undo") {
      undo();
      return;
    }
    if (action.type === "redo") {
      redo();
      return;
    }
    if (action.type === "cancel") {
      if (drag?.mode === "drag-panel" || drag?.mode === "select") {
        layout = { ...layout, placements: drag.placementsBefore };
      }
      drag = null;
      editor.clearSelection();
      editor.end();
      draw();
      onSelect?.(null);
    }
  }

  function onKeyUp(event) {
    if (event.code === "Space") spaceDown = false;
  }

  function findPanel(panelId) {
    if (!panelId || !geometry || !layout) return null;
    const panel = geometry.panels.find((item) => item.id === panelId);
    const placement = layout.placements.find((item) => item.panelId === panelId);
    if (!panel || !placement) return null;
    return { panel, placement };
  }

  function containerSize() {
    const rect = container.getBoundingClientRect();
    return {
      width: rect.width || 640,
      height: rect.height || 420,
    };
  }

  function destroy() {
    container.removeEventListener("wheel", onWheel);
    container.removeEventListener("pointerdown", onPointerDown);
    container.removeEventListener("pointermove", onPointerMove);
    container.removeEventListener("pointerup", onPointerUp);
    container.removeEventListener("pointercancel", onPointerUp);
    container.removeEventListener("pointerleave", onPointerLeave);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  }

  return {
    show,
    showIssues,
    selectPanel,
    getPanelElement,
    setViewportTransform,
    fitToView,
    resetView,
    zoom,
    pan,
    getViewport,
    setSnap,
    undo,
    redo,
    getPanelBounds: boundsFor,
    geometryHash,
    destroy,
  };
}

function cloneLayout(layout) {
  return {
    ...layout,
    placements: clonePlacements(layout),
  };
}

function clonePlacements(layout) {
  return (layout?.placements ?? []).map((placement) => ({ ...placement }));
}

function isTypingTarget(target) {
  const tag = target?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable;
}

function cssEscape(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}
