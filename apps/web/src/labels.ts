import type { PanelId } from "@fanera/core";

export const PANEL_LABELS: Record<PanelId, string> = {
  front: "Перед",
  back: "Зад",
  left: "Лево",
  right: "Право",
  bottom: "Дно",
  lid: "Крышка",
};

export const PANEL_ORDER: readonly PanelId[] = ["front", "back", "left", "right", "bottom", "lid"];
