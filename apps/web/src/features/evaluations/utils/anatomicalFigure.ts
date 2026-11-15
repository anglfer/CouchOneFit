import type { MeasurementField, Method } from '../types/assessment';

export const FIGURE_WIDTH = 220;
export const FIGURE_HEIGHT = 470;
const AXIS_X = FIGURE_WIDTH / 2;

export type BodySide = 'front' | 'back';

export type MuscleGroupId =
  | 'neck'
  | 'trapezius'
  | 'deltoid'
  | 'pectoralis'
  | 'biceps'
  | 'triceps'
  | 'forearm'
  | 'serratus'
  | 'abs'
  | 'absUmbilical'
  | 'obliques'
  | 'scapula'
  | 'latissimus'
  | 'erectors'
  | 'glutes'
  | 'tfl'
  | 'quadriceps'
  | 'adductors'
  | 'hamstrings'
  | 'calves';

export interface MuscleShape {
  id: string;
  group: MuscleGroupId;
  path: string;
  striations: readonly string[];
}

export interface SiteMarker {
  field: MeasurementField;
  method: Extract<Method, 'perimetros' | 'pliegues'>;
  side: BodySide;
  kind: 'perimeter' | 'skinfold';
  x: number;
  y: number;
  focusCenter: { x: number; y: number };
  bandLeftX?: number;
  bandRightX?: number;
  bandDip?: number;
  backBand?: { y: number; leftX: number; rightX: number; dip: number };
  muscles: readonly MuscleGroupId[];
  muscleLabel: string;
  visualGuide: string;
}

type Point = readonly [number, number];
type CubicSegment = readonly [number, number, number, number, number, number];

function fmt(n: number): string {
  return Number(n.toFixed(1)).toString();
}

function mirrorX(x: number): number {
  return FIGURE_WIDTH - x;
}

function closedSplinePath(points: readonly Point[], mirrored = false): string {
  const pts: Point[] = points.map(([x, y]) => [mirrored ? mirrorX(x) : x, y]);
  const n = pts.length;
  const at = (i: number): Point => pts[((i % n) + n) % n];
  const segments: string[] = [`M ${fmt(pts[0][0])} ${fmt(pts[0][1])}`];
  for (let i = 0; i < n; i += 1) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    segments.push(
      `C ${fmt(c1x)} ${fmt(c1y)}, ${fmt(c2x)} ${fmt(c2y)}, ${fmt(p2[0])} ${fmt(p2[1])}`
    );
  }
  segments.push('Z');
  return segments.join(' ');
}

function openCurvePath(points: readonly Point[], mirrored = false): string {
  const pts: Point[] = points.map(([x, y]) => [mirrored ? mirrorX(x) : x, y]);
  if (pts.length < 2) return '';
  if (pts.length === 2) {
    return `M ${fmt(pts[0][0])} ${fmt(pts[0][1])} L ${fmt(pts[1][0])} ${fmt(pts[1][1])}`;
  }
  const at = (i: number): Point =>
    pts[Math.max(0, Math.min(pts.length - 1, i))];
  const segments: string[] = [`M ${fmt(pts[0][0])} ${fmt(pts[0][1])}`];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    segments.push(
      `C ${fmt(c1x)} ${fmt(c1y)}, ${fmt(c2x)} ${fmt(c2y)}, ${fmt(p2[0])} ${fmt(p2[1])}`
    );
  }
  return segments.join(' ');
}

function symmetricCubicPath(
  start: Point,
  halfSegments: readonly CubicSegment[]
): string {
  const cmds: string[] = [`M ${fmt(start[0])} ${fmt(start[1])}`];
  const vertices: Point[] = [start];
  for (const [c1x, c1y, c2x, c2y, x, y] of halfSegments) {
    cmds.push(
      `C ${fmt(c1x)} ${fmt(c1y)}, ${fmt(c2x)} ${fmt(c2y)}, ${fmt(x)} ${fmt(y)}`
    );
    vertices.push([x, y]);
  }
  for (let i = halfSegments.length - 1; i >= 0; i -= 1) {
    const [c1x, c1y, c2x, c2y] = halfSegments[i];
    const prev = vertices[i];
    cmds.push(
      `C ${fmt(mirrorX(c2x))} ${fmt(c2y)}, ${fmt(mirrorX(c1x))} ${fmt(c1y)}, ${fmt(mirrorX(prev[0]))} ${fmt(prev[1])}`
    );
  }
  cmds.push('Z');
  return cmds.join(' ');
}

function buildPairedMuscles(
  specs: readonly {
    id: string;
    group: MuscleGroupId;
    points: readonly Point[];
    striations?: readonly (readonly Point[])[];
  }[]
): MuscleShape[] {
  const result: MuscleShape[] = [];
  for (const spec of specs) {
    for (const side of ['l', 'r'] as const) {
      const mirrored = side === 'r';
      result.push({
        id: `${spec.id}-${side}`,
        group: spec.group,
        path: closedSplinePath(spec.points, mirrored),
        striations: (spec.striations ?? []).map((line) =>
          openCurvePath(line, mirrored)
        ),
      });
    }
  }
  return result;
}

function pairedOpenLines(lines: readonly (readonly Point[])[]): string[] {
  const result: string[] = [];
  for (const line of lines) {
    result.push(openCurvePath(line, false));
    result.push(openCurvePath(line, true));
  }
  return result;
}

// Unified athletic body silhouette (neck -> shoulders -> arms -> hands -> torso -> legs -> feet)
const bodyHalfSegments: readonly CubicSegment[] = [
  [101, 56, 99, 58, 99, 65], // upper neck
  [99, 72, 95, 76, 86, 79], // neck to trapezius
  [79, 81, 72, 82, 66, 84], // shoulder slope
  [54, 87, 48, 96, 46.5, 110], // deltoid cap
  [45.5, 122, 43, 136, 41, 152], // outer upper arm
  [40, 162, 38, 168, 35.5, 176], // outer elbow
  [32.5, 190, 30.5, 208, 29.5, 224], // outer forearm
  [28.5, 231, 28, 236, 26, 241], // outer wrist
  [23, 249, 22, 261, 24, 271], // outer hand / pinky
  [26, 278, 32, 280, 36, 276], // fingertips
  [39, 270, 40, 263, 41, 258], // index to thumb notch
  [44, 260, 47, 255, 44, 246], // thumb
  [42, 241, 41, 237, 41, 232], // inner wrist
  [44, 217, 49, 196, 52, 178], // inner forearm
  [54, 166, 59, 144, 64, 124], // inner upper arm
  [66, 118, 68, 114, 70, 113], // armpit fold
  [71, 125, 73, 140, 76, 154], // lateral ribcage
  [78, 163, 79, 169, 78, 176], // natural waist
  [76, 187, 73, 197, 72, 208], // oblique / iliac flare
  [70, 218, 67, 228, 66, 240], // greater trochanter
  [64, 260, 64, 284, 66, 308], // outer thigh
  [68, 326, 70, 340, 72, 350], // outer knee
  [71, 360, 68, 374, 68, 388], // outer calf
  [68, 402, 72, 418, 76, 434], // lower leg taper
  [75, 442, 71, 449, 71, 455], // outer ankle / foot
  [72, 460, 80, 462, 88, 460], // toes / sole
  [93, 458, 94, 451, 91, 443], // inner foot arch
  [89, 437, 88, 433, 89, 427], // inner ankle
  [93, 413, 97, 398, 97, 384], // inner calf flare
  [97, 372, 93, 360, 91, 350], // inner knee
  [92, 338, 95, 316, 98, 294], // VMO / inner thigh
  [101, 274, 105, 256, 110, 242], // adductors to crotch
];

export const BODY_SILHOUETTE_PATH = symmetricCubicPath(
  [AXIS_X, 56],
  bodyHalfSegments
);

export const HEAD_FRONT_PATH = symmetricCubicPath(
  [AXIS_X, 13.5],
  [
    [100, 13.5, 92, 20, 92, 32],
    [92, 39, 92.8, 44.5, 94.2, 49],
    [95.5, 56, 99, 62.5, 104.5, 66.8],
    [106.8, 68.4, 108.5, 69, 110, 69],
  ]
);

export const HEAD_BACK_PATH = symmetricCubicPath(
  [AXIS_X, 13.5],
  [
    [99, 13.5, 91, 21, 91, 33],
    [91, 41, 94, 49, 98, 54],
    [102, 57.5, 106, 59, 110, 59],
  ]
);

export const EARS_PATH = `${closedSplinePath([
  [92, 33],
  [89, 34],
  [89, 41],
  [91, 45],
  [93, 43],
])} ${closedSplinePath(
  [
    [92, 33],
    [89, 34],
    [89, 41],
    [91, 45],
    [93, 43],
  ],
  true
)}`;

export const FRONT_MUSCLES: readonly MuscleShape[] = buildPairedMuscles([
  {
    id: 'scm',
    group: 'neck',
    points: [
      [100, 64],
      [104, 68],
      [108.5, 81.5],
      [104.5, 82],
      [99, 75],
    ],
    striations: [
      [
        [102, 69],
        [106, 79],
      ],
    ],
  },
  {
    id: 'upper-trap-front',
    group: 'trapezius',
    points: [
      [98, 68],
      [92, 76],
      [74, 83],
      [83, 84.5],
      [99, 76.5],
    ],
  },
  {
    id: 'deltoid-anterior',
    group: 'deltoid',
    points: [
      [72, 85],
      [61, 89],
      [54.5, 101],
      [54.5, 119],
      [58, 123],
      [63.5, 112],
      [66.5, 97],
      [74, 89.5],
    ],
    striations: [
      [
        [67, 90],
        [60, 102],
        [56.5, 116],
      ],
    ],
  },
  {
    id: 'deltoid-lateral',
    group: 'deltoid',
    points: [
      [60, 88],
      [51.5, 93],
      [47.5, 108],
      [49, 122],
      [54, 124],
      [54, 102],
    ],
    striations: [
      [
        [53, 95],
        [50, 108],
        [51.5, 120],
      ],
    ],
  },
  {
    id: 'pectoralis-clavicular',
    group: 'pectoralis',
    points: [
      [108, 86],
      [89, 85.5],
      [74, 88],
      [68, 97],
      [83, 98.5],
      [108, 95.5],
    ],
    striations: [
      [
        [103, 91],
        [87, 91.5],
        [73, 93],
      ],
    ],
  },
  {
    id: 'pectoralis-sternal',
    group: 'pectoralis',
    points: [
      [108, 96.5],
      [84, 99.5],
      [67, 100],
      [68, 117],
      [77, 129],
      [96, 130.5],
      [108.5, 124],
    ],
    striations: [
      [
        [104, 104],
        [87, 106.5],
        [72, 102.5],
      ],
      [
        [104, 112.5],
        [86, 115.5],
        [71, 109.5],
      ],
      [
        [103, 120],
        [87, 123.5],
        [75, 118],
      ],
    ],
  },
  {
    id: 'serratus-front',
    group: 'serratus',
    points: [
      [71, 128],
      [79, 134],
      [83, 152],
      [78, 160],
      [73, 145],
    ],
    striations: [
      [
        [72.5, 135],
        [79.5, 138.5],
      ],
      [
        [73.5, 143],
        [81, 146.5],
      ],
      [
        [75, 151],
        [81.5, 154.5],
      ],
    ],
  },
  {
    id: 'biceps-short',
    group: 'biceps',
    points: [
      [56.5, 122],
      [62, 125],
      [58, 146],
      [53.5, 165],
      [50, 164],
      [51.5, 142],
    ],
    striations: [
      [
        [56.5, 128],
        [54.5, 146],
        [52, 160],
      ],
    ],
  },
  {
    id: 'biceps-long',
    group: 'biceps',
    points: [
      [51, 124],
      [55, 125],
      [51, 144],
      [49.5, 163],
      [46, 162],
      [47, 141],
    ],
  },
  {
    id: 'brachialis-front',
    group: 'biceps',
    points: [
      [47.5, 132],
      [44, 146],
      [41, 163],
      [46, 164],
      [47.5, 146],
    ],
  },
  {
    id: 'forearm-brachioradialis',
    group: 'forearm',
    points: [
      [40, 167],
      [45.5, 174],
      [42, 198],
      [36, 224],
      [31.5, 222],
      [33, 194],
    ],
    striations: [
      [
        [39, 176],
        [35.5, 206],
      ],
    ],
  },
  {
    id: 'forearm-flexors',
    group: 'forearm',
    points: [
      [47.5, 170],
      [52, 178],
      [47, 206],
      [40, 228],
      [37, 224],
      [43, 196],
    ],
    striations: [
      [
        [46.5, 182],
        [41.5, 216],
      ],
    ],
  },
  {
    id: 'abs-1',
    group: 'abs',
    points: [
      [93, 134],
      [108.5, 132],
      [108.5, 149],
      [94, 150],
      [91, 142],
    ],
  },
  {
    id: 'abs-2',
    group: 'abs',
    points: [
      [93, 153],
      [108.5, 153],
      [108.5, 169],
      [93, 169],
      [91, 161],
    ],
  },
  {
    id: 'abs-3',
    group: 'absUmbilical',
    points: [
      [93, 172],
      [108.5, 172],
      [108.5, 192],
      [94, 191],
      [92, 182],
    ],
  },
  {
    id: 'abs-4',
    group: 'absUmbilical',
    points: [
      [94.5, 195],
      [108.5, 195],
      [108.5, 224],
      [101, 226],
      [95.5, 211],
    ],
  },
  {
    id: 'obliques-front',
    group: 'obliques',
    points: [
      [76, 152],
      [87, 158],
      [91, 186],
      [92, 214],
      [81, 210],
      [74, 194],
      [78, 172],
    ],
    striations: [
      [
        [79, 166],
        [88, 174],
      ],
      [
        [77, 183],
        [88, 193],
      ],
      [
        [77, 199],
        [89, 207],
      ],
    ],
  },
  {
    id: 'tfl-hip',
    group: 'tfl',
    points: [
      [71, 214],
      [79, 222],
      [76, 252],
      [68, 250],
      [68, 232],
    ],
  },
  {
    id: 'sartorius-front',
    group: 'tfl',
    points: [
      [78, 218],
      [86, 224],
      [95, 250],
      [97, 290],
      [92, 290],
      [85, 246],
      [77, 234],
    ],
  },
  {
    id: 'adductors-front',
    group: 'adductors',
    points: [
      [87, 238],
      [105, 246],
      [99, 286],
      [92, 304],
      [86, 272],
    ],
    striations: [
      [
        [99, 248],
        [93, 286],
      ],
    ],
  },
  {
    id: 'vastus-lateralis',
    group: 'quadriceps',
    points: [
      [66.5, 250],
      [76, 254],
      [78, 302],
      [75, 336],
      [69, 324],
      [66, 282],
    ],
    striations: [
      [
        [69, 268],
        [74.5, 296],
      ],
      [
        [69.5, 292],
        [75, 322],
      ],
    ],
  },
  {
    id: 'rectus-femoris',
    group: 'quadriceps',
    points: [
      [77, 248],
      [88, 254],
      [89, 296],
      [84, 336],
      [78, 334],
      [76, 292],
    ],
    striations: [
      [
        [83, 260],
        [82.5, 294],
        [82, 326],
      ],
    ],
  },
  {
    id: 'vastus-medialis',
    group: 'quadriceps',
    points: [
      [89, 296],
      [96, 294],
      [92, 334],
      [86, 338],
      [85, 318],
    ],
    striations: [
      [
        [92, 304],
        [88.5, 328],
      ],
    ],
  },
  {
    id: 'peroneus-front',
    group: 'calves',
    points: [
      [70, 369],
      [73.5, 370],
      [75, 420],
      [72.5, 424],
      [69.5, 396],
    ],
  },
  {
    id: 'tibialis-anterior',
    group: 'calves',
    points: [
      [74.5, 364],
      [84, 366],
      [84, 416],
      [78, 422],
      [74, 394],
    ],
    striations: [
      [
        [79, 374],
        [80, 412],
      ],
    ],
  },
  {
    id: 'calf-medial-front',
    group: 'calves',
    points: [
      [89, 366],
      [95.5, 378],
      [94, 405],
      [87.5, 402],
    ],
  },
]);

export const BACK_MUSCLES: readonly MuscleShape[] = buildPairedMuscles([
  {
    id: 'trapezius-upper',
    group: 'trapezius',
    points: [
      [109, 58.5],
      [97, 68],
      [72, 83],
      [88, 92],
      [108.5, 104],
    ],
    striations: [
      [
        [105, 73],
        [83, 84],
      ],
      [
        [106, 86],
        [89, 90],
      ],
    ],
  },
  {
    id: 'trapezius-lower',
    group: 'trapezius',
    points: [
      [108.5, 102],
      [89, 94],
      [98, 122],
      [109, 152],
    ],
    striations: [
      [
        [106, 114],
        [98, 114],
      ],
    ],
  },
  {
    id: 'deltoid-posterior',
    group: 'deltoid',
    points: [
      [72, 85],
      [59, 89],
      [54, 102],
      [55, 121],
      [62, 113],
      [72, 93],
    ],
    striations: [
      [
        [68, 92],
        [58, 108],
      ],
    ],
  },
  {
    id: 'deltoid-lateral-back',
    group: 'deltoid',
    points: [
      [59, 88],
      [50, 95],
      [47.5, 109],
      [49, 121],
      [54.5, 122],
      [54, 102],
    ],
  },
  {
    id: 'infraspinatus',
    group: 'scapula',
    points: [
      [72, 92],
      [88, 92],
      [94, 112],
      [82, 124],
      [70, 108],
    ],
    striations: [
      [
        [89, 101],
        [75, 106],
      ],
      [
        [91, 110],
        [78, 114],
      ],
    ],
  },
  {
    id: 'teres-major',
    group: 'scapula',
    points: [
      [70, 110],
      [82, 123],
      [93, 123],
      [82, 132],
      [70, 122],
    ],
  },
  {
    id: 'latissimus',
    group: 'latissimus',
    points: [
      [71, 124],
      [84, 132],
      [97, 132],
      [101, 160],
      [92, 186],
      [80, 184],
      [74, 158],
    ],
    striations: [
      [
        [97, 141],
        [76, 132],
      ],
      [
        [96, 154],
        [77, 145],
      ],
      [
        [95, 168],
        [80, 162],
      ],
    ],
  },
  {
    id: 'erectors',
    group: 'erectors',
    points: [
      [98, 156],
      [108.5, 156],
      [108.5, 218],
      [96, 214],
      [94, 188],
    ],
    striations: [
      [
        [102, 166],
        [101, 206],
      ],
    ],
  },
  {
    id: 'obliques-back',
    group: 'obliques',
    points: [
      [78, 178],
      [89, 186],
      [92, 210],
      [75, 208],
    ],
  },
  {
    id: 'triceps-long',
    group: 'triceps',
    points: [
      [56, 122],
      [62, 125],
      [58, 148],
      [53, 164],
      [49, 154],
      [51, 132],
    ],
    striations: [
      [
        [56.5, 129],
        [53.5, 154],
      ],
    ],
  },
  {
    id: 'triceps-lateral',
    group: 'triceps',
    points: [
      [48, 122],
      [52, 134],
      [49, 156],
      [42, 162],
      [43, 142],
    ],
    striations: [
      [
        [47.5, 130],
        [45.5, 152],
      ],
    ],
  },
  {
    id: 'forearm-extensors',
    group: 'forearm',
    points: [
      [39, 172],
      [51, 174],
      [46, 206],
      [39, 228],
      [32, 224],
      [34, 194],
    ],
    striations: [
      [
        [43, 180],
        [38, 216],
      ],
      [
        [46, 184],
        [42, 216],
      ],
    ],
  },
  {
    id: 'glute-medius',
    group: 'glutes',
    points: [
      [73, 210],
      [95, 214],
      [96, 232],
      [70, 228],
    ],
  },
  {
    id: 'glute-maximus',
    group: 'glutes',
    points: [
      [70, 230],
      [96, 228],
      [108.5, 238],
      [107, 272],
      [88, 280],
      [70, 266],
    ],
    striations: [
      [
        [99, 243],
        [77, 250],
      ],
      [
        [100, 257],
        [79, 264],
      ],
    ],
  },
  {
    id: 'biceps-femoris',
    group: 'hamstrings',
    points: [
      [67, 274],
      [83, 280],
      [82, 338],
      [73, 342],
      [68, 310],
    ],
    striations: [
      [
        [75, 288],
        [76, 326],
      ],
    ],
  },
  {
    id: 'semitendinosus',
    group: 'hamstrings',
    points: [
      [84, 280],
      [99, 274],
      [95, 314],
      [90, 340],
      [84, 338],
    ],
    striations: [
      [
        [91, 288],
        [88, 324],
      ],
    ],
  },
  {
    id: 'gastroc-lateral',
    group: 'calves',
    points: [
      [69, 362],
      [82, 362],
      [82, 400],
      [73, 402],
      [69, 384],
    ],
    striations: [
      [
        [75, 370],
        [76, 394],
      ],
    ],
  },
  {
    id: 'gastroc-medial',
    group: 'calves',
    points: [
      [83, 362],
      [95, 366],
      [96, 388],
      [91, 406],
      [83, 400],
    ],
    striations: [
      [
        [89, 372],
        [88, 396],
      ],
    ],
  },
  {
    id: 'soleus',
    group: 'calves',
    points: [
      [74, 404],
      [90, 406],
      [87, 428],
      [77, 428],
    ],
  },
]);

export const FRONT_LANDMARKS: readonly string[] = [
  // Suprasternal / jugular fossa
  `M 105.5 83.5 Q 110 86.5 114.5 83.5`,
  // Clavicles
  ...pairedOpenLines([
    [
      [105.5, 83.5],
      [91, 80.5],
      [72, 83.5],
    ],
    // Deltopectoral grooves
    [
      [73, 86],
      [66.5, 98],
      [65, 114],
    ],
    // Costal arch
    [
      [110, 131],
      [97, 134],
      [84, 146],
      [76, 156],
    ],
    // Linea semilunaris
    [
      [91, 136],
      [89, 165],
      [91.5, 195],
      [99, 224],
    ],
    // Iliac / inguinal V-line
    [
      [74, 206],
      [89, 222],
      [103, 238],
    ],
    // Rectus femoris tendon & tibial crest hint
    [
      [81, 336],
      [82, 344],
    ],
    [
      [85, 368],
      [85.5, 422],
    ],
    // Distal forearm wrist tendons & hand finger contours
    [
      [35, 212],
      [33.5, 234],
    ],
    [
      [41, 214],
      [38.5, 235],
    ],
    [
      [27.5, 258],
      [26.5, 274],
    ],
    [
      [32, 258],
      [31, 277],
    ],
    [
      [36.5, 258],
      [36, 274],
    ],
  ]),
  // Linea alba
  `M ${AXIS_X} 88 L ${AXIS_X} 182 M ${AXIS_X} 191 L ${AXIS_X} 234`,
  // Umbilicus
  `M ${AXIS_X - 2.3} 186 A 2.3 2.7 0 1 0 ${AXIS_X + 2.3} 186 A 2.3 2.7 0 1 0 ${AXIS_X - 2.3} 186`,
  // Kneecaps (patellae)
  closedSplinePath(
    [
      [78, 344],
      [86, 344],
      [87, 354],
      [82, 358],
      [77, 353],
    ],
    false
  ),
  closedSplinePath(
    [
      [78, 344],
      [86, 344],
      [87, 354],
      [82, 358],
      [77, 353],
    ],
    true
  ),
  // Ankle malleoli & subtle toes hints
  `M 78 434 Q 82 436.5 86 434 M 134 434 Q 138 436.5 142 434 M 74 456 Q 81 453 89 456 M 131 456 Q 139 453 146 456`,
];

export const BACK_LANDMARKS: readonly string[] = [
  // Nape / occipital hairline arc & C7 prominence
  `M 96 49 Q 110 56 124 49`,
  `M 107.5 67 Q 110 68.5 112.5 67`,
  // C7-T3 trapezius tendinous aponeurosis diamond hint
  `M ${AXIS_X} 74 L 104 94 L ${AXIS_X} 106 L 116 94 Z`,
  // Spine of scapula, inferior scapular angle hint & lower-back creases
  ...pairedOpenLines([
    [
      [73, 88],
      [85, 92],
      [96, 97],
    ],
    // Scapular border subtle hint framing subscapular region
    [
      [94, 98],
      [88, 120],
      [83, 125],
    ],
    // Elbow olecranon / triceps tendon crease
    [
      [45, 164],
      [51, 166],
    ],
    // Dorsal hand metacarpal lines
    [
      [30, 250],
      [28, 272],
    ],
    [
      [35, 250],
      [33.5, 276],
    ],
    // Gluteal fold
    [
      [78, 271],
      [94, 276],
      [106, 274],
    ],
    // Popliteal behind-knee diamond crease
    [
      [75, 351],
      [82, 354],
      [89, 351],
    ],
    // Achilles tendon borders
    [
      [80.5, 404],
      [81.5, 446],
    ],
    [
      [84, 404],
      [83.5, 446],
    ],
  ]),
  // Spinal furrow & thoracolumbar fascia diamond
  `M ${AXIS_X} 68 L ${AXIS_X} 234 M ${AXIS_X} 182 L 99 208 L ${AXIS_X} 228 L 121 208 Z`,
];

export const SITE_MARKERS: readonly SiteMarker[] = [
  {
    field: 'neckCm',
    method: 'perimetros',
    side: 'front',
    kind: 'perimeter',
    x: 110,
    y: 74,
    focusCenter: { x: 110, y: 74 },
    bandLeftX: 98,
    bandRightX: 122,
    bandDip: 3,
    backBand: { y: 74, leftX: 98, rightX: 122, dip: 2 },
    muscles: ['neck'],
    muscleLabel: 'Esternocleidomastoideo y trapecio superior',
    visualGuide:
      'Banda horizontal en el tercio medio del cuello, debajo del borde mandibular y sobre el nivel clavicular.',
  },
  {
    field: 'waistCm',
    method: 'perimetros',
    side: 'front',
    kind: 'perimeter',
    x: 82,
    y: 168,
    focusCenter: { x: 110, y: 166 },
    bandLeftX: 78,
    bandRightX: 142,
    bandDip: 4,
    backBand: { y: 168, leftX: 78, rightX: 142, dip: 3 },
    muscles: ['obliques', 'abs'],
    muscleLabel: 'Oblicuos externos y recto abdominal superior',
    visualGuide:
      'Zona más estrecha del torso, debajo del arco costal y por encima del ombligo (distinta de abdomen umbilical).',
  },
  {
    field: 'abdomenUmbilicalCm',
    method: 'perimetros',
    side: 'front',
    kind: 'perimeter',
    x: 138,
    y: 186,
    focusCenter: { x: 110, y: 186 },
    bandLeftX: 76,
    bandRightX: 144,
    bandDip: 4,
    backBand: { y: 186, leftX: 76, rightX: 144, dip: 3 },
    muscles: ['absUmbilical', 'obliques'],
    muscleLabel: 'Recto abdominal (nivel umbilical) y oblicuos',
    visualGuide:
      'Perímetro horizontal a nivel del ombligo; no sustituye cintura.',
  },
  {
    field: 'hipCm',
    method: 'perimetros',
    side: 'front',
    kind: 'perimeter',
    x: 110,
    y: 232,
    focusCenter: { x: 110, y: 234 },
    bandLeftX: 67,
    bandRightX: 153,
    bandDip: 5,
    backBand: { y: 242, leftX: 67, rightX: 153, dip: 4 },
    muscles: ['glutes', 'tfl'],
    muscleLabel: 'Glúteo mayor, glúteo medio y tensor de la fascia lata',
    visualGuide:
      'Contorno horizontal más amplio de la pelvis y región glútea en las vistas anterior y posterior.',
  },
  {
    field: 'pectoralSkinfoldMm',
    method: 'pliegues',
    side: 'front',
    kind: 'skinfold',
    x: 74,
    y: 108,
    focusCenter: { x: 94, y: 112 },
    muscles: ['pectoralis'],
    muscleLabel: 'Pectoral mayor (porciones clavicular y esternal)',
    visualGuide:
      'Región anterolateral del pectoral en el esquema, entre el surco deltopectoral/axilar y el centro del pecho.',
  },
  {
    field: 'bicepsSkinfoldMm',
    method: 'pliegues',
    side: 'front',
    kind: 'skinfold',
    x: 52,
    y: 144,
    focusCenter: { x: 56, y: 144 },
    muscles: ['biceps'],
    muscleLabel: 'Bíceps braquial (cabeza corta y larga)',
    visualGuide:
      'Cara anterior del brazo en el tercio medio del vientre del bíceps, entre la inserción deltoidea y el codo.',
  },
  {
    field: 'abdominalSkinfoldMm',
    method: 'pliegues',
    side: 'front',
    kind: 'skinfold',
    x: 122,
    y: 186,
    focusCenter: { x: 114, y: 186 },
    muscles: ['absUmbilical'],
    muscleLabel: 'Recto abdominal (porción umbilical)',
    visualGuide:
      'Zona lateral inmediata al ombligo sobre el vientre del recto abdominal indicado en la vista frontal.',
  },
  {
    field: 'suprailiacSkinfoldMm',
    method: 'pliegues',
    side: 'front',
    kind: 'skinfold',
    x: 77,
    y: 202,
    focusCenter: { x: 86, y: 196 },
    muscles: ['obliques'],
    muscleLabel: 'Oblicuo externo (región suprailiaca)',
    visualGuide:
      'Flanco anterolateral sobre la línea iliaca, justo en la porción inferolateral de los oblicuos externos.',
  },
  {
    field: 'thighSkinfoldMm',
    method: 'pliegues',
    side: 'front',
    kind: 'skinfold',
    x: 82,
    y: 292,
    focusCenter: { x: 84, y: 292 },
    muscles: ['quadriceps'],
    muscleLabel: 'Cuádriceps femoral (recto femoral y vastos)',
    visualGuide:
      'Eje anterior del muslo en la zona media del recto femoral, entre el pliegue inguinal y la rótula.',
  },
  {
    field: 'tricepsSkinfoldMm',
    method: 'pliegues',
    side: 'back',
    kind: 'skinfold',
    x: 51,
    y: 142,
    focusCenter: { x: 56, y: 142 },
    muscles: ['triceps'],
    muscleLabel: 'Tríceps braquial (cabezas larga y lateral)',
    visualGuide:
      'Cara posterior del brazo en su tercio medio, centrado sobre el vientre del tríceps entre hombro y codo.',
  },
  {
    field: 'subscapularSkinfoldMm',
    method: 'pliegues',
    side: 'back',
    kind: 'skinfold',
    x: 83,
    y: 126,
    focusCenter: { x: 95, y: 122 },
    muscles: ['scapula', 'latissimus'],
    muscleLabel: 'Ángulo inferior escapular, redondo mayor y dorsal ancho',
    visualGuide:
      'Región inferior de la escápula en vista posterior, en la transición entre redondo mayor e inicio del dorsal ancho.',
  },
];
