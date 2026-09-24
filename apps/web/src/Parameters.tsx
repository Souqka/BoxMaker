import { MATERIAL_PRESETS, type BoxModel, type DimensionMode } from "@fanera/core";

interface ParametersProps {
  model: BoxModel;
  onChange: (patch: (current: BoxModel) => BoxModel) => void;
}

export function Parameters({ model, onChange }: ParametersProps) {
  function setDimensions(patch: Partial<BoxModel["dimensions"]>) {
    onChange((current) => ({ ...current, dimensions: { ...current.dimensions, ...patch } }));
  }

  return (
    <form className="parameters" onSubmit={(event) => event.preventDefault()}>
      <fieldset>
        <legend>Размеры, мм</legend>
        <div className="mode">
          <ModeButton mode="external" current={model.dimensions.mode} onSelect={(mode) => setDimensions({ mode })} label="Внешние" />
          <ModeButton mode="internal" current={model.dimensions.mode} onSelect={(mode) => setDimensions({ mode })} label="Внутренние" />
        </div>
        <NumberField label="Ширина" value={model.dimensions.width} onChange={(width) => setDimensions({ width })} />
        <NumberField label="Глубина" value={model.dimensions.depth} onChange={(depth) => setDimensions({ depth })} />
        <NumberField label="Высота" value={model.dimensions.height} onChange={(height) => setDimensions({ height })} />
      </fieldset>

      <fieldset>
        <legend>Материал</legend>
        <div className="presets">
          {MATERIAL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={model.material.thickness === preset.thickness ? "is-active" : ""}
              onClick={() =>
                onChange((current) => ({
                  ...current,
                  material: {
                    ...current.material,
                    id: preset.id,
                    name: preset.name,
                    thickness: preset.thickness,
                  },
                }))
              }
            >
              {preset.thickness} мм
            </button>
          ))}
        </div>
        <NumberField
          label="Толщина"
          step={0.1}
          value={model.material.thickness}
          onChange={(thickness) =>
            onChange((current) => ({
              ...current,
              material: { ...current.material, id: "sheet", name: "Листовой материал", thickness },
            }))
          }
        />
        <NumberField
          label="Керф"
          step={0.01}
          value={model.material.kerf}
          onChange={(kerf) => onChange((current) => ({ ...current, material: { ...current.material, kerf } }))}
        />
        <NumberField
          label="Clearance"
          step={0.01}
          value={model.material.clearance}
          onChange={(clearance) => onChange((current) => ({ ...current, material: { ...current.material, clearance } }))}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={model.render.kerfCompensation}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                render: { ...current.render, kerfCompensation: event.target.checked },
              }))
            }
          />
          Компенсация керфа на траектории реза
        </label>
      </fieldset>

      <fieldset>
        <legend>Паз + шип</legend>
        <NumberField
          label="Ширина шипа"
          step={0.1}
          value={model.joint.tabWidth}
          onChange={(tabWidth) => onChange((current) => ({ ...current, joint: { ...current.joint, tabWidth } }))}
        />
        <NumberField
          label="Поле кромки"
          step={0.1}
          value={model.joint.edgeMargin}
          onChange={(edgeMargin) => onChange((current) => ({ ...current, joint: { ...current.joint, edgeMargin } }))}
        />
        <NumberField
          label="Мин. промежуток"
          step={0.1}
          value={model.joint.minGap}
          onChange={(minGap) => onChange((current) => ({ ...current, joint: { ...current.joint, minGap } }))}
        />
        <NumberField
          label="Сетка"
          step={1}
          value={model.render.gridStep}
          onChange={(gridStep) => onChange((current) => ({ ...current, render: { ...current.render, gridStep } }))}
        />
      </fieldset>
    </form>
  );
}

function ModeButton({
  mode,
  current,
  label,
  onSelect,
}: {
  mode: DimensionMode;
  current: DimensionMode;
  label: string;
  onSelect: (mode: DimensionMode) => void;
}) {
  return (
    <button type="button" className={current === mode ? "is-active" : ""} onClick={() => onSelect(mode)}>
      {label}
    </button>
  );
}

function NumberField({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode="decimal"
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
