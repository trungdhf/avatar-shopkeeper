import { Canvas, createPortal, useFrame, useLoader, useThree } from '@react-three/fiber'
import { VRMLoaderPlugin, type VRM } from '@pixiv/three-vrm'
import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import { DoubleSide, Vector3, type Group } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

function NonLa({ color }: { color: string }) {
  return (
    <group position={[0, 0.1, 0.025]}>
      <mesh position={[0, 0.115, 0]} castShadow>
        <coneGeometry args={[0.19, 0.23, 48, 1, true]} />
        <meshStandardMaterial color="#e9d4a5" roughness={0.95} side={DoubleSide} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.19, 0.009, 8, 48]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.065, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.136, 0.004, 6, 48]} />
        <meshStandardMaterial color={color} roughness={0.8} />
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
      pose.rightArm.rotation.y = pose.rightArmRest.y + wave * 1.3
      pose.rightArm.rotation.z = pose.rightArmRest.z + 1.2 - wave * 0.75
    }
    if (pose.rightForearm && pose.rightForearmRest) {
      pose.rightForearm.rotation.z = pose.rightForearmRest.z - wave * 1.4
    }
    if (pose.rightHand && pose.rightHandRest) {
      pose.rightHand.rotation.x = pose.rightHandRest.x + wave * 0.15
      pose.rightHand.rotation.y = pose.rightHandRest.y + wave * (0.18 + Math.sin(time * 11) * 0.35)
      pose.rightHand.rotation.z = pose.rightHandRest.z + wave * 0.1
    }
    const blinkTime = (time + 3) % 4.2
    const blink = blinkTime < 0.12 ? blinkTime / 0.12 : blinkTime < 0.2 ? 1 : Math.max(0, 1 - (blinkTime - 0.2) / 0.15)
    vrm.expressionManager?.setValue('blink', blink)
    vrm.update(delta)
  })

  return (
    <group ref={character}>
      <primitive object={vrm.scene} />
      {pose.head && wearing && createPortal(<NonLa color={hatColor} />, pose.head)}
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
