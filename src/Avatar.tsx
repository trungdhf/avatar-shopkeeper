import { Canvas, createPortal, useFrame, useLoader, useThree } from '@react-three/fiber'
import Backdrop from './Backdrop'
import { Beanie, BucketHat, Cap, Garment, RoundGlasses, Tee, Visor } from './Accessories'

export { garment } from './Accessories'
import { VRMLoaderPlugin, type VRM, type VRMHumanBoneName } from '@pixiv/three-vrm'
import { createVRMAnimationClip, VRMAnimationLoaderPlugin, type VRMAnimation } from '@pixiv/three-vrm-animation'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimationMixer, CanvasTexture, CylinderGeometry, DoubleSide, LoopOnce, Object3D, Quaternion, RingGeometry, SRGBColorSpace, Vector3, type AnimationAction, type Group } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// Idle-face tuning. Raise smile for a warmer shopkeeper, lower it for a calmer one.
export const face = { smile: 0.18, smileSway: 0.05, softness: 0.09, headTurn: 0.26, headLean: 0.05 }

// Showcase turn. The avatar holds each pose, then eases to the next, the way a
// model presents rather than spinning on a motor. yaw is radians, times seconds.
export const showcase = { poses: [0.45, 0.15, -0.15, -0.45, -0.15, 0.15], hold: 2.5, travel: 4, headHold: 0.45, pointerNudge: 0.08 }

// The idle clip plants the feet wide. leftUpperLeg sits at +x, so a negative
// rotation.z swings that foot back towards the midline, and the mirror closes
// the right. Raise close to narrow the stance further, negate it to widen.
export const stance = { close: 0.11 }

// The idle clip curls the fingers 16-26 degrees. Pull each finger bone back
// towards its rest rotation, which is the straight hand. 0 keeps the clip's
// curl, 1 forces the fingers fully straight.
export const hands = { straighten: 0.65 }
const restRotation = new Quaternion()

// Band patch on the crown. Radii follow the crown taper so the patch keeps
// hugging it as y rises; raise y further and both radii must shrink to match.
// Idle clip source. VITE_IDLE_MOTION is honoured only in development, so a
// local BOOTH motion can stand in while recording. import.meta.env.DEV is
// replaced with false when building, which drops the override entirely: the
// published bundle can only ever ask for the MIT clip we are allowed to ship.
const idleMotion: string = (import.meta.env.DEV && import.meta.env.VITE_IDLE_MOTION) || '/anims/LookAround.vrma'

// Silent lip sync. The VRM carries the five VRM visemes, so each vowel picks
// one and consonants close the mouth. No audio: the bubble shows the words.
// cps is characters per second, open the peak viseme weight.
export const speech = {
  line: 'Hi! I’m Mochi. Click anything on the shelf and I will try it on.',
  syllable: 0.17,
  consonant: 0.07,
  wordGap: 0.11,
  pause: 0.3,
  open: 0.8,
  blend: 14,
  smileTalk: 0.45,
  startedAt: -1,
  visible: 0,
}

const visemes = ['aa', 'ih', 'ou', 'ee', 'oh'] as const
type Viseme = typeof visemes[number]
const vowelViseme: Record<string, Viseme | undefined> = {
  a: 'aa', e: 'ee', i: 'ih', o: 'oh', u: 'ou', y: 'ih',
}

// NFD splits an accented vowel into its base letter plus the mark, so Vietnamese
// and Japanese romanisation both land on one of the five shapes.
const baseLetter = (character: string) => character.normalize('NFD')[0].toLowerCase()
const isVowel = (character: string) => vowelViseme[baseLetter(character)] !== undefined
const isTie = (character: string) => character === "'" || character === '’'
const isLetter = (character: string) => /[a-z]/.test(baseLetter(character)) || isTie(character)

type Token = { viseme?: Viseme; weight: number; end: number; chars: number }

// One shape per vowel run rather than per letter, because a mouth that shuts
// between every character just flaps. Consonant runs keep the mouth slightly
// open so shapes flow inside a word, and only gaps and punctuation close it.
function buildTokens(line: string) {
  const tokens: Token[] = []
  let at = 0
  let index = 0
  let vowelInWord = false
  while (index < line.length) {
    let end = index
    let token: Token
    if (isVowel(line[index])) {
      while (end < line.length && isVowel(line[end])) end += 1
      // A lone trailing e is silent in English, so it gets a consonant beat
      // instead of its own shape: Welcome ends on the o, not on an ee.
      const silentE = end - index === 1 && baseLetter(line[index]) === 'e' && vowelInWord
        && (end >= line.length || !isLetter(line[end]))
      at += silentE ? speech.consonant : speech.syllable
      token = silentE
        ? { weight: 0.18, end: at, chars: end }
        : { viseme: vowelViseme[baseLetter(line[index])], weight: 1, end: at, chars: end }
      if (!silentE) vowelInWord = true
    } else if (isLetter(line[index])) {
      while (end < line.length && isLetter(line[end]) && !isVowel(line[end])) end += 1
      at += speech.consonant
      token = { weight: 0.18, end: at, chars: end }
    } else {
      while (end < line.length && !isLetter(line[end])) end += 1
      at += /[.!?,;:]/.test(line.slice(index, end)) ? speech.pause : speech.wordGap
      token = { weight: 0, end: at, chars: end }
      vowelInWord = false
    }
    tokens.push(token)
    index = end
  }
  return tokens
}

let tokens: Token[] = []
let cursor = 0
const mouth: Record<Viseme, number> = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 }

// -2 parks the line until the next frame, which stamps the real clock time.
export function say(line?: string) {
  if (line !== undefined) speech.line = line
  tokens = buildTokens(speech.line)
  cursor = 0
  speech.startedAt = -2
  speech.visible = 0
}

export const speechLength = () => (tokens.length > 0 ? tokens[tokens.length - 1].end : 0)

// Stage layout. The display stand needs a wider shot than the original
// chest-up crop, so the camera distance is a knob rather than a literal.
// Avatar stands off to the right so the shelves are not hidden behind them.
// A -0.08 m overlap between the right bay and the avatar is why avatarX is 1.35
// rather than 0.95: see the gap sum in the commit message.
export const stage = {
  standX: -1.05, standY: 0, standZ: -1.15, standScale: 1,
  avatarX: 1.35, cameraZ: 5.6, cameraY: -0.16, lookX: 0.1,
}

// arc 1.9 rad gives a 0.19 m wide panel on a 0.102 m torso, and the canvas is
// sized from that same ratio so the print can never come out stretched.
export const shirt = { text: 'ETHGLOBAL TOKYO 2026', y: -0.008, radius: 0.102, height: 0.072, arc: 1.9, color: '#fff6ea' }

export const badge = { y: 0.036, height: 0.04, radiusTop: 0.1205, radiusBottom: 0.1235 }

export function showcaseYaw(time: number) {
  const step = showcase.hold + showcase.travel
  const index = Math.floor((time % (showcase.poses.length * step)) / step)
  const local = (time % (showcase.poses.length * step)) - index * step
  const from = showcase.poses[index]
  if (local <= showcase.hold) return from
  const to = showcase.poses[(index + 1) % showcase.poses.length]
  const k = (local - showcase.hold) / showcase.travel
  return from + (to - from) * k * k * (3 - 2 * k)
}

// Printed on a thin curved decal parented to the chest bone rather than baked
// into the avatar texture, because this VRM's metadata restricts modifying the
// model. Transparent background, so only the letters sit on the clothing.
function ShirtText({ color }: { color: string }) {
  const label = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.height = 320
    canvas.width = Math.round(320 * (shirt.radius * shirt.arc) / shirt.height)
    const context = canvas.getContext('2d')
    if (context) {
      const [first, ...rest] = shirt.text.split(' ')
      context.textAlign = 'center'
      context.lineJoin = 'round'
      // Shrink to fit rather than trust a fixed size: the panel is narrow and a
      // longer line would otherwise run past its edges.
      const draw = (line: string, wanted: number, y: number) => {
        let size = wanted
        context.font = `900 ${size}px sans-serif`
        while (size > 10 && context.measureText(line).width > canvas.width * 0.88) {
          size -= 2
          context.font = `900 ${size}px sans-serif`
        }
        context.strokeStyle = 'rgba(38,30,46,0.55)'
        context.lineWidth = size * 0.16
        context.strokeText(line, canvas.width / 2, y)
        context.fillStyle = color
        context.fillText(line, canvas.width / 2, y)
      }
      draw(first, 132, 152)
      if (rest.length > 0) draw(rest.join(' '), 86, 258)
    }
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    return texture
  }, [color])

  useEffect(() => () => label.dispose(), [label])

  return (
    <mesh position={[0, shirt.y, 0]}>
      <cylinderGeometry args={[shirt.radius, shirt.radius, shirt.height, 32, 1, true, -shirt.arc / 2, shirt.arc]} />
      <meshBasicMaterial map={label} transparent toneMapped={false} />
    </mesh>
  )
}

// Everything the shelves carry. Preview only: the deployed contract still sells
// exactly one hat and one pair of shades, so this adds styles, not products.
// sku names the two entries the deployed contract can actually sell. Everything
// without one is try-on only, and the cart refuses it.
export type Sku = 'hat' | 'glasses'
// screen is the viewport position of the click, so the page can open its menu
// next to the item instead of in a fixed corner.
export type ShelfItem = {
  id: string
  label: string
  group: 'hat' | 'eyewear' | 'tee'
  sku?: Sku
  screen: { x: number; y: number }
}

export const hatCatalogue = [
  { id: 'cowboy-sakura', kind: 'cowboy', color: '#e89281', label: 'Sakura cowboy', sku: 'hat' as Sku },
  { id: 'cowboy-midnight', kind: 'cowboy', color: '#607a9c', label: 'Midnight cowboy', sku: 'hat' as Sku },
  { id: 'cowboy-honey', kind: 'cowboy', color: '#deb261', label: 'Honey cowboy', sku: 'hat' as Sku },
  { id: 'cap-navy', kind: 'cap', color: '#3f4c6d', label: 'Shibuya cap' },
  { id: 'beanie-rose', kind: 'beanie', color: '#d98a94', label: 'Harajuku beanie' },
  { id: 'bucket-sand', kind: 'bucket', color: '#cdb391', label: 'Sando bucket' },
]

export const eyewearCatalogue = [
  { id: 'shades', kind: 'shades', label: 'Shibuya shades', sku: 'glasses' as Sku },
  { id: 'round', kind: 'round', label: 'Ueno rounds' },
  { id: 'visor', kind: 'visor', label: 'Akiba visor' },
]

export const teeCatalogue = [
  { id: 'cream', color: '#f6ece0', print: '#3b3340', label: 'Cream tee' },
  { id: 'coral', color: '#e6826c', print: '#fff6ea', label: 'Coral tee' },
  { id: 'indigo', color: '#44527a', print: '#ffe9cf', label: 'Indigo tee' },
]

function HatModel({ kind, color }: { kind: string; color: string }) {
  if (kind === 'cap') return <Cap color={color} />
  if (kind === 'beanie') return <Beanie color={color} />
  if (kind === 'bucket') return <BucketHat color={color} />
  return <CowboyHat color={color} />
}

function EyewearModel({ kind }: { kind: string }) {
  if (kind === 'round') return <RoundGlasses />
  if (kind === 'visor') return <Visor />
  return <Sunglasses />
}

// Pointer events come from the raycaster, so a group is enough: the ray hits a
// child mesh and the click bubbles up to here.
function Pickable({ onPick, position, hit = [0.38, 0.26, 0.38], hitY = 0.08, children }: {
  onPick: (x: number, y: number) => void
  position: [number, number, number]
  hit?: [number, number, number]
  hitY?: number
  children: ReactNode
}) {
  return (
    <group
      position={position}
      onClick={(event) => { event.stopPropagation(); onPick(event.clientX, event.clientY) }}
      onPointerOver={(event) => { event.stopPropagation(); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = 'auto' }}
    >
      <mesh position={[0, hitY, 0]}>
        <boxGeometry args={hit} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {children}
    </group>
  )
}

function Bay({ x, shelves, width }: { x: number; shelves: number[]; width: number }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.74, -0.26]}>
        <boxGeometry args={[width, 1.5, 0.04]} />
        <meshStandardMaterial color="#e7d6c2" roughness={0.9} />
      </mesh>
      {[-width / 2 + 0.03, width / 2 - 0.03].map((side) => (
        <mesh key={side} position={[side, 0.74, 0]}>
          <boxGeometry args={[0.06, 1.5, 0.52]} />
          <meshStandardMaterial color="#c9a988" roughness={0.8} />
        </mesh>
      ))}
      {shelves.map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[width, 0.045, 0.52]} />
          <meshStandardMaterial color="#d8bb98" roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

// Shop name lives in the scene now rather than in page headings. Board and
// canvas share one aspect ratio, and the text is measured to fit, so the sign
// cannot stretch or overflow whatever the font resolves to.
const sign = { width: 3.3, height: 0.42, y: 1.78, z: -0.1 }

function ShopSign() {
  const label = useMemo(() => {
    const faceWidth = sign.width - 0.08
    const faceHeight = sign.height - 0.06
    const canvas = document.createElement('canvas')
    canvas.height = 176
    canvas.width = Math.round(176 * faceWidth / faceHeight)
    const context = canvas.getContext('2d')
    if (context) {
      const text = 'MOCHI MART'
      let size = 108
      context.font = `900 ${size}px sans-serif`
      while (size > 20 && context.measureText(text).width > canvas.width * 0.6) {
        size -= 4
        context.font = `900 ${size}px sans-serif`
      }
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = '#fff4e6'
      context.fillText(text, canvas.width / 2, canvas.height / 2)
      const half = context.measureText(text).width / 2
      context.fillStyle = '#e6826c'
      context.font = `900 ${Math.round(size * 0.7)}px sans-serif`
      context.fillText('\u2733', canvas.width / 2 - half - size * 0.55, canvas.height / 2)
      context.fillText('\u2733', canvas.width / 2 + half + size * 0.55, canvas.height / 2)
    }
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    return texture
  }, [])

  useEffect(() => () => label.dispose(), [label])

  return (
    <group position={[0, sign.y, sign.z]}>
      <mesh castShadow>
        <boxGeometry args={[sign.width, sign.height, 0.06]} />
        <meshStandardMaterial color="#2f3038" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.032]}>
        <planeGeometry args={[sign.width - 0.08, sign.height - 0.06]} />
        <meshBasicMaterial map={label} transparent toneMapped={false} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (sign.width / 2 - 0.18), sign.height / 2 + 0.07, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.14, 10]} />
          <meshStandardMaterial color="#b49a8d" roughness={0.5} metalness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

function DisplayStand({ onPickHat, onPickEyewear, onPickTee }: {
  onPickHat: (id: string, x: number, y: number) => void
  onPickEyewear: (id: string, x: number, y: number) => void
  onPickTee: (id: string, x: number, y: number) => void
}) {
  const hatShelves = [0.58, 1.06]
  const rightShelves = [0.5, 1.06]
  const bayWidth = 1.42
  const left = -1.02
  const right = 1.02

  return (
    <group position={[stage.standX, stage.standY, stage.standZ]} scale={stage.standScale}>
      <ShopSign />
      <Bay x={left} shelves={hatShelves} width={bayWidth} />
      <Bay x={right} shelves={rightShelves} width={bayWidth} />

      {hatCatalogue.map((hat, index) => {
        const row = Math.floor(index / 3)
        const column = index % 3
        return (
          <Pickable key={hat.id} position={[left + (column - 1) * 0.44, hatShelves[1 - row] + 0.04, 0.02]} onPick={(x, y) => onPickHat(hat.id, x, y)}>
            <group rotation={[0, (column - 1) * 0.26, 0]}>
              <HatModel kind={hat.kind} color={hat.color} />
            </group>
          </Pickable>
        )
      })}

      {eyewearCatalogue.map((item, index) => (
        <Pickable key={item.id} position={[right + (index - 1) * 0.42, rightShelves[1] + 0.1, 0.04]} onPick={(x, y) => onPickEyewear(item.id, x, y)} hit={[0.3, 0.16, 0.24]} hitY={0.02}>
          <group rotation={[0.3, (index - 1) * 0.3, 0]}>
            <EyewearModel kind={item.kind} />
          </group>
        </Pickable>
      ))}

      <mesh position={[right, rightShelves[0] + 0.44, 0.02]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, bayWidth - 0.12, 12]} />
        <meshStandardMaterial color="#b49a8d" roughness={0.5} metalness={0.3} />
      </mesh>
      {teeCatalogue.map((tee, index) => (
        <Pickable key={tee.id} position={[right + (index - 1) * 0.42, rightShelves[0] + 0.42, 0.02]} onPick={(x, y) => onPickTee(tee.id, x, y)} hit={[0.34, 0.42, 0.14]} hitY={-0.08}>
          <group>
            <Tee color={tee.color} />
          </group>
        </Pickable>
      ))}
    </group>
  )
}

function CowboyHat({ color }: { color: string }) {
  const patch = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 320
    const context = canvas.getContext('2d')
    if (context) {
      context.fillStyle = '#222733'
      context.fillRect(0, 0, 1024, 320)
      context.strokeStyle = '#f5e4c8'
      context.lineWidth = 12
      context.strokeRect(14, 14, 996, 292)
      context.fillStyle = '#fff8eb'
      context.textAlign = 'center'
      context.font = '900 140px sans-serif'
      context.fillText('ETHGLOBAL', 512, 165)
      context.font = 'bold 88px sans-serif'
      context.fillText('TOKYO 2026', 512, 272)
    }
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    return texture
  }, [])

  useEffect(() => () => patch.dispose(), [patch])
  const crown = useMemo(() => {
    const height = 0.135
    const geometry = new CylinderGeometry(0.1, 0.123, height, 48, 10)
    const positions = geometry.attributes.position
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i)
      const y = positions.getY(i)
      const z = positions.getZ(i)
      const h = (y + height / 2) / height
      const front = Math.max(0, z / 0.1)
      const pinchedX = x * (1 - 0.2 * h * h * front)
      const crease = 0.013 * Math.exp(-((pinchedX / 0.04) ** 2)) * h ** 4
      const rounded = 0.012 * h ** 6 * ((x * x + z * z) / 0.01)
      positions.setXYZ(i, pinchedX, y - crease - rounded, z)
    }
    geometry.computeVertexNormals()
    return geometry
  }, [])

  useEffect(() => () => crown.dispose(), [crown])
  const brim = useMemo(() => {
    const inner = 0.118
    const outer = 0.2
    const geometry = new RingGeometry(inner, outer, 64, 6)
    const positions = geometry.attributes.position
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i)
      const y = positions.getY(i)
      const radius = Math.hypot(x, y)
      const angle = Math.atan2(y, x)
      const t = (radius - inner) / (outer - inner)
      const depth = 1.53 - 0.28 * t
      const side = Math.cos(angle) ** 2
      const lift = 0.055 * t * t * side + 0.006 * t * (1 - side)
      positions.setXYZ(i, radius * Math.cos(angle), lift, radius * Math.sin(angle) * depth)
    }
    geometry.computeVertexNormals()
    return geometry
  }, [])

  useEffect(() => () => brim.dispose(), [brim])

  return (
    <group position={[0, 0.085, 0.005]} rotation={[-0.1, 0, 0]} scale={0.86}>
      <group position={[0, 0, 0.015]} scale={[1, 1, 1.53]}>
        <mesh position={[0, 0.0675, 0]} castShadow>
          <primitive object={crown} attach="geometry" />
          <meshStandardMaterial color={color} roughness={0.85} side={DoubleSide} />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.1215, 0.1235, 0.03, 40, 1, true]} />
          <meshStandardMaterial color="#292d38" roughness={0.85} side={DoubleSide} />
        </mesh>
        <mesh position={[0, badge.y, 0]}>
          <cylinderGeometry args={[badge.radiusTop, badge.radiusBottom, badge.height, 24, 1, true, -0.45, 0.9]} />
          <meshBasicMaterial map={patch} />
        </mesh>
      </group>
      <mesh position={[0, 0.002, 0.015]} castShadow>
        <primitive object={brim} attach="geometry" />
        <meshStandardMaterial color={color} roughness={0.8} side={DoubleSide} />
      </mesh>
    </group>
  )
}

function Sunglasses() {
  return (
    <group position={[0, 0.054, 0.114]}>
      {[-0.032, 0.032].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh scale={[1.15, 0.85, 1]}>
            <torusGeometry args={[0.021, 0.0028, 8, 32]} />
            <meshStandardMaterial color="#1f2029" roughness={0.35} metalness={0.2} />
          </mesh>
          <mesh scale={[1.15, 0.85, 1]}>
            <circleGeometry args={[0.021, 32]} />
            <meshStandardMaterial color="#e6826c" roughness={0.1} metalness={0.4} transparent opacity={0.72} side={DoubleSide} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.006, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0024, 0.0024, 0.018, 8]} />
        <meshStandardMaterial color="#1f2029" roughness={0.35} metalness={0.2} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.062, 0.004, -0.045]} rotation={[0, side * -0.12, 0]}>
          <boxGeometry args={[0.004, 0.005, 0.095]} />
          <meshStandardMaterial color="#1f2029" roughness={0.35} metalness={0.2} />
        </mesh>
      ))}
    </group>
  )
}

type MotionRequest = { files: File[]; id: number; loop?: boolean }

function Character({ hatColor, wearing, wearingGlasses, motionRequest, onMotionStatus, onSelect }: {
  hatColor: string
  wearing: boolean
  wearingGlasses: boolean
  motionRequest: MotionRequest | null
  onMotionStatus: (message: string) => void
  onSelect: (item: ShelfItem) => void
}) {
  const character = useRef<Group>(null)
  const camera = useThree(({ camera }) => camera)
  const size = useThree(({ size }) => size)
  const gltf = useLoader(GLTFLoader, '/avatars/real2.vrm', (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser))
  })
  const idleGltf = useLoader(GLTFLoader, idleMotion, (loader) => {
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser))
  })
  const vrm = gltf.userData.vrm as VRM
  const head = useMemo(() => vrm.humanoid.getNormalizedBoneNode('head'), [vrm])
  const chest = useMemo(() => vrm.humanoid.getNormalizedBoneNode('upperChest')
    ?? vrm.humanoid.getNormalizedBoneNode('chest'), [vrm])
  const [pickedHat, setPickedHat] = useState<string | null>(null)
  const [pickedEyewear, setPickedEyewear] = useState<string | null>(null)
  const [pickedTee, setPickedTee] = useState<string | null>(null)
  const fingers = useMemo(() => {
    const segments = ['Proximal', 'Intermediate', 'Distal']
    const names = (['left', 'right'] as const).flatMap((side) => [
      ...['Metacarpal', 'Proximal', 'Distal'].map((part) => `${side}Thumb${part}`),
      ...['Index', 'Middle', 'Ring', 'Little'].flatMap((digit) => segments.map((part) => `${side}${digit}${part}`)),
    ]) as VRMHumanBoneName[]
    return names.map((name) => vrm.humanoid.getNormalizedBoneNode(name)).filter((node) => node !== null)
  }, [vrm])
  const upperLegs = useMemo(() => ({
    left: vrm.humanoid.getNormalizedBoneNode('leftUpperLeg'),
    right: vrm.humanoid.getNormalizedBoneNode('rightUpperLeg'),
  }), [vrm])
  const motion = useMemo(() => {
    const idleAnimation = (idleGltf.userData.vrmAnimations as VRMAnimation[])[0]
    const mixer = new AnimationMixer(vrm.scene)
    const idle = mixer.clipAction(createVRMAnimationClip(idleAnimation, vrm))
    return { mixer, idle }
  }, [vrm, idleGltf])
  const selectedAction = useRef<AnimationAction | null>(null)
  const selectedActive = useRef(false)
  const queuedActions = useRef<AnimationAction[]>([])
  const motionEndTime = useRef<number | null>(null)
  const allActions = useRef<AnimationAction[]>([])
  const loopRequested = useRef(false)
  const scene = useThree(({ scene }) => scene)
  const gaze = useMemo(() => new Object3D(), [])
  const blinkState = useRef({ nextAt: 1.4, startedAt: -1, pending: 0 })
  const headTurn = useRef(0)
  const headLean = useRef(0)

  useEffect(() => {
    const lookAt = vrm.lookAt
    if (!lookAt) return
    scene.add(gaze)
    lookAt.target = gaze
    return () => {
      lookAt.target = undefined
      scene.remove(gaze)
    }
  }, [vrm, gaze, scene])

  useEffect(() => {
    motion.idle.reset().play()
    // No uncacheRoot here: StrictMode remounts replay this same memoised action,
    // and dropping its property bindings makes the next play() throw.
    return () => {
      motion.mixer.stopAllAction()
    }
  }, [motion])

  useEffect(() => {
    if (!motionRequest) return
    let active = true
    const clips: ReturnType<typeof createVRMAnimationClip>[] = []
    motionEndTime.current = null
    onMotionStatus(motionRequest.files.length > 1 ? `Loading ${motionRequest.files.length} VRoid motions…` : 'Loading your VRoid motion…')
    const loader = new GLTFLoader()
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser))
    void Promise.all(motionRequest.files.map(async (file) => {
      const animationGltf = await loader.parseAsync(await file.arrayBuffer(), '')
      const animation = (animationGltf.userData.vrmAnimations as VRMAnimation[] | undefined)?.[0]
      if (!animation) throw new Error(`${file.name} does not contain a VRM animation.`)
      return animation
    }))
      .then((animations) => {
        if (!active) return
        const actions = animations.map((animation) => {
          const clip = createVRMAnimationClip(animation, vrm)
          clips.push(clip)
          const action = motion.mixer.clipAction(clip)
          action.setLoop(LoopOnce, 1)
          action.clampWhenFinished = true
          return action
        })
        const [first, ...rest] = actions
        first.reset().play().crossFadeFrom(motion.idle, 0.4, false)
        selectedAction.current = first
        queuedActions.current = rest
        allActions.current = actions
        loopRequested.current = motionRequest.loop === true
        selectedActive.current = true
        onMotionStatus(loopRequested.current
          ? `Looping ${actions.length} motion(s). Files stay in your browser.`
          : actions.length > 1
            ? `Playing your ${actions.length}-motion runway show. Files stay in your browser.`
            : 'Playing your local motion. The file stays in your browser.')
      })
      .catch((error: unknown) => {
        if (active) onMotionStatus(error instanceof Error ? `Could not play motion: ${error.message}` : 'Could not play this motion.')
      })
    return () => {
      active = false
      selectedActive.current = false
      motionEndTime.current = null
      queuedActions.current = []
      allActions.current = []
      loopRequested.current = false
      selectedAction.current = null
      for (const clip of clips) {
        motion.mixer.clipAction(clip).stop()
        motion.mixer.uncacheAction(clip, vrm.scene)
      }
      motion.idle.reset().play()
    }
  }, [motionRequest, motion, vrm, onMotionStatus])

  useLayoutEffect(() => {
    if (!head) return
    vrm.scene.updateMatrixWorld(true)
    const headY = head.getWorldPosition(new Vector3()).y
    camera.position.set(stage.lookX, headY - 0.35 + stage.cameraY, stage.cameraZ)
    camera.lookAt(stage.lookX, headY - 0.4 + stage.cameraY, 0)
  }, [camera, head, vrm])

  useFrame(({ clock, pointer }, delta) => {
    const time = clock.elapsedTime
    if (character.current) {
      const target = selectedActive.current ? 0 : showcaseYaw(time) + pointer.x * showcase.pointerNudge
      character.current.rotation.y += (target - character.current.rotation.y) * Math.min(1, delta * 2.6)
    }
    if (selectedActive.current && selectedAction.current &&
      selectedAction.current.time >= selectedAction.current.getClip().duration - 0.4) {
      let next = queuedActions.current.shift()
      if (!next && loopRequested.current && allActions.current.length > 0) {
        const [restart, ...rest] = allActions.current
        queuedActions.current = rest
        next = restart
      }
      if (next) {
        // A single looping clip crossfades from itself, which stalls the mixer.
        if (next === selectedAction.current) {
          next.reset().play()
        } else {
          next.reset().play().crossFadeFrom(selectedAction.current, 0.4, false)
        }
        selectedAction.current = next
      } else {
        motion.idle.reset().play().crossFadeFrom(selectedAction.current, 0.4, false)
        selectedActive.current = false
        motionEndTime.current = time + 0.9
      }
    }
    if (motionEndTime.current !== null && time >= motionEndTime.current) {
      motionEndTime.current = null
      onMotionStatus('Motion played locally. Choose another file to replay.')
    }
    const fullBodyDistance = 1.5 / (Math.tan(14 * Math.PI / 180) * (size.width / size.height))
    const targetDistance = selectedActive.current ? Math.max(5.6, fullBodyDistance) : stage.cameraZ
    if (selectedActive.current && camera.position.z < targetDistance) {
      camera.position.z = targetDistance
    } else {
      camera.position.z += (targetDistance - camera.position.z) * Math.min(1, delta * 4)
    }
    motion.mixer.update(delta)
    if (head && !selectedActive.current) {
      headTurn.current += (pointer.x * face.headTurn - headTurn.current) * Math.min(1, delta * 3.2)
      headLean.current += (Math.sin(time * 0.32) * face.headLean - headLean.current) * Math.min(1, delta * 1.6)
      const bodyYaw = character.current ? character.current.rotation.y : 0
      head.rotation.y += headTurn.current - bodyYaw * showcase.headHold
      head.rotation.z += headLean.current
    }
    if (upperLegs.left && upperLegs.right && !selectedActive.current) {
      upperLegs.left.rotation.z -= stance.close
      upperLegs.right.rotation.z += stance.close
    }
    if (!selectedActive.current) {
      for (const bone of fingers) {
        bone.quaternion.slerp(restRotation, hands.straighten)
      }
    }
    gaze.position.copy(camera.position)
    gaze.position.x += Math.sin(time * 0.41) * 0.12
    gaze.position.y += Math.sin(time * 0.29) * 0.07
    gaze.updateMatrixWorld()
    const blinking = blinkState.current
    if (blinking.startedAt < 0 && time >= blinking.nextAt) {
      blinking.startedAt = time
    }
    let blink = 0
    if (blinking.startedAt >= 0) {
      const t = time - blinking.startedAt
      blink = t < 0.07 ? t / 0.07 : t < 0.12 ? 1 : Math.max(0, 1 - (t - 0.12) / 0.11)
      if (t >= 0.23) {
        blinking.startedAt = -1
        if (blinking.pending > 0) {
          blinking.pending -= 1
          blinking.nextAt = time + 0.09
        } else {
          blinking.pending = Math.random() < 0.18 ? 1 : 0
          blinking.nextAt = time + 2.1 + Math.random() * 3.6
        }
      }
    }
    if (speech.startedAt === -2) speech.startedAt = time
    let active: Token | undefined
    if (speech.startedAt >= 0) {
      const elapsed = time - speech.startedAt
      while (cursor < tokens.length && tokens[cursor].end <= elapsed) cursor += 1
      if (cursor >= tokens.length) {
        speech.startedAt = -1
        speech.visible = speech.line.length
      } else {
        active = tokens[cursor]
        speech.visible = active.chars
      }
    }
    const talking = speech.startedAt >= 0
    const expressions = vrm.expressionManager
    if (expressions) {
      expressions.setValue('blink', blink)
      // A wide smile fights the visemes for the same mouth morphs, so ease it
      // off while talking and let it come back afterwards.
      const smile = face.smile * (talking ? speech.smileTalk : 1) + Math.sin(time * 0.52) * face.smileSway
      expressions.setValue('happy', smile)
      expressions.setValue('relaxed', face.softness)
      // Lerp every viseme so shapes blend into each other instead of snapping.
      const rate = Math.min(1, delta * speech.blend)
      for (const viseme of visemes) {
        const target = active && active.viseme === viseme ? active.weight * speech.open : 0
        mouth[viseme] += (target - mouth[viseme]) * rate
        expressions.setValue(viseme, mouth[viseme])
      }
    }
    vrm.update(delta)
  })

  // Clicking a shelf item overrides what the shop UI has equipped; clicking the
  // same item again clears the override and hands control back to the buttons.
  const announce = (label: string, on: boolean) => say(on ? `Trying the ${label}.` : `Taking the ${label} back off.`)

  const hatChoice = hatCatalogue.find((item) => item.id === pickedHat)
  const eyewearChoice = eyewearCatalogue.find((item) => item.id === pickedEyewear)
  const teeChoice = teeCatalogue.find((item) => item.id === pickedTee)

  return (
    <>
      <DisplayStand
        onPickHat={(id, x, y) => {
          const entry = hatCatalogue.find((item) => item.id === id)
          const on = pickedHat !== id
          setPickedHat(on ? id : null)
          announce(entry?.label ?? 'hat', on)
          if (entry) onSelect({ id, label: entry.label, group: 'hat', sku: entry.sku, screen: { x, y } })
        }}
        onPickEyewear={(id, x, y) => {
          const entry = eyewearCatalogue.find((item) => item.id === id)
          const on = pickedEyewear !== id
          setPickedEyewear(on ? id : null)
          announce(entry?.label ?? 'shades', on)
          if (entry) onSelect({ id, label: entry.label, group: 'eyewear', sku: entry.sku, screen: { x, y } })
        }}
        onPickTee={(id, x, y) => {
          const entry = teeCatalogue.find((item) => item.id === id)
          const on = pickedTee !== id
          setPickedTee(on ? id : null)
          announce(entry?.label ?? 'tee', on)
          if (entry) onSelect({ id, label: entry.label, group: 'tee', screen: { x, y } })
        }}
      />
      <group ref={character} position={[stage.avatarX, 0, 0]}>
        <primitive object={vrm.scene} />
        {chest && teeChoice && createPortal(
          <Garment color={teeChoice.color} print={teeChoice.print} text={shirt.text} />, chest)}
        {chest && !teeChoice && createPortal(<ShirtText color={shirt.color} />, chest)}
        {head && hatChoice && createPortal(<HatModel kind={hatChoice.kind} color={hatChoice.color} />, head)}
        {head && !hatChoice && wearing && createPortal(<CowboyHat color={hatColor} />, head)}
        {head && eyewearChoice && createPortal(<EyewearModel kind={eyewearChoice.kind} />, head)}
        {head && !eyewearChoice && wearingGlasses && createPortal(<Sunglasses />, head)}
      </group>
    </>
  )
}

export default function Avatar({ hatColor, wearing, wearingGlasses, motionRequest, onMotionStatus, onSelect }: {
  hatColor: string
  wearing: boolean
  wearingGlasses: boolean
  motionRequest: MotionRequest | null
  onMotionStatus: (message: string) => void
  onSelect: (item: ShelfItem) => void
}) {
  return (
    <Canvas camera={{ position: [0, 1.5, 3.4], fov: 28 }} shadows dpr={[1, 2]}>
      <Backdrop />
      <ambientLight intensity={1.5} />
      <directionalLight position={[-3, 5, 5]} intensity={2.5} castShadow />
      <directionalLight position={[4, 1, -3]} intensity={1.5} color="#ffc4a4" />
      <Suspense fallback={null}>
        <Character hatColor={hatColor} wearing={wearing} wearingGlasses={wearingGlasses} motionRequest={motionRequest} onMotionStatus={onMotionStatus} onSelect={onSelect} />
      </Suspense>
    </Canvas>
  )
}
