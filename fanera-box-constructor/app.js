import { buildBoxGeometry } from "./src/geometry/box.js";
import { createBox } from "./src/models/BoxModel.js";
import { renderBoxToSvg } from "./src/renderers/svg.js";

const form = document.querySelector("#box-form");
const errors = document.querySelector("#errors");
const readout = document.querySelector("#readout");
const sheet = document.querySelector("#sheet");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const box = createBox(readForm(form));
  const result = buildBoxGeometry(box);

  if (!result.ok) {
    sheet.replaceChildren();
    readout.textContent = "Модель не собрана.";
    errors.hidden = false;
    errors.textContent = result.issues.map((issue) => issue.message).join(" ");
    return;
  }

  errors.hidden = true;
  errors.textContent = "";
  readout.replaceChildren(readoutFragment(box, result.geometry));
  sheet.innerHTML = renderBoxToSvg(result.geometry);
});

function readForm(source) {
  const data = new FormData(source);
  return {
    width: numberValue(source.elements.width),
    depth: numberValue(source.elements.depth),
    height: numberValue(source.elements.height),
    dimensionMode: String(data.get("dimensionMode")),
    material: {
      thickness: numberValue(source.elements.thickness),
      kerf: 0,
      clearance: 0,
    },
    construction: "tab-slot",
  };
}

function numberValue(input) {
  return input.valueAsNumber;
}

function readoutFragment(box, geometry) {
  const { external, internal, provisional } = geometry.dimensions;
  const wrapper = document.createElement("div");
  wrapper.innerHTML =
    `<div>Внешние ${formatSize(external)}</div>` +
    `<div>Внутренние ${formatSize(internal)}</div>` +
    `<div>Режим ввода: ${box.dimensionMode === "external" ? "внешние" : "внутренние"}, толщина ${box.material.thickness} мм</div>`;
  if (provisional) {
    const note = document.createElement("span");
    note.className = "note";
    note.textContent =
      "Пересчёт второго контура ещё не включён: Dimension Engine пока повторяет введённые размеры. Формулу по панелям можно подставить в joint.projectOppositeEnvelope, не меняя эту страницу.";
    wrapper.append(note);
  }
  return wrapper;
}

function formatSize(size) {
  return `${trim(size.width)} × ${trim(size.depth)} × ${trim(size.height)} мм`;
}

function trim(value) {
  return String(Math.round(value * 100) / 100);
}
