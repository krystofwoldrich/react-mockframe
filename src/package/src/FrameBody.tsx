/**
 * @fileoverview Superellipse body and band for the frames measured from Apple's bezels and Google's skins.
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
 * so they fit any frame size. The Pixels' bodies have their own superellipse corners
 * (`band.body`), and a closed Pixel Fold adds strips along its hinge side.
 *
 * HTML layers (not SVG shapes) keep the frame exportable with tools such as
 * html-to-image: they copy each HTML element's computed style, so the color
 * variables resolve, but they copy an <svg> with its children as they are.
 */

import * as React from 'react'
import type { FrameBand, ScreenShape } from './ScreenShape'
import { bandCornerPaths, bodyLayerStyle, bodyShapeStyle, hingeGlass, spineCapsule } from './ScreenShape'

const FILL: React.CSSProperties = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }

/** The inset glass glow (`inset 0 0 <blur> <spread>`) as steps around the spread, outermost first */
const GLOW_STEPS = [
  { offset: 0.5, opacity: 0.35 },
  { offset: 0, opacity: 0.5 },
  { offset: -0.5, opacity: 1 },
]

/** How the hinge side of a closed Fold is shaded: stripes that bend around its corners and the spine's ends, or straight strips */
export type HingeStyle = 'bent' | 'straight'

/**
 * The hinge side of a closed foldable (left in portrait, bottom in landscape): the hinge itself, and the
 * glass on top, whose larger corners leave the body's face colour showing in the hinge-side corners.
 * - bent (default): the band runs along the hinge side too and bends around its corners, like on the
 *   other corners; the spine is a capsule whose stripes bend around its ends.
 * - straight: strips along the hinge side over the band (the spine's run the full length, the others
 *   stop where the hinge-side corners begin).
 */
function hingeLayers(shape: ScreenShape, band: FrameBand, landscape: boolean | undefined, style: HingeStyle) {
  const hinge = band.hinge
  if (!hinge) return { hinge: [], spine: undefined, glassBox: undefined }
  const side = (depth: number, inset: number): React.CSSProperties => landscape
    ? { position: 'absolute', left: inset, right: inset, bottom: 0, height: depth }
    : { position: 'absolute', top: inset, bottom: inset, left: 0, width: depth }
  const spine = hinge.spine
  const glass = hingeGlass(shape, band, landscape)
  const color = (i: number) => `var(${hinge.ringColor}${i + 1})`
  let strips: { color: string, style: React.CSSProperties }[] = []
  let capsule
  if (style === 'straight') {
    // The hinge-side body corners (top-left and bottom-left in portrait) end where the hinge side runs straight
    const corner = band.body?.topLeft.size ?? 0
    const spineWidth = spine?.width ?? 0
    strips = hinge.rings.map((depth, i) => ({ color: color(i), style: side(depth, depth <= spineWidth ? 0 : corner) })).reverse()
  } else if (spine) {
    // The spine's stripes are the hinge rings that fit in it, bent around its ends
    const c = spineCapsule(spine, landscape)
    const inside = hinge.rings.map((depth, i) => ({ depth, i })).filter(({ depth }) => depth <= spine.width)
    capsule = {
      style: { ...c.box, ...c.outline },
      background: color(inside[inside.length - 1]?.i ?? 0),
      rings: inside.map(({ depth, i }) => ({ color: color(i), mask: c.layer(depth) })).reverse(),
    }
  }
  return {
    // Widest first; the body outline clips them
    hinge: strips,
    spine: capsule,
    glassBox: {
      inset: glass.inset,
      outline: glass.outline,
      rings: hinge.edge.rings
        .map((depth, i) => ({ color: `var(${hinge.edge.ringColor}${i + 1})`, mask: glass.layer(depth) }))
        .reverse(),
    },
  }
}

/**
 * The hinge plates in the floor of an open Fold's gaps (top and bottom, or left and right in landscape): the
 * plate's colour first, then the body colour, over the band rings that turn under the floor.
 */
function gapPlates(band: FrameBand, landscape?: boolean): React.CSSProperties[] {
  const gap = band.gap
  if (!gap?.plate) return []
  const half = gap.width / 2
  const thick = band.rings[band.rings.length - 1] ?? 0
  const background = band.background ?? '#000'
  const fill = (to: string) => `linear-gradient(to ${to}, ${gap.plate} 2.4px, ${background} 2.4px)`
  return landscape
    ? [
      { position: 'absolute', left: gap.depth, top: `calc(50% - ${half}px)`, width: thick, height: gap.width, background: fill('right') },
      { position: 'absolute', right: gap.depth, top: `calc(50% - ${half}px)`, width: thick, height: gap.width, background: fill('left') },
    ]
    : [
      { position: 'absolute', top: gap.depth, left: `calc(50% - ${half}px)`, width: gap.width, height: thick, background: fill('bottom') },
      { position: 'absolute', bottom: gap.depth, left: `calc(50% - ${half}px)`, width: gap.width, height: thick, background: fill('top') },
    ]
}

export const FrameBody = ({ shape, band, landscape, hingeStyle = 'bent' }: {
  shape: ScreenShape, band: FrameBand, landscape?: boolean, hingeStyle?: HingeStyle
}) => {
  const layers = React.useMemo(() => {
    const ringColor = band.ringColor ?? '--mf-b'
    // Bent hinge: the band also runs along the hinge side, at the main body's edge under a spine
    const hingeEdge = band.hinge && hingeStyle === 'bent' ? { at: band.hinge.spine?.bodyEdge ?? 0, landscape } : undefined
    // Open Fold: the band also bends into the hinge gap at the middle of the top and bottom edges
    const gap = band.gap && { gap: band.gap, landscape, band: band.rings[band.rings.length - 1] }
    const layer = (depth: number) => bodyLayerStyle(bandCornerPaths(shape, band, depth, landscape), depth, hingeEdge, gap)
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
      ...hingeLayers(shape, band, landscape, hingeStyle),
      plates: gapPlates(band, landscape),
    }
  }, [shape, band, landscape, hingeStyle])

  const background = band.background ?? '#000'
  // A closed Fold's body is its hinge face colour (it shows in the hinge-side corners); the glass is black on top.
  // One colour under every edge, so anti-aliased edges cannot show different colours on the two halves.
  const base = band.hinge ? `var(${band.hinge.ringColor}${band.hinge.face})` : background
  return (
    <div className="body" aria-hidden="true" style={layers.outline}>
      <div style={{ ...FILL, background: base }} />
      {layers.glass.map(({ depth, opacity, mask }) => (
        <div key={depth} style={{ ...FILL, ...mask, background: 'var(--mf-glass)', opacity }} />
      ))}
      {layers.rings.map(({ color, mask }) => (
        <div key={color} style={{ ...FILL, ...mask, background: color }} />
      ))}
      {layers.hinge.map(({ color, style }) => (
        <div key={color} style={{ ...style, background: color }} />
      ))}
      {layers.spine && (
        <div style={layers.spine.style}>
          <div style={{ ...FILL, background: layers.spine.background }} />
          {layers.spine.rings.map(({ color, mask }) => (
            <div key={color} style={{ ...FILL, ...mask, background: color }} />
          ))}
        </div>
      )}
      {layers.plates.map((style, i) => <div key={i} style={style} />)}
      {layers.glassBox && (
        <div style={{ position: 'absolute', ...layers.glassBox.inset, ...layers.glassBox.outline }}>
          <div style={{ ...FILL, background }} />
          {layers.glassBox.rings.map(({ color, mask }) => (
            <div key={color} style={{ ...FILL, ...mask, background: color }} />
          ))}
        </div>
      )}
    </div>
  )
}
