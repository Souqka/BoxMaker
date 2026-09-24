import { createJoint } from "./joints.js";

/**
 * Dimension Engine.
 *
 * Coordinates: X = width, Y = depth, Z = height.
 * Every size is a number of millimetres. This module never stores "300mm"
 * strings and never converts to pixels.
 *
 * The engine does not know how a joint is built. It asks the joint for the
 * millimetres that separate the internal cavity from the external envelope,
 * then adds or subtracts that adjustment. Kerf and clearance stay on the
 * material. They are validated here and are not folded into the nominal size.
 */

export const COORDINATES = {
  X: "width",
  Y: "depth",
  Z: "height",
  unit: "mm",
};

const AXES = [
  ["width", "Width"],
  ["depth", "Depth"],
  ["height", "Height"],
];

export function normalizeDimensions({ dimensions = {}, dimensionMode, material = {} } = {}) {
  const width = toNumber(dimensions.width);
  const depth = toNumber(dimensions.depth);
  const height = toNumber(dimensions.height);
  const thickness = toNumber(material.thickness);
  const kerf = toNumber(material.kerf);
  const clearance = toNumber(material.clearance);
  const mode = dimensionMode ?? dimensions.mode;
  const errors = [];

  checkFinite(errors, width, "width", "Width");
  checkFinite(errors, depth, "depth", "Depth");
  checkFinite(errors, height, "height", "Height");
  checkFinite(errors, thickness, "thickness", "Thickness");
  checkFinite(errors, kerf, "kerf", "Kerf");
  checkFinite(errors, clearance, "clearance", "Clearance");

  if (errors.length === 0) {
    checkPositive(errors, width, "width", "Width");
    checkPositive(errors, depth, "depth", "Depth");
    checkPositive(errors, height, "height", "Height");
    checkPositive(errors, thickness, "thickness", "Thickness");
    if (kerf < 0) errors.push(error("kerf", "INVALID_VALUE", "Kerf cannot be negative."));
    if (clearance < 0) errors.push(error("clearance", "INVALID_VALUE", "Clearance cannot be negative."));
  }

  if (mode !== "external" && mode !== "internal") {
    errors.push(error("dimensionMode", "INVALID_MODE", "Dimension mode must be external or internal."));
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    dimensions: { width, depth, height },
    dimensionMode: mode,
    material: { thickness, kerf, clearance },
  };
}

export function resolveDimensions({ dimensions, dimensionMode, material, joint } = {}) {
  const normalized = normalizeDimensions({ dimensions, dimensionMode, material });
  if (!normalized.valid) return normalized;

  let jointModel;
  try {
    jointModel = asJoint(joint);
  } catch (cause) {
    return {
      valid: false,
      errors: [
        error(
          "joint",
          cause.code ?? "UNSUPPORTED_JOINT",
          cause.message || "This joint type is not supported.",
        ),
      ],
    };
  }

  const adjustment = readAdjustment(jointModel.getDimensionAdjustment(normalized.material));
  if (!adjustment) {
    return {
      valid: false,
      errors: [
        error(
          "joint",
          "INVALID_ADJUSTMENT",
          "The joint did not return a finite size adjustment.",
        ),
      ],
    };
  }

  const entered = normalized.dimensions;
  const external = normalized.dimensionMode === "external" ? copySize(entered) : addSize(entered, adjustment);
  const internal = normalized.dimensionMode === "internal" ? copySize(entered) : subtractSize(entered, adjustment);

  const tooSmall = nonPositiveAxes(internal).map((axis) =>
    error(
      axis,
      "CAVITY_TOO_SMALL",
      `${labelFor(axis)} is smaller than the material this joint places on that axis.`,
    ),
  );
  const envelopeErrors = nonPositiveAxes(external).map((axis) =>
    error(axis, "ENVELOPE_TOO_SMALL", `${labelFor(axis)} resolves to a non-positive external size.`),
  );

  if (tooSmall.length > 0 || envelopeErrors.length > 0) {
    return { valid: false, errors: [...tooSmall, ...envelopeErrors] };
  }

  return {
    valid: true,
    input: {
      width: entered.width,
      depth: entered.depth,
      height: entered.height,
      mode: normalized.dimensionMode,
    },
    external,
    internal,
  };
}

function asJoint(joint) {
  if (joint && typeof joint.getDimensionAdjustment === "function") return joint;
  return createJoint(joint ?? { type: "tab-slot" });
}

function readAdjustment(value) {
  if (!value || typeof value !== "object") return null;
  const width = toNumber(value.width);
  const depth = toNumber(value.depth);
  const height = toNumber(value.height);
  if (![width, depth, height].every(Number.isFinite)) return null;
  return { width, depth, height };
}

function copySize(size) {
  return { width: size.width, depth: size.depth, height: size.height };
}

function addSize(size, adjustment) {
  return {
    width: size.width + adjustment.width,
    depth: size.depth + adjustment.depth,
    height: size.height + adjustment.height,
  };
}

function subtractSize(size, adjustment) {
  return {
    width: size.width - adjustment.width,
    depth: size.depth - adjustment.depth,
    height: size.height - adjustment.height,
  };
}

function nonPositiveAxes(size) {
  return AXES.filter(([axis]) => !(size[axis] > 0)).map(([axis]) => axis);
}

function labelFor(axis) {
  return AXES.find(([name]) => name === axis)?.[1] ?? axis;
}

function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return Number.NaN;
}

function checkFinite(errors, value, field, label) {
  if (!Number.isFinite(value)) {
    errors.push(error(field, "NOT_FINITE", `${label} must be a finite number.`));
  }
}

function checkPositive(errors, value, field, label) {
  if (!(value > 0)) {
    errors.push(error(field, "INVALID_VALUE", `${label} must be greater than zero.`));
  }
}

function error(field, code, message) {
  return { field, code, message };
}
