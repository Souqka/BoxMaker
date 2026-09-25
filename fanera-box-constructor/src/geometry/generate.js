import { createJoint, planFingers } from "./joints.js";
import { layoutPanels } from "./layout.js";
import { tracePanel } from "./outline.js";
import { validatePanelSize } from "./panelLimits.js";
import { BOX_PANEL_IDS } from "./panels.js";
import { boundingBox, dedupePoints, outlineProblems } from "./primitives.js";
import { normalizeDimensions } from "./dimensions.js";

/**
 * Geometry Engine. Millimetres only. No DOM.
 *
 * Closed tab-slot box. Caps (bottom, lid) are the outer footprint and carry
 * slots. Front and back carry tabs into the caps and slots for the sides.
 * side-1 and side-2 carry tabs on every edge. Tab length and slot depth equal
 * the sheet thickness, so the flat bounding box is the outer face:
 * lid/bottom W×D, front/back W×H, sides D×H.
 *
 * A plain margin of one thickness would let perpendicular slots meet. The
 * extra corner land is min(thickness, room/4), and it must stay wider than
 * half the clearance. Room is the internal size of that axis. Kerf is kept
 * on the material and is not applied to this nominal outline.
 */

const PANEL_ORDER = BOX_PANEL_IDS;

export function generateBoxGeometry({
  dimensions = {},
  material = {},
  joint = { type: "tab-slot" },
  layout = {},
} = {}) {
  let jointModel;
  try {
    jointModel = asJoint(joint);
  } catch (cause) {
    return invalid([issue("joint", cause.code ?? "UNSUPPORTED_JOINT", cause.message)]);
  }

  const normalized = normalizeDimensions({
    dimensions: dimensions.external ?? dimensions,
    dimensionMode: "external",
    material,
  });
  if (!normalized.valid) return invalid(normalized.errors);

  const external = normalized.dimensions;
  const sheet = normalized.material;
  const internal = dimensions.internal ?? subtractAdjustment(external, jointModel, sheet);
  const internalErrors = internalSizeErrors(internal);
  if (internalErrors.length > 0) return invalid(internalErrors);

  const adjustment = jointModel.getDimensionAdjustment(sheet);
  const mismatch = envelopeMismatch(external, internal, adjustment);
  if (mismatch.length > 0) return invalid(mismatch);

  const prepared = prepareAxes(external, sheet, jointModel);
  if (prepared.errors.length > 0) return invalid(prepared.errors);

  const panels = [];
  for (const id of PANEL_ORDER) {
    const built = buildPanel(id, external, sheet, prepared.axes, jointModel);
    if (built.error) return invalid([built.error]);
    panels.push(built.panel);
  }

  const limitErrors = panels
    .map((panel) => validatePanelSize(panel))
    .filter(Boolean)
    .map(panelLimitIssue);
  if (limitErrors.length > 0) return invalid(limitErrors);

  const gap = layout.gap ?? 10;
  const arranged = layoutPanels(panels, { gap, margin: layout.margin ?? 10 });

  return {
    box: {
      external: { ...external },
      internal: { ...internal },
      material: { ...sheet },
      construction: jointModel.type,
    },
    panels,
    layout: { ...arranged, gap },
    validation: { valid: true, errors: [] },
  };
}

function prepareAxes(external, material, jointModel) {
  const thickness = material.thickness;
  const clearance = material.clearance;
  const axes = {
    width: fitAxis(external.width - 2 * thickness, thickness, clearance, jointModel),
    depth: fitAxis(external.depth - 2 * thickness, thickness, clearance, jointModel),
    height: fitAxis(external.height - 2 * thickness, thickness, clearance, jointModel),
  };
  const errors = [];
  for (const [name, axis] of Object.entries(axes)) {
    if (!axis.ok) {
      errors.push(
        issue(
          name,
          axis.code,
          axis.code === "SLOT_WEB_TOO_SMALL"
            ? `${label(name)} joints would meet at the corners.`
            : `${label(name)} joints cannot fit tabs and slots.`,
          { span: axis.span, clearance, thickness },
        ),
      );
    }
  }
  return { axes, errors };
}

function fitAxis(room, thickness, clearance, jointModel) {
  if (!(room > 0)) return { ok: false, code: "FINGERS_CANNOT_FIT", span: room };
  const delta = Math.min(thickness, room / 4);
  const span = room - 2 * delta;
  if (!(delta > clearance / 2)) return { ok: false, code: "SLOT_WEB_TOO_SMALL", delta, span };
  if (!(span > 3 * clearance)) return { ok: false, code: "FINGERS_CANNOT_FIT", delta, span };
  const plan = jointModel.planFingers({ span, thickness, clearance });
  if (!plan || !(plan.tabWidth > 0)) return { ok: false, code: "FINGERS_CANNOT_FIT", delta, span };
  return { ok: true, delta, span, plan };
}

function buildPanel(id, external, material, axes, jointModel) {
  const thickness = material.thickness;
  const { width: boxWidth, depth, height } = external;
  const spec = panelEdges(id, boxWidth, depth, height, thickness, axes);
  for (const edge of spec.edges) {
    edge.role = jointModel.classifyEdge({ panelId: id, edge: edge.name });
    edge.thickness = thickness;
  }

  const traced = tracePanel(spec.edges);
  const outline = dedupePoints(traced.points);
  const problems = outlineProblems(outline);
  if (problems.length > 0) {
    return {
      error: issue(id, "SELF_INTERSECTING_OUTLINE", `${id} outline is not a simple polygon.`, {
        panelId: id,
        detail: problems[0],
      }),
    };
  }

  const box = boundingBox(outline);
  const normalized = outline.map((point) => ({ x: point.x - box.minX, y: point.y - box.minY }));
  const shifted = shiftFeatures(traced, box);

  return {
    panel: {
      id,
      width: box.width,
      height: box.height,
      outline: normalized,
      tabs: shifted.tabs,
      slots: shifted.slots,
      cutouts: [],
      engraving: [],
      orientation: { rotation: 0 },
      boundingBox: {
        minX: 0,
        minY: 0,
        maxX: box.width,
        maxY: box.height,
        width: box.width,
        height: box.height,
      },
    },
  };
}

function panelEdges(id, boxWidth, depth, height, thickness, axes) {
  if (id === "bottom" || id === "lid") {
    return {
      edges: [
        female("bottom", 0, 0, boxWidth, 0, 0, -1, thickness + axes.width.delta, axes.width.plan),
        female("right", boxWidth, 0, boxWidth, depth, 1, 0, thickness + axes.depth.delta, axes.depth.plan),
        female("top", boxWidth, depth, 0, depth, 0, 1, thickness + axes.width.delta, axes.width.plan),
        female("left", 0, depth, 0, 0, -1, 0, thickness + axes.depth.delta, axes.depth.plan),
      ],
    };
  }

  if (id === "front" || id === "back") {
    return {
      edges: [
        male("bottom", 0, thickness, boxWidth, thickness, 0, -1, thickness + axes.width.delta, axes.width.plan),
        female("right", boxWidth, thickness, boxWidth, height - thickness, 1, 0, axes.height.delta, axes.height.plan),
        male("top", boxWidth, height - thickness, 0, height - thickness, 0, 1, thickness + axes.width.delta, axes.width.plan),
        female("left", 0, height - thickness, 0, thickness, -1, 0, axes.height.delta, axes.height.plan),
      ],
    };
  }

  return {
    edges: [
      male("bottom", thickness, thickness, depth - thickness, thickness, 0, -1, axes.depth.delta, axes.depth.plan),
      male("right", depth - thickness, thickness, depth - thickness, height - thickness, 1, 0, axes.height.delta, axes.height.plan),
      male("top", depth - thickness, height - thickness, thickness, height - thickness, 0, 1, axes.depth.delta, axes.depth.plan),
      male("left", thickness, height - thickness, thickness, thickness, -1, 0, axes.height.delta, axes.height.plan),
    ],
  };
}

function female(name, x0, y0, x1, y1, outwardX, outwardY, margin, plan) {
  return edge(name, x0, y0, x1, y1, outwardX, outwardY, margin, plan);
}

function male(name, x0, y0, x1, y1, outwardX, outwardY, margin, plan) {
  return edge(name, x0, y0, x1, y1, outwardX, outwardY, margin, plan);
}

function edge(name, x0, y0, x1, y1, outwardX, outwardY, margin, plan) {
  return {
    name,
    x0,
    y0,
    x1,
    y1,
    outwardX,
    outwardY,
    margin0: margin,
    margin1: margin,
    plan,
  };
}

function shiftFeatures(traced, box) {
  return {
    tabs: traced.tabs.map((feature) => ({ ...feature })),
    slots: traced.slots.map((feature) => ({ ...feature })),
  };
}

function subtractAdjustment(external, jointModel, material) {
  const adjustment = jointModel.getDimensionAdjustment(material);
  return {
    width: external.width - adjustment.width,
    depth: external.depth - adjustment.depth,
    height: external.height - adjustment.height,
  };
}

function internalSizeErrors(internal) {
  if (!internal) return [issue("internal", "INVALID_VALUE", "Internal dimensions are required.")];
  const errors = [];
  for (const [name, labelText] of [
    ["width", "Width"],
    ["depth", "Depth"],
    ["height", "Height"],
  ]) {
    if (!(internal[name] > 0)) {
      errors.push(issue(name, "CAVITY_TOO_SMALL", `${labelText} resolves to a non-positive internal size.`));
    }
  }
  return errors;
}

function envelopeMismatch(external, internal, adjustment) {
  const errors = [];
  for (const axis of ["width", "depth", "height"]) {
    const expected = external[axis] - internal[axis];
    if (Math.abs(expected - adjustment[axis]) > 1e-6) {
      errors.push(
        issue(
          axis,
          "INCONSISTENT_DIMENSIONS",
          `${label(axis)} does not match the joint adjustment.`,
        ),
      );
    }
  }
  return errors;
}

function panelLimitIssue(limit) {
  return {
    field: limit.panelId,
    code: "PANEL_TOO_LARGE",
    message: limit.message,
    panelId: limit.panelId,
    width: limit.width,
    height: limit.height,
    maxWidth: limit.maxWidth,
    maxHeight: limit.maxHeight,
    actual: { width: limit.width, height: limit.height },
    allowed: { width: limit.maxWidth, height: limit.maxHeight },
  };
}

function invalid(errors) {
  return {
    box: null,
    panels: [],
    layout: null,
    validation: { valid: false, errors },
  };
}

function issue(field, code, message, extra = {}) {
  return { field, code, message, ...extra };
}

function label(axis) {
  if (axis === "width") return "Width";
  if (axis === "depth") return "Depth";
  return "Height";
}

function asJoint(joint) {
  if (joint && typeof joint.planFingers === "function" && typeof joint.classifyEdge === "function") {
    return joint;
  }
  return createJoint(joint ?? { type: "tab-slot" });
}

export { planFingers };
