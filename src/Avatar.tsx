import { Canvas, createPortal, useFrame, useLoader } from '@react-three/fiber'
import { VRMLoaderPlugin, type VRM } from '@pixiv/three-vrm'
import { Suspense, useRef } from 'react'
import { DoubleSide, type Group } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

function Cap({ color }: { color: string }) {
  return (
    <group position={[0, 0.19, 0.005]}>
      <mesh castShadow>
        <sphereGeometry args={[0.13, 36, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} roughness={0.7} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.12]} rotation={[0.18, 0, 0]} scale={[0.15, 0.012, 0.09]} castShadow>
        <sphereGeometry args={[1, 28, 16]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.085, 0.1]}>
        <sphereGeometry args={[0.02, 16, 12]} />
        <meshStandardMaterial color="#fff7e6" />
      </mesh>
    </group>
  )
}

function Character({ hatColor, wearing }: { hatColor: string; wearing: boolean }) {
  const character = useRef<Group>(null)
  const gltf = useLoader(GLTFLoader, '/avatars/real2.vrm', (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser))
  })
  const vrm = gltf.userData.vrm as VRM
  const head = vrm.humanoid.getNormalizedBoneNode('head')

  useFrame(({ pointer }, delta) => {
    if (character.current) {
      character.current.rotation.y += (pointer.x * 0.16 - character.current.rotation.y) * 0.035
    }
    vrm.update(delta)
  })

  return (
    <group ref={character}>
      <primitive object={vrm.scene} />
      {head && wearing && createPortal(<Cap color={hatColor} />, head)}
    </group>
  )
}

export default function Avatar({ hatColor, wearing }: { hatColor: string; wearing: boolean }) {
  return (
    <Canvas camera={{ position: [0, 1, 4.3], fov: 28 }} shadows dpr={[1, 2]}>
      <color attach="background" args={['#efe9de']} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[-3, 5, 5]} intensity={2.5} castShadow />
      <directionalLight position={[4, 1, -3]} intensity={1.5} color="#ffc4a4" />
      <Suspense fallback={null}>
        <Character hatColor={hatColor} wearing={wearing} />
      </Suspense>
    </Canvas>
  )
}
