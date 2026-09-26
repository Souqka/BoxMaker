import { buildBoxGeometry } from "./src/geometry/box.js";
import { createBox } from "./src/models/BoxModel.js";
import { createSheetView } from "./src/renderers/sheetView.js";

/**
 * Temporary development readout. Remove this element from the page,
 * or set the flag to false, and the block disappears.
 */
const SHOW_DIMENSION_DEBUG = true;

const form = document.querySelector("#box-form");
const errors = document.querySelector("#errors");
const readout = document.querySelector("#readout");
const sheet = document.querySelector("#sheet");
const debug = document.querySelector("#dimension-debug");
const selectionReadout = document.querySelector("#selection-readout");
const view = createSheetView(sheet, {
  onSelect(panelId) {
    selectionReadout.textContent = panelId ? `Выбрана: ${panelId}` : "Панель не выбрана";
  },
});

document.querySelector("#zoom-in").addEventListener("click", () => view.zoom(1.25));
document.querySelector("#zoom-out").addEventListener("click", () => view.zoom(1 / 1.25));
document.querySelector("#zoom-fit").addEventListener("click", () => view.fitToView());

form.addEventListener("input", render);
form.addEventListener("change", render);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  render();
});

render();

function render() {
  const box = createBox(readForm(form));
  const result = buildBoxGeometry(box);
  renderDebug(box, result);

  if (!result.ok) {
    view.showIssues(result.issues);
    selectionReadout.textContent = "Панель не выбрана";
    readout.textContent = "Модель не собрана.";
    errors.hidden = false;
    errors.textContent = result.issues.map((issue) => issue.message).join(" ");
    return;
  }

  errors.hidden = true;
  errors.textContent = "";
  readout.replaceChildren(readoutFragment(box, result.geometry));
  view.show(result.geometry);
  selectionReadout.textContent = "Панель не выбрана";
}

function readForm(source) {
  return {
    width: numberValue(source.elements.width),
    depth: numberValue(source.elements.depth),
    height: numberValue(source.elements.height),
    dimensionMode: source.elements.dimensionMode.value,
    material: {
      thickness: numberValue(source.elements.thickness),
      kerf: 0,
      clearance: 0,
    },
    construction: "tab-slot",
  };
}

function numberValue(control) {
  if (control instanceof HTMLInputElement && control.type === "number") return control.valueAsNumber;
  return Number(control.value);
}

function readoutFragment(box, geometry) {
  const { external, internal } = geometry.dimensions;
  const wrapper = document.createElement("div");
  wrapper.innerHTML =
    `<div>Внешние ${formatSize(external)}</div>` +
    `<div>Внутренние ${formatSize(internal)}</div>` +
    `<div>Режим ввода: ${box.dimensionMode === "external" ? "внешние" : "внутренние"}, толщина ${formatMm(box.material.thickness)}</div>`;
  return wrapper;
}

function renderDebug(box, result) {
  if (!SHOW_DIMENSION_DEBUG || !debug) return;
  debug.hidden = false;
  const dimensions = result.ok ? result.geometry.dimensions : null;
  setDebug("input", `${formatMm(box.width)} × ${formatMm(box.depth)} × ${formatMm(box.height)}`);
  setDebug("mode", box.dimensionMode);
  setDebug("thickness", formatMm(box.material.thickness));
  setDebug("external", dimensions ? formatSize(dimensions.external) : "—");
  setDebug("internal", dimensions ? formatSize(dimensions.internal) : "—");
}

function setDebug(name, text) {
  debug.querySelector(`[data-debug="${name}"]`).textContent = text;
}

function formatSize(size) {
  return `${formatMm(size.width)} × ${formatMm(size.depth)} × ${formatMm(size.height)}`;
}

function formatMm(value) {
  if (!Number.isFinite(value)) return "—";
  return `${trim(value)} мм`;
}

function trim(value) {
  return String(Math.round(value * 1000) / 1000);
}
