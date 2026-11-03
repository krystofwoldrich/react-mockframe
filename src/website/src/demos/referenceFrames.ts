/**
 * Reference frames: device bezel images that you add yourself, to compare with the generated frames.
 *
 * The folder `src/website/reference-frames/` is git-ignored except for its README, so no Apple or
 * Google artwork is committed. Add files with these names (see the README in that folder):
 *
 * - `<device>.png` (or .webp / .jpg): a bezel image with a transparent screen opening, for example
 *   an Apple Design Resources bezel renamed to `iphone-18-pro.png`.
 * - `<device>--<pose>.png`: the same, for one pose of a foldable, e.g. `iphone-duo--open.png`.
 * - `<device>/` with `back.webp`, `mask.webp` and `layout`: an Android Studio emulator skin, copied
 *   unchanged. Underscores count as dashes, so `pixel_10_pro/` works. Foldables have one folder per
 *   pose: `pixel_9_pro_fold/closed/` and `pixel_9_pro_fold/default/` (= open).
 *
 * `<device>` is the device or list entry name in lower case, with dashes for spaces and other
 * characters: 'iPhone 18 Pro' → `iphone-18-pro`, 'Pixel 9 Pro Fold' → `pixel-9-pro-fold`.
 */

// The files, loaded on demand; only the dev server provides them (see vite.config.mts)
import { images, layouts } from 'virtual:reference-frames'

const ROOT = '/reference-frames/'

/** File name stem for a device or list entry name, e.g. 'iPhone 18 Pro' → 'iphone-18-pro' */
export const referenceSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Path below the reference folder, in lower case, with underscores as dashes */
const normalize = (key: string) => key.slice(ROOT.length).toLowerCase().replace(/_/g, '-')
const findKey = (keys: string[], path: string) => keys.find((k) => normalize(k) === path)

const IMAGE_EXTENSIONS = ['png', 'webp', 'jpg', 'jpeg']
/** Android Studio calls the open pose of its foldable skins 'default' */
const SKIN_POSE_DIRS: Record<string, string[]> = { closed: ['closed'], open: ['default', 'open'] }

export type ReferenceSource =
  | { kind: 'image', path: string, url: () => Promise<string> }
  | { kind: 'skin', path: string, back: () => Promise<string>, mask?: () => Promise<string>, layout: () => Promise<string> }

/** The first reference file that matches one of the names (and the pose, for foldables) */
export function findReference(names: string[], pose?: string): ReferenceSource | undefined {
  const imageKeys = Object.keys(images)
  const layoutKeys = Object.keys(layouts)
  for (const name of names) {
    const s = referenceSlug(name)
    for (const stem of pose ? [`${s}--${pose}`, s] : [s]) {
      for (const ext of IMAGE_EXTENSIONS) {
        const key = findKey(imageKeys, `${stem}.${ext}`)
        if (key) return { kind: 'image', path: key.slice(ROOT.length), url: images[key]! }
      }
    }
    const dirs = [...(pose ? (SKIN_POSE_DIRS[pose] ?? [pose]).map((p) => `${s}/${p}`) : []), s]
    for (const dir of dirs) {
      const layoutKey = findKey(layoutKeys, `${dir}/layout`)
      const back = findKey(imageKeys, `${dir}/back.webp`) ?? findKey(imageKeys, `${dir}/back.png`)
      if (!layoutKey || !back) continue
      const mask = findKey(imageKeys, `${dir}/mask.webp`) ?? findKey(imageKeys, `${dir}/mask.png`)
      return {
        kind: 'skin',
        path: `${layoutKey.slice(ROOT.length, -'layout'.length)}`,
        back: images[back]!,
        mask: mask ? images[mask] : undefined,
        layout: layouts[layoutKey]!,
      }
    }
  }
  return undefined
}

/** The file names that `findReference` looks for, for the hint in the sidebar */
export function expectedReferenceNames(name: string, pose?: string) {
  const s = referenceSlug(name)
  const skinPose = pose && (SKIN_POSE_DIRS[pose]?.[0] ?? pose)
  return {
    image: pose ? `${s}--${pose}.png` : `${s}.png`,
    skin: `${s.replace(/-/g, '_')}/${skinPose ? `${skinPose}/` : ''}`,
  }
}

export type Rect = { x: number, y: number, w: number, h: number }

/** A reference drawn into a canvas, with the screen opening in canvas pixels */
export type LoadedReference = { canvas: HTMLCanvasElement, screen: Rect, path: string }

const loadImage = async (url: string) => {
  const img = new Image()
  img.src = url
  await img.decode()
  return img
}

const canvasOf = (w: number, h: number) => {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return canvas
}

/** Display size and position from an Android Studio skin `layout` file */
function parseSkinLayout(text: string): Rect {
  const display = /display\s*\{[^}]*?width\s+(\d+)[^}]*?height\s+(\d+)/.exec(text)
  const part = /name\s+device\s+x\s+(-?\d+)\s+y\s+(-?\d+)/.exec(text)
  if (!display || !part) throw new Error('The layout file has no display size or position')
  return { x: Number(part[1]), y: Number(part[2]), w: Number(display[1]), h: Number(display[2]) }
}

/**
 * The bounding box of the transparent area around the image center (the screen opening).
 * A flood fill, so opaque islands inside the screen (a camera, a notch) do not matter.
 */
function findScreenOpening(canvas: HTMLCanvasElement): Rect {
  const { width: w, height: h } = canvas
  const alpha = canvas.getContext('2d')!.getImageData(0, 0, w, h).data
  const clear = (i: number) => alpha[i * 4 + 3]! < 128
  const start = (h >> 1) * w + (w >> 1)
  if (!clear(start)) throw new Error('The image has no transparent screen opening at its center')
  const seen = new Uint8Array(w * h)
  const queue = new Int32Array(w * h)
  let head = 0
  let tail = 0
  queue[tail++] = start
  seen[start] = 1
  let minX = w, minY = h, maxX = 0, maxY = 0
  while (head < tail) {
    const i = queue[head++]!
    const x = i % w
    const y = (i - x) / w
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
    const visit = (j: number) => {
      if (!seen[j] && clear(j)) {
        seen[j] = 1
        queue[tail++] = j
      }
    }
    if (x > 0) visit(i - 1)
    if (x < w - 1) visit(i + 1)
    if (y > 0) visit(i - w)
    if (y < h - 1) visit(i + w)
  }
  if (minX === 0 || minY === 0 || maxX === w - 1 || maxY === h - 1) {
    throw new Error('The transparent area around the center reaches the image edge, so it is not a screen opening')
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

/** Draw a reference: an image as it is, or a skin as the emulator does (frame, then the mask over the display) */
export async function loadReference(source: ReferenceSource): Promise<LoadedReference> {
  if (source.kind === 'image') {
    const img = await loadImage(await source.url())
    const canvas = canvasOf(img.naturalWidth, img.naturalHeight)
    canvas.getContext('2d')!.drawImage(img, 0, 0)
    return { canvas, screen: findScreenOpening(canvas), path: source.path }
  }
  const screen = parseSkinLayout(await source.layout())
  const back = await loadImage(await source.back())
  const canvas = canvasOf(back.naturalWidth, back.naturalHeight)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(back, 0, 0)
  if (source.mask) ctx.drawImage(await loadImage(await source.mask()), screen.x, screen.y)
  return { canvas, screen, path: source.path }
}

/** The reference turned 90° counter-clockwise, as the frames turn for landscape */
export function rotateReference(ref: LoadedReference): LoadedReference {
  const { width: w, height: h } = ref.canvas
  const canvas = canvasOf(h, w)
  const ctx = canvas.getContext('2d')!
  ctx.translate(0, w)
  ctx.rotate(-Math.PI / 2)
  ctx.drawImage(ref.canvas, 0, 0)
  const { x, y, w: sw, h: sh } = ref.screen
  // A point (px, py) moves to (py, w - px)
  return { canvas, screen: { x: y, y: w - x - sw, w: sh, h: sw }, path: ref.path }
}
