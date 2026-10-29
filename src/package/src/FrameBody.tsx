/**
 * @fileoverview Superellipse body and band for the frames measured from Apple's bezels.
 *
 * The CSS draws the body with a circular `border-radius` and the band as inset
 * `box-shadow` rings, which follow that circle. Next to a superellipse screen the
 * black border then gets thinner and thicker around the corner. This SVG redraws
 * the body, the glass glow and the band rings as offset curves of the screen's
 * superellipse, with the same color variables as the CSS (`--mf-b1`, `--mf-glass`, …).
 *
 * Each layer is everything less than `depth` px inside the body edge: a rect
 * stroke covers the straight edges and the corner cut-outs cover the corners.
 * Nested <svg>s put the cut-outs at the corners, so the SVG fits any frame size.
 */

import * as React from 'react'
import type { FrameBand, ScreenShape, CornerPaths } from './ScreenShape'
import { CORNERS, bodyCornerPaths, paddingSides } from './ScreenShape'

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
    const sides = paddingSides(band.padding, landscape)
    const ringColor = band.ringColor ?? '--mf-b'
    const paths = (depth: number) => bodyCornerPaths(shape, sides, depth, band.circles)
    return {
      body: paths(0),
      glass: band.glass && paths(band.glass.spread),
      // Widest ring first: each ring is painted over the next one in
      rings: band.rings
        .map((depth, i) => ({ depth, color: `var(${ringColor}${i + 1})`, paths: paths(depth) }))
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
        <rect width="100%" height="100%" style={{ fill: band.background ?? '#000' }} />
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
