import { createRef } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MockFrame, CustomMockFrame, DeviceOptions } from '../MockFrame'
import type { MockFrameProps } from '../MockFrame'
import {
  DUO_BANDS, DUO_SCREEN_SHAPES, FRAME_BANDS, SCREEN_SHAPES, bodyCornerPaths, paddingSides, screenMaskSvg, screenShapeStyle,
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
  it('draws the body and band as an SVG on the band frames', () => {
    const { container } = render(<MockFrame device="iPhone 17" color="black" />)
    const frame = container.firstElementChild as HTMLElement
    expect(frame).toHaveClass('superellipse-body')
    const svg = frame.querySelector(':scope > svg.body')!
    // One layer per band ring plus the glass glow, each with four corners
    expect(svg.querySelectorAll('g[mask] > g')).toHaveLength(13)
    expect(svg.querySelectorAll('g[mask] path')).toHaveLength(13 * 4)
    // The mask ids are unique per frame
    const { container: second } = render(<MockFrame device="iPhone 17" color="black" />)
    expect(second.querySelector('mask')!.id).not.toBe(svg.querySelector('mask')!.id)
  })

  it('leaves the CSS body on frames without a band', () => {
    for (const props of [{ device: 'iPhone X' }, { device: 'iPhone 8', color: 'black' }] as MockFrameProps[]) {
      const { container, unmount } = render(<MockFrame {...props} />)
      expect(container.firstElementChild).not.toHaveClass('superellipse-body')
      expect(container.querySelector('svg.body')).toBeNull()
      unmount()
    }
  })

  it('draws the iPad Pro body with its four rings and glass glow', () => {
    const { container } = render(<MockFrame device="iPad Pro" color="silver" />)
    expect(container.firstElementChild).toHaveClass('superellipse-body')
    expect(container.querySelectorAll('svg.body g[mask] > g')).toHaveLength(5)
  })

  it('draws both iPhone Duo bodies, keeping the small hinge-side corners of the closed panel', () => {
    const { container, rerender } = render(<MockFrame device="iPhone Duo" color="night-sky" />)
    const panel = container.querySelector('.duo-panel')!
    expect(panel).toHaveClass('superellipse-body')
    expect(panel.querySelectorAll(':scope > svg.body g[mask] > g')).toHaveLength(24)
    // The hinge side keeps a 4px circle: the body corner starts 4px from the corner
    expect(panel.querySelector('mask path')!.getAttribute('d')).toMatch(/^M 0\.00,4\.00 /)
    rerender(<MockFrame device="iPhone Duo" color="night-sky" pose="open" />)
    const frame = container.querySelector('.duo-frame')!
    expect(frame).toHaveClass('superellipse-body')
    expect(frame.querySelectorAll(':scope > svg.body g[mask] > g')).toHaveLength(18)
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
    for (const [name, band] of Object.entries(FRAME_BANDS)) {
      const cls = DeviceOptions[name as keyof typeof DeviceOptions].device
      const start = css.indexOf(`&.${cls} {`)
      const block = css.slice(start, css.indexOf('.screen', start))
      const padding = block.match(/padding: ([\d.]+)px(?: ([\d.]+)px)?;/)!.slice(1).filter(Boolean).map(Number)
      expect(padding, name).toEqual(band!.padding)
      expect(ringsOf(block, '--mf-b'), name).toEqual(band!.rings)
      const glass = block.match(/inset 0 0 ([\d.]+)px ([\d.]+)px var\(--mf-glass\)/)
      expect(glass && { spread: Number(glass[2]), blur: Number(glass[1]) }, name).toEqual(band!.glass ?? null)
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
    expect(container.querySelector('.spine')).not.toBeNull()
    expect(container.querySelectorAll('.hinge')).toHaveLength(2)
    rerender(<MockFrame device="Pixel 10 Pro Fold" color="jade" pose="open" landscape />)
    expect(root).toHaveClass('fold-open', 'landscape')
    expect(root).not.toHaveClass('fold-closed')
    expect(root).not.toHaveAttribute('pose')
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
