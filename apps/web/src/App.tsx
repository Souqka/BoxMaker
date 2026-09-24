import {
  buildProduct,
  createEngravingItem,
  createPresetBox,
  duplicateEngraving,
  MATERIAL_PRESETS,
  MODEL_ASSUMPTIONS,
  moveEngraving,
  removeEngraving,
  rotateEngraving,
  scaleEngraving,
  snapToStep,
  suggestTabSlotPreset,
  type BoxModel,
  type EngravingSource,
  type PanelId,
} from "@fanera/core";
import { useMemo, useState } from "react";
import { Parameters } from "./Parameters.tsx";
import { Viewport } from "./Viewport.tsx";
import { PANEL_LABELS, PANEL_ORDER } from "./labels.ts";

export function App() {
  const [model, setModel] = useState<BoxModel>(() => createPresetBox());
  const [selectedPanel, setSelectedPanel] = useState<PanelId>("front");
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [snap, setSnap] = useState(true);
  const result = useMemo(() => buildProduct(model), [model]);

  function update(patch: (current: BoxModel) => BoxModel) {
    setModel((current) => patch(current));
  }

  function maybeSnap(value: number): number {
    return snap && model.render.gridStep > 0 ? snapToStep(value, model.render.gridStep) : value;
  }

  async function addLogo(file: File) {
    if (!result.ok) return;
    const panel = result.panels.find((item) => item.id === selectedPanel);
    if (!panel) return;
    const source = sourceOf(file);
    const content = await readDataUrl(file);
    const width = Math.min(80, panel.nominalWidth * 0.45);
    const height = Math.min(40, panel.nominalHeight * 0.35);
    const item = createEngravingItem({
      panelId: selectedPanel,
      x: maybeSnap(panel.nominalWidth / 2),
      y: maybeSnap(panel.nominalHeight / 2),
      width: Math.max(maybeSnap(width), 5),
      height: Math.max(maybeSnap(height), 5),
      source,
      name: file.name,
      content,
    });
    update((current) => ({ ...current, engraving: [...current.engraving, item] }));
    setSelectedLogo(item.id);
  }

  const selected = model.engraving.find((item) => item.id === selectedLogo) ?? null;

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Fanera Brains</p>
          <h1>Конструктор коробок</h1>
        </div>
        <p className="topbar-note">Фанера, отдельные панели, соединение паз + шип. Размеры в миллиметрах.</p>
      </header>

      <Parameters model={model} onChange={update} />

      <main className="stage">
        <Viewport
          result={result}
          selectedPanel={selectedPanel}
          onSelectPanel={(id) => {
            setSelectedPanel(id);
            setSelectedLogo(null);
          }}
        />
        {result.ok ? (
          <div className="readout">
            <SizeBlock title="Внешние" width={result.dimensions.external.width} depth={result.dimensions.external.depth} height={result.dimensions.external.height} />
            <SizeBlock title="Внутренние" width={result.dimensions.internal.width} depth={result.dimensions.internal.depth} height={result.dimensions.internal.height} />
            <p className="mode-note">
              Заданные {model.dimensions.width} × {model.dimensions.depth} × {model.dimensions.height} мм —{" "}
              {model.dimensions.mode === "external" ? "внешний габарит" : "полезный внутренний объём"}.
            </p>
          </div>
        ) : (
          <ul className="issues">
            {result.issues.filter((issue) => issue.severity === "error").map((issue) => (
              <li key={`${issue.code}-${issue.path ?? ""}`}>{issue.message}</li>
            ))}
          </ul>
        )}
      </main>

      <aside className="side">
        <section>
          <h2>Панели</h2>
          <ul className="panel-list">
            {PANEL_ORDER.map((id) => {
              const panel = result.ok ? result.panels.find((item) => item.id === id) : undefined;
              return (
                <li key={id}>
                  <button type="button" className={id === selectedPanel ? "is-active" : ""} onClick={() => setSelectedPanel(id)}>
                    <span>{PANEL_LABELS[id]}</span>
                    <span>{panel ? `${trim(panel.nominalWidth)} × ${trim(panel.nominalHeight)}` : "—"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h2>Гравировка</h2>
          <p className="hint">Файл ложится в координаты выбранной панели, не в пиксели экрана.</p>
          <label className="file">
            Загрузить SVG, PNG или JPG
            <input
              type="file"
              accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void addLogo(file);
                event.target.value = "";
              }}
            />
          </label>
          <label className="check">
            <input type="checkbox" checked={snap} onChange={(event) => setSnap(event.target.checked)} />
            Привязка к сетке {model.render.gridStep} мм
          </label>
          <ul className="logo-list">
            {model.engraving.map((item) => (
              <li key={item.id}>
                <button type="button" className={item.id === selectedLogo ? "is-active" : ""} onClick={() => { setSelectedLogo(item.id); setSelectedPanel(item.panelId); }}>
                  {item.name}
                  <span>{PANEL_LABELS[item.panelId]}</span>
                </button>
              </li>
            ))}
          </ul>
          {selected ? (
            <div className="logo-fields">
              <NumberField label="X центра" value={selected.x} onChange={(x) => update((current) => ({ ...current, engraving: moveEngraving(current.engraving, selected.id, maybeSnap(x), selected.y) }))} />
              <NumberField label="Y центра" value={selected.y} onChange={(y) => update((current) => ({ ...current, engraving: moveEngraving(current.engraving, selected.id, selected.x, maybeSnap(y)) }))} />
              <NumberField label="Ширина" value={selected.width} onChange={(width) => update((current) => ({ ...current, engraving: scaleEngraving(current.engraving, selected.id, maybeSnap(width), selected.height) }))} />
              <NumberField label="Высота" value={selected.height} onChange={(height) => update((current) => ({ ...current, engraving: scaleEngraving(current.engraving, selected.id, selected.width, maybeSnap(height)) }))} />
              <NumberField label="Поворот °" value={selected.rotation} step={1} onChange={(rotation) => update((current) => ({ ...current, engraving: rotateEngraving(current.engraving, selected.id, rotation) }))} />
              <div className="row">
                <button
                  type="button"
                  onClick={() => {
                    const copy = duplicateEngraving(model.engraving, selected.id, { dx: model.render.gridStep || 5, dy: model.render.gridStep || 5 });
                    const created = copy[copy.length - 1];
                    update((current) => ({ ...current, engraving: copy }));
                    if (created) setSelectedLogo(created.id);
                  }}
                >
                  Дублировать
                </button>
                <button
                  type="button"
                  onClick={() => {
                    update((current) => ({ ...current, engraving: removeEngraving(current.engraving, selected.id) }));
                    setSelectedLogo(null);
                  }}
                >
                  Удалить
                </button>
              </div>
            </div>
          ) : null}
          {result.ok
            ? result.issues
                .filter((issue) => issue.severity === "warning")
                .map((issue) => (
                  <p key={`${issue.code}-${issue.path ?? ""}`} className="warning">
                    {issue.message}
                  </p>
                ))
            : null}
        </section>

        <section>
          <h2>Допущения модели</h2>
          <ul className="assumptions">
            {MODEL_ASSUMPTIONS.map((item) => (
              <li key={item.id}>{item.text}</li>
            ))}
          </ul>
          <button
            type="button"
            className="quiet"
            onClick={() => {
              const preset = suggestTabSlotPreset(model.material.thickness, model.material.clearance);
              update((current) => ({
                ...current,
                joint: { ...current.joint, tabWidth: preset.tabWidth, edgeMargin: preset.edgeMargin, minGap: preset.minGap },
              }));
            }}
          >
            Подставить стартовые шипы
          </button>
          <p className="hint">Пресеты толщины: {MATERIAL_PRESETS.map((item) => `${item.thickness} мм`).join(", ")}. Ядро принимает и любую другую толщину.</p>
        </section>
      </aside>
    </div>
  );
}

function SizeBlock({ title, width, depth, height }: { title: string; width: number; depth: number; height: number }) {
  return (
    <div>
      <span>{title}</span>
      <strong>
        {trim(width)} × {trim(depth)} × {trim(height)}
      </strong>
    </div>
  );
}

function NumberField({ label, value, step = 0.1, onChange }: { label: string; value: number; step?: number; onChange: (value: number) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => {
          if (Number.isFinite(event.target.valueAsNumber)) onChange(event.target.valueAsNumber);
        }}
      />
    </label>
  );
}

function sourceOf(file: File): EngravingSource {
  const name = file.name.toLowerCase();
  if (file.type === "image/png" || name.endsWith(".png")) return "png";
  if (file.type === "image/jpeg" || name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpg";
  return "svg";
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function trim(value: number): string {
  return String(Math.round(value * 100) / 100);
}
