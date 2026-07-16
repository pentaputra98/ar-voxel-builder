// ============================================================
// Level blueprints. Grid is 7x7 (indices 0..6, centre = 3), height 6.
// INVARIANT: every target cell must be supported bottom-up (y==0, or a
// cell directly below, or reachable via a face) so the floor/face
// targeting can always place it. Build order emerges naturally.
// ============================================================

const C = 3; // centre index

// helper: filled rectangle on a layer
function rect(y, x0, x1, z0, z1) {
  const out = [];
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) out.push({ x, y, z });
  return out;
}

export const LEVELS = [
  {
    id: 1,
    name: 'LINE',
    tag: 'LEVEL 1 · LINE',
    control: 'one-hand',       // camera auto-drifts
    profile: 'floor',          // aim on the ground plane; single layer
    seconds: 60,
    teach: 'Point at the blue ghost &amp; <b>hold still</b> to place',
    // a simple single-layer line — zero friction for a first-timer
    cells: [
      { x: 1, y: 0, z: C }, { x: 2, y: 0, z: C }, { x: 3, y: 0, z: C },
      { x: 4, y: 0, z: C }, { x: 5, y: 0, z: C },
    ],
  },
  {
    id: 2,
    name: 'PYRAMID',
    tag: 'LEVEL 2 · PYRAMID',
    control: 'one-hand',
    profile: 'slice',          // vertical lattice slice; raise hand => higher layer
    sliceZ: C,                 // the pyramid lives in the centre Z-slice
    seconds: 60,
    teach: 'Raise your hand <b>higher</b> to build a higher layer',
    // 2D stepped pyramid in the z = centre slice (5 → 3 → 1)
    cells: [
      { x: 1, y: 0, z: C }, { x: 2, y: 0, z: C }, { x: 3, y: 0, z: C }, { x: 4, y: 0, z: C }, { x: 5, y: 0, z: C },
      { x: 2, y: 1, z: C }, { x: 3, y: 1, z: C }, { x: 4, y: 1, z: C },
      { x: 3, y: 2, z: C },
    ],
  },
  {
    id: 3,
    name: 'CORE',
    tag: 'LEVEL 3 · THE CORE',
    control: 'two-hand',       // requires orbiting to see hidden back cells
    profile: 'layered',        // aim x/z on the active horizontal layer
    seconds: 75,
    // camera auto-orbits; the 2nd hand does ONE thing — raise/lower for layer
    teach: 'Raise &amp; lower your <b>other hand</b> to change the build layer',
    // true 3D vault — back cells (z=2) are hidden from the front
    cells: [
      ...rect(0, 2, 4, 2, 4),                          // 3x3 base (9)
      { x: 2, y: 1, z: 2 }, { x: 4, y: 1, z: 2 },      // back corners
      { x: 2, y: 1, z: 4 }, { x: 4, y: 1, z: 4 },      // front corners
      { x: 3, y: 1, z: 3 },                            // centre pillar base
      { x: 3, y: 2, z: 3 },                            // pillar top
    ],
  },
];

export function levelByIndex(i) { return LEVELS[i % LEVELS.length]; }
export const LEVEL_COUNT = LEVELS.length;
