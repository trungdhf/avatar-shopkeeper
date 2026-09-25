import { Canvas, createPortal, useFrame, useLoader, useThree } from '@react-three/fiber'
import { VRMLoaderPlugin, type VRM } from '@pixiv/three-vrm'
import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import { DoubleSide, Vector3, type Group } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

function Cap({ color }: { color: string }) {
  return (
    <group position={[0, 0.1, 0.005]}>
      <mesh position={[0, 0, 0.025]} scale={[1.08, 1.05, 1.55]} castShadow>
        <sphereGeometry args={[0.105, 36, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} roughness={0.7} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.14]} rotation={[0.18, 0, 0]} scale={[0.12, 0.009, 0.08]} castShadow>
        <sphereGeometry args={[1, 28, 16]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.07, 0.145]}>
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
  const pose = useMemo(() => {
    const head = vrm.humanoid.getNormalizedBoneNode('head')
    const leftArm = vrm.humanoid.getNormalizedBoneNode('leftUpperArm')
    const rightArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm')
    const rightForearm = vrm.humanoid.getNormalizedBoneNode('rightLowerArm')
    const rightHand = vrm.humanoid.getNormalizedBoneNode('rightHand')
    return {
      head,
      headRest: head?.rotation.clone(),
      leftArm,
      leftArmRest: leftArm?.rotation.clone(),
      rightArm,
      rightArmRest: rightArm?.rotation.clone(),
      rightForearm,
      rightForearmRest: rightForearm?.rotation.clone(),
      rightHand,
      rightHandRest: rightHand?.rotation.clone(),
    }
  }, [vrm])

  useLayoutEffect(() => {
    if (!pose.head) return
    vrm.scene.updateMatrixWorld(true)
    const headY = pose.head.getWorldPosition(new Vector3()).y
    camera.position.set(0, headY - 0.35, 3.4)
    camera.lookAt(0, headY - 0.4, 0)
  }, [camera, pose, vrm])

  useFrame(({ clock, pointer }, delta) => {
    if (character.current) {
      character.current.rotation.y += (pointer.x * 0.16 - character.current.rotation.y) * 0.035
    }
    const time = clock.elapsedTime
    const greeting = time % 9
    const inProgress = Math.min(1, greeting / 0.55)
    const outProgress = Math.min(1, Math.max(0, (3.2 - greeting) / 0.55))
    const wave = inProgress * inProgress * (3 - 2 * inProgress) * outProgress * outProgress * (3 - 2 * outProgress)

    if (pose.head && pose.headRest) {
      pose.head.rotation.x = pose.headRest.x + Math.sin(time * 1.1) * 0.025
      pose.head.rotation.y = pose.headRest.y + Math.sin(time * 0.8) * 0.045
      pose.head.rotation.z = pose.headRest.z + Math.sin(time * 1.3) * 0.085
    }
    if (pose.leftArm && pose.leftArmRest) {
      pose.leftArm.rotation.z = pose.leftArmRest.z - 1.2
    }
    if (pose.rightArm && pose.rightArmRest) {
      pose.rightArm.rotation.z = pose.rightArmRest.z + 1.2 - wave * 2.1
    }
    if (pose.rightForearm && pose.rightForearmRest) {
      pose.rightForearm.rotation.z = pose.rightForearmRest.z - wave * 1.05
    }
    if (pose.rightHand && pose.rightHandRest) {
      pose.rightHand.rotation.z = pose.rightHandRest.z + wave * (0.18 + Math.sin(time * 13) * 0.27)
    }
    const blinkTime = (time + 3) % 4.2
    const blink = blinkTime < 0.12 ? blinkTime / 0.12 : blinkTime < 0.2 ? 1 : Math.max(0, 1 - (blinkTime - 0.2) / 0.15)
    vrm.expressionManager?.setValue('blink', blink)
    vrm.update(delta)
  })

  return (
    <group ref={character}>
      <primitive object={vrm.scene} />
      {pose.head && wearing && createPortal(<Cap color={hatColor} />, pose.head)}
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
