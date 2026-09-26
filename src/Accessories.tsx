import { useEffect, useMemo } from 'react'
import { CanvasTexture, DoubleSide, SRGBColorSpace } from 'three'

// Extra try-on styles. Each one is authored around the head bone with the same
// offsets CowboyHat and Sunglasses use, so the identical component works both
// on the avatar and standing on a shelf.
// These are previews only: the deployed contract sells one hat and one pair of
// shades, so nothing here adds a purchasable item.

export function Beanie({ color }: { color: string }) {
  return (
    <group position={[0, 0.086, 0.004]} scale={0.92}>
      <mesh position={[0, 0.014, 0]} castShadow>
        <sphereGeometry args={[0.107, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <meshStandardMaterial color={color} roughness={1} side={DoubleSide} />
      </mesh>
      <mesh position={[0, -0.008, 0]}>
        <cylinderGeometry args={[0.111, 0.114, 0.036, 40, 1, true]} />
        <meshStandardMaterial color={color} roughness={1} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0.086, 0]}>
        <sphereGeometry args={[0.019, 16, 12]} />
        <meshStandardMaterial color="#fff2e2" roughness={1} />
      </mesh>
    </group>
  )
}

export function Cap({ color }: { color: string }) {
  return (
    <group position={[0, 0.082, 0.004]} scale={0.92}>
      <mesh position={[0, 0.004, 0]} castShadow>
        <sphereGeometry args={[0.112, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.56]} />
        <meshStandardMaterial color={color} roughness={0.8} side={DoubleSide} />
      </mesh>
      {/* A thin disc segment facing front makes the peak; theta 0 is +Z. */}
      <mesh position={[0, -0.002, 0.012]} rotation={[-0.26, 0, 0]} scale={[1, 1, 0.92]}>
        <cylinderGeometry args={[0.104, 0.104, 0.007, 32, 1, false, -0.92, 1.84]} />
        <meshStandardMaterial color={color} roughness={0.8} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0.094, 0]}>
        <sphereGeometry args={[0.009, 12, 8]} />
        <meshStandardMaterial color="#292d38" roughness={0.7} />
      </mesh>
    </group>
  )
}

export function BucketHat({ color }: { color: string }) {
  return (
    <group position={[0, 0.084, 0.004]} scale={0.92}>
      <mesh position={[0, 0.032, 0]} castShadow>
        <cylinderGeometry args={[0.103, 0.112, 0.086, 36, 1, false]} />
        <meshStandardMaterial color={color} roughness={0.95} side={DoubleSide} />
      </mesh>
      {/* Cone apex up, wide base down: a brim that flares towards the shoulders. */}
      <mesh position={[0, -0.016, 0]} castShadow>
        <coneGeometry args={[0.163, 0.056, 40, 1, true]} />
        <meshStandardMaterial color={color} roughness={0.95} side={DoubleSide} />
      </mesh>
    </group>
  )
}

export function RoundGlasses() {
  return (
    <group position={[0, 0.054, 0.113]}>
      {[-0.031, 0.031].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh>
            <torusGeometry args={[0.02, 0.0016, 8, 36]} />
            <meshStandardMaterial color="#c9a253" roughness={0.25} metalness={0.85} />
          </mesh>
          <mesh>
            <circleGeometry args={[0.02, 32]} />
            <meshStandardMaterial color="#f2f6f8" roughness={0.05} transparent opacity={0.3} side={DoubleSide} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.004, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0015, 0.0015, 0.022, 8]} />
        <meshStandardMaterial color="#c9a253" roughness={0.25} metalness={0.85} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.06, 0.003, -0.046]} rotation={[0, side * -0.12, 0]}>
          <boxGeometry args={[0.0022, 0.0028, 0.096]} />
          <meshStandardMaterial color="#c9a253" roughness={0.25} metalness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

export function Visor() {
  return (
    <group position={[0, 0.053, 0.014]}>
      <mesh scale={[1, 1, 0.78]}>
        <cylinderGeometry args={[0.089, 0.089, 0.038, 40, 1, true, -1.02, 2.04]} />
        <meshStandardMaterial color="#2b3040" roughness={0.2} metalness={0.5} transparent opacity={0.84} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0.021, 0]} scale={[1, 1, 0.78]}>
        <cylinderGeometry args={[0.09, 0.09, 0.007, 40, 1, true, -1.02, 2.04]} />
        <meshStandardMaterial color="#e6826c" roughness={0.6} side={DoubleSide} />
      </mesh>
    </group>
  )
}

// Hanging tee for the clothing rail. Clicking one dresses the avatar in the
// matching Garment below.
export function Tee({ color }: { color: string }) {
  const badge = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 128
    const context = canvas.getContext('2d')
    if (context) {
      context.fillStyle = 'rgba(255,246,234,0.92)'
      context.textAlign = 'center'
      context.font = '900 46px sans-serif'
      context.fillText('TOKYO', 128, 58)
      context.font = 'bold 34px sans-serif'
      context.fillText('2026', 128, 100)
    }
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    return texture
  }, [])

  useEffect(() => () => badge.dispose(), [badge])

  return (
    <group>
      <mesh position={[0, -0.12, 0]} castShadow>
        <boxGeometry args={[0.2, 0.25, 0.03]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.14, -0.04, 0]} rotation={[0, 0, side * -0.5]}>
          <boxGeometry args={[0.1, 0.07, 0.028]} />
          <meshStandardMaterial color={color} roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[0, -0.1, 0.017]}>
        <planeGeometry args={[0.12, 0.06]} />
        <meshBasicMaterial map={badge} transparent toneMapped={false} />
      </mesh>
      {/* Hanger */}
      <mesh position={[0, 0.005, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.19, 0.006, 0.006]} />
        <meshStandardMaterial color="#a98e73" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.042, 0]}>
        <torusGeometry args={[0.018, 0.0025, 8, 20, Math.PI]} />
        <meshStandardMaterial color="#a98e73" roughness={0.7} />
      </mesh>
    </group>
  )
}

// A tee worn over the avatar's own outfit, parented to the chest bone. Measured
// to clear what is already there: the existing clothing reaches |x| 0.140 and
// z 0.139 around the waist, so the shell sits just outside both.
// It is not skinned, so heavy arm motion can clip it, the same trade the hat makes.
export const garment = {
  y: 0, z: -0.026, radiusTop: 0.176, radiusBottom: 0.158, height: 0.4, depth: 0.87,
  printRadius: 0.183, printY: 0.035, printHeight: 0.086, printArc: 1.55,
}

export function Garment({ color, print, text }: { color: string; print: string; text: string }) {
  const label = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.height = 320
    canvas.width = Math.round(320 * (garment.printRadius * garment.printArc) / garment.printHeight)
    const context = canvas.getContext('2d')
    if (context) {
      const [first, ...rest] = text.split(' ')
      context.textAlign = 'center'
      context.lineJoin = 'round'
      const draw = (line: string, wanted: number, y: number) => {
        let size = wanted
        context.font = `900 ${size}px sans-serif`
        while (size > 10 && context.measureText(line).width > canvas.width * 0.86) {
          size -= 2
          context.font = `900 ${size}px sans-serif`
        }
        context.fillStyle = print
        context.fillText(line, canvas.width / 2, y)
      }
      draw(first, 130, 150)
      if (rest.length > 0) draw(rest.join(' '), 84, 256)
    }
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    return texture
  }, [print, text])

  useEffect(() => () => label.dispose(), [label])

  return (
    <group position={[0, garment.y, garment.z]}>
      <mesh scale={[1, 1, garment.depth]} castShadow>
        <cylinderGeometry args={[garment.radiusTop, garment.radiusBottom, garment.height, 40, 1, true]} />
        <meshStandardMaterial color={color} roughness={0.95} side={DoubleSide} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 0.152, garment.height / 2 - 0.055, 0]}
          rotation={[0, 0, side * -0.38]}
          scale={[1, 1, garment.depth]}
        >
          <cylinderGeometry args={[0.064, 0.056, 0.105, 24, 1, true]} />
          <meshStandardMaterial color={color} roughness={0.95} side={DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, garment.printY, 0]} scale={[1, 1, garment.depth]}>
        <cylinderGeometry
          args={[garment.printRadius, garment.printRadius, garment.printHeight, 32, 1, true,
            -garment.printArc / 2, garment.printArc]}
        />
        <meshBasicMaterial map={label} transparent toneMapped={false} />
      </mesh>
    </group>
  )
}
