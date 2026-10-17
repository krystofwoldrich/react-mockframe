import { createRef } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MockFrame, CustomMockFrame } from '../MockFrame'
import type { MockFrameProps } from '../MockFrame'

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
