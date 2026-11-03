import { createRef } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MockFrame, CustomMockFrame, DeviceOptions } from '../MockFrame'
import type { MockFrameProps } from '../MockFrame'
import {
  DUO_BANDS, DUO_SCREEN_SHAPES, DUO_SPINE_ENDS, FRAME_BANDS, cornersShapeStyle, POSE_FRAME_BANDS, POSE_SCREEN_SHAPES, SCREEN_SHAPES, bandCornerPaths, bodyCornerPaths,
  paddingSides, screenMaskSvg, screenShapeStyle, turnShape,
} from '../ScreenShape'

describe('MockFrame className/style merging', () => {
  it('keeps device classes when a custom className is provided', () => {
    const { container } = render(
      <MockFrame device="iPhone 17" color="black" className="custom" />
    )
    const el = container.firstChild as HTMLElement
    expect(el).toHaveClass('mockframe', 'iphone17', 'black', 'custom')
  })

  it('applies user inline style alongside computed dimensions', () => {
    const { container } = render(
      <MockFrame device="iPhone 17" color="black" width={400} style={{ opacity: 0.5 }} />
    )
    const el = container.firstChild as HTMLElement
    expect(el).toHaveStyle({ opacity: '0.5' })
    expect(el.style.width).toBe('400px')
  })
})

describe('MockFrame structure', () => {
  it('renders exactly one bottom-bar element', () => {
    const { container } = render(<MockFrame device="iPhone 8" color="black" />)
    expect(container.querySelectorAll('.bottom-bar')).toHaveLength(1)
  })
})

describe('CustomMockFrame className merging', () => {
  it('merges frameClassName and a passed className', () => {
    const { container } = render(
      <CustomMockFrame width={100} height={100} frameClassName="frame" className="extra" />
    )
    const el = container.firstChild as HTMLElement
    expect(el).toHaveClass('frame', 'extra')
  })
})

describe('refs', () => {
  it('forwards a ref to the MockFrame root element', () => {
    const ref = createRef<HTMLDivElement>()
    render(<MockFrame ref={ref} device="iPhone 18 Pro" color="glacier" />)
    expect(ref.current).toHaveClass('mockframe', 'iphone18pro', 'glacier')
  })

  it('forwards a ref to the CustomMockFrame root element', () => {
    const ref = createRef<HTMLDivElement>()
    render(<CustomMockFrame ref={ref} width={100} height={100} frameClassName="frame" />)
    expect(ref.current).toHaveClass('frame')
  })
})

describe('MockFrame runtime guards', () => {
  it('renders nothing and logs for an unknown device instead of throwing', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const props = { device: 'iPhone 99' } as unknown as MockFrameProps
    const { container } = render(<MockFrame {...props} />)
    expect(container.firstChild).toBeNull()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('unknown device "iPhone 99"'))
    error.mockRestore()
  })

  it('does not add the landscape class to devices without landscape support', () => {
    const props = { device: 'MacBook Pro', color: 'silver', landscape: true } as unknown as MockFrameProps
    const { container } = render(<MockFrame {...props} />)
    expect(container.firstChild).not.toHaveClass('landscape')
  })

  it('adds the landscape class and swaps dimensions when supported', () => {
    const { container } = render(
      <MockFrame device="iPhone 17" color="black" landscape width={402} height={874} />
    )
    const el = container.firstChild as HTMLElement
    expect(el).toHaveClass('landscape')
    expect(el.style.width).toBe('874px')
    expect(el.style.height).toBe('402px')
  })
})

describe('MockFrame anatomy', () => {
  it('renders the Dynamic Island unless hideNotch is set', () => {
    const { container, rerender } = render(<MockFrame device="iPhone 18 Pro" color="black" />)
    expect(container.querySelector('.dynamic-island .camera')).not.toBeNull()
    rerender(<MockFrame device="iPhone 18 Pro" color="black" hideNotch />)
    expect(container.querySelector('.dynamic-island')).toBeNull()
  })
})

describe('iPhone Duo', () => {
  it('defaults to the closed pose at the outer display size', () => {
    const { container } = render(<MockFrame device="iPhone Duo" color="night-sky" />)
    const root = container.firstChild as HTMLElement
    expect(root).toHaveClass('mockframe', 'iphone-duo', 'night-sky', 'duo-closed')
    expect(container.querySelector('.duo-outer .screen')).toHaveStyle({ width: '466px', height: '678px' })
  })

  it('opens to the inner display in its natural landscape orientation', () => {
    const { container } = render(<MockFrame device="iPhone Duo" color="night-sky" pose="open" />)
    expect(container.querySelector('.duo-inner .screen')).toHaveStyle({ width: '951px', height: '669px' })
    expect((container.querySelector('.duo-device') as HTMLElement).style.transform).toBe('')
  })

  it('turns the open device and counter-rotates the content for portrait', () => {
    const { container } = render(
      <MockFrame device="iPhone Duo" color="night-sky" pose="open" landscape={false} />
    )
    expect((container.querySelector('.duo-device') as HTMLElement).style.transform).toContain('rotate(-90deg)')
    expect((container.querySelector('.duo-content') as HTMLElement).style.transform).toContain('rotate(90deg)')
  })

  it('draws the half-open pose as two halves with an inert, hidden copy', () => {
    const { container, getAllByText } = render(
      <MockFrame device="iPhone Duo" color="star-white" pose="half-open"><p>hello</p></MockFrame>
    )
    expect(container.querySelectorAll('.duo-half')).toHaveLength(2)
    expect(getAllByText('hello')).toHaveLength(2)
    const copy = container.querySelector('.duo-half--right .duo-content')!
    expect(copy).toHaveAttribute('aria-hidden', 'true')
    expect(copy).toHaveAttribute('inert')
    expect(container.querySelector('.duo-half--left .duo-content')).not.toHaveAttribute('inert')
    expect((container.querySelector('.duo-half--left') as HTMLElement).style.transform).toMatch(/^matrix3d\(/)
  })

  it('does not leak the pose prop to the DOM', () => {
    const { container } = render(<MockFrame device="iPhone Duo" color="night-sky" pose="open" />)
    expect(container.firstChild).not.toHaveAttribute('pose')
  })
})

describe('superellipse screen shapes', () => {
  it('replaces the circular screen radius on frames measured from Apple bezels', () => {
    for (const props of [
      { device: 'iPhone X' },
      { device: 'iPhone 17', color: 'black' },
      { device: 'iPhone 18 Pro', color: 'silver' },
      { device: 'iPad Pro', color: 'silver' },
    ] as MockFrameProps[]) {
      const { container, unmount } = render(<MockFrame {...props} />)
      expect((container.querySelector('.screen') as HTMLElement).style.borderRadius).toBe('0px')
      unmount()
    }
  })

  it('leaves frames without a measured shape unchanged', () => {
    const { container } = render(<MockFrame device="iPhone 8" color="black" />)
    expect(container.querySelector('.screen')).not.toHaveAttribute('style')
  })

  it('shapes both iPhone Duo displays', () => {
    const { container, rerender } = render(<MockFrame device="iPhone Duo" color="night-sky" />)
    expect((container.querySelector('.duo-outer .screen') as HTMLElement).style.borderRadius).toBe('0px')
    rerender(<MockFrame device="iPhone Duo" color="night-sky" pose="open" />)
    expect((container.querySelector('.duo-inner .screen') as HTMLElement).style.borderRadius).toBe('0px')
  })

  it('builds a stretching SVG mask with one nub per corner', () => {
    const style = screenShapeStyle(SCREEN_SHAPES['iPhone 17']!)
    expect(style.maskImage).toMatch(/^url\("data:image\/svg\+xml,/)
    expect(style.WebkitMaskImage).toBe(style.maskImage)
    expect(style.maskSize).toBe('100% 100%')
    const svg = screenMaskSvg(DUO_SCREEN_SHAPES.outer)
    expect(svg.match(/<path /g)).toHaveLength(4)
    // The Duo outer display has small corners on the hinge side and large ones on the other
    expect(svg).toContain('M 0.00,9.57')
    expect(svg).toContain('M 0.00,70.55')
  })
})

describe('superellipse body and band', () => {
  it('draws the body and band as masked layers on the band frames', () => {
    const { container } = render(<MockFrame device="iPhone 17" color="black" />)
    const frame = container.firstElementChild as HTMLElement
    expect(frame).toHaveClass('superellipse-body')
    const body = frame.querySelector(':scope > .body') as HTMLElement
    // The body color, three glass glow steps and one layer per band ring
    const layers = [...body.children] as HTMLElement[]
    expect(layers).toHaveLength(1 + 3 + 12)
    // The rings keep their color variables, widest first, each with its own mask
    expect(layers.slice(4).map((l) => l.style.background)).toEqual(
      Array.from({ length: 12 }, (_, i) => `var(--mf-b${12 - i})`))
    expect(layers[15]!.style.maskImage).toMatch(/^url\("data:image\/svg\+xml,/)
    // The body outline is a self-contained CSS mask
    expect(body.style.maskImage).toMatch(/^url\("data:image\/svg\+xml,/)
  })

  it('keeps url( out of the mask data, so image exporters do not rewrite it', () => {
    for (const props of [
      { device: 'iPhone 18 Pro', color: 'silver' },
      { device: 'iPad Pro', color: 'silver' },
      { device: 'iPhone Duo', color: 'night-sky', pose: 'half-open' },
    ] as MockFrameProps[]) {
      const { container, unmount } = render(<MockFrame {...props} />)
      for (const el of container.querySelectorAll<HTMLElement>('.body, .body > *, .screen, .duo-wall, .duo-shade, .duo-spine')) {
        const mask = el.style.maskImage
        if (mask) expect(mask.slice(4, -1)).not.toMatch(/url\(/)
      }
      expect(container.querySelector('.body svg, .body mask, .body filter')).toBeNull()
      unmount()
    }
  })

  it('leaves the CSS body on frames without a band', () => {
    for (const props of [{ device: 'iPhone X' }, { device: 'iPhone 8', color: 'black' }] as MockFrameProps[]) {
      const { container, unmount } = render(<MockFrame {...props} />)
      expect(container.firstElementChild).not.toHaveClass('superellipse-body')
      expect(container.querySelector('.body')).toBeNull()
      unmount()
    }
  })

  it('draws the iPad Pro body with its four rings and glass glow', () => {
    const { container } = render(<MockFrame device="iPad Pro" color="silver" />)
    expect(container.firstElementChild).toHaveClass('superellipse-body')
    expect(container.querySelector('.body')!.children).toHaveLength(1 + 3 + 4)
  })

  it('draws both iPhone Duo bodies, keeping the small hinge-side corners of the closed panel', () => {
    const { container, rerender } = render(<MockFrame device="iPhone Duo" color="night-sky" />)
    const panel = container.querySelector('.duo-panel')!
    expect(panel).toHaveClass('superellipse-body')
    expect(panel.querySelector(':scope > .body')!.children).toHaveLength(1 + 24)
    // The hinge side keeps a 4px circle: the body corner starts 4px from the corner
    const outline = bodyCornerPaths(DUO_SCREEN_SHAPES.outer, paddingSides(DUO_BANDS.outer.padding), 0, DUO_BANDS.outer.circles)
    expect(outline.topLeft).toMatch(/^M 0\.00,4\.00 /)
    rerender(<MockFrame device="iPhone Duo" color="night-sky" pose="open" />)
    const frame = container.querySelector('.duo-frame')!
    expect(frame).toHaveClass('superellipse-body')
    expect(frame.querySelector(':scope > .body')!.children).toHaveLength(1 + 18)
  })

  it('gives the closed iPhone Duo\'s spine Apple\'s ends and a grain that exporters do not rewrite', () => {
    const { container } = render(<MockFrame device="iPhone Duo" color="star-white" />)
    const spine = container.querySelector('.duo-spine') as HTMLElement
    expect(spine.style.borderRadius).toBe('0px')
    expect(spine.style.maskImage).toBe(cornersShapeStyle(DUO_SPINE_ENDS).maskImage)
    const css = readFileSync(resolve(__dirname, '../../css/mockframe.css'), 'utf8')
    const grain = css.match(/--duo-grain: url\("(data:[^"]+)"\);/)![1]!
    expect(grain).not.toMatch(/[()]/)
    expect(decodeURIComponent(grain)).toContain("filter='url(#g)'")
  })

  it('cuts the half-open side walls and shade to the open body and screen', () => {
    const { container } = render(<MockFrame device="iPhone Duo" color="night-sky" pose="half-open" />)
    for (const el of container.querySelectorAll<HTMLElement>('.duo-wall, .duo-shade')) {
      expect(el.style.borderRadius).toBe('0px')
      expect(el.style.maskImage).toMatch(/^url\("data:image\/svg\+xml,/)
    }
  })

  it('starts the body corner where the screen corner starts, one glass border further out', () => {
    const sides = paddingSides([14.33, 14.67])
    // The top-left body corner of the iPhone 17 begins on the left edge, 14.33 + 77.43 px down
    expect(bodyCornerPaths(SCREEN_SHAPES['iPhone 17']!, sides, 0).topLeft).toMatch(/^M 0\.00,91\.76 /)
    // A ring 2 px in starts on the line x = 2
    expect(bodyCornerPaths(SCREEN_SHAPES['iPhone 17']!, sides, 2).topLeft).toMatch(/^M 2\.00,91\.76 /)
    // A circular corner smaller than the depth becomes square
    expect(bodyCornerPaths(SCREEN_SHAPES['iPhone 17']!, sides, 6, { topLeft: 4 }).topLeft).toMatch(/^M 6\.00,6\.00 /)
  })

  it('expands the CSS padding shorthand and turns it for landscape', () => {
    expect(paddingSides([22.33])).toEqual({ top: 22.33, right: 22.33, bottom: 22.33, left: 22.33 })
    expect(paddingSides([14.33, 14.67])).toEqual({ top: 14.33, right: 14.67, bottom: 14.33, left: 14.67 })
    expect(paddingSides([16, 16, 16, 14], true)).toEqual({ top: 16, right: 16, bottom: 14, left: 16 })
  })

  it('matches the padding and band rings in mockframe.css', () => {
    const css = readFileSync(resolve(__dirname, '../../css/mockframe.css'), 'utf8')
    const ringsOf = (block: string, color: string) =>
      [...block.matchAll(new RegExp(`inset 0 0 0 ([\\d.]+)px var\\(${color}\\d+\\)`, 'g'))].map((m) => Number(m[1]))
    const paddingOf = (block: string) => block.match(/padding: ((?:[\d.]+px ?){1,4});/)![1]!.split(' ').map(parseFloat)
    for (const [name, band] of Object.entries(FRAME_BANDS)) {
      const cls = DeviceOptions[name as keyof typeof DeviceOptions].device
      // The device's own block (a shared selector such as `&.pixel9profold, &.pixel10profold` is skipped)
      const start = css.search(new RegExp(`\\n\\t&\\.${cls} \\{`))
      const block = css.slice(start, css.indexOf('.screen', start))
      expect(paddingOf(block), name).toEqual(band!.padding)
      expect(ringsOf(block, band!.ringColor ?? '--mf-b'), name).toEqual(band!.rings)
      const glass = block.match(/inset 0 0 ([\d.]+)px ([\d.]+)px var\(--mf-glass\)/)
      expect(glass && { spread: Number(glass[2]), blur: Number(glass[1]) }, name).toEqual(band!.glass ?? null)
      // The hinge strips of a closed Fold: inset shadows from the left edge; then the glass edge after the band
      const hinge = [...block.matchAll(/inset ([\d.]+)px 0 0 0 var\(--mf-h\d+\)/g)].map((m) => Number(m[1]))
      expect(hinge, name).toEqual(band!.hinge?.rings ?? [])
      const bandWidth = band!.rings[band!.rings.length - 1]!
      expect(ringsOf(block, '--mf-g'), name).toEqual((band!.hinge?.edge.rings ?? []).map((d) => Math.round((bandWidth + d) * 100) / 100))
      // The open pose of a Fold, in `&.fold-open` inside the device's block
      for (const [pose, poseBand] of Object.entries(POSE_FRAME_BANDS[name as keyof typeof POSE_FRAME_BANDS] ?? {})) {
        const poseStart = css.indexOf(`&.fold-${pose} {`, start)
        const poseBlock = css.slice(poseStart, css.indexOf('.screen', poseStart))
        expect(paddingOf(poseBlock), `${name} ${pose}`).toEqual(poseBand.padding)
        expect(ringsOf(poseBlock, poseBand.ringColor!), `${name} ${pose}`).toEqual(poseBand.rings)
      }
    }
    const duo = css.slice(css.indexOf('&.iphone-duo {'))
    const blockAt = (selector: string) => duo.slice(duo.indexOf(selector), duo.indexOf('}', duo.indexOf(selector)))
    expect(ringsOf(blockAt('.duo-panel {'), '--duo-k')).toEqual(DUO_BANDS.outer.rings)
    expect(ringsOf(blockAt('.duo-frame {'), '--duo-o')).toEqual(DUO_BANDS.inner.rings)
  })
})

describe('iPhone 17 Pro Max, 18 Pro Max, Air and 12 mini', () => {
  it('render their device class, a Dynamic Island and a superellipse screen', () => {
    for (const props of [
      { device: 'iPhone 17 Pro Max', color: 'cosmic-orange', cls: 'iphone17promax' },
      { device: 'iPhone 18 Pro Max', color: 'glacier', cls: 'iphone18promax' },
      { device: 'iPhone Air', color: 'sky-blue', cls: 'iphone-air' },
    ]) {
      const { cls, ...frameProps } = props
      const { container, unmount } = render(<MockFrame {...(frameProps as MockFrameProps)} />)
      expect(container.firstChild).toHaveClass('mockframe', cls, props.color)
      expect(container.querySelector('.dynamic-island .camera')).not.toBeNull()
      expect(container.querySelector('.action')).not.toBeNull()
      expect((container.querySelector('.screen') as HTMLElement).style.borderRadius).toBe('0px')
      unmount()
    }
  })

  it('renders the iPhone 12 mini notch with speaker and camera at the 360x780 screen size', () => {
    const { container, rerender } = render(<MockFrame device="iPhone 12 mini" color="white" />)
    const root = container.firstChild as HTMLElement
    expect(root).toHaveClass('mockframe', 'iphone12mini', 'white')
    expect(DeviceOptions['iPhone 12 mini']).toMatchObject({ width: 360, height: 780 })
    expect(container.querySelector('.notch .speaker')).not.toBeNull()
    expect(container.querySelector('.notch .camera')).not.toBeNull()
    rerender(<MockFrame device="iPhone 12 mini" color="white" hideNotch />)
    expect(container.querySelector('.notch')).toBeNull()
  })
})

describe('Pixel 9 Pro, 10 Pro, 9 Pro Fold and 10 Pro Fold', () => {
  it('render the Pro phones at the 427x952 viewport with a punch-hole camera', () => {
    for (const [device, color, cls] of [
      ['Pixel 9 Pro', 'rose-quartz', 'pixel9pro'],
      ['Pixel 10 Pro', 'moonstone', 'pixel10pro'],
    ] as const) {
      const { container, unmount } = render(<MockFrame {...({ device, color } as MockFrameProps)} />)
      expect(container.firstChild).toHaveClass('mockframe', cls, color)
      expect(DeviceOptions[device]).toMatchObject({ width: 427, height: 952 })
      expect(container.querySelector('.camera')).not.toBeNull()
      unmount()
    }
  })

  it('draws the Folds closed by default and open with pose="open"', () => {
    const { container, rerender } = render(<MockFrame device="Pixel 10 Pro Fold" color="jade" />)
    const root = container.firstChild as HTMLElement
    expect(root).toHaveClass('mockframe', 'pixel10profold', 'jade', 'fold-closed')
    // Closed: the body (its hinge face color), the band rings, the spine (its stripes bent around its ends)
    // and the glass with its edge rings
    const closed = FRAME_BANDS['Pixel 10 Pro Fold']!
    const spineRings = closed.hinge!.rings.filter((d) => d <= closed.hinge!.spine!.width).length
    const body = root.querySelector(':scope > .body')!
    expect(body.children).toHaveLength(1 + closed.rings.length + 1 + 1)
    expect(body.children[body.children.length - 2]!.children).toHaveLength(1 + spineRings)
    expect(body.lastElementChild!.children).toHaveLength(1 + closed.hinge!.edge.rings.length)
    expect(container.querySelectorAll('.hinge')).toHaveLength(2)
    rerender(<MockFrame device="Pixel 10 Pro Fold" color="jade" pose="open" landscape />)
    expect(root).toHaveClass('fold-open', 'landscape')
    expect(root).not.toHaveClass('fold-closed')
    expect(root).not.toHaveAttribute('pose')
    // Open: the inner display's body and band, without hinge strips, and the hinge plates in the two gaps
    const open = POSE_FRAME_BANDS['Pixel 10 Pro Fold']!.open!
    expect(root.querySelector(':scope > .body')!.children).toHaveLength(1 + open.rings.length + 2)
  })

  it('cuts Google\'s hinge gaps into the open Folds\' top and bottom edges', () => {
    const outline = (props: MockFrameProps) => {
      const { container, unmount } = render(<MockFrame {...props} />)
      const mask = decodeURIComponent((container.querySelector('.mockframe > .body') as HTMLElement).style.maskImage)
      unmount()
      return mask
    }
    for (const device of ['Pixel 9 Pro Fold', 'Pixel 10 Pro Fold'] as const) {
      const open = outline({ device, color: device === 'Pixel 9 Pro Fold' ? 'obsidian' : 'jade', pose: 'open' } as MockFrameProps)
      // Placed at the middle of the top edge and, mirrored, of the bottom edge
      expect(open, device).toContain("<svg x='50%' y='0' overflow='visible'>")
      expect(open, device).toContain("<svg x='50%' y='100%' overflow='visible'>")
      const turned = outline({ device, color: device === 'Pixel 9 Pro Fold' ? 'obsidian' : 'jade', pose: 'open', landscape: true } as MockFrameProps)
      expect(turned, device).toContain("<svg x='0' y='50%' overflow='visible'>")
      // The closed device has no gap
      expect(outline({ device, color: device === 'Pixel 9 Pro Fold' ? 'obsidian' : 'jade' } as MockFrameProps), device).not.toContain("x='50%'")
    }
  })

  it('draws straight hinge strips with the hinge-straight class', () => {
    const { container } = render(<MockFrame device="Pixel 9 Pro Fold" color="obsidian" className="hinge-straight" />)
    const band = FRAME_BANDS['Pixel 9 Pro Fold']!
    const body = container.querySelector('.mockframe > .body')!
    expect(body.children).toHaveLength(1 + band.rings.length + band.hinge!.rings.length + 1)
    // Bent (default): no strips, and no spine on the 9 Pro Fold
    const bent = render(<MockFrame device="Pixel 9 Pro Fold" color="obsidian" />).container.querySelector('.mockframe > .body')!
    expect(bent.children).toHaveLength(1 + band.rings.length + 1)
  })

  it('falls back to the closed pose for a pose the Fold does not have', () => {
    const { container } = render(
      <MockFrame {...({ device: 'Pixel 9 Pro Fold', color: 'obsidian', pose: 'half-open' } as unknown as MockFrameProps)} />
    )
    expect(container.firstChild).toHaveClass('fold-closed')
  })

  it('does not add a pose class to devices without poses', () => {
    const { container } = render(<MockFrame device="Pixel 10" color="indigo" />)
    expect((container.firstChild as HTMLElement).className).not.toMatch(/fold-/)
  })
})

describe('Pixel superellipse frames (measured on Google\'s emulator skins)', () => {
  const pixels = [
    { device: 'Pixel 10', color: 'indigo' },
    { device: 'Pixel 10 Pro', color: 'moonstone' },
    { device: 'Pixel 9 Pro', color: 'hazel' },
    { device: 'Pixel 9 Pro Fold', color: 'porcelain' },
    { device: 'Pixel 10 Pro Fold', color: 'moonstone' },
  ] as MockFrameProps[]

  it('gives every Pixel a superellipse screen, body and band', () => {
    for (const props of pixels) {
      const { container, unmount } = render(<MockFrame {...props} />)
      const root = container.firstElementChild as HTMLElement
      expect(root, props.device).toHaveClass('superellipse-body')
      expect((container.querySelector('.screen') as HTMLElement).style.borderRadius, props.device).toBe('0px')
      expect((root.querySelector(':scope > .body') as HTMLElement).style.maskImage).toMatch(/^url\("data:image\/svg\+xml,/)
      // The body has its own corners: flatter superellipses than the screen
      expect(FRAME_BANDS[props.device]!.body, props.device).toBeDefined()
      unmount()
    }
  })

  it('uses the inner display\'s screen when a Fold is open', () => {
    const { container, rerender } = render(<MockFrame device="Pixel 9 Pro Fold" color="obsidian" />)
    const screen = () => (container.querySelector('.screen') as HTMLElement).style.maskImage
    expect(screen()).toBe(screenShapeStyle(SCREEN_SHAPES['Pixel 9 Pro Fold']!).maskImage)
    rerender(<MockFrame device="Pixel 9 Pro Fold" color="obsidian" pose="open" />)
    expect(screen()).toBe(screenShapeStyle(POSE_SCREEN_SHAPES['Pixel 9 Pro Fold']!.open!).maskImage)
  })

  it('turns corners that differ for landscape', () => {
    // The closed Pixel 10 Pro Fold has a larger top-right screen corner; turned counter-clockwise it is the top-left one
    const shape = SCREEN_SHAPES['Pixel 10 Pro Fold']!
    expect(turnShape(shape).topLeft).toBe(shape.topRight)
    const { container } = render(<MockFrame device="Pixel 10 Pro Fold" color="jade" landscape />)
    expect((container.querySelector('.screen') as HTMLElement).style.maskImage).toBe(screenShapeStyle(turnShape(shape)).maskImage)
    // The hinge is at the bottom: the spine capsule runs along it
    const spine = FRAME_BANDS['Pixel 10 Pro Fold']!.hinge!.spine!
    const capsule = [...container.querySelectorAll<HTMLElement>('.body > div')].filter((el) => el.style.height === `${spine.width}px`)
    expect(capsule).toHaveLength(1)
    expect(capsule[0]!.style.bottom).toBe('0px')
    // With straight strips, they run along the bottom too (the face layer covers the bottom half)
    const straight = render(<MockFrame device="Pixel 10 Pro Fold" color="jade" landscape className="hinge-straight" />).container
    const strips = [...straight.querySelectorAll<HTMLElement>('.body > div')]
      .filter((el) => el.style.bottom === '0px' && el.style.height && el.style.height !== '50%')
    expect(strips).toHaveLength(FRAME_BANDS['Pixel 10 Pro Fold']!.hinge!.rings.length)
  })

  it('steps the closed Pixel 10 Pro Fold outline out to its spine on the hinge side', () => {
    const band = FRAME_BANDS['Pixel 10 Pro Fold']!
    const spine = band.hinge!.spine!
    const outline = bandCornerPaths(SCREEN_SHAPES['Pixel 10 Pro Fold']!, band, 0)
    // The hinge-side outline starts on the left edge where the spine's rounded end begins
    expect(outline.topLeft).toMatch(new RegExp(`^M 0\\.00,${(spine.inset + spine.end.y).toFixed(2)} `))
    expect(outline.bottomLeft).toBe(outline.topLeft)
    // The other side follows the body corner only
    expect(outline.topRight).toMatch(new RegExp(`^M 0\\.00,${band.body!.topRight.size.toFixed(2)} `))
    // In landscape the hinge is at the bottom, so its outline is the same curve turned
    const turned = bandCornerPaths(SCREEN_SHAPES['Pixel 10 Pro Fold']!, band, 0, true)
    expect(turned.bottomLeft).not.toBe(outline.topLeft)
    expect(turned.topLeft).toMatch(new RegExp(`^M 0\\.00,${band.body!.topRight.size.toFixed(2)} `))
  })

  it('draws the closed Pixel 9 Pro Fold at its 1080x2424 outer display, 412x924', () => {
    expect(DeviceOptions['Pixel 9 Pro Fold']).toMatchObject({ width: 412, height: 924 })
  })
})
