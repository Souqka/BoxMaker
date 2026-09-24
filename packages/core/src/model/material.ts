import type { Material } from "./types.ts";

/** Named starting sheets. The engines accept any positive thickness. */
export const MATERIAL_PRESETS: readonly Material[] = [
  { id: "plywood-3", name: "Фанера 3 мм", thickness: 3, kerf: 0.15, clearance: 0.1 },
  { id: "plywood-4", name: "Фанера 4 мм", thickness: 4, kerf: 0.15, clearance: 0.1 },
  { id: "plywood-6", name: "Фанера 6 мм", thickness: 6, kerf: 0.15, clearance: 0.1 },
];

export function createMaterial(partial: Partial<Material> & Pick<Material, "thickness">): Material {
  return {
    id: partial.id ?? "sheet",
    name: partial.name ?? "Листовой материал",
    thickness: partial.thickness,
    kerf: partial.kerf ?? 0,
    clearance: partial.clearance ?? 0,
  };
}
