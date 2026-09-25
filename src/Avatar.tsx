import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'

function Character({ hatColor, wearing }: { hatColor: string; wearing: boolean }) {
  const character = useRef<Group>(null)

  useFrame(({ clock, pointer }) => {
    if (!character.current) return
    character.current.rotation.y += (pointer.x * 0.16 - character.current.rotation.y) * 0.035
    character.current.position.y = Math.sin(clock.elapsedTime * 1.6) * 0.035
  })

  return (
    <group ref={character} position={[0, -0.2, 0]}>
      <mesh position={[0, -1.65, 0]} castShadow>
        <sphereGeometry args={[0.98, 32, 24]} />
        <meshStandardMaterial color="#ff715c" roughness={0.8} />
      </mesh>
      <mesh position={[0, -1.9, 0.82]} rotation={[0.14, 0, 0]}>
        <boxGeometry args={[0.65, 0.64, 0.05]} />
        <meshStandardMaterial color="#fff4d5" />
      </mesh>
      <mesh position={[-0.25, -1.91, 0.858]}>
        <sphereGeometry args={[0.075, 16, 12]} />
        <meshStandardMaterial color="#f5b370" />
      </mesh>
      <mesh position={[0.23, -1.91, 0.858]}>
        <sphereGeometry args={[0.075, 16, 12]} />
        <meshStandardMaterial color="#f5b370" />
      </mesh>
      <mesh position={[-0.94, -1.5, 0]} rotation={[0, 0, -0.45]} castShadow>
        <capsuleGeometry args={[0.22, 0.68, 8, 16]} />
        <meshStandardMaterial color="#f4b783" />
      </mesh>
      <mesh position={[0.94, -1.5, 0]} rotation={[0, 0, 0.45]} castShadow>
        <capsuleGeometry args={[0.22, 0.68, 8, 16]} />
        <meshStandardMaterial color="#f4b783" />
      </mesh>
      <mesh position={[-0.44, -2.59, 0]}>
        <capsuleGeometry args={[0.23, 0.5, 8, 16]} />
        <meshStandardMaterial color="#526b88" />
      </mesh>
      <mesh position={[0.44, -2.59, 0]}>
        <capsuleGeometry args={[0.23, 0.5, 8, 16]} />
        <meshStandardMaterial color="#526b88" />
      </mesh>
      <mesh position={[0, 0, 0]} castShadow>
        <sphereGeometry args={[1.05, 48, 32]} />
        <meshStandardMaterial color="#f7bf91" roughness={0.85} />
      </mesh>
      <mesh position={[-0.43, 0.07, 0.91]}>
        <sphereGeometry args={[0.095, 20, 16]} />
        <meshStandardMaterial color="#30354b" />
      </mesh>
      <mesh position={[0.43, 0.07, 0.91]}>
        <sphereGeometry args={[0.095, 20, 16]} />
        <meshStandardMaterial color="#30354b" />
      </mesh>
      <mesh position={[-0.7, -0.33, 0.75]}>
        <sphereGeometry args={[0.15, 20, 16]} />
        <meshStandardMaterial color="#ee917d" transparent opacity={0.6} />
      </mesh>
      <mesh position={[0.7, -0.33, 0.75]}>
        <sphereGeometry args={[0.15, 20, 16]} />
        <meshStandardMaterial color="#ee917d" transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, -0.35, 0.945]} rotation={[0.12, 0, 0]}>
        <torusGeometry args={[0.15, 0.025, 10, 32, Math.PI]} />
        <meshStandardMaterial color="#aa605c" />
      </mesh>
      <mesh position={[-0.78, 0.68, -0.18]} rotation={[0, 0, -0.43]} castShadow>
        <sphereGeometry args={[0.45, 24, 16]} />
        <meshStandardMaterial color="#45405a" />
      </mesh>
      <mesh position={[0.78, 0.68, -0.18]} rotation={[0, 0, 0.43]} castShadow>
        <sphereGeometry args={[0.45, 24, 16]} />
        <meshStandardMaterial color="#45405a" />
      </mesh>
      {wearing && (
        <group position={[0, 0.94, 0.02]} rotation={[-0.11, 0, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.79, 36, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={hatColor} roughness={0.7} side={2} />
          </mesh>
          <mesh position={[0, 0.02, 0.59]} rotation={[0.18, 0, 0]} castShadow>
            <sphereGeometry args={[0.66, 0.055, 0.38, 28]} />
            <meshStandardMaterial color={hatColor} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.52, 0.57]}>
            <sphereGeometry args={[0.11, 16, 12]} />
            <meshStandardMaterial color="#fff7e6" />
          </mesh>
        </group>
      )}
    </group>
  )
}

export default function Avatar({ hatColor, wearing }: { hatColor: string; wearing: boolean }) {
  return (
    <Canvas camera={{ position: [0, 0, 7.1], fov: 42 }} shadows dpr={[1, 2]}>
      <color attach="background" args={['#efe9de']} />
      <ambientLight intensity={2.2} />
      <directionalLight position={[-3, 5, 5]} intensity={2.5} castShadow />
      <directionalLight position={[4, 1, -3]} intensity={1.5} color="#ffc4a4" />
      <Character hatColor={hatColor} wearing={wearing} />
    </Canvas>
  )
}
