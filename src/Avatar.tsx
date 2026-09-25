import { Canvas, createPortal, useFrame, useLoader, useThree } from '@react-three/fiber'
import { VRMLoaderPlugin, type VRM } from '@pixiv/three-vrm'
import { Suspense, useLayoutEffect, useRef } from 'react'
import { DoubleSide, Vector3, type Group } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

function Cap({ color }: { color: string }) {
  return (
    <group position={[0, 0.1, 0.005]}>
      <mesh castShadow>
        <sphereGeometry args={[0.105, 36, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} roughness={0.7} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.09]} rotation={[0.18, 0, 0]} scale={[0.12, 0.009, 0.07]} castShadow>
        <sphereGeometry args={[1, 28, 16]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.07, 0.085]}>
        <sphereGeometry args={[0.015, 16, 12]} />
        <meshStandardMaterial color="#fff7e6" />
      </mesh>
    </group>
  )
}

function Character({ hatColor, wearing }: { hatColor: string; wearing: boolean }) {
  const character = useRef<Group>(null)
  const camera = useThree(({ camera }) => camera)
  const gltf = useLoader(GLTFLoader, '/avatars/real2.vrm', (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser))
  })
  const vrm = gltf.userData.vrm as VRM
  const head = vrm.humanoid.getNormalizedBoneNode('head')

  useLayoutEffect(() => {
    if (!head) return
    vrm.scene.updateMatrixWorld(true)
    const headY = head.getWorldPosition(new Vector3()).y
    camera.position.set(0, headY - 0.35, 3.4)
    camera.lookAt(0, headY - 0.4, 0)
  }, [camera, head, vrm])

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
    <Canvas camera={{ position: [0, 1.5, 3.4], fov: 28 }} shadows dpr={[1, 2]}>
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
