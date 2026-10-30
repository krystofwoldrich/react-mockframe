import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { MockFrame, DeviceNames, DeviceOptions } from 'react-mockframe'
import type { DeviceName, MockFrameProps } from 'react-mockframe'
import { Smartphone, Upload, Download, RotateCcw, Move, ChevronDown, Check, Copy, Trash2 } from 'lucide-react'
import { toPng } from 'html-to-image'
import defaultScreenshot from '../assets/default-screenshot.webp'

/* -----------------------------------------------------------------------------
   Device lists
   ----------------------------------------------------------------------------- */

// Apple and Android logos from the standalone view design (16x16 boxes around the original paths)
const APPLE_PATH = 'M37.6316 431.569C37.4205 432.057 37.1707 432.506 36.8812 432.918C36.4866 433.481 36.1636 433.87 35.9146 434.087C35.5286 434.442 35.1151 434.623 34.6723 434.634C34.3544 434.634 33.971 434.543 33.5247 434.36C33.077 434.177 32.6655 434.087 32.2893 434.087C31.8947 434.087 31.4715 434.177 31.0189 434.36C30.5655 434.543 30.2003 434.639 29.9211 434.648C29.4965 434.666 29.0732 434.48 28.6507 434.087C28.381 433.851 28.0437 433.448 27.6397 432.877C27.2062 432.267 26.8497 431.56 26.5705 430.753C26.2715 429.882 26.1216 429.039 26.1216 428.222C26.1216 427.287 26.3237 426.48 26.7285 425.804C27.0467 425.261 27.47 424.833 27.9997 424.518C28.5295 424.204 29.1019 424.044 29.7183 424.033C30.0556 424.033 30.4979 424.138 31.0475 424.343C31.5957 424.549 31.9476 424.653 32.1019 424.653C32.2172 424.653 32.6082 424.531 33.271 424.288C33.8977 424.062 34.4267 423.969 34.8601 424.006C36.0343 424.1 36.9165 424.563 37.5032 425.397C36.453 426.034 35.9335 426.925 35.9439 428.068C35.9534 428.959 36.2764 429.7 36.9114 430.288C37.1991 430.561 37.5205 430.772 37.878 430.922C37.8005 431.147 37.7186 431.363 37.6316 431.569V431.569ZM34.9385 420.972C34.9385 421.67 34.6835 422.321 34.1752 422.925C33.5617 423.642 32.8198 424.056 32.0152 423.991C32.005 423.907 31.999 423.819 31.999 423.726C31.999 423.056 32.2907 422.339 32.8088 421.753C33.0674 421.456 33.3963 421.209 33.7952 421.012C34.1932 420.818 34.5697 420.711 34.9238 420.692C34.9342 420.786 34.9385 420.879 34.9385 420.972V420.972Z'
const ANDROID_PATH = 'M35.375 517.049C35.0382 517.049 34.7643 516.774 34.7643 516.436C34.7643 516.098 35.0382 515.823 35.375 515.823C35.7118 515.823 35.9857 516.098 35.9857 516.436C35.9857 516.774 35.7118 517.049 35.375 517.049ZM28.6246 517.049C28.2879 517.049 28.0139 516.774 28.0139 516.436C28.0139 516.098 28.2879 515.823 28.6246 515.823C28.9614 515.823 29.2353 516.098 29.2353 516.436C29.2353 516.774 28.9614 517.049 28.6246 517.049ZM35.594 513.358L36.8146 511.237C36.8846 511.115 36.843 510.96 36.7217 510.889C36.6004 510.819 36.445 510.861 36.3748 510.983L35.1389 513.13C34.1939 512.697 33.1324 512.456 31.9998 512.456C30.8672 512.456 29.8058 512.697 28.8607 513.13L27.6248 510.983C27.5547 510.861 27.3993 510.819 27.278 510.889C27.1567 510.96 27.1148 511.115 27.185 511.237L28.4056 513.358C26.3097 514.502 24.8762 516.63 24.6665 519.145H39.3331C39.1232 516.63 37.6898 514.502 35.594 513.358Z'

const AppleLogo = () => (
  <svg width="16" height="16" viewBox="24 419.67 16 16" aria-hidden="true" className="flex-shrink-0">
    <path d={APPLE_PATH} fill="currentColor" />
  </svg>
)

const AndroidLogo = () => (
  <svg width="16" height="16" viewBox="24 507 16 16" aria-hidden="true" className="flex-shrink-0">
    <path d={ANDROID_PATH} fill="currentColor" />
  </svg>
)

type Platform = 'ios' | 'android' | 'macos'

// Newest first within each platform
const platformDevices: Record<Platform, DeviceName[]> = {
  ios: [
    'iPhone 18 Pro', 'iPhone 18 Pro Max', 'iPhone Duo', 'iPhone Air', 'iPhone 17 Pro Max', 'iPhone 17',
    'iPhone 12 mini', 'iPhone X', 'iPhone 8 Plus', 'iPhone 8', 'iPad Pro', 'iPad Mini',
  ],
  android: ['Pixel 10 Pro', 'Pixel 10 Pro Fold', 'Pixel 10', 'Pixel 9 Pro', 'Pixel 9 Pro Fold', 'Galaxy S25'],
  macos: ['MacBook Pro', 'MacBook Pro 2020'],
}

// Any device added to the library later still shows up, at the end of its platform list
const listed = new Set(Object.values(platformDevices).flat())
for (const name of DeviceNames.filter((d) => !listed.has(d))) {
  const platform: Platform = /pixel|galaxy/i.test(name) ? 'android' : /macbook/i.test(name) ? 'macos' : 'ios'
  platformDevices[platform].push(name)
}

const platforms: { key: Platform, title: string, Logo: () => React.JSX.Element }[] = [
  { key: 'ios', title: 'iOS', Logo: AppleLogo },
  { key: 'android', title: 'Android', Logo: AndroidLogo },
  { key: 'macos', title: 'macOS', Logo: AppleLogo },
]

/* -----------------------------------------------------------------------------
   Device data for the controls
   ----------------------------------------------------------------------------- */

const colorMap: Record<string, string> = {
  'black': '#2c2b2c',
  'white': '#fafaf7',
  'gold': '#f1e2d0',
  'silver': '#c0c0c0',
  'mist-blue': '#a8bac8',
  'sage': '#a5b8a1',
  'lavender': '#c5b5d2',
  'cosmic-orange': '#F6823D',
  'deep-blue': '#4A547F',
  // iPhone 18 Pro colors
  'glacier': '#c3cede',
  'burgundy': '#6b3a42',
  'natural-titanium': '#b5aea4',
  // iPhone Duo colors
  'night-sky': '#3a4659',
  'star-white': '#ece9e3',
  'space-gray': '#3a3a3a',
  'space-black': '#2d2b2e',
  // Pixel 10 colors
  'obsidian': '#4a4d4d',
  'frost': '#d1d8ed',
  'indigo': '#5585e0',
  'lemongrass': '#dfe1c3',
  'porcelain': '#e8e5e1',
  'mint': '#afdbc5',
  'rose': '#e8c4c4',
  // Pixel 9 Pro / 10 Pro / Pro Fold colors (Google Store swatches)
  'hazel': '#949997',
  'rose-quartz': '#f4ddec',
  'moonstone': '#7d8291',
  'jade': '#d9e9ca',
  // Galaxy S25 colors
  'phantom-black': '#1e1e1e',
  'icy-blue': '#c5d5e0',
  'navy': '#283a5e',
  'blue-black': '#3a3e48',
  'silver-shadow': '#a7a8ab',
  'coral-red': '#ea646b',
  'pink-gold': '#e8d7cd',
  // iPhone Air colors (a mid band ring of each finish)
  'cloud-white': '#eae9e9',
  'light-gold': '#e4ddcb',
  'sky-blue': '#d2e0eb',
}


function getColorHex(color: string): string {
  return colorMap[color.toLowerCase()] || '#888888'
}

const colorLabel = (c: string) => c.split('-').map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ')

// Devices that have a notch, a Dynamic Island or a camera that can be hidden
const devicesWithNotch: DeviceName[] = [
  'iPhone X', 'iPhone 12 mini', 'iPhone 17', 'iPhone 17 Pro Max', 'iPhone 18 Pro', 'iPhone 18 Pro Max', 'iPhone Air', 'iPhone Duo',
  'MacBook Pro',
]
const devicesWithDynamicIsland: DeviceName[] = ['iPhone 17', 'iPhone 17 Pro Max', 'iPhone 18 Pro', 'iPhone 18 Pro Max', 'iPhone Air']

// iPhone Duo poses: label, natural orientation, and the framed size (screen + bezels) for auto-zoom
type DuoPose = 'closed' | 'half-open' | 'open'
const duoPoses: { value: DuoPose, label: string, landscape: boolean, size: [number, number] }[] = [
  { value: 'closed', label: 'Closed', landscape: false, size: [508, 710] },
  { value: 'half-open', label: 'Half-open', landscape: true, size: [993, 787] },
  { value: 'open', label: 'Open', landscape: true, size: [992, 710] },
]

// Pixel Pro Fold poses and their screen sizes (closed is the device's default size)
const pixelFolds: DeviceName[] = ['Pixel 10 Pro Fold', 'Pixel 9 Pro Fold']
const pixelFoldPoses: { value: DuoPose, label: string }[] = [
  { value: 'closed', label: 'Closed' },
  { value: 'open', label: 'Open' },
]
const PIXEL_FOLD_INNER: [number, number] = [852, 883]

// Older colour names the library still accepts for compatibility; hidden from the picker
const legacyColors: Partial<Record<DeviceName, readonly string[]>> = {
  'iPad Pro': ['space-gray'],
  'MacBook Pro': ['space-gray'],
  'Pixel 10': ['porcelain', 'mint', 'rose'],
  'Galaxy S25': ['phantom-black', 'silver'],
}

const zoomPresets = [
  { value: 'auto', label: 'Auto' },
  { value: '0.5', label: '50%' },
  { value: '0.75', label: '75%' },
  { value: '1', label: '100%' },
]

const solidColors = ['#000000', '#ffffff', '#1a1a2e', '#f5f5f5', '#0f172a', '#fef3c7']
const gradientPresets = [
  { name: 'Purple', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { name: 'Sunset', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { name: 'Ocean', value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { name: 'Forest', value: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { name: 'Night', value: 'linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 100%)' },
  { name: 'Warm', value: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
]

/* -----------------------------------------------------------------------------
   Sidebar building blocks (styled after the standalone view design)
   ----------------------------------------------------------------------------- */

function Section({ title, children, collapsible }: { title: string, children: React.ReactNode, collapsible?: boolean }) {
  const [open, setOpen] = useState(true)
  return (
    <section className="border-b border-[#ececef] px-4 py-4">
      {collapsible ? (
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between text-[15px] font-medium text-[#1c2024]"
          aria-expanded={open}
        >
          {title}
          <ChevronDown className={`h-4 w-4 text-[#60646c] transition-transform ${open ? '' : '-rotate-90'}`} />
        </button>
      ) : (
        <h2 className="text-[15px] font-medium text-[#1c2024]">{title}</h2>
      )}
      {open && <div className="mt-3">{children}</div>}
    </section>
  )
}

/** A label with a compact dropdown on the right, like "Appearance  Dark ⌄" */
function OptionRow({ label, value, options, onChange, swatch }: {
  label: string
  value: string
  options: { value: string, label: string }[]
  onChange: (value: string) => void
  swatch?: string
}) {
  const current = options.find((o) => o.value === value)
  return (
    <label className="flex items-center justify-between gap-3 py-[9px]">
      <span className="text-[15px] text-[#60646c]">{label}</span>
      <span className="relative inline-flex h-8 items-center gap-1.5 rounded-md bg-[#f0f0f3] pl-2.5 pr-1.5 text-[15px] text-[#1c2024] hover:bg-[#e8e8ec]">
        {swatch && (
          <span className="h-3.5 w-3.5 rounded-full" style={{ background: swatch, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)' }} />
        )}
        <span className="whitespace-nowrap">{current?.label ?? value}</span>
        <ChevronDown className="h-4 w-4 text-[#60646c]" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={label}
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </span>
    </label>
  )
}

function SmallButton({ onClick, children, primary, disabled }: {
  onClick: () => void
  children: React.ReactNode
  primary?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-[14px] font-medium transition-colors disabled:opacity-50 ${
        primary ? 'bg-[#1c2024] text-white hover:bg-[#2e3135]' : 'bg-[#f0f0f3] text-[#1c2024] hover:bg-[#e8e8ec]'
      }`}
    >
      {children}
    </button>
  )
}

/* -----------------------------------------------------------------------------
   Screen content
   ----------------------------------------------------------------------------- */

// Uploaded image content with drag-to-pan functionality
function UploadedImageContent({ src, zoom, position, onMouseDown, onMouseMove, onMouseUp, isDragging, background }: {
  src: string
  zoom: number
  position: { x: number; y: number }
  onMouseDown: (e: React.MouseEvent) => void
  onMouseMove: (e: React.MouseEvent) => void
  onMouseUp: () => void
  isDragging: boolean
  background: string
}) {
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ cursor: isDragging ? 'grabbing' : 'grab', overflow: 'hidden', background }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <img
        src={src}
        alt="Uploaded"
        draggable={false}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
          transformOrigin: 'center',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />
    </div>
  )
}

/* -----------------------------------------------------------------------------
   Page
   ----------------------------------------------------------------------------- */

export default function MockFrameDemo() {
  const [device, setDevice] = useState<DeviceName>('iPhone 18 Pro')
  const [landscape, setLandscape] = useState(false)
  const [hideNotch, setHideNotch] = useState(false)
  const [pose, setPose] = useState<DuoPose>('closed')
  const deviceInfo = DeviceOptions[device]
  const isDuo = device === 'iPhone Duo'
  const isPixelFold = pixelFolds.includes(device)
  const pixelFoldOpen = isPixelFold && pose === 'open'
  const duoPose = duoPoses.find((p) => p.value === pose) ?? duoPoses[0]!
  const colors = deviceInfo.colors.filter((c) => !legacyColors[device]?.includes(c))
  const [color, setColor] = useState<string | undefined>(colors[0])
  const [copied, setCopied] = useState(false)
  const deviceHasNotch = devicesWithNotch.includes(device)

  // Uploaded screenshot
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [imageZoom, setImageZoom] = useState(1)
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isDropZoneActive, setIsDropZoneActive] = useState(false)
  const [bgType, setBgType] = useState<'solid' | 'gradient'>('solid')
  const [bgColor, setBgColor] = useState('#000000')
  const [bgGradient, setBgGradient] = useState(gradientPresets[0]!.value)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const deviceRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Device scale
  const [deviceZoom, setDeviceZoom] = useState<number | 'auto'>('auto')
  const [autoZoomValue, setAutoZoomValue] = useState(0.75)

  // Export
  const [exportFormat, setExportFormat] = useState<'png' | 'webp'>('png')
  const [isExporting, setIsExporting] = useState(false)

  const selectDevice = (newDevice: DeviceName) => {
    setDevice(newDevice)
    if (newDevice === 'iPhone Duo') setLandscape(false)
    if (newDevice === 'iPhone Duo' || pixelFolds.includes(newDevice)) setPose('closed')
    const newColors = DeviceOptions[newDevice].colors.filter((c) => !legacyColors[newDevice]?.includes(c))
    setColor(newColors[0])
  }

  // Auto-fit zoom from the canvas size and the device dimensions
  const calculateAutoZoom = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return 0.75
    const availableWidth = canvas.clientWidth - 160
    const availableHeight = canvas.clientHeight - 120

    // The Duo's framed size depends on the pose (and turns with the orientation)
    if (isDuo) {
      const [w, h] = duoPose.size
      const turned = pose !== 'half-open' && landscape !== duoPose.landscape
      const [fw, fh] = turned ? [h, w] : [w, h]
      return Math.max(0.25, Math.min(1.5, Math.min(availableWidth / (fw * 1.1), availableHeight / (fh * 1.1))))
    }

    const [screenWidth, screenHeight] = pixelFoldOpen ? PIXEL_FOLD_INNER : [deviceInfo.width || 375, deviceInfo.height || 812]
    const deviceWidth = landscape ? screenHeight : screenWidth
    const deviceHeight = landscape ? screenWidth : screenHeight
    // Frames add bezels and buttons around the screen
    const chrome = device.toLowerCase().includes('macbook') ? 1.15 : 1.12
    return Math.max(0.25, Math.min(1.5, Math.min(availableWidth / (deviceWidth * chrome), availableHeight / (deviceHeight * chrome))))
  }, [deviceInfo.width, deviceInfo.height, landscape, device, isDuo, duoPose, pose, pixelFoldOpen])

  useEffect(() => {
    if (deviceZoom !== 'auto') return
    const update = () => setAutoZoomValue(calculateAutoZoom())
    update()
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(update)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [deviceZoom, calculateAutoZoom])

  const effectiveZoom = deviceZoom === 'auto' ? autoZoomValue : deviceZoom

  const codeSnippet = useMemo(() => {
    const props: string[] = [`device="${device}"`]
    if (colors.length > 0 && color) props.push(`color="${color}"`)
    if (isDuo) {
      if (pose !== 'closed') props.push(`pose="${pose}"`)
      if (pose !== 'half-open' && landscape !== duoPose.landscape) {
        props.push(landscape ? 'landscape' : 'landscape={false}')
      }
    } else {
      if (pixelFoldOpen) props.push('pose="open"')
      if (deviceInfo.hasLandscape && landscape) props.push('landscape')
    }
    if (deviceHasNotch && hideNotch) props.push('hideNotch')
    return `<MockFrame\n  ${props.join('\n  ')}\n>\n  <YourAppContent />\n</MockFrame>`
  }, [device, color, colors.length, landscape, deviceInfo.hasLandscape, deviceHasNotch, hideNotch, isDuo, pose, duoPose, pixelFoldOpen])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeSnippet)
    } catch {
      // Clipboard can be blocked (permissions, insecure context); leave the button state alone
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Screenshot upload
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setUploadedImage(event.target?.result as string)
      setImageZoom(1)
      setImagePosition({ x: 0, y: 0 })
    }
    reader.readAsDataURL(file)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processImageFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDropZoneActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDropZoneActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDropZoneActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processImageFile(file)
  }

  const handleClearImage = () => {
    setUploadedImage(null)
    setImageZoom(1)
    setImagePosition({ x: 0, y: 0 })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleResetZoomPan = () => {
    setImageZoom(1)
    setImagePosition({ x: 0, y: 0 })
  }

  // Drag the uploaded image to reposition it
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setImagePosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }

  const handleMouseUp = () => setIsDragging(false)

  const handleExport = async () => {
    if (!deviceRef.current) return
    // Render the frame at 100% (no scale transform, no animation) in a hidden wrapper, then capture it
    setIsExporting(true)
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    try {
      // Always generate PNG first (supports transparency)
      const pngDataUrl = await toPng(deviceRef.current, {
        pixelRatio: 2,
        style: { opacity: '1' },
      })
      let finalDataUrl = pngDataUrl

      // Convert to WebP if requested (preserves transparency)
      if (exportFormat === 'webp') {
        const img = new Image()
        img.src = pngDataUrl
        await new Promise((resolve) => { img.onload = resolve })
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0)
          finalDataUrl = canvas.toDataURL('image/webp', 0.95)
        }
      }

      const link = document.createElement('a')
      link.download = `device-mockup-${device.replace(/\s+/g, '-').toLowerCase()}.${exportFormat}`
      link.href = finalDataUrl
      link.click()
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }

  // The device is chosen at runtime, so its props are built as one object
  const frameProps = {
    device,
    ...(colors.length > 0 ? { color } : {}),
    landscape: deviceInfo.hasLandscape ? landscape : undefined,
    ...(isDuo || isPixelFold ? { pose } : {}),
  } as MockFrameProps

  const onOff = [{ value: 'show', label: 'Show' }, { value: 'hide', label: 'Hide' }]
  const showOrientation = deviceInfo.hasLandscape && !(isDuo && pose === 'half-open')

  return (
    <div className="flex h-screen overflow-hidden bg-[#f9f9fb] text-[#1c2024]">
      {/* Sidebar */}
      <aside className="flex h-full w-[320px] flex-shrink-0 flex-col overflow-y-auto border-r border-[#ececef] bg-white">
        <header className="flex h-[72px] flex-shrink-0 items-center gap-2 border-b border-[#ececef] px-4">
          <Smartphone className="h-5 w-5" />
          <span className="text-[20px] font-semibold tracking-tight">MockFrame</span>
        </header>

        {platforms.map(({ key, title, Logo }) => (
          <Section key={key} title={title}>
            <ul className="flex flex-col gap-1">
              {platformDevices[key].map((name) => {
                const selected = name === device
                return (
                  <li key={name}>
                    <button
                      onClick={() => selectDevice(name)}
                      aria-pressed={selected}
                      className={`flex h-9 w-full items-center gap-2 rounded-md border px-2 text-left text-[15px] transition-colors ${
                        selected ? 'border-[#8ec8f6] bg-[#e6f4fe]' : 'border-transparent bg-[#f9f9fb] hover:bg-[#f0f0f3]'
                      }`}
                    >
                      <span className="text-[#60646c]"><Logo /></span>
                      {name}
                    </button>
                  </li>
                )
              })}
            </ul>
          </Section>
        ))}

        <Section title="Device options" collapsible>
          {colors.length > 0 && color && (
            <OptionRow
              label="Color"
              value={color}
              swatch={getColorHex(color)}
              options={colors.map((c) => ({ value: c, label: colorLabel(c) }))}
              onChange={setColor}
            />
          )}
          {isDuo && (
            <OptionRow
              label="Fold"
              value={pose}
              options={duoPoses}
              onChange={(value) => {
                const next = duoPoses.find((p) => p.value === value)!
                setPose(next.value)
                setLandscape(next.landscape)
              }}
            />
          )}
          {isPixelFold && (
            <OptionRow label="Fold" value={pose} options={pixelFoldPoses} onChange={(value) => setPose(value as DuoPose)} />
          )}
          {showOrientation && (
            <OptionRow
              label="Orientation"
              value={landscape ? 'landscape' : 'portrait'}
              options={[{ value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]}
              onChange={(value) => setLandscape(value === 'landscape')}
            />
          )}
          {deviceHasNotch && (
            <OptionRow
              label={isDuo ? 'Camera' : devicesWithDynamicIsland.includes(device) ? 'Dynamic Island' : 'Notch'}
              value={hideNotch ? 'hide' : 'show'}
              options={onOff}
              onChange={(value) => setHideNotch(value === 'hide')}
            />
          )}
          <OptionRow
            label="Scale"
            value={String(deviceZoom)}
            options={zoomPresets.map((p) => p.value === 'auto' ? { ...p, label: `Auto (${Math.round(autoZoomValue * 100)}%)` } : p)}
            onChange={(value) => setDeviceZoom(value === 'auto' ? 'auto' : Number(value))}
          />
        </Section>

        <Section title="Screenshot" collapsible>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          {!uploadedImage ? (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex w-full flex-col items-center gap-1.5 rounded-md border border-dashed px-4 py-5 text-center transition-colors ${
                  isDropZoneActive ? 'border-[#8ec8f6] bg-[#e6f4fe]' : 'border-[#d9d9e0] bg-[#f9f9fb] hover:bg-[#f0f0f3]'
                }`}
              >
                <Upload className="h-5 w-5 text-[#60646c]" />
                <span className="text-[14px] font-medium">Upload a screenshot</span>
                <span className="text-[13px] text-[#8b8d98]">or drop it here or on the device</span>
              </button>
              <p className="mt-2 text-[13px] text-[#8b8d98]">Showing the expo.dev screenshot until you upload one.</p>
            </>
          ) : (
            <div className="flex gap-2">
              <SmallButton onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4" />Replace</SmallButton>
              <SmallButton onClick={handleClearImage}><Trash2 className="h-4 w-4" />Use default</SmallButton>
            </div>
          )}

          {/* Background, zoom and position of the screenshot on the screen */}
          <OptionRow
            label="Background"
            value={bgType}
            options={[{ value: 'solid', label: 'Solid' }, { value: 'gradient', label: 'Gradient' }]}
            onChange={(value) => setBgType(value as 'solid' | 'gradient')}
          />
          <div className="flex flex-wrap items-center gap-1.5 pb-2">
            {bgType === 'solid' ? (
              <>
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="h-7 w-7 cursor-pointer rounded-md border-0 bg-transparent"
                  aria-label="Background color"
                />
                {solidColors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setBgColor(c)}
                    aria-label={c}
                    className="h-6 w-6 rounded-md"
                    style={{ background: c, boxShadow: bgColor === c ? '0 0 0 2px #8ec8f6' : 'inset 0 0 0 1px rgba(0,0,0,0.15)' }}
                  />
                ))}
              </>
            ) : (
              gradientPresets.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => setBgGradient(preset.value)}
                  title={preset.name}
                  aria-label={preset.name}
                  className="h-7 w-7 rounded-md"
                  style={{ background: preset.value, boxShadow: bgGradient === preset.value ? '0 0 0 2px #8ec8f6' : 'none' }}
                />
              ))
            )}
          </div>
          <div className="flex items-center justify-between gap-3 py-[9px]">
            <span className="text-[15px] text-[#60646c]">Zoom</span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={imageZoom}
                onChange={(e) => setImageZoom(parseFloat(e.target.value))}
                className="w-28 accent-[#1c2024]"
                aria-label="Screenshot zoom"
              />
              <span className="w-9 text-right text-[13px] text-[#60646c]">{imageZoom.toFixed(1)}x</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[13px] text-[#8b8d98]">
            <span className="flex items-center gap-1.5"><Move className="h-3.5 w-3.5" />Drag the image to reposition</span>
            <button onClick={handleResetZoomPan} className="flex items-center gap-1 text-[#1c2024] hover:underline">
              <RotateCcw className="h-3.5 w-3.5" />Reset
            </button>
          </div>
        </Section>

        <Section title="Export" collapsible>
          <OptionRow
            label="Format"
            value={exportFormat}
            options={[{ value: 'png', label: 'PNG' }, { value: 'webp', label: 'WebP' }]}
            onChange={(value) => setExportFormat(value as 'png' | 'webp')}
          />
          <div className="pt-1">
            <SmallButton onClick={handleExport} primary disabled={isExporting}>
              <Download className="h-4 w-4" />{isExporting ? 'Exporting…' : 'Download mockup'}
            </SmallButton>
          </div>
        </Section>

        <Section title="Code" collapsible>
          <div className="relative">
            <pre className="overflow-x-auto rounded-md bg-[#f9f9fb] p-3 font-mono text-[12.5px] leading-relaxed text-[#1c2024] ring-1 ring-[#ececef]">
              {codeSnippet}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute right-2 top-2 rounded-md bg-white p-1.5 text-[#60646c] ring-1 ring-[#ececef] hover:text-[#1c2024]"
              aria-label="Copy code"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </Section>
      </aside>

      {/* Canvas: the device in the middle; drop a screenshot anywhere on it */}
      <main
        ref={canvasRef}
        className={`relative flex flex-1 items-center justify-center overflow-hidden ${isDropZoneActive ? 'bg-[#eef6fd]' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* The padding keeps the side buttons inside exported images */}
        <div
          ref={deviceRef}
          style={{ display: 'inline-block', padding: 8, opacity: isExporting ? 0 : 1 }}
        >
          <MockFrame
            {...frameProps}
            zoom={isExporting ? undefined : effectiveZoom}
            animated={!isExporting}
            hideNotch={hideNotch}
          >
            <UploadedImageContent
              src={uploadedImage ?? defaultScreenshot}
              zoom={imageZoom}
              position={imagePosition}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              isDragging={isDragging}
              background={bgType === 'gradient' ? bgGradient : bgColor}
            />
          </MockFrame>
        </div>
      </main>
    </div>
  )
}
