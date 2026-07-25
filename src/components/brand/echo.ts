// Shared geometry for the echoed-outline "P" mark.
//
// One solid ink "P" with N offset copies fanning up and to the right.
// Tier 1 (marketing lockup) uses a dense fan; Tier 2 (in-product app mark)
// uses only 3-4 copies so the repeated lines can't read as moiré/visual
// stress for someone looking at it all day.

export const INK = "#171522";
export const APP_INK = "#14131F";
export const PAPER = "#F7F5F0";
export const LAVENDER = "#DCD3EA";
export const PLEX = "'IBM Plex Sans', system-ui, sans-serif";

/** dx/dy per echo step, in mark units. Up and to the right. */
export const STEP_X = 2.2;
export const STEP_Y = -1.6;

export interface EchoStep {
  x: number;
  y: number;
  opacity: number;
}

/** Offsets for the echo copies, furthest (faintest) first. */
export function echoSteps(count: number, minOpacity = 0.14): EchoStep[] {
  const steps: EchoStep[] = [];
  for (let i = count; i >= 1; i--) {
    const t = i / count;
    steps.push({
      x: STEP_X * i,
      y: STEP_Y * i,
      opacity: minOpacity + (1 - minOpacity) * (1 - t) * 0.55,
    });
  }
  return steps;
}