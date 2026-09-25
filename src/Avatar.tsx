import { Canvas, createPortal, useFrame, useLoader, useThree } from '@react-three/fiber'
import { VRMLoaderPlugin, type VRM } from '@pixiv/three-vrm'
import { createVRMAnimationClip, VRMAnimationLoaderPlugin, type VRMAnimation } from '@pixiv/three-vrm-animation'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { AnimationMixer, CanvasTexture, DoubleSide, LoopOnce, SRGBColorSpace, Vector3, type AnimationAction, type Group } from 'three'
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
      <mesh position={[0, 0.068, 0.195]}>
        <planeGeometry args={[0.143, 0.064]} />
        <meshBasicMaterial map={patch} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0.102, 0.025]}>
        <sphereGeometry args={[0.012, 16, 12]} />
        <meshStandardMaterial color="#292d38" roughness={0.85} />
      </mesh>
    </group>
  )
}

type SpinRequest = { file: File; id: number }

function Character({ hatColor, wearing, spinRequest, onSpinStatus }: {
  hatColor: string
  wearing: boolean
  spinRequest: SpinRequest | null
  onSpinStatus: (message: string) => void
}) {
  const character = useRef<Group>(null)
  const camera = useThree(({ camera }) => camera)
  const gltf = useLoader(GLTFLoader, '/avatars/real2.vrm', (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser))
  })
  const [idleGltf, greetingGltf] = useLoader(GLTFLoader, ['/anims/Relax.vrma', '/anims/Goodbye.vrma'], (loader) => {
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser))
  })
  const vrm = gltf.userData.vrm as VRM
  const head = useMemo(() => vrm.humanoid.getNormalizedBoneNode('head'), [vrm])
  const motion = useMemo(() => {
    const idleAnimation = (idleGltf.userData.vrmAnimations as VRMAnimation[])[0]
    const greetingAnimation = (greetingGltf.userData.vrmAnimations as VRMAnimation[])[0]
    const mixer = new AnimationMixer(vrm.scene)
    const idle = mixer.clipAction(createVRMAnimationClip(idleAnimation, vrm))
    const greeting = mixer.clipAction(createVRMAnimationClip(greetingAnimation, vrm))
    greeting.setLoop(LoopOnce, 1)
    greeting.clampWhenFinished = true
    return { mixer, idle, greeting }
  }, [vrm, idleGltf, greetingGltf])
  const greetingCycle = useRef(-1)
  const returningToIdle = useRef(false)
  const spinAction = useRef<AnimationAction | null>(null)
  const spinActive = useRef(false)

  useEffect(() => {
    motion.idle.play()
    return () => {
      motion.mixer.stopAllAction()
      motion.mixer.uncacheRoot(vrm.scene)
    }
  }, [motion, vrm])

  useEffect(() => {
    if (!spinRequest) return
    let active = true
    let clip: ReturnType<typeof createVRMAnimationClip> | undefined
    onSpinStatus('Loading your VRoid motion…')
    const loader = new GLTFLoader()
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser))
    void spinRequest.file.arrayBuffer()
      .then((buffer) => loader.parseAsync(buffer, ''))
      .then((animationGltf) => {
        if (!active) return
        const animation = (animationGltf.userData.vrmAnimations as VRMAnimation[] | undefined)?.[0]
        if (!animation) throw new Error('This file does not contain a VRM animation.')
        clip = createVRMAnimationClip(animation, vrm)
        const action = motion.mixer.clipAction(clip)
        action.setLoop(LoopOnce, 1)
        action.clampWhenFinished = true
        motion.greeting.stop()
        action.reset().play().crossFadeFrom(motion.idle, 0.4, false)
        spinAction.current = action
        spinActive.current = true
        onSpinStatus('Playing your local motion. The file stays in your browser.')
      })
      .catch((error: unknown) => {
        if (active) onSpinStatus(error instanceof Error ? `Could not play motion: ${error.message}` : 'Could not play this motion.')
      })
    return () => {
      active = false
      spinActive.current = false
      spinAction.current?.stop()
      spinAction.current = null
      if (clip) motion.mixer.uncacheAction(clip, vrm.scene)
      motion.idle.reset().play()
    }
  }, [spinRequest, motion, vrm, onSpinStatus])

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
    const cycle = Math.floor(time / 9)
    if (spinActive.current && spinAction.current) {
      greetingCycle.current = cycle
      if (spinAction.current.time >= spinAction.current.getClip().duration - 0.4) {
        motion.idle.reset().play().crossFadeFrom(spinAction.current, 0.4, false)
        spinActive.current = false
      }
    } else {
      if (cycle !== greetingCycle.current) {
        motion.greeting.reset().play().crossFadeFrom(motion.idle, 0.4, false)
        greetingCycle.current = cycle
        returningToIdle.current = false
      }
      if (!returningToIdle.current && motion.greeting.time >= motion.greeting.getClip().duration - 0.5) {
        motion.idle.reset().play().crossFadeFrom(motion.greeting, 0.4, false)
        returningToIdle.current = true
      }
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

export default function Avatar({ hatColor, wearing, spinRequest, onSpinStatus }: {
  hatColor: string
  wearing: boolean
  spinRequest: SpinRequest | null
  onSpinStatus: (message: string) => void
}) {
  return (
    <Canvas camera={{ position: [0, 1.5, 3.4], fov: 28 }} shadows dpr={[1, 2]}>
      <color attach="background" args={['#efe9de']} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[-3, 5, 5]} intensity={2.5} castShadow />
      <directionalLight position={[4, 1, -3]} intensity={1.5} color="#ffc4a4" />
      <Suspense fallback={null}>
        <Character hatColor={hatColor} wearing={wearing} spinRequest={spinRequest} onSpinStatus={onSpinStatus} />
      </Suspense>
    </Canvas>
  )
}
