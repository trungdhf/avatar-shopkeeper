import { useEffect, useMemo } from 'react'
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

// An original Tokyo dusk scene drawn in a canvas, the same trick the hat patch
// uses. No ETHGlobal logo, photo or brand asset: the wordmark is event-themed
// set dressing, matching the disclaimer the README already carries.
// Kept pastel on purpose, because the stage lights were tuned for a light
// background and a night sky would leave the avatar looking unlit.

const sky = { top: '#f0d7e6', upper: '#fbdcd8', middle: '#ffe2cb', horizon: '#ffd3ad' }
const city = { far: 'rgba(174,155,190,0.5)', near: 'rgba(129,110,150,0.72)', window: 'rgba(255,214,150,0.85)' }

// A tiny seeded generator keeps the skyline identical on every reload, so the
// scene never flickers between renders or between the shop and debug pages.
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function skyTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 8
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, 512)
    gradient.addColorStop(0, sky.top)
    gradient.addColorStop(0.42, sky.upper)
    gradient.addColorStop(0.72, sky.middle)
    gradient.addColorStop(1, sky.horizon)
    context.fillStyle = gradient
    context.fillRect(0, 0, 8, 512)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function skylineRow(context: CanvasRenderingContext2D, random: () => number, baseline: number, maxHeight: number, fill: string) {
  context.fillStyle = fill
  let x = -40
  while (x < 2100) {
    const width = 70 + random() * 120
    const height = maxHeight * (0.35 + random() * 0.65)
    context.fillRect(x, baseline - height, width, height)
    if (random() > 0.62) {
      const capWidth = width * 0.4
      context.fillRect(x + (width - capWidth) / 2, baseline - height - 26, capWidth, 26)
    }
    x += width + 8 + random() * 26
  }
}

function lattice(context: CanvasRenderingContext2D, x: number, baseline: number, height: number) {
  context.strokeStyle = city.near
  context.lineWidth = 7
  const halfTop = 14
  const halfBottom = 58
  context.beginPath()
  context.moveTo(x - halfBottom, baseline)
  context.lineTo(x - halfTop, baseline - height)
  context.lineTo(x + halfTop, baseline - height)
  context.lineTo(x + halfBottom, baseline)
  context.stroke()
  for (let step = 1; step < 7; step += 1) {
    const level = step / 7
    const y = baseline - height * level
    const half = halfBottom + (halfTop - halfBottom) * level
    context.beginPath()
    context.moveTo(x - half, y)
    context.lineTo(x + half, y)
    context.stroke()
  }
  context.lineWidth = 9
  context.beginPath()
  context.moveTo(x, baseline - height)
  context.lineTo(x, baseline - height - 54)
  context.stroke()
}

function cityTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 1024
  const context = canvas.getContext('2d')
  if (context) {
    const random = seeded(20260927)
    const baseline = 900

    // Low sun behind the skyline.
    const glow = context.createRadialGradient(1430, 690, 20, 1430, 690, 300)
    glow.addColorStop(0, 'rgba(255,206,160,0.95)')
    glow.addColorStop(1, 'rgba(255,206,160,0)')
    context.fillStyle = glow
    context.fillRect(1130, 390, 600, 600)

    skylineRow(context, random, baseline - 96, 300, city.far)
    lattice(context, 470, baseline, 430)
    skylineRow(context, random, baseline, 250, city.near)

    // Lit windows on the near row only, so the far row stays hazy.
    context.fillStyle = city.window
    for (let index = 0; index < 260; index += 1) {
      const x = random() * 2048
      const y = baseline - random() * 220
      context.fillRect(x, y, 7, 11)
    }

    // Event-themed banner, not an official mark. The plate is sized from the
    // measured text rather than a fixed width, so the wordmark cannot overflow
    // it however the font resolves.
    const wordmark = 'ETHGLOBAL TOKYO 2026'
    const wordmarkSize = 34
    context.font = `800 ${wordmarkSize}px sans-serif`
    const padX = 30
    const padY = 17
    const bannerWidth = context.measureText(wordmark).width + padX * 2
    const bannerHeight = wordmarkSize + padY * 2
    const bannerX = (2048 - bannerWidth) / 2
    const bannerY = 232
    context.fillStyle = 'rgba(58,44,74,0.52)'
    context.fillRect(bannerX, bannerY, bannerWidth, bannerHeight)
    context.strokeStyle = 'rgba(255,240,224,0.62)'
    context.lineWidth = 2
    context.strokeRect(bannerX + 6, bannerY + 6, bannerWidth - 12, bannerHeight - 12)
    context.fillStyle = 'rgba(255,245,233,0.88)'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(wordmark, 1024, bannerY + bannerHeight / 2)
    context.textBaseline = 'alphabetic'

    // Ground haze so the skyline melts into the stage floor.
    const haze = context.createLinearGradient(0, baseline - 70, 0, baseline + 110)
    haze.addColorStop(0, 'rgba(255,225,203,0)')
    haze.addColorStop(1, 'rgba(255,226,205,0.95)')
    context.fillStyle = haze
    context.fillRect(0, baseline - 70, 2048, 180)
    context.clearRect(0, baseline + 110, 2048, 1024 - baseline - 110)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

// Shop floor. It stops exactly at the skyline plane so the two meet on a single
// horizon instead of the boards running out behind the buildings.
const floorDepth = 8.2
const floorPlaneZ = -3.2

function floorTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (context) {
    const random = seeded(4711)
    const plank = 64
    for (let y = 0; y < 512; y += plank) {
      const tone = 214 + Math.round(random() * 22)
      context.fillStyle = `rgb(${tone}, ${tone - 24}, ${tone - 52})`
      context.fillRect(0, y, 512, plank)
      context.strokeStyle = 'rgba(150,118,90,0.28)'
      context.lineWidth = 2
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(512, y)
      context.stroke()
      // Staggered short seams so the boards do not read as one long strip.
      let x = Math.round(random() * 180)
      while (x < 512) {
        context.beginPath()
        context.moveTo(x, y)
        context.lineTo(x, y + plank)
        context.stroke()
        x += 150 + random() * 170
      }
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(5, 2.4)
  texture.anisotropy = 8
  return texture
}

export default function Backdrop() {
  const skyMap = useMemo(skyTexture, [])
  const cityMap = useMemo(cityTexture, [])
  const floorMap = useMemo(floorTexture, [])
  useEffect(() => () => {
    skyMap.dispose()
    cityMap.dispose()
    floorMap.dispose()
  }, [skyMap, cityMap, floorMap])

  return (
    <>
      <primitive object={skyMap} attach="background" />
      <mesh position={[0, 1.15, floorPlaneZ]}>
        <planeGeometry args={[15, 7.5]} />
        <meshBasicMaterial map={cityMap} transparent toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, floorPlaneZ + floorDepth / 2]} receiveShadow>
        <planeGeometry args={[44, floorDepth]} />
        <meshStandardMaterial map={floorMap} roughness={0.88} />
      </mesh>
    </>
  )
}
