import { getConstruction } from "../dimension/constructions.ts";
import { resolveDimensions } from "../dimension/resolveDimensions.ts";
import { closedBoxContacts, closedBoxPanelSizes } from "../geometry/closedBox.ts";
import { engravingBounds } from "../engraving/engraving.ts";
import { JointError } from "../joint/types.ts";
import { generateJoint } from "../joint/generateJoint.ts";
import type { BoxModel, PanelId, ValidationIssue } from "../model/types.ts";

const PANEL_IDS: readonly PanelId[] = ["front", "back", "left", "right", "bottom", "lid"];

const PANEL_LABEL: Record<PanelId, string> = {
  front: "перед",
  back: "зад",
  left: "лево",
  right: "право",
  bottom: "дно",
  lid: "крышка",
};

export function validateBox(model: BoxModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { dimensions, material, joint, fabrication } = model;

  requireFinite(issues, dimensions.width, "dimensions.width", "Ширина");
  requireFinite(issues, dimensions.depth, "dimensions.depth", "Глубина");
  requireFinite(issues, dimensions.height, "dimensions.height", "Высота");
  requireFinite(issues, material.thickness, "material.thickness", "Толщина");
  requireFinite(issues, material.kerf, "material.kerf", "Керф");
  requireFinite(issues, material.clearance, "material.clearance", "Clearance");
  requireFinite(issues, joint.tabWidth, "joint.tabWidth", "Ширина шипа");
  requireFinite(issues, joint.edgeMargin, "joint.edgeMargin", "Поле кромки");
  requireFinite(issues, joint.minGap, "joint.minGap", "Промежуток между шипами");
  requireFinite(issues, fabrication.minimumFeatureSize, "fabrication.minimumFeatureSize", "Минимальный элемент");
  requireFinite(issues, fabrication.minimumPanelSize, "fabrication.minimumPanelSize", "Минимальная панель");

  if (dimensions.mode !== "external" && dimensions.mode !== "internal") {
    issues.push(issue("invalid-dimension-mode", "Режим размеров должен быть external или internal.", "dimensions.mode"));
  }
  if (issues.some((item) => item.severity === "error")) return issues;

  if (!(dimensions.width > 0) || !(dimensions.depth > 0) || !(dimensions.height > 0)) {
    issues.push(issue("invalid-dimensions", "Ширина, глубина и высота должны быть больше нуля.", "dimensions"));
  }
  if (!(material.thickness > 0)) {
    issues.push(issue("invalid-thickness", "Толщина материала должна быть больше нуля.", "material.thickness"));
  }
  if (material.kerf < 0) {
    issues.push(issue("invalid-kerf", "Керф не может быть отрицательным.", "material.kerf"));
  }
  if (material.clearance < 0) {
    issues.push(issue("invalid-clearance", "Clearance не может быть отрицательным.", "material.clearance"));
  }
  if (!(joint.tabWidth > 0)) {
    issues.push(issue("invalid-tab-width", "Ширина шипа должна быть больше нуля.", "joint.tabWidth"));
  }
  if (joint.edgeMargin < 0 || joint.minGap < 0) {
    issues.push(issue("invalid-joint-gaps", "Поле кромки и промежуток между шипами не могут быть отрицательными.", "joint"));
  }
  if (fabrication.minimumFeatureSize < 0 || fabrication.minimumPanelSize < 0) {
    issues.push(issue("invalid-fabrication", "Ограничения изготовления не могут быть отрицательными.", "fabrication"));
  }
  if (model.layout.spacing < 0 || model.layout.margin < 0 || !(model.layout.maxRowWidth > 0)) {
    issues.push(issue("invalid-layout", "Поля листа, зазор и ширина ряда должны быть корректными.", "layout"));
  }
  if (issues.some((item) => item.severity === "error")) return issues;

  if (joint.tabWidth < fabrication.minimumFeatureSize) {
    issues.push(
      issue(
        "feature-too-small",
        `Ширина шипа ${formatMm(joint.tabWidth)} мм меньше минимального элемента ${formatMm(fabrication.minimumFeatureSize)} мм.`,
        "joint.tabWidth",
      ),
    );
  }
  if (material.thickness < fabrication.minimumFeatureSize) {
    issues.push(
      issue(
        "feature-too-small",
        `Толщина ${formatMm(material.thickness)} мм меньше минимального элемента ${formatMm(fabrication.minimumFeatureSize)} мм.`,
        "material.thickness",
      ),
    );
  }

  const minMargin = material.thickness + material.clearance * 1.5;
  if (joint.edgeMargin + 1e-9 < minMargin) {
    issues.push(
      issue(
        "edge-margin-too-small",
        `Поле кромки ${formatMm(joint.edgeMargin)} мм меньше минимума этой конструкции ${formatMm(minMargin)} мм (толщина + 1.5 × clearance). Иначе угловые пазы пересекаются.`,
        "joint.edgeMargin",
      ),
    );
  }

  const construction = getConstruction(model.construction);
  const resolved = resolveDimensions({
    dimensions,
    thickness: material.thickness,
    construction,
  });

  if (resolved.internal.width <= 0 || resolved.internal.depth <= 0 || resolved.internal.height <= 0) {
    issues.push(
      issue(
        "internal-non-positive",
        `Внутренний размер получается ${formatMm(resolved.internal.width)} × ${formatMm(resolved.internal.depth)} × ${formatMm(resolved.internal.height)} мм. Для этой конструкции внешний габарит по оси должен быть больше числа толщин × толщина.`,
        "dimensions",
      ),
    );
    return issues;
  }

  const panels = closedBoxPanelSizes(resolved.external, material.thickness, construction);
  for (const id of PANEL_IDS) {
    const panel = panels[id];
    if (panel.width + 1e-9 < fabrication.minimumPanelSize || panel.height + 1e-9 < fabrication.minimumPanelSize) {
      issues.push(
        issue(
          "panel-too-small",
          `Панель «${PANEL_LABEL[id]}» ${formatMm(panel.width)} × ${formatMm(panel.height)} мм меньше минимального размера ${formatMm(fabrication.minimumPanelSize)} мм.`,
          `panels.${id}`,
        ),
      );
    }
  }
  if (issues.some((item) => item.code === "panel-too-small")) return issues;

  for (const spec of closedBoxContacts(resolved.external, material.thickness, construction)) {
    try {
      generateJoint(
        { length: spec.length, role: "slot", partnerThickness: material.thickness },
        {
          type: "tab-slot",
          tabWidth: joint.tabWidth,
          edgeMargin: joint.edgeMargin,
          minGap: joint.minGap,
          clearance: material.clearance,
          tabCount: joint.tabCount,
        },
      );
    } catch (error) {
      const message = error instanceof JointError ? error.message : "Не удалось построить соединение.";
      const code = error instanceof JointError ? error.code : "joint-failed";
      issues.push(issue(code, `${spec.id}: ${message}`, "joint"));
    }
  }

  const knownPanels = new Set(PANEL_IDS);
  for (const item of model.engraving) {
    if (!knownPanels.has(item.panelId)) {
      issues.push(issue("engraving-panel", `Гравировка «${item.name}» ссылается на неизвестную панель.`, `engraving.${item.id}`));
      continue;
    }
    if (!(item.width > 0) || !(item.height > 0)) {
      issues.push(issue("engraving-size", `Гравировка «${item.name}» должна иметь положительные ширину и высоту.`, `engraving.${item.id}`));
      continue;
    }
    const panel = panels[item.panelId];
    const bounds = engravingBounds(item);
    const left = item.x - bounds.width / 2;
    const right = item.x + bounds.width / 2;
    const bottom = item.y - bounds.height / 2;
    const top = item.y + bounds.height / 2;
    if (left < -1e-6 || bottom < -1e-6 || right > panel.width + 1e-6 || top > panel.height + 1e-6) {
      issues.push(
        issue(
          "engraving-outside-panel",
          `Гравировка «${item.name}» выходит за номинальный контур панели «${item.panelId}».`,
          `engraving.${item.id}`,
          "warning",
        ),
      );
    }
  }

  return issues;
}

function requireFinite(issues: ValidationIssue[], value: number, path: string, label: string): void {
  if (!Number.isFinite(value)) {
    issues.push(issue("invalid-number", `${label} должно быть конечным числом.`, path));
  }
}

function issue(code: string, message: string, path?: string, severity: ValidationIssue["severity"] = "error"): ValidationIssue {
  return { code, message, path, severity };
}

function formatMm(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}
