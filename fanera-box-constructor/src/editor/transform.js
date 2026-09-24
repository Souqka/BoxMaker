/** Moves, resizes and rotates an engraving in panel millimetres. */
export function translateLogo(logo, dx, dy) {
  return { ...logo, x: logo.x + dx, y: logo.y + dy };
}

export function resizeLogo(logo, width, height) {
  return { ...logo, width, height };
}

export function rotateLogo(logo, rotation) {
  return { ...logo, rotation };
}
