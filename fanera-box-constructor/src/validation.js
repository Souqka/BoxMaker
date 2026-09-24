/**
 * Input checks only. Construction math does not live here.
 * @returns {{ code: string, message: string, path: string }[]}
 */
export function validateBox(box) {
  const issues = [];

  requireFinite(issues, box?.width, "width", "Ширина");
  requireFinite(issues, box?.depth, "depth", "Глубина");
  requireFinite(issues, box?.height, "height", "Высота");
  requireFinite(issues, box?.material?.thickness, "material.thickness", "Толщина");
  requireFinite(issues, box?.material?.kerf, "material.kerf", "Керф");
  requireFinite(issues, box?.material?.clearance, "material.clearance", "Clearance");

  if (issues.length > 0) return issues;

  requirePositive(issues, box.width, "width", "Ширина");
  requirePositive(issues, box.depth, "depth", "Глубина");
  requirePositive(issues, box.height, "height", "Высота");
  requirePositive(issues, box.material.thickness, "material.thickness", "Толщина");

  if (box.material.kerf < 0) {
    issues.push(issue("kerf-negative", "Керф не может быть отрицательным.", "material.kerf"));
  }
  if (box.material.clearance < 0) {
    issues.push(issue("clearance-negative", "Clearance не может быть отрицательным.", "material.clearance"));
  }
  if (box.dimensionMode !== "external" && box.dimensionMode !== "internal") {
    issues.push(issue("invalid-dimension-mode", "Режим размеров должен быть external или internal.", "dimensionMode"));
  }

  return issues;
}

function requireFinite(issues, value, path, label) {
  if (!Number.isFinite(value)) {
    issues.push(issue("not-finite", `${label} должно быть числом.`, path));
  }
}

function requirePositive(issues, value, path, label) {
  if (!(value > 0)) {
    issues.push(issue("not-positive", `${label} должна быть больше нуля.`, path));
  }
}

function issue(code, message, path) {
  return { code, message, path };
}
