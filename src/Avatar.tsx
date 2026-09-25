import { Canvas, createPortal, useFrame, useLoader, useThree } from '@react-three/fiber'
import { VRMLoaderPlugin, type VRM } from '@pixiv/three-vrm'
import { createVRMAnimationClip, VRMAnimationLoaderPlugin, type VRMAnimation } from '@pixiv/three-vrm-animation'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { AnimationMixer, CanvasTexture, DoubleSide, LoopOnce, PlaneGeometry, SRGBColorSpace, Vector3, type AnimationAction, type Group } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

function HipHopCap({ color }: { color: string }) {
  const patch = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const context = canvas.getContext('2d')
    if (context) {
      context.fillStyle = '#222733'
      context.fillRect(0, 0, 512, 256)
      context.strokeStyle = '#f5e4c8'
      context.lineWidth = 12
      context.strokeRect(12, 12, 488, 232)
      context.fillStyle = '#fff8eb'
      context.textAlign = 'center'
      context.font = '900 70px sans-serif'
      context.fillText('ETHGLOBAL', 256, 120)
      context.font = 'bold 45px sans-serif'
      context.fillText('TOKYO 2026', 256, 186)
    }
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    return texture
  }, [])

  useEffect(() => () => patch.dispose(), [patch])
  const patchSurface = useMemo(() => {
    const geometry = new PlaneGeometry(0.13, 0.054, 16, 8)
    const positions = geometry.attributes.position
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i)
      const y = positions.getY(i) + 0.063
      const dome = Math.max(0, 1 - (x / 0.1134) ** 2 - (y / 0.11025) ** 2)
      positions.setZ(i, 0.025 + 0.16275 * Math.sqrt(dome) + 0.004)
    }
    geometry.computeVertexNormals()
    return geometry
  }, [])

  useEffect(() => () => patchSurface.dispose(), [patchSurface])

  return (
    <group position={[0, 0.1, 0.005]}>
      <mesh position={[0, 0, 0.025]} scale={[1.08, 1.05, 1.55]} castShadow>
        <sphereGeometry args={[0.105, 36, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} roughness={0.8} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.025]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.45, 1]}>
        <torusGeometry args={[0.112, 0.006, 8, 48]} />
        <meshStandardMaterial color="#292d38" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.001, 0.165]} rotation={[0.15, 0, 0]} scale={[0.125, 0.008, 0.087]} castShadow>
        <sphereGeometry args={[1, 32, 16]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.063, 0]}>
        <primitive object={patchSurface} attach="geometry" />
        <meshBasicMaterial map={patch} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0.102, 0.025]}>
        <sphereGeometry args={[0.012, 16, 12]} />
        <meshStandardMaterial color="#292d38" roughness={0.85} />
      </mesh>
    </group>
  )
}

type MotionRequest = { file: File; id: number }

function Character({ hatColor, wearing, motionRequest, onMotionStatus }: {
  hatColor: string
  wearing: boolean
  motionRequest: MotionRequest | null
  onMotionStatus: (message: string) => void
}) {
  const character = useRef<Group>(null)
  const camera = useThree(({ camera }) => camera)
  const size = useThree(({ size }) => size)
  const gltf = useLoader(GLTFLoader, '/avatars/real2.vrm', (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser))
  })
  const idleGltf = useLoader(GLTFLoader, '/anims/LookAround.vrma', (loader) => {
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser))
  })
  const vrm = gltf.userData.vrm as VRM
  const head = useMemo(() => vrm.humanoid.getNormalizedBoneNode('head'), [vrm])
  const motion = useMemo(() => {
    const idleAnimation = (idleGltf.userData.vrmAnimations as VRMAnimation[])[0]
    const mixer = new AnimationMixer(vrm.scene)
    const idle = mixer.clipAction(createVRMAnimationClip(idleAnimation, vrm))
    return { mixer, idle }
  }, [vrm, idleGltf])
  const selectedAction = useRef<AnimationAction | null>(null)
  const selectedActive = useRef(false)

  useEffect(() => {
    motion.idle.play()
    return () => {
      motion.mixer.stopAllAction()
      motion.mixer.uncacheRoot(vrm.scene)
    }
  }, [motion, vrm])

  useEffect(() => {
    if (!motionRequest) return
    let active = true
    let clip: ReturnType<typeof createVRMAnimationClip> | undefined
    onMotionStatus('Loading your VRoid motion…')
    const loader = new GLTFLoader()
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser))
    void motionRequest.file.arrayBuffer()
      .then((buffer) => loader.parseAsync(buffer, ''))
      .then((animationGltf) => {
        if (!active) return
        const animation = (animationGltf.userData.vrmAnimations as VRMAnimation[] | undefined)?.[0]
        if (!animation) throw new Error('This file does not contain a VRM animation.')
        clip = createVRMAnimationClip(animation, vrm)
        const action = motion.mixer.clipAction(clip)
        action.setLoop(LoopOnce, 1)
        action.clampWhenFinished = true
        action.reset().play().crossFadeFrom(motion.idle, 0.4, false)
        selectedAction.current = action
        selectedActive.current = true
        onMotionStatus('Playing your local motion. The file stays in your browser.')
      })
      .catch((error: unknown) => {
        if (active) onMotionStatus(error instanceof Error ? `Could not play motion: ${error.message}` : 'Could not play this motion.')
      })
    return () => {
      active = false
      selectedActive.current = false
      selectedAction.current?.stop()
      selectedAction.current = null
      if (clip) motion.mixer.uncacheAction(clip, vrm.scene)
      motion.idle.reset().play()
    }
  }, [motionRequest, motion, vrm, onMotionStatus])

  useLayoutEffect(() => {
    if (!head) return
    vrm.scene.updateMatrixWorld(true)
    const headY = head.getWorldPosition(new Vector3()).y
    camera.position.set(0, headY - 0.35, 3.4)
    camera.lookAt(0, headY - 0.4, 0)
  }, [camera, head, vrm])

  useFrame(({ clock, pointer }, delta) => {
    if (character.current) {
      character.current.rotation.y += (pointer.x * 0.16 - character.current.rotation.y) * 0.035
    }
    const time = clock.elapsedTime
    if (selectedActive.current && selectedAction.current &&
      selectedAction.current.time >= selectedAction.current.getClip().duration - 0.4) {
      motion.idle.reset().play().crossFadeFrom(selectedAction.current, 0.4, false)
      selectedActive.current = false
      onMotionStatus('Motion played locally. Choose another file to replay.')
    }
    const fullBodyDistance = 1.5 / (Math.tan(14 * Math.PI / 180) * (size.width / size.height))
    const targetDistance = selectedActive.current ? Math.max(5.6, fullBodyDistance) : 3.4
    if (selectedActive.current && camera.position.z < targetDistance) {
      camera.position.z = targetDistance
    } else {
      camera.position.z += (targetDistance - camera.position.z) * Math.min(1, delta * 4)
    }
    motion.mixer.update(delta)
    const blinkTime = (time + 3) % 4.2
    const blink = blinkTime < 0.12 ? blinkTime / 0.12 : blinkTime < 0.2 ? 1 : Math.max(0, 1 - (blinkTime - 0.2) / 0.15)
    vrm.expressionManager?.setValue('blink', blink)
    vrm.update(delta)
  })

  return (
    <group ref={character}>
      <primitive object={vrm.scene} />
      {head && wearing && createPortal(<HipHopCap color={hatColor} />, head)}
    </group>
  )
}

export default function Avatar({ hatColor, wearing, motionRequest, onMotionStatus }: {
  hatColor: string
  wearing: boolean
  motionRequest: MotionRequest | null
  onMotionStatus: (message: string) => void
}) {
  return (
    <Canvas camera={{ position: [0, 1.5, 3.4], fov: 28 }} shadows dpr={[1, 2]}>
      <color attach="background" args={['#efe9de']} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[-3, 5, 5]} intensity={2.5} castShadow />
      <directionalLight position={[4, 1, -3]} intensity={1.5} color="#ffc4a4" />
      <Suspense fallback={null}>
        <Character hatColor={hatColor} wearing={wearing} motionRequest={motionRequest} onMotionStatus={onMotionStatus} />
      </Suspense>
    </Canvas>
  )
}
