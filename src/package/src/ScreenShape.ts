/**
 * @fileoverview Superellipse screen shapes for the frames measured from Apple's bezels and Google's skins.
 *
 * Each screen corner is a quarter of |x|^n + |y|^n = 1, so the straight edges run
 * into the corner with zero curvature (for n > 2) instead of the curvature jump of
 * a circular `border-radius`. The shape is applied to `.screen` as a CSS mask.
 *
 * One superellipse was fitted to the four screen corners of each of Apple's bezel
 * PNGs (https://developer.apple.com/design/resources/#product-bezels); the fitted
 * curves are within 0.7 PNG px of the bezel edges. The Google Pixel screens and
 * bodies are fitted the same way to Google's emulator skins (Android Studio,
 * plugins/android/resources/device-art-resources; also in AOSP,
 * platform/tools/adt/idea): the screen to the skin's screen mask, the body to the
 * frame image's outline. Values are CSS px at the frame's default size:
 *   n:    exponent (2 = circle, higher = flatter near the edges)
 *   size: distance from the corner where the curve starts
 */

import type * as React from 'react'
import type { DeviceName } from './DeviceOptions'

export type ScreenCorner = { n: number, size: number }

export type ScreenShape = {
  topLeft: ScreenCorner
  topRight: ScreenCorner
  bottomRight: ScreenCorner
  bottomLeft: ScreenCorner
}

const uniform = (n: number, size: number): ScreenShape => {
  const corner = { n, size }
  return { topLeft: corner, topRight: corner, bottomRight: corner, bottomLeft: corner }
}

const scaled = (shape: ScreenShape, k: number): ScreenShape => {
  const scale = ({ n, size }: ScreenCorner) => ({ n, size: size * k })
  return {
    topLeft: scale(shape.topLeft),
    topRight: scale(shape.topRight),
    bottomRight: scale(shape.bottomRight),
    bottomLeft: scale(shape.bottomLeft),
  }
}

/** 402x874 pt, fitted to the iPhone 16 Pro bezel; the iPhone 17, 17 Pro and 18 Pro share this screen */
const IPHONE_402x874 = uniform(2.59, 77.43)

/** 440x956 pt, fitted to the iPhone 16 Pro Max bezel; the 17 Pro Max and 18 Pro Max share this screen */
const IPHONE_440x956 = uniform(2.56, 76.62)

/** Screen shapes of the `MockFrame` devices, by device name */
export const SCREEN_SHAPES: Partial<Record<DeviceName, ScreenShape>> = {
  /** 375x812 pt, fitted to the iPhone 11 Pro bezel (same screen as the iPhone X and Xs) */
  'iPhone X': uniform(2.43, 45.67),
  'iPhone 17': IPHONE_402x874,
  'iPhone 18 Pro': IPHONE_402x874,
  'iPhone 17 Pro Max': IPHONE_440x956,
  'iPhone 18 Pro Max': IPHONE_440x956,
  /** 420x912 pt, fitted to the iPhone Air bezel */
  'iPhone Air': uniform(2.61, 78.2),
  /** 360x780 pt, fitted to the iPhone 12 mini and 13 mini bezels together */
  'iPhone 12 mini': uniform(2.73, 54.71),
  /** 13" iPad Pro (M4, M5): 1032x1376 pt, drawn at 512x683 px */
  'iPad Pro': scaled(uniform(2.18, 31.68), 512 / 1032),
  // Google Pixel, in dp. The Pixel 10 family's screen masks have circular corners (n = 2), the
  // Pixel 9 family's flatter ones. The Folds' shapes here are the closed (outer) displays.
  'Pixel 10': uniform(2, 55.62),
  'Pixel 10 Pro': uniform(2, 59.64),
  'Pixel 9 Pro': uniform(2.35, 67.11),
  'Pixel 9 Pro Fold': uniform(2.3, 62.42),
  // Google's mask has a larger top-right corner
  'Pixel 10 Pro Fold': { topLeft: { n: 2, size: 49.14 }, topRight: { n: 2, size: 52.19 }, bottomRight: { n: 2, size: 49.14 }, bottomLeft: { n: 2, size: 49.14 } },
}

/** Screens of the poses that use another display: the Pixel Folds open (inner display) */
export const POSE_SCREEN_SHAPES: Partial<Record<DeviceName, Record<string, ScreenShape>>> = {
  'Pixel 9 Pro Fold': { open: uniform(2.22, 52.72) },
  'Pixel 10 Pro Fold': { open: uniform(2, 53.74) },
}

/** iPhone Duo screens in their natural orientation (1px = 1pt) */
export const DUO_SCREEN_SHAPES = {
  /** 466x678 outer display: small corners on the hinge (left) side */
  outer: {
    topLeft: { n: 2.45, size: 9.57 },
    topRight: { n: 2.51, size: 70.55 },
    bottomRight: { n: 2.51, size: 70.55 },
    bottomLeft: { n: 2.45, size: 9.57 },
  } satisfies ScreenShape,
  /** 951x669 inner display */
  inner: uniform(2.52, 65.28),
}

/**
 * Ends of the iPhone Duo's spine (the other half, beside the closed device's hinge side), fitted
 * to Apple's closed bezel: superellipses within 0.04 pt of its outline, 7 pt from the top and bottom
 * edges (`.duo-spine` in mockframe.css).
 */
export const DUO_SPINE_ENDS: Partial<ScreenShape> = {
  topLeft: { n: 2.7, size: 13.1 },
  bottomLeft: { n: 2.7, size: 13.1 },
}

const SAMPLES = 18

type Vec = [x: number, y: number]

/** How far a cut-out reaches past the element edges, in px (enough for a frame scaled down to 1/8) */
const BLEED = 8

const draw = (x: number, y: number) => `${x.toFixed(2)},${y.toFixed(2)}`

/**
 * Close a corner curve (from the left edge to the top edge) into a cut-out that
 * reaches `BLEED` px past the element edges. If it stopped exactly on the edges,
 * the anti-aliased edge pixels of the mask rect would only be partly covered, and
 * a faint line would show along the edges outside the curve.
 */
function cutOut(points: Vec[]) {
  const first = points[0]!, last = points[points.length - 1]!
  const curve = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${draw(...p)}`).join(' ')
  return `${curve} L ${draw(last[0], -BLEED)} L ${draw(-BLEED, -BLEED)} L ${draw(-BLEED, first[1])} Z`
}

/**
 * One corner's cut-out, hugging the outer corner at (0,0). By default this is the
 * screen corner itself. For the body layers, `at` is where the screen corner sits
 * and `out` moves the curve outward along its normals (an offset curve), so the
 * layer stays the same distance from the screen all around the corner. A negative
 * `out` moves a body corner inward instead.
 */
function nubPath({ size, n }: ScreenCorner, at: Vec = [0, 0], out: Vec = [0, 0]) {
  const points: Vec[] = []
  for (let i = 0; i <= SAMPLES; i++) {
    const t = (i / SAMPLES) * (Math.PI / 2)
    const cos = Math.cos(t), sin = Math.sin(t)
    const x = size - size * cos ** (2 / n)
    const y = size - size * sin ** (2 / n)
    // Outward normal of |x|^n + |y|^n = 1 at this point
    const nx = cos ** (2 * (n - 1) / n), ny = sin ** (2 * (n - 1) / n)
    const len = Math.hypot(nx, ny)
    const p: Vec = [at[0] + x - (nx / len) * out[0], at[1] + y - (ny / len) * out[1]]
    // An inward offset deeper than the curve's radius would loop back: keep the curve running one way
    const prev = points[points.length - 1]
    points.push(prev ? [Math.max(p[0], prev[0]), Math.min(p[1], prev[1])] : p)
  }
  return cutOut(points)
}

/** Points of a superellipse corner from the left edge to the top edge: `sx` px across, `sy` px down, from (ox, oy) */
function cornerPoints(n: number, sx: number, sy: number, ox = 0, oy = 0, samples = SAMPLES): Vec[] {
  const points: Vec[] = []
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * (Math.PI / 2)
    points.push([ox + sx - sx * Math.cos(t) ** (2 / n), oy + sy - sy * Math.sin(t) ** (2 / n)])
  }
  return points
}

/** Height of a corner polyline (x rising) at `x` */
function yAt(points: Vec[], x: number) {
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]!, [x1, y1] = points[i]!
    if (x1 >= x) return x1 === x0 ? y1 : y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
  }
  return points[points.length - 1]![1]
}

/** Cut-out of a circular corner of `radius`, `depth` px inside the edges (like an inset box-shadow) */
function circleNubPath(radius: number, depth: number) {
  const c = Math.max(radius, depth), r = c - depth
  const points: Vec[] = []
  for (let i = 0; i <= SAMPLES; i++) {
    const t = (i / SAMPLES) * (Math.PI / 2)
    points.push([c - r * Math.cos(t), c - r * Math.sin(t)])
  }
  return cutOut(points)
}

export type CornerPaths = Record<keyof ScreenShape, string>

/**
 * Where each corner's cut-out goes: a nested <svg> moves the origin to the corner
 * and the cut-out is mirrored to point into the element, so the corners keep
 * their size at any element size.
 */
export const CORNERS: readonly { key: keyof ScreenShape, x: string, y: string, scale: string }[] = [
  { key: 'topLeft', x: '0', y: '0', scale: '1 1' },
  { key: 'topRight', x: '100%', y: '0', scale: '-1 1' },
  { key: 'bottomRight', x: '100%', y: '100%', scale: '-1 -1' },
  { key: 'bottomLeft', x: '0', y: '100%', scale: '1 -1' },
]

/** The given corner cut-outs, each placed at its corner */
function placedCorners(paths: Partial<CornerPaths>) {
  return CORNERS
    .filter(({ key }) => paths[key])
    .map(({ key, x, y, scale }) =>
      `<svg x='${x}' y='${y}' overflow='visible'><path d='${paths[key]}' transform='scale(${scale})'/></svg>`)
    .join('')
}

/** A mask as an SVG that fills the masked element: a full rect with the given corners (and `extra` shapes) cut out */
function cornerMaskSvg(paths: Partial<CornerPaths>, extra = '') {
  const corners = placedCorners(paths) + extra
  // A full rectangle with the corner nubs cut out via an inner luminance mask
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'>` +
    `<mask id='cut'><rect width='100%' height='100%' fill='white'/><g fill='black'>${corners}</g></mask>` +
    `<rect width='100%' height='100%' mask='url(#cut)'/>` +
    '</svg>'
  )
}

/** The screen mask: the four screen corners cut out of the element */
export function screenMaskSvg(shape: ScreenShape) {
  return cornerMaskSvg({
    topLeft: nubPath(shape.topLeft),
    topRight: nubPath(shape.topRight),
    bottomRight: nubPath(shape.bottomRight),
    bottomLeft: nubPath(shape.bottomLeft),
  })
}

/**
 * Body corners for the band frames. Apple draws the outer body as the screen's
 * superellipse moved outward by the glass border (within 0.2 pt on the iPhones
 * and the iPhone Duo, 0.35 pt on the iPad Pro, 0.4 pt on the Pro Max), so every
 * body layer is an offset curve of the screen corner. Then the black border keeps
 * one width around the corner, as on Apple's bezels.
 */
export type FrameBand = {
  /** Glass border around the screen in portrait, as the CSS `padding` shorthand (1, 2 or 4 values) */
  padding: readonly number[]
  /** Inner edge of each band ring, measured from the body edge */
  rings: readonly number[]
  /** Color variable of the rings, numbered from 1 */
  ringColor?: string
  /** Body color under the rings */
  background?: string
  /** Glass glow under the band (`--mf-glass`): spread and blur of the inset shadow */
  glass?: { spread: number, blur: number }
  /** Corners that stay circular (radius in px), instead of following the screen */
  circles?: Partial<Record<keyof ScreenShape, number>>
  /**
   * Body corners at the body edge, when the body does not follow the screen corners (the Pixels:
   * their bodies are flatter superellipses than their screens). The band rings follow them inward.
   */
  body?: ScreenShape
  /** The hinge side of a closed foldable */
  hinge?: Hinge
  /** The hinge gap at the middle of the top and bottom edges of an open foldable (left and right in landscape) */
  gap?: HingeGap
}

/**
 * The gap between the two halves of an open Pixel Fold, at the middle of the top and bottom edges (from Google's
 * skins): each half's end is a rounded shoulder, a superellipse `sx` px across and `sy` px deep that ends
 * `width / 2` px from the middle; between the halves the gap's floor is `depth` px deep, filled by the hinge `plate`.
 */
export type HingeGap = { sx: number, sy: number, n: number, width: number, depth: number, plate?: string }

/** The hinge of a closed foldable: on the left in portrait, at the bottom in landscape */
export type Hinge = {
  /** Strips along the hinge side, over the band: the inner edge of each, from that edge */
  rings: readonly number[]
  /** Color variable of the strips, numbered from 1 */
  ringColor: string
  /** The strip whose color fills the hinge-side corners, between the band and the glass (numbered from 1) */
  face: number
  /**
   * The glass edge, drawn with the glass inside the band and the hinge strips: rings from the glass
   * edge inward. The glass follows the screen corners, so on the hinge side its corners are larger
   * than the body's and the face color shows between them.
   */
  edge: { rings: readonly number[], ringColor: string }
  /**
   * A spine beside the main body and shorter than it (the Pixel 10 Pro Fold). The hinge-side
   * body corners are then the main body's, starting `bodyEdge` px from the hinge-side edge,
   * and the outline steps out to the spine below them.
   */
  spine?: {
    /** Spine width, from the hinge-side edge */
    width: number
    /** Where the spine's rounded end starts, from the top (and the bottom) edge */
    inset: number
    /** The rounded end: a superellipse `x` px across the spine and `y` px along it */
    end: { n: number, x: number, y: number }
    /** Where the main body's edge is under the spine, from the hinge-side edge */
    bodyEdge: number
  }
}

// The values match the `padding` and the inset `box-shadow` rings in mockframe.css
const PRO_RINGS = [0.667, 1.333, 2, 2.667, 3.333, 4, 4.333, 4.667, 5, 5.333, 5.667, 6.333]
const PRO_GLASS = { spread: 9.3, blur: 3 }

/** Band frames, by device name */
export const FRAME_BANDS: Partial<Record<DeviceName, FrameBand>> = {
  'iPhone 17': {
    padding: [14.33, 14.67],
    rings: [0.667, 1.333, 2, 2.667, 3.333, 3.667, 4, 4.333, 4.667, 5, 5.333, 5.667],
    glass: { spread: 8.5, blur: 3 },
  },
  'iPhone 18 Pro': { padding: [15.67, 15.83], rings: PRO_RINGS, glass: PRO_GLASS },
  'iPhone 17 Pro Max': { padding: [15.13, 15.33], rings: PRO_RINGS, glass: PRO_GLASS },
  'iPhone 18 Pro Max': { padding: [15.13, 15.33], rings: PRO_RINGS, glass: PRO_GLASS },
  'iPhone Air': { padding: [15.23, 15.35], rings: PRO_RINGS, glass: PRO_GLASS },
  'iPhone 12 mini': {
    padding: [20.41, 20.49],
    rings: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5.25, 6.25, 7.25],
  },
  'iPad Pro': { padding: [22.33], rings: [0.5, 1, 1.75, 2.5], glass: { spread: 3, blur: 1 } },
  // Google Pixel: bezels, body corners and band measured on Google's emulator skins. The band is the
  // metal rings, then the glass edge; the colors are in mockframe.css. The Folds here are closed.
  'Pixel 10': {
    padding: [20.86, 21.92, 21.11, 22.45],
    rings: [0.36, 1.12, 1.5, 1.88, 2.26, 2.64, 3.02, 4.55, 4.93, 5.69, 6.07, 6.45, 6.83, 7.22, 7.6, 7.98, 8.36, 8.74, 9.12, 9.5, 9.88, 10.26],
    body: uniform(2.26, 85.8),
  },
  'Pixel 10 Pro': {
    padding: [19.82, 20.22, 17.33, 19.66],
    rings: [0.33, 0.66, 0.99, 1.33, 1.66, 1.99, 2.66, 4.99, 5.66, 5.99, 6.33, 6.66, 6.99, 7.33, 7.66, 7.99, 8.33, 8.66, 8.99, 9.33, 9.66, 9.99, 10.33],
    body: uniform(2.26, 87.81),
  },
  'Pixel 9 Pro': {
    padding: [20.24, 20.01, 18.98, 19.87],
    rings: [0.2, 0.53, 0.87, 1.2, 1.53, 1.87, 2.2, 2.53, 4.53, 4.87, 5.2, 5.53, 5.87, 6.2, 6.53, 7.2, 7.53, 7.87, 8.2, 8.53, 8.87, 9.2],
    body: uniform(2.23, 86.77),
  },
  'Pixel 9 Pro Fold': {
    padding: [26.49, 23.49, 22.85, 35.78],
    rings: [0.64, 1.4, 1.78, 2.16, 2.54, 2.92, 3.3, 4.45, 4.83, 5.21, 5.59, 5.97, 7.49, 7.87, 8.26, 8.64, 9.02],
    body: { topLeft: { n: 2.5, size: 13.84 }, topRight: { n: 2.33, size: 91.02 }, bottomRight: { n: 2.33, size: 91.02 }, bottomLeft: { n: 2.5, size: 13.84 } },
    background: '#1a1a1a',
    hinge: {
      rings: [0.35, 0.73, 1.11, 1.49, 1.87, 2.26, 3.4, 3.78, 4.16, 4.92, 5.68, 19.02, 19.4],
      ringColor: '--mf-h',
      face: 12,
      edge: { rings: [0.38, 0.76, 1.14, 1.52], ringColor: '--mf-g' },
    },
  },
  'Pixel 10 Pro Fold': {
    padding: [24.98, 24.87, 24.69, 31.6],
    rings: [0.11, 1.25, 1.63, 2.02, 2.4, 2.78, 3.16, 3.54, 5.06, 6.21, 7.35, 8.11],
    body: { topLeft: { n: 2.62, size: 30.71 }, topRight: { n: 2.39, size: 90.96 }, bottomRight: { n: 2.39, size: 90.96 }, bottomLeft: { n: 2.62, size: 30.71 } },
    hinge: {
      rings: [1.12, 1.5, 1.89, 2.27, 3.41, 3.79, 4.17, 4.55, 6.08, 6.46, 6.84, 7.22, 7.6, 7.98, 8.36, 8.74, 9.12, 9.5, 9.89, 10.27, 12.17, 12.55, 13.31, 15.22, 15.6, 15.98, 16.36],
      ringColor: '--mf-h',
      face: 21,
      edge: { rings: [0.38, 0.76, 1.14, 1.52], ringColor: '--mf-g' },
      spine: { width: 8.93, inset: 13.15, end: { n: 2.85, x: 11.5, y: 14.48 }, bodyEdge: 6.34 },
    },
  },
}

/** Bands of the poses that use another display: the Pixel Folds open */
export const POSE_FRAME_BANDS: Partial<Record<DeviceName, Record<string, FrameBand>>> = {
  'Pixel 9 Pro Fold': {
    open: {
      padding: [25.25, 25.28, 24.4, 25.32],
      rings: [0.3, 0.71, 1.12, 1.53, 2.76, 3.17, 4.81, 5.22, 5.63],
      ringColor: '--mf-o',
      body: uniform(2.33, 87.36),
      // A narrow V: the halves' shoulders meet at the middle (within 0.25 dp of the skin)
      gap: { sx: 10, sy: 7.25, n: 2.05, width: 1, depth: 7.53 },
    },
  },
  'Pixel 10 Pro Fold': {
    open: {
      padding: [23.42, 23.93, 23.45, 25.25],
      rings: [0.23, 1.05, 1.46, 1.87, 3.1, 3.51, 3.92, 4.33, 4.74, 5.15, 5.56, 5.97],
      ringColor: '--mf-o',
      body: uniform(2.34, 86.89),
      // A wide dip with the hinge plate in its floor (0.31 dp RMS; the skin is not quite symmetric)
      gap: { sx: 19, sy: 9.6, n: 1.6, width: 8.5, depth: 9.85, plate: '#252628' },
    },
  },
}

/** The screen shape of a device in a pose (the pose's own display, else the device's) */
export const screenShapeFor = (device: DeviceName, pose?: string): ScreenShape | undefined =>
  (pose && POSE_SCREEN_SHAPES[device]?.[pose]) || SCREEN_SHAPES[device]

/** The band of a device in a pose (the pose's own display, else the device's) */
export const frameBandFor = (device: DeviceName, pose?: string): FrameBand | undefined =>
  (pose && POSE_FRAME_BANDS[device]?.[pose]) || FRAME_BANDS[device]

const turned = new WeakMap<ScreenShape, ScreenShape>()

/** The corners of a shape turned 90deg counter-clockwise, as the frames turn for landscape */
export function turnShape(shape: ScreenShape): ScreenShape {
  let turn = turned.get(shape)
  if (!turn) {
    turn = { topLeft: shape.topRight, topRight: shape.bottomRight, bottomRight: shape.bottomLeft, bottomLeft: shape.topLeft }
    turned.set(shape, turn)
  }
  return turn
}

const turnCorners = <T>(corners: Partial<Record<keyof ScreenShape, T>>): Partial<Record<keyof ScreenShape, T>> =>
  ({ topLeft: corners.topRight, topRight: corners.bottomRight, bottomRight: corners.bottomLeft, bottomLeft: corners.topLeft })

/** iPhone Duo bodies, matching `.duo-panel` (closed) and `.duo-frame` (open) in mockframe.css */
export const DUO_BANDS = {
  /** Front panel of the closed device. The hinge-side corners stay small circles. */
  outer: {
    padding: [16, 16, 16, 14],
    rings: [
      0.333, 0.667, 1, 1.333, 1.667, 2, 2.333, 2.667, 3, 3.333, 4, 4.667,
      5.333, 6, 6.333, 7, 7.667, 8.333, 9, 9.667, 10.667, 12, 13.667, 15.667,
    ],
    ringColor: '--duo-k',
    circles: { topLeft: 4, bottomLeft: 4 },
  } satisfies FrameBand,
  /** Frame of the open device */
  inner: {
    padding: [20.67],
    rings: [0.667, 1.333, 1.667, 2, 2.333, 2.667, 3, 3.333, 3.667, 4, 4.333, 4.667, 5, 6, 7, 16.667, 17.333, 18],
    ringColor: '--duo-o',
    background: 'var(--duo-o-bg)',
  } satisfies FrameBand,
}

export type Sides = { top: number, right: number, bottom: number, left: number }

/** Expand a CSS `padding` shorthand; in landscape the device is turned 90deg counter-clockwise */
export function paddingSides(padding: readonly number[], landscape?: boolean): Sides {
  const [top = 0, right = top, bottom = top, left = right] = padding
  return landscape
    ? { top: right, right: bottom, bottom: left, left: top }
    : { top, right, bottom, left }
}

/**
 * Corner cut-outs of the body layer `depth` px inside the body edge, each in its
 * own corner's coordinates (like the screen mask). `sides` is the glass border
 * between the body edges and the screen edges.
 */
export function bodyCornerPaths(
  shape: ScreenShape, sides: Sides, depth: number, circles: FrameBand['circles'] = {},
): CornerPaths {
  const path = (key: keyof ScreenShape, padding: Vec) => {
    const radius = circles[key]
    return radius !== undefined
      ? circleNubPath(radius, depth)
      : nubPath(shape[key], padding, [padding[0] - depth, padding[1] - depth])
  }
  return {
    topLeft: path('topLeft', [sides.left, sides.top]),
    topRight: path('topRight', [sides.right, sides.top]),
    bottomRight: path('bottomRight', [sides.right, sides.bottom]),
    bottomLeft: path('bottomLeft', [sides.left, sides.bottom]),
  }
}

/**
 * The outline at a hinge-side corner with a spine (Pixel 10 Pro Fold): the spine's rounded end,
 * then a step to the main body corner, which starts `bodyEdge` px in from the hinge-side edge.
 */
function spineOutline(body: ScreenCorner, spine: NonNullable<Hinge['spine']>): Vec[] {
  const end = cornerPoints(spine.end.n, spine.end.x, spine.end.y, 0, spine.inset, SAMPLES * 2)
  const main = cornerPoints(body.n, body.size, body.size, spine.bodyEdge, 0, SAMPLES * 2)
  const w = spine.width
  const ySpine = yAt(end, w), yBody = Math.min(ySpine, yAt(main, w))
  return [...end.filter(([x]) => x < w), [w, ySpine], [w, yBody], ...main.filter(([x, y]) => x > w && y < yBody)]
}

/**
 * Corner cut-outs of the band layer `depth` px inside the body edge, in either orientation. The body
 * follows the screen corners (moved out by the glass border), unless the band has its own `body`
 * corners; on the hinge side of a closed foldable it can step out to a spine.
 */
export function bandCornerPaths(shape: ScreenShape, band: FrameBand, depth: number, landscape?: boolean): CornerPaths {
  const sides = paddingSides(band.padding, landscape)
  const circles = band.circles && (landscape ? turnCorners(band.circles) : band.circles)
  if (!band.body) return bodyCornerPaths(landscape ? turnShape(shape) : shape, sides, depth, circles)
  const body = landscape ? turnShape(band.body) : band.body
  const spine = band.hinge?.spine
  // The hinge is on the left in portrait and at the bottom in landscape, where it runs along the
  // corners' local x axis instead of their y axis
  const hingeCorners: readonly (keyof ScreenShape)[] = landscape ? ['bottomRight', 'bottomLeft'] : ['topLeft', 'bottomLeft']
  const path = (key: keyof ScreenShape) => {
    const radius = circles?.[key]
    if (radius !== undefined) return circleNubPath(radius, depth)
    if (spine && hingeCorners.includes(key)) {
      if (depth === 0) {
        const points = spineOutline(body[key], spine)
        return cutOut(landscape ? points.map(([x, y]): Vec => [y, x]).reverse() : points)
      }
      // Inside the edge the band follows the main body; the hinge strips cover the spine
      return nubPath(body[key], landscape ? [0, spine.bodyEdge] : [spine.bodyEdge, 0], [-depth, -depth])
    }
    return nubPath(body[key], [0, 0], [-depth, -depth])
  }
  return { topLeft: path('topLeft'), topRight: path('topRight'), bottomRight: path('bottomRight'), bottomLeft: path('bottomLeft') }
}

/**
 * The glass of a closed foldable, inside the band and the hinge strips: where its box sits in the body
 * (`inset`), its outline (the screen corners moved out by the black border) and its edge ring layers.
 */
export function hingeGlass(shape: ScreenShape, band: FrameBand, landscape?: boolean) {
  const sides = paddingSides(band.padding, landscape)
  const bandWidth = band.rings[band.rings.length - 1] ?? 0
  const hingeWidth = band.hinge?.rings[band.hinge.rings.length - 1] ?? bandWidth
  const inset: Sides = landscape
    ? { top: bandWidth, right: bandWidth, bottom: hingeWidth, left: bandWidth }
    : { top: bandWidth, right: bandWidth, bottom: bandWidth, left: hingeWidth }
  const border: Sides = {
    top: sides.top - inset.top, right: sides.right - inset.right, bottom: sides.bottom - inset.bottom, left: sides.left - inset.left,
  }
  const screen = landscape ? turnShape(shape) : shape
  return {
    inset,
    outline: maskStyle(cornerMaskSvg(bodyCornerPaths(screen, border, 0))),
    layer: (depth: number) => bodyLayerStyle(bodyCornerPaths(screen, border, depth), depth),
  }
}

const styleCache = new Map<string, React.CSSProperties>()

/**
 * Inline style that masks an element with `svg`, without the CSS `border-radius` (it would cut the corners too).
 * Parentheses are percent-encoded too: image exporters such as html-to-image rewrite every `url(...)` they
 * find in a style, including the `url(#cut)` inside the mask SVG, which would break the mask.
 */
function maskStyle(svg: string): React.CSSProperties {
  let style = styleCache.get(svg)
  if (!style) {
    const data = encodeURIComponent(svg).replace(/\(/g, '%28').replace(/\)/g, '%29')
    const mask = `url("data:image/svg+xml,${data}")`
    style = {
      borderRadius: 0,
      maskImage: mask,
      maskSize: '100% 100%',
      maskRepeat: 'no-repeat',
      WebkitMaskImage: mask,
      WebkitMaskSize: '100% 100%',
      WebkitMaskRepeat: 'no-repeat',
    }
    styleCache.set(svg, style)
  }
  return style
}

const screenStyles = new WeakMap<ScreenShape, React.CSSProperties>()

/** Inline style that shapes only the given corners of an element (the others stay square) */
export function cornersShapeStyle(corners: Partial<ScreenShape>): React.CSSProperties {
  return maskStyle(cornerMaskSvg(Object.fromEntries(
    Object.entries(corners).map(([key, corner]) => [key, nubPath(corner)]),
  )))
}

/** Inline style that gives `.screen` its superellipse corners */
export function screenShapeStyle(shape: ScreenShape): React.CSSProperties {
  let style = screenStyles.get(shape)
  if (!style) {
    style = maskStyle(screenMaskSvg(shape))
    screenStyles.set(shape, style)
  }
  return style
}

/**
 * Inline style that keeps everything less than `depth` px inside the body edge (one band ring or glow
 * layer): a rect stroke for the straight edges and the corner cut-outs for the corners. An alpha mask,
 * so the SVG needs no inner <mask>.
 */
export function bodyLayerStyle(
  paths: CornerPaths, depth: number, hingeEdge?: { at: number, landscape?: boolean },
  gap?: { gap: HingeGap, landscape?: boolean, band?: number },
): React.CSSProperties {
  const d = +depth.toFixed(3)
  // On a closed Fold with a spine, the main body's hinge-side edge is `at` px in from the element's edge
  const strip = !hingeEdge?.at ? '' : hingeEdge.landscape
    ? `<svg y='100%' overflow='visible'><rect y='${-(hingeEdge.at + d)}' width='100%' height='${d}' fill='white'/></svg>`
    : `<rect x='${hingeEdge.at}' width='${d}' height='100%' fill='white'/>`
  return maskStyle(
    `<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'>` +
    `<rect width='100%' height='100%' fill='none' stroke='white' stroke-width='${+(2 * depth).toFixed(3)}'/>` +
    strip +
    `<g fill='white'>${placedCorners(paths)}${placedGaps(gap?.gap, depth, gap?.landscape, gap?.band)}</g>` +
    '</svg>'
  )
}

/**
 * Points of the spine's rounded end (from the hinge-side edge to across the spine), `depth` px inside
 * its outline, in the end's own corner coordinates (portrait top-left). An offset deeper than the end's
 * radius is kept running one way, like `nubPath`.
 */
function spineEndPoints(spine: NonNullable<Hinge['spine']>, depth: number): Vec[] {
  const { n, x: sx, y: sy } = spine.end
  const points: Vec[] = []
  for (let i = 0; i <= SAMPLES * 2; i++) {
    const t = (i / (SAMPLES * 2)) * (Math.PI / 2)
    const cos = Math.cos(t), sin = Math.sin(t)
    // Inward normal of ((sx - x) / sx)^n + ((sy - y) / sy)^n = 1
    const nx = cos ** (2 * (n - 1) / n) / sx, ny = sin ** (2 * (n - 1) / n) / sy
    const len = Math.hypot(nx, ny) || 1
    const p: Vec = [sx - sx * cos ** (2 / n) + (nx / len) * depth, spine.inset + sy - sy * sin ** (2 / n) + (ny / len) * depth]
    const prev = points[points.length - 1]
    points.push(prev ? [Math.max(p[0], prev[0]), Math.min(p[1], prev[1])] : p)
  }
  return points
}

/**
 * The hinge gap's outline `depth` px inside the body, from the top edge on the left to the top edge on the
 * right, with x from the middle and y down from the top edge: the left half's shoulder (its top-right corner,
 * moved inward along its normals), down its side to the floor, across, and the right half mirrored.
 */
function gapPoints(gap: HingeGap, depth: number, band?: number): Vec[] {
  const { sx, sy, n } = gap, h = gap.width / 2
  const left: Vec[] = []
  for (let i = 0; i <= SAMPLES * 2; i++) {
    // From the top edge (t = 1) to the side (t = 0) of the shoulder, as a top-left corner mirrored in x
    const t = (1 - i / (SAMPLES * 2)) * (Math.PI / 2)
    const cos = Math.cos(t), sin = Math.sin(t)
    const nx = cos ** (2 * (n - 1) / n) / sx, ny = sin ** (2 * (n - 1) / n) / sy
    const len = Math.hypot(nx, ny) || 1
    const p: Vec = [-h - (sx - sx * cos ** (2 / n) + (nx / len) * depth), sy - sy * sin ** (2 / n) + (ny / len) * depth]
    const prev = left[left.length - 1]
    left.push(prev ? [Math.max(p[0], prev[0]), Math.max(p[1], prev[1])] : p)
  }
  const last = left[left.length - 1]!
  const floor = gap.depth + depth
  if (last[1] < floor) left.push([last[0], floor])
  if (band !== undefined && depth > 0) {
    // As on Google's skins the band does not sink into the gap: its stripes follow the shoulders, but go no
    // deeper than the band, except a thin edge that follows each shoulder down to the floor
    const outline = gapPoints(gap, 0)
    for (const p of left) p[1] = Math.min(p[1], Math.max(band, yAt(outline, p[0]) + GAP_EDGE))
  }
  const right = left.map(([x, y]): Vec => [-x, y]).reverse()
  return [...left, ...right]
}

/** Thickness of the band where a shoulder dips below the band, down to the gap's floor */
const GAP_EDGE = 1.5

/** The gap's outline closed over the edge (a cut-out of the body, or a band layer's fill), as a path */
function gapPath(gap: HingeGap, depth: number, band?: number) {
  const points = gapPoints(gap, depth, band)
  const first = points[0]!, last = points[points.length - 1]!
  const curve = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${draw(...p)}`).join(' ')
  return `${curve} L ${draw(last[0], -BLEED)} L ${draw(first[0], -BLEED)} Z`
}

/**
 * Both hinge gaps (top and bottom, or left and right in landscape), placed at the middle of their edges with
 * nested <svg>s, `depth` px inside the body. Empty without a gap.
 */
function placedGaps(gap: HingeGap | undefined, depth: number, landscape?: boolean, band?: number) {
  if (!gap) return ''
  const d = gapPath(gap, depth, band)
  // Landscape turns the device counter-clockwise: the top edge's gap goes to the left edge, the bottom's to the right
  return landscape
    ? `<svg x='0' y='50%' overflow='visible'><path d='${d}' transform='matrix(0 1 1 0 0 0)'/></svg>` +
      `<svg x='100%' y='50%' overflow='visible'><path d='${d}' transform='matrix(0 1 -1 0 0 0)'/></svg>`
    : `<svg x='50%' y='0' overflow='visible'><path d='${d}'/></svg>` +
      `<svg x='50%' y='100%' overflow='visible'><path d='${d}' transform='scale(1 -1)'/></svg>`
}

/**
 * The spine of a closed Pixel 10 Pro Fold as a capsule whose stripes bend around its ends (the "bent"
 * hinge): where its box sits, its outline, and the mask of a stripe `depth` px in from its outer edge.
 * The hinge is on the left in portrait and at the bottom in landscape.
 */
export function spineCapsule(spine: NonNullable<Hinge['spine']>, landscape?: boolean) {
  const ends = landscape ? ['bottomRight', 'bottomLeft'] as const : ['topLeft', 'bottomLeft'] as const
  const corners = (depth: number): Partial<CornerPaths> => {
    const points = spineEndPoints(spine, depth)
    const path = cutOut(landscape ? points.map(([x, y]): Vec => [y, x]).reverse() : points)
    return { [ends[0]]: path, [ends[1]]: path }
  }
  return {
    box: (landscape
      ? { position: 'absolute', left: 0, right: 0, bottom: 0, height: spine.width }
      : { position: 'absolute', top: 0, bottom: 0, left: 0, width: spine.width }) satisfies React.CSSProperties,
    outline: maskStyle(cornerMaskSvg(corners(0))),
    layer: (depth: number) => {
      const d = +depth.toFixed(3)
      const strip = landscape
        ? `<svg y='100%' overflow='visible'><rect y='${-d}' width='100%' height='${d}'/></svg>`
        : `<rect width='${d}' height='100%'/>`
      return maskStyle(
        `<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'>` +
        `<g fill='white'>${strip}${placedCorners(corners(depth))}</g>` +
        '</svg>'
      )
    },
  }
}

/** Inline style that cuts an element's `corners` to the body outline of `band` */
export function bodyShapeStyle(
  shape: ScreenShape, band: FrameBand, corners: readonly (keyof ScreenShape)[] = CORNERS.map((c) => c.key),
  landscape?: boolean,
): React.CSSProperties {
  const paths = bandCornerPaths(shape, band, 0, landscape)
  return maskStyle(cornerMaskSvg(Object.fromEntries(corners.map((key) => [key, paths[key]])), placedGaps(band.gap, 0, landscape)))
}
