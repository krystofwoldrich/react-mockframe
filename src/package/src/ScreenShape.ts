/**
 * @fileoverview Superellipse screen shapes for the frames measured from Apple's bezels.
 *
 * Each screen corner is a quarter of |x|^n + |y|^n = 1, so the straight edges run
 * into the corner with zero curvature (for n > 2) instead of the curvature jump of
 * a circular `border-radius`. The shape is applied to `.screen` as a CSS mask.
 *
 * One superellipse was fitted to the four screen corners of each of Apple's bezel
 * PNGs (https://developer.apple.com/design/resources/#product-bezels); the fitted
 * curves are within 0.7 PNG px of the bezel edges. Values are CSS px at the
 * frame's default size:
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
 * layer stays the same distance from the screen all around the corner.
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
    points.push([at[0] + x - (nx / len) * out[0], at[1] + y - (ny / len) * out[1]])
  }
  return cutOut(points)
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

/** A mask as an SVG that fills the masked element: a full rect with the given corners cut out */
function cornerMaskSvg(paths: Partial<CornerPaths>) {
  const corners = CORNERS
    .filter(({ key }) => paths[key])
    .map(({ key, x, y, scale }) =>
      `<svg x='${x}' y='${y}' overflow='visible'><path d='${paths[key]}' transform='scale(${scale})'/></svg>`)
    .join('')
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
}

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

const styleCache = new Map<string, React.CSSProperties>()

/** Inline style that masks an element with `svg`, without the CSS `border-radius` (it would cut the corners too) */
function maskStyle(svg: string): React.CSSProperties {
  let style = styleCache.get(svg)
  if (!style) {
    const mask = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
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

/** Inline style that gives `.screen` its superellipse corners */
export function screenShapeStyle(shape: ScreenShape): React.CSSProperties {
  let style = screenStyles.get(shape)
  if (!style) {
    style = maskStyle(screenMaskSvg(shape))
    screenStyles.set(shape, style)
  }
  return style
}

/** Inline style that cuts an element's `corners` to the body outline of `band` */
export function bodyShapeStyle(
  shape: ScreenShape, band: FrameBand, corners: readonly (keyof ScreenShape)[],
): React.CSSProperties {
  const paths = bodyCornerPaths(shape, paddingSides(band.padding), 0, band.circles)
  return maskStyle(cornerMaskSvg(Object.fromEntries(corners.map((key) => [key, paths[key]]))))
}
