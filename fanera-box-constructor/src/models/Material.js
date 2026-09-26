/**
 * Sheet material. Kerf and clearance travel with the model.
 * Geometry functions read these fields and do not keep their own copies.
 */
export function createMaterial({ thickness, kerf = 0, clearance = 0 } = {}) {
  return {
    thickness,
    kerf,
    clearance,
  };
}
