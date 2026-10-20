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
const inspectorTitle = document.querySelector("#inspector-title");
const inspectorBody = document.querySelector("#inspector-body");
const view = createSheetView(sheet, {
  onChange: renderInspector,
});

document.querySelector("#zoom-in").addEventListener("click", () => view.zoom(1.25));
document.querySelector("#zoom-out").addEventListener("click", () => view.zoom(1 / 1.25));
document.querySelector("#zoom-fit").addEventListener("click", () => view.fitToView());
document.querySelector("#zoom-reset").addEventListener("click", () => view.resetView());
document.querySelector("#snap-toggle").addEventListener("change", (event) => {
  view.setSnap(event.target.checked, 5);
});

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
    readout.textContent = "Модель не собрана.";
    errors.hidden = false;
    errors.textContent = result.issues.map((issue) => issue.message).join(" ");
    return;
  }

  errors.hidden = true;
  errors.textContent = "";
  readout.replaceChildren(readoutFragment(box, result.geometry));
  view.show(result.geometry);
}

function renderInspector(snapshot) {
  if (!inspectorTitle || !inspectorBody) return;
  if (!snapshot?.info) {
    inspectorTitle.textContent = "Деталь";
    inspectorBody.textContent = snapshot?.invalid ? "Модель не собрана." : "Выберите деталь";
    return;
  }
  const info = snapshot.info;
  inspectorTitle.textContent = info.title;
  const rows = [
    ["Ширина", `${trim(info.width)} мм`],
    ["Высота", `${trim(info.height)} мм`],
    ["X", `${trim(info.x)} мм`],
    ["Y", `${trim(info.y)} мм`],
    ["Поворот", `${trim(info.rotation)}°`],
  ];
  const list = document.createElement("dl");
  for (const [name, value] of rows) {
    const term = document.createElement("dt");
    term.textContent = name;
    const detail = document.createElement("dd");
    detail.textContent = value;
    list.append(term, detail);
  }
  const note = document.createElement("p");
  note.className = "hint";
  note.textContent = "X вправо, Y вверх, миллиметры листа. Ширина и высота без поворота.";
  inspectorBody.replaceChildren(list, note);
  for (const message of snapshot.warnings?.messages ?? []) {
    const warning = document.createElement("p");
    warning.className = "warning";
    warning.textContent = message;
    inspectorBody.append(warning);
  }
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
