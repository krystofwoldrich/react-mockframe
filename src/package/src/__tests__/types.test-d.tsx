import { createRef } from 'react'
import { expectTypeOf } from 'vitest'
import { MockFrame } from '../MockFrame'
import type { DeviceColor, DevicePose } from '../DeviceOptions'

/* ---- DevicePose extraction ---- */
expectTypeOf<DevicePose<'iPhone Duo'>>().toEqualTypeOf<'closed' | 'half-open' | 'open'>()
expectTypeOf<DevicePose<'iPhone 17'>>().toEqualTypeOf<never>()

/* ---- DeviceColor extraction ---- */
expectTypeOf<DeviceColor<'iPhone 8'>>().toEqualTypeOf<'black' | 'silver' | 'gold'>()
expectTypeOf<DeviceColor<'iPhone X'>>().toEqualTypeOf<never>()
expectTypeOf<DeviceColor<'iPhone 17'>>().toEqualTypeOf<
  'black' | 'white' | 'mist-blue' | 'sage' | 'lavender' | 'cosmic-orange' | 'deep-blue'
>()
expectTypeOf<DeviceColor<'iPhone 18 Pro'>>().toEqualTypeOf<
  'black' | 'silver' | 'glacier' | 'burgundy' | 'gold' | 'natural-titanium'
>()
expectTypeOf<DeviceColor<'iPhone 17 Pro Max'>>().toEqualTypeOf<'silver' | 'cosmic-orange' | 'deep-blue'>()
expectTypeOf<DeviceColor<'iPhone 18 Pro Max'>>().toEqualTypeOf<'black' | 'silver' | 'glacier' | 'burgundy'>()
expectTypeOf<DeviceColor<'iPhone Air'>>().toEqualTypeOf<'space-black' | 'cloud-white' | 'light-gold' | 'sky-blue'>()
expectTypeOf<DeviceColor<'iPhone 12 mini'>>().toEqualTypeOf<'white'>()

/* ---- Valid usages (must compile) ----
 * Written as JSX because object-literal assignment is too lenient against the
 * props union (excess-property checks pass if the key exists on ANY member).
 * JSX attribute checking is what users actually hit. */
export const v1 = <MockFrame device="iPhone X" />
export const v2 = <MockFrame device="iPhone X" landscape />
export const v3 = <MockFrame device="iPhone 17" color="lavender" />
export const v4 = <MockFrame device="MacBook Pro 2020" />
export const v5 = (
  <MockFrame device="iPhone 8" color="gold" className="x" style={{ opacity: 1 }} />
)
export const v6 = <MockFrame device="iPhone 18 Pro" color="natural-titanium" landscape />
export const v7 = <MockFrame device="iPhone 17" color="sage" ref={createRef<HTMLDivElement>()} />
export const v8 = <MockFrame device="iPhone Duo" color="night-sky" pose="half-open" />
export const v9 = <MockFrame device="iPhone Duo" color="star-white" pose="open" landscape={false} />
export const v10 = <MockFrame device="iPhone Duo" color="night-sky" />
export const v11 = <MockFrame device="iPhone 18 Pro Max" color="glacier" landscape />
export const v12 = <MockFrame device="iPhone Air" color="sky-blue" />
export const v13 = <MockFrame device="iPhone 12 mini" color="white" hideNotch />

/* ---- Invalid usages: each MUST error, or the @ts-expect-error fails the build ---- */
// @ts-expect-error iPhone X has no color variants
export const x1 = <MockFrame device="iPhone X" color="black" />
// @ts-expect-error 'pink' is not a valid iPhone 17 color
export const x2 = <MockFrame device="iPhone 17" color="pink" />
// @ts-expect-error color is required for iPhone 17
export const x3 = <MockFrame device="iPhone 17" />
// @ts-expect-error MacBook Pro 2020 does not support landscape
export const x4 = <MockFrame device="MacBook Pro 2020" landscape />
// @ts-expect-error MacBook Pro 2020 has no color variants
export const x5 = <MockFrame device="MacBook Pro 2020" color="silver" />
// @ts-expect-error only foldables take a pose
export const x7 = <MockFrame device="iPhone 17" color="black" pose="open" />
// @ts-expect-error 'flat' is not an iPhone Duo pose
export const x8 = <MockFrame device="iPhone Duo" color="night-sky" pose="flat" />
// @ts-expect-error 'cosmic-orange' is an iPhone 17 colour, not an iPhone 18 Pro one
export const x6 = <MockFrame device="iPhone 18 Pro" color="cosmic-orange" />
// @ts-expect-error the iPhone 12 mini frame has no landscape variant
export const x9 = <MockFrame device="iPhone 12 mini" color="white" landscape />
