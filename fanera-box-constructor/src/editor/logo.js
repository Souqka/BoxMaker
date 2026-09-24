/** Attaches an engraving object to the panel it names. Position stays in millimetres. */
export function attachLogo(panel, logo) {
  if (logo.panelId !== panel.id) {
    throw new Error(`Гравировка ${logo.id} относится к панели ${logo.panelId}, а не к ${panel.id}.`);
  }
  return {
    ...panel,
    engraving: [...panel.engraving, logo],
  };
}
