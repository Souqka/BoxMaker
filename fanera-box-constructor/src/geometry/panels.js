/**
 * Panel model. Outline, slots and tabs are real geometry collections in
 * millimetres. The rectangles below are a preview placeholder: they use the
 * external envelope and do not yet describe tab-and-slot joinery.
 */
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
  const specs = [
    ["front", width, height],
    ["back", width, height],
    ["left", depth, height],
    ["right", depth, height],
    ["bottom", width, depth],
    ["lid", width, depth],
  ];

  return specs.map(([id, panelWidth, panelHeight]) => {
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
