/**
 * Sheet arrangement in millimetres, y-up. This is not the assembled pose.
 * Spacing is an argument so the layout module does not hide a shop constant.
 */
export function layoutPanels(panels, { gap = 12, margin = 10 } = {}) {
  const placements = [];
  let cursor = margin;
  let rowHeight = 0;

  for (const panel of panels) {
    placements.push({
      panelId: panel.id,
      x: cursor,
      y: margin,
      width: panel.width,
      height: panel.height,
    });
    cursor += panel.width + gap;
    rowHeight = Math.max(rowHeight, panel.height);
  }

  const width = panels.length === 0 ? margin * 2 : cursor - gap + margin;
  return {
    width,
    height: rowHeight + margin * 2,
    placements,
  };
}
