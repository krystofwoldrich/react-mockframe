/**
 * @fileoverview iPhone Duo (foldable) renderer used by `MockFrame`.
 *
 * Geometry comes from Apple's official iPhone Duo product bezels (1px = 1pt):
 * - closed: the 466x678 outer display, natural orientation portrait
 * - open: the 951x669 inner display, natural orientation landscape
 * - half-open: the book pose. Each half of the open device is drawn flat and
 *   then placed with a perspective transform fitted to the corners of Apple's
 *   partially-open render, so the screen content is drawn once per half.
 *
 * Landscape/portrait variants of closed and open are the natural device turned
 * 90 degrees counter-clockwise, which is how Apple's bezels are drawn.
 */

import * as React from 'react'

import { DUO_BANDS, DUO_SCREEN_SHAPES, bodyShapeStyle, screenShapeStyle } from './ScreenShape'
import { FrameBody } from './FrameBody'

export type DuoPose = 'closed' | 'half-open' | 'open'

type Size = { sw: number, sh: number }

/** Natural screen sizes and bezel totals (x, y) per display */
const OUTER = { sw: 466, sh: 678, bx: 41.67, by: 32 }
const INNER = { sw: 951, sh: 669, bx: 41.33, by: 41.33 }

/**
 * Apple's partially-open render (Inner Partially Open Landscape, 5600x4500 px):
 * virtual sharp corners of each half's front face (fitted to the rim, inside
 * the ~8pt side walls), the silhouette's bounding box, and the scale that maps
 * the hinge (3946.8 px) to the flat body height.
 */
const BOOK = {
  origin: [40, 63] as const,
  size: [5519, 4374] as const,
  hinge: { x: 2789, top: 276.1, bottom: 4222.9 },
  outer: { left: 84.3, right: 5515.7, top: 19.3, bottom: 4479.7 },
  scale: (INNER.sh + INNER.by) / (4222.9 - 276.1),
}

type Pt = [number, number]

/** Solve the 8 unknowns of the projective transform taking `src` to `dst` */
function homography(src: Pt[], dst: Pt[]): number[] {
  const m: number[][] = []
  src.forEach(([x, y], i) => {
    const [u, v] = dst[i]!
    m.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u])
    m.push([0, 0, 0, x, y, 1, -v * x, -v * y, v])
  })
  for (let c = 0; c < 8; c++) {
    let p = c
    for (let r = c + 1; r < 8; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[p]![c]!)) p = r
    ;[m[c], m[p]] = [m[p]!, m[c]!]
    for (let r = 0; r < 8; r++) {
      if (r === c) continue
      const f = m[r]![c]! / m[c]![c]!
      for (let k = c; k < 9; k++) m[r]![k]! -= f * m[c]![k]!
    }
  }
  return m.map((row, i) => row[8]! / row[i]!)
}

/** CSS matrix3d() for the projective transform taking `src` to `dst` */
function matrix3d(src: Pt[], dst: Pt[]): string {
  const [a, b, c, d, e, f, g, h] = homography(src, dst)
  return `matrix3d(${[a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, 1].map((n) => +n!.toFixed(9)).join(',')})`
}

/** Half-open side walls: the open body's outline, so the walls follow its superellipse corners */
const WALL_STYLES = {
  left: bodyShapeStyle(DUO_SCREEN_SHAPES.inner, DUO_BANDS.inner, ['topLeft', 'bottomLeft']),
  right: bodyShapeStyle(DUO_SCREEN_SHAPES.inner, DUO_BANDS.inner, ['topRight', 'bottomRight']),
}

/** Mark a duplicated subtree inert (works with React 18 and 19) */
const setInert = (el: HTMLElement | null) => el?.setAttribute('inert', '')

interface DuoDeviceProps extends Size {
  inner: boolean
  rotated: boolean
  hideCamera?: boolean
  duplicate?: boolean
  /** Half-open only: which half this copy shows (adds its side wall and shading) */
  half?: 'left' | 'right'
  children?: React.ReactNode
}

/** One flat device: the outer (closed) or inner (open) face */
function DuoDevice({ inner, sw, sh, rotated, hideCamera, duplicate, half, children }: DuoDeviceProps) {
  const dims = inner ? INNER : OUTER
  const dw = sw + dims.bx
  const dh = sh + dims.by

  return (
    <div
      className={inner ? 'duo-device duo-inner' : 'duo-device duo-outer'}
      style={{
        width: dw,
        height: dh,
        // Turn 90deg counter-clockwise inside a box of the rotated size
        transform: rotated ? `translateY(${dw}px) rotate(-90deg)` : undefined,
      }}
    >
      {inner ? (
        <>
          <div className="duo-frame superellipse-body">
            <FrameBody shape={DUO_SCREEN_SHAPES.inner} band={DUO_BANDS.inner} />
          </div>
          <div className="duo-hinge duo-hinge--top" />
          <div className="duo-hinge duo-hinge--bottom" />
        </>
      ) : (
        <>
          <div className="duo-spine" />
          <div className="duo-panel superellipse-body">
            <FrameBody shape={DUO_SCREEN_SHAPES.outer} band={DUO_BANDS.outer} />
            <div className="duo-strip-b" />
          </div>
        </>
      )}
      <div className="duo-btn duo-btn--side" />
      <div className="duo-btn duo-btn--vol-up" />
      <div className="duo-btn duo-btn--vol-down" />
      <div
        className="screen"
        style={{ width: sw, height: sh, ...screenShapeStyle(inner ? DUO_SCREEN_SHAPES.inner : DUO_SCREEN_SHAPES.outer) }}
      >
        <div
          className="duo-content"
          ref={duplicate ? setInert : undefined}
          aria-hidden={duplicate || undefined}
          // Counter-rotate so the content stays upright when the device turns
          style={rotated
            ? { width: sh, height: sw, transform: `translateX(${sw}px) rotate(90deg)` }
            : { width: sw, height: sh }}
        >
          {children}
        </div>
      </div>
      {!hideCamera && <div className="duo-camera" />}
      {half && (
        <>
          <div className={`duo-wall duo-wall--${half}`} style={WALL_STYLES[half]} />
          <div className={`duo-shade duo-shade--${half}`} style={screenShapeStyle(DUO_SCREEN_SHAPES.inner)} />
        </>
      )}
    </div>
  )
}

/** Half-open layout for a given inner body size: root box, hinge and the two transforms */
function bookLayout(dw: number, dh: number) {
  // Scale Apple's fitted corners from the default body to this body size
  const sx = (dw / (INNER.sw + INNER.bx)) * BOOK.scale
  const sy = (dh / (INNER.sh + INNER.by)) * BOOK.scale
  const X = (x: number) => (x - BOOK.origin[0]) * sx
  const Y = (y: number) => (y - BOOK.origin[1]) * sy
  const { hinge, outer } = BOOK
  const lt: Pt = [X(outer.left), Y(outer.top)]
  const lb: Pt = [X(outer.left), Y(outer.bottom)]
  const ht: Pt = [X(hinge.x), Y(hinge.top)]
  const hb: Pt = [X(hinge.x), Y(hinge.bottom)]
  const rt: Pt = [X(outer.right), Y(outer.top)]
  const rb: Pt = [X(outer.right), Y(outer.bottom)]
  const mid = dw / 2
  return {
    width: BOOK.size[0] * sx,
    height: BOOK.size[1] * sy,
    hingeX: X(hinge.x),
    hingeTop: Y(hinge.top),
    left: matrix3d([[0, 0], [mid, 0], [mid, dh], [0, dh]], [lt, ht, hb, lb]),
    right: matrix3d([[mid, 0], [dw, 0], [dw, dh], [mid, dh]], [ht, rt, rb, hb]),
  }
}

/* -----------------------------------------------------------------------------
   Fold animation
   The device as two real 3D leaves hinged in the middle. Apple's book pose is
   each half turned ~30deg towards the viewer under a ~2100px perspective; both
   are derived from the same fitted corners as the static pose, so a fold ends
   where the static half-open frame begins. Closing swings the left leaf all the
   way over: its back is the outer display.
   ----------------------------------------------------------------------------- */

const FOLD_MS = 900
const FOLD_EASE = 'cubic-bezier(0.45, 0, 0.2, 1)'

/** Per-half angle and perspective that reproduce Apple's book render */
const BOOK_3D = (() => {
  const w = (INNER.sw + INNER.bx) / 2
  const k = BOOK.scale
  const outerH = BOOK.outer.bottom - BOOK.outer.top
  const hingeH = BOOK.hinge.bottom - BOOK.hinge.top
  const zoomOuter = outerH / hingeH // projected size of the outer edge vs the hinge
  const cos = ((BOOK.hinge.x - BOOK.outer.left) * k) / (w * zoomOuter)
  const angle = Math.acos(cos)
  const perspective = (w * Math.sin(angle)) / (1 - 1 / zoomOuter)
  return { angle: (angle * 180) / Math.PI, perspective }
})()

type FoldState = {
  width: number
  height: number
  hingeX: number
  top: number
  left: number
  right: number
}

function foldState(pose: DuoPose): FoldState {
  const dw = INNER.sw + INNER.bx
  const dh = INNER.sh + INNER.by
  if (pose === 'open') return { width: dw, height: dh, hingeX: dw / 2, top: 0, left: 0, right: 0 }
  if (pose === 'half-open') {
    const b = bookLayout(dw, dh)
    return { width: b.width, height: b.height, hingeX: b.hingeX, top: b.hingeTop, left: BOOK_3D.angle, right: -BOOK_3D.angle }
  }
  // Closed: the left leaf folded over the right one, the spine just left of the hinge
  const spine = 11.67
  return { width: OUTER.sw + OUTER.bx, height: OUTER.sh + OUTER.by, hingeX: spine, top: 0, left: 180, right: 0 }
}

function DuoFoldScene({ state, flat, hideCamera, children }: {
  state: FoldState
  flat: boolean
  hideCamera?: boolean
  children?: React.ReactNode
}) {
  const dw = INNER.sw + INNER.bx
  const dh = INNER.sh + INNER.by
  const w = dw / 2
  const t = `${FOLD_MS}ms ${FOLD_EASE}`
  return (
    <div
      className={flat ? 'duo-scene duo-scene--flat' : 'duo-scene'}
      style={{
        left: state.hingeX - w,
        top: state.top,
        width: dw,
        height: dh,
        perspective: BOOK_3D.perspective,
        transition: `left ${t}, top ${t}`,
      }}
    >
      <div
        className="duo-leaf duo-leaf--right"
        style={{ transform: `translateZ(-0.5px) rotateY(${state.right}deg)`, transition: `transform ${t}` }}
      >
        <div className="duo-face duo-face--right">
          <DuoDevice inner sw={INNER.sw} sh={INNER.sh} rotated={false} hideCamera={hideCamera} duplicate half="right">
            {children}
          </DuoDevice>
        </div>
      </div>
      <div
        className="duo-leaf duo-leaf--left"
        style={{ transform: `rotateY(${state.left}deg)`, transition: `transform ${t}` }}
      >
        <div className="duo-face duo-face--front">
          <DuoDevice inner sw={INNER.sw} sh={INNER.sh} rotated={false} hideCamera={hideCamera} half="left">
            {children}
          </DuoDevice>
        </div>
        <div className="duo-face duo-face--back">
          <DuoDevice inner={false} sw={OUTER.sw} sh={OUTER.sh} rotated={false} hideCamera={hideCamera} duplicate>
            {children}
          </DuoDevice>
        </div>
      </div>
    </div>
  )
}

export interface DuoFrameProps {
  pose?: DuoPose
  landscape?: boolean
  /** Screen width in the displayed orientation */
  width?: number
  /** Screen height in the displayed orientation */
  height?: number
  hideNotch?: boolean
  /** Animate the fold when `pose` changes */
  animated?: boolean
  className: string
  style: React.CSSProperties
  divProps: React.HTMLAttributes<HTMLDivElement>
  children?: React.ReactNode
}

type Fold = { from: DuoPose, to: DuoPose, running: boolean }

export const DuoFrame = React.forwardRef<HTMLDivElement, DuoFrameProps>(function DuoFrame(
  { pose = 'closed', landscape, width, height, hideNotch, animated, className, style, divProps, children },
  ref,
) {
  const inner = pose !== 'closed'
  const base = inner ? INNER : OUTER
  // Closed is naturally portrait, open naturally landscape; half-open is the book pose
  const rotated = pose === 'closed' ? landscape === true : pose === 'open' ? landscape === false : false
  const sw = (rotated ? height : width) ?? base.sw
  const sh = (rotated ? width : height) ?? base.sh
  const dw = sw + base.bx
  const dh = sh + base.by

  const book = React.useMemo(() => (pose === 'half-open' ? bookLayout(dw, dh) : null), [pose, dw, dh])

  // Fold animation: only between natural orientations at the default size
  const [fold, setFold] = React.useState<Fold | null>(null)
  const prev = React.useRef({ pose, rotated })
  React.useLayoutEffect(() => {
    const from = prev.current
    prev.current = { pose, rotated }
    if (from.pose === pose) return
    const canAnimate = animated && !from.rotated && !rotated && width === undefined && height === undefined
      && !(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
    setFold(canAnimate ? { from: from.pose, to: pose, running: false } : null)
  }, [pose, rotated, animated, width, height])

  React.useEffect(() => {
    if (!fold) return
    if (!fold.running) {
      // Paint the start state, then switch to the end state so the transitions run
      let second = 0
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setFold((f) => f && { ...f, running: true }))
      })
      return () => { cancelAnimationFrame(first); cancelAnimationFrame(second) }
    }
    const done = setTimeout(() => setFold(null), FOLD_MS + 60)
    return () => clearTimeout(done)
  }, [fold])

  if (fold) {
    const state = foldState(fold.running ? fold.to : fold.from)
    const t = `${FOLD_MS}ms ${FOLD_EASE}`
    return (
      <div
        ref={ref}
        className={`${className} duo-${pose} duo-folding`}
        {...divProps}
        style={{
          width: state.width,
          height: state.height,
          ...style,
          transition: [style.transition, `width ${t}`, `height ${t}`].filter(Boolean).join(', '),
        }}
      >
        <DuoFoldScene state={state} flat={(fold.running ? fold.to : fold.from) === 'open'} hideCamera={hideNotch}>
          {children}
        </DuoFoldScene>
      </div>
    )
  }

  const rootSize = book
    ? { width: book.width, height: book.height }
    : rotated ? { width: dh, height: dw } : { width: dw, height: dh }

  return (
    <div
      ref={ref}
      className={`${className} duo-${pose}`}
      {...divProps}
      style={{ ...rootSize, ...style }}
    >
      {book ? (
        <>
          <div className="duo-half duo-half--left" style={{ width: dw, height: dh, transform: book.left }}>
            <DuoDevice inner sw={sw} sh={sh} rotated={false} hideCamera={hideNotch} half="left">{children}</DuoDevice>
          </div>
          <div className="duo-half duo-half--right" style={{ width: dw, height: dh, transform: book.right }}>
            <DuoDevice inner sw={sw} sh={sh} rotated={false} hideCamera={hideNotch} duplicate half="right">{children}</DuoDevice>
          </div>
        </>
      ) : (
        <DuoDevice inner={inner} sw={sw} sh={sh} rotated={rotated} hideCamera={hideNotch}>{children}</DuoDevice>
      )}
    </div>
  )
})
