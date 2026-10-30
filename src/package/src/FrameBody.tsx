/**
 * @fileoverview Superellipse body and band for the frames measured from Apple's bezels.
 *
 * The CSS draws the body with a circular `border-radius` and the band as inset
 * `box-shadow` rings, which follow that circle. Next to a superellipse screen the
 * black border then gets thinner and thicker around the corner. This redraws the
 * body, the glass glow and the band rings as offset curves of the screen's
 * superellipse, with the same color variables as the CSS (`--mf-b1`, `--mf-glass`, …).
 *
 * Each layer is an HTML element, filled with its color and masked to everything
 * less than `depth` px inside the body edge; the container is masked to the body
 * outline. The masks are data-URI SVGs that place the corners with nested <svg>s,
 * so they fit any frame size.
 *
 * HTML layers (not SVG shapes) keep the frame exportable with tools such as
 * html-to-image: they copy each HTML element's computed style, so the color
 * variables resolve, but they copy an <svg> with its children as they are.
 */

import * as React from 'react'
import type { FrameBand, ScreenShape } from './ScreenShape'
import { bodyCornerPaths, bodyLayerStyle, bodyShapeStyle, paddingSides } from './ScreenShape'

const FILL: React.CSSProperties = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }

/** The inset glass glow (`inset 0 0 <blur> <spread>`) as steps around the spread, outermost first */
const GLOW_STEPS = [
  { offset: 0.5, opacity: 0.35 },
  { offset: 0, opacity: 0.5 },
  { offset: -0.5, opacity: 1 },
]

export const FrameBody = ({ shape, band, landscape }: { shape: ScreenShape, band: FrameBand, landscape?: boolean }) => {
  const layers = React.useMemo(() => {
    const sides = paddingSides(band.padding, landscape)
    const ringColor = band.ringColor ?? '--mf-b'
    const layer = (depth: number) => bodyLayerStyle(bodyCornerPaths(shape, sides, depth, band.circles), depth)
    const glass = band.glass
    return {
      outline: bodyShapeStyle(shape, band, undefined, landscape),
      glass: glass
        ? GLOW_STEPS.map(({ offset, opacity }) => {
          const depth = Math.max(0, glass.spread + offset * glass.blur)
          return { depth, opacity, mask: layer(depth) }
        })
        : [],
      // Widest ring first: each ring is painted over the next one in
      rings: band.rings
        .map((depth, i) => ({ depth, color: `var(${ringColor}${i + 1})`, mask: layer(depth) }))
        .reverse(),
    }
  }, [shape, band, landscape])

  return (
    <div className="body" aria-hidden="true" style={layers.outline}>
      <div style={{ ...FILL, background: band.background ?? '#000' }} />
      {layers.glass.map(({ depth, opacity, mask }) => (
        <div key={depth} style={{ ...FILL, ...mask, background: 'var(--mf-glass)', opacity }} />
      ))}
      {layers.rings.map(({ color, mask }) => (
        <div key={color} style={{ ...FILL, ...mask, background: color }} />
      ))}
    </div>
  )
}
