/**
 * Panel geometry. Outline, slots, tabs, cutouts and engraving describe the
 * part itself. Where that part sits on the sheet is the Layout Model.
 *
 * The rectangles below are a preview of the external faces. They are not
 * tab-and-slot contours.
 */

export const BOX_PANEL_IDS = ["lid", "side-1", "front", "bottom", "back", "side-2"];

export function createPanel({
  id,
  width,
  height,
  outline = [],
  slots = [],
  tabs = [],
  cutouts = [],
  engraving = [],
  orientation = { rotation: 0 },
}) {
  return {
    id,
    width,
    height,
    outline,
    slots,
    tabs,
    cutouts,
    engraving,
    orientation,
  };
}

export function createBoxPanels(dimensions, joint) {
  const { width, depth, height } = dimensions.external;
  const size = {
    lid: [width, depth],
    "side-1": [depth, height],
    front: [width, height],
    bottom: [width, depth],
    back: [width, height],
    "side-2": [depth, height],
  };

  return BOX_PANEL_IDS.map((id) => {
    const [panelWidth, panelHeight] = size[id];
    const features = joint.featuresForEdge({ panelId: id });
    return createPanel({
      id,
      width: panelWidth,
      height: panelHeight,
      outline: rectangle(panelWidth, panelHeight),
      slots: features.slots,
      tabs: features.tabs,
      orientation: { rotation: 0 },
    });
  });
}

function rectangle(width, height) {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
}
