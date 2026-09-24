/** Panel selection for a future 2D editor. Stores an id, not screen coordinates. */
export function createSelection() {
  let panelId = null;

  return {
    select(id) {
      panelId = id;
    },
    clear() {
      panelId = null;
    },
    get() {
      return panelId;
    },
  };
}
