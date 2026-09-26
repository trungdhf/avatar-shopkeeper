import { Canvas, createPortal, useFrame, useLoader, useThree } from '@react-three/fiber'
import { VRMLoaderPlugin, type VRM } from '@pixiv/three-vrm'
import { createVRMAnimationClip, VRMAnimationLoaderPlugin, type VRMAnimation } from '@pixiv/three-vrm-animation'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { AnimationMixer, CanvasTexture, CylinderGeometry, DoubleSide, LoopOnce, RingGeometry, SRGBColorSpace, Vector3, type AnimationAction, type Group } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

function CowboyHat({ color }: { color: string }) {
  const patch = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 160
    const context = canvas.getContext('2d')
    if (context) {
      context.fillStyle = '#222733'
      context.fillRect(0, 0, 512, 160)
      context.strokeStyle = '#f5e4c8'
      context.lineWidth = 8
      context.strokeRect(8, 8, 496, 144)
      context.fillStyle = '#fff8eb'
      context.textAlign = 'center'
      context.font = '900 64px sans-serif'
      context.fillText('ETHGLOBAL', 256, 78)
      context.font = 'bold 40px sans-serif'
      context.fillText('TOKYO 2026', 256, 132)
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
        <mesh position={[0, 0.021, 0]}>
          <cylinderGeometry args={[0.1235, 0.1255, 0.034, 24, 1, true, -0.45, 0.9]} />
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

type MotionRequest = { files: File[]; id: number }

function Character({ hatColor, wearing, wearingGlasses, motionRequest, onMotionStatus }: {
  hatColor: string
  wearing: boolean
  wearingGlasses: boolean
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
  const queuedActions = useRef<AnimationAction[]>([])
  const motionEndTime = useRef<number | null>(null)

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
        selectedActive.current = true
        onMotionStatus(actions.length > 1
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
      const next = queuedActions.current.shift()
      if (next) {
        next.reset().play().crossFadeFrom(selectedAction.current, 0.4, false)
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
      {head && wearing && createPortal(<CowboyHat color={hatColor} />, head)}
      {head && wearingGlasses && createPortal(<Sunglasses />, head)}
    </group>
  )
}

export default function Avatar({ hatColor, wearing, wearingGlasses, motionRequest, onMotionStatus }: {
  hatColor: string
  wearing: boolean
  wearingGlasses: boolean
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
        <Character hatColor={hatColor} wearing={wearing} wearingGlasses={wearingGlasses} motionRequest={motionRequest} onMotionStatus={onMotionStatus} />
      </Suspense>
    </Canvas>
  )
}
