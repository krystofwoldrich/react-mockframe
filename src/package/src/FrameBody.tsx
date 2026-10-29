/**
 * @fileoverview Superellipse body and band for the frames measured from Apple's bezels.
 *
 * The CSS draws the body with a circular `border-radius` and the band as inset
 * `box-shadow` rings, which follow that circle. Next to a superellipse screen the
 * black border then gets thinner and thicker around the corner. This SVG redraws
 * the body, the glass glow and the band rings as offset curves of the screen's
 * superellipse, with the same colors (`--mf-b1` … `--mf-b12`, `--mf-glass`).
 *
 * Each layer is everything less than `depth` px inside the body edge: a rect
 * stroke covers the straight edges and the corner cut-outs cover the corners.
 * Nested <svg>s put the cut-outs at the corners, so the SVG fits any frame size.
 */

import * as React from 'react'
import type { FrameBand, ScreenShape, CornerPaths } from './ScreenShape'
import { bodyCornerPaths } from './ScreenShape'

const CORNERS: { key: keyof CornerPaths, x: string, y: string, scale: string }[] = [
  { key: 'topLeft', x: '0', y: '0', scale: '1 1' },
  { key: 'topRight', x: '100%', y: '0', scale: '-1 1' },
  { key: 'bottomRight', x: '100%', y: '100%', scale: '-1 -1' },
  { key: 'bottomLeft', x: '0', y: '100%', scale: '1 -1' },
]

const Corners = ({ paths }: { paths: CornerPaths }) => (
  <>
    {CORNERS.map(({ key, x, y, scale }) => (
      <svg key={key} x={x} y={y} overflow="visible">
        <path d={paths[key]} transform={`scale(${scale})`} />
      </svg>
    ))}
  </>
)

/** Everything less than `depth` px inside the body edge, in one color */
const Layer = ({ paths, depth, color, filter }: { paths: CornerPaths, depth: number, color: string, filter?: string }) => (
  <g style={{ fill: color }} filter={filter}>
    <rect width="100%" height="100%" fill="none" style={{ stroke: color }} strokeWidth={2 * depth} />
    <Corners paths={paths} />
  </g>
)

export const FrameBody = ({ shape, band, landscape }: { shape: ScreenShape, band: FrameBand, landscape?: boolean }) => {
  const id = React.useId().replace(/[^\w-]/g, '')
  const layers = React.useMemo(() => {
    // CSS padding order is [vertical, horizontal]; the corner math wants [x, y]
    const padding: [number, number] = landscape
      ? [band.padding[0], band.padding[1]]
      : [band.padding[1], band.padding[0]]
    return {
      body: bodyCornerPaths(shape, padding, 0),
      glass: band.glass && bodyCornerPaths(shape, padding, band.glass.spread),
      // Widest ring first: each ring is painted over the next one in
      rings: band.rings
        .map((depth, i) => ({ depth, color: `var(--mf-b${i + 1})`, paths: bodyCornerPaths(shape, padding, depth) }))
        .reverse(),
    }
  }, [shape, band, landscape])

  return (
    <svg className="body" aria-hidden="true">
      <defs>
        <mask id={`${id}-body`}>
          <rect width="100%" height="100%" fill="white" />
          <g fill="black"><Corners paths={layers.body} /></g>
        </mask>
        {band.glass && (
          <filter id={`${id}-glass`}>
            <feGaussianBlur stdDeviation={band.glass.blur / 2} />
          </filter>
        )}
      </defs>
      <g mask={`url(#${id}-body)`}>
        <rect width="100%" height="100%" fill="#000" />
        {band.glass && layers.glass && (
          <Layer paths={layers.glass} depth={band.glass.spread} color="var(--mf-glass)" filter={`url(#${id}-glass)`} />
        )}
        {layers.rings.map(({ depth, color, paths }) => (
          <Layer key={color} paths={paths} depth={depth} color={color} />
        ))}
      </g>
    </svg>
  )
}
