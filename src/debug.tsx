import { useEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import Avatar, { badge, face, hands, say, shirt, showcase, showcaseYaw, speech, stage, stance } from './Avatar'
import './debug.css'

type Knob = {
  label: string
  min: number
  max: number
  step: number
  get: () => number
  set: (value: number) => void
  remount?: boolean
}

const trim = (value: number) => Number(value.toFixed(4))
const deg = (rad: number) => `${(rad * 180 / Math.PI).toFixed(1)} deg`
const toDeg = (rad: number) => rad * 180 / Math.PI
const toRad = (degrees: number) => degrees * Math.PI / 180

// Names and hip-yaw figures measured from the VRoid seven-motion pack:
// amplitude of the turn, then its peak angular speed.
const motionNotes: Record<string, { name: string; amplitude: number; peak: number }> = {
  VRMA_01: { name: 'Show full body', amplitude: 418, peak: 233 },
  VRMA_02: { name: 'Greeting', amplitude: 19, peak: 57 },
  VRMA_03: { name: 'Peace sign', amplitude: 25, peak: 45 },
  VRMA_04: { name: 'Shoot', amplitude: 38, peak: 54 },
  VRMA_05: { name: 'Spin', amplitude: 408, peak: 473 },
  VRMA_06: { name: 'Model pose', amplitude: 36, peak: 66 },
  VRMA_07: { name: 'Squat', amplitude: 8, peak: 42 },
}

// Keep the sweep symmetric: outer angle, inner angle, then mirror back down.
// Every step is then the same size, which is what holds the speed constant.
function setPoses(outer: number, inner: number) {
  showcase.poses.splice(0, showcase.poses.length, outer, inner, -inner, -outer, -inner, inner)
}

// smoothstep peaks at 1.5x its average rate, so one step of stepDelta radians
// over travel seconds tops out here. Inverting it turns speed into a duration.
const stepDelta = () => Math.abs(showcase.poses[0] - showcase.poses[1])
const peakFromTravel = () => (stepDelta() > 0 ? 1.5 * stepDelta() / showcase.travel : 0)
const travelFromPeak = (peakRad: number) => 1.5 * stepDelta() / peakRad

function metrics() {
  const cycle = showcase.poses.length * (showcase.hold + showcase.travel)
  let peak = 0
  let previous = showcaseYaw(0)
  for (let t = 1 / 60; t <= cycle; t += 1 / 60) {
    const value = showcaseYaw(t)
    peak = Math.max(peak, Math.abs(value - previous) * 60)
    previous = value
  }
  return { cycle, peak, squaresUp: showcase.poses.some((pose) => pose === 0) }
}

function Slider({ knob, onChange }: { knob: Knob; onChange: (remount: boolean) => void }) {
  return (
    <div className="knob">
      <div className="knob-top">
        <span>{knob.label}</span>
        <span>{trim(knob.get())}</span>
      </div>
      <input
        type="range"
        min={knob.min}
        max={knob.max}
        step={knob.step}
        value={knob.get()}
        onChange={(event) => {
          knob.set(Number(event.target.value))
          onChange(knob.remount === true)
        }}
      />
    </div>
  )
}

const colors = [
  { name: 'Sakura', hex: '#e89281' },
  { name: 'Midnight', hex: '#607a9c' },
  { name: 'Honey', hex: '#deb261' },
]

function Debug() {
  const [, bump] = useState(0)
  const [generation, setGeneration] = useState(0)
  const [hatColor, setHatColor] = useState(colors[0].hex)
  const [wearing, setWearing] = useState(true)
  const [wearingGlasses, setWearingGlasses] = useState(false)
  const [motionRequest, setMotionRequest] = useState<{ files: File[]; id: number; loop?: boolean } | null>(null)
  const [status, setStatus] = useState('Idle clip playing.')
  const motionId = useRef(0)
  const [outer, setOuter] = useState(showcase.poses[0])
  const [inner, setInner] = useState(showcase.poses[1])
  const [library, setLibrary] = useState<{ dir: string; files: string[] }>({ dir: '', files: [] })
  const [picked, setPicked] = useState<string[]>([])
  const [loop, setLoop] = useState(true)
  const [line, setLine] = useState(speech.line)

  useEffect(() => {
    void fetch('/dev-motions.json')
      .then((response) => response.json() as Promise<{ dir: string; files: string[] }>)
      .then(setLibrary)
      .catch(() => setLibrary({ dir: 'unreachable', files: [] }))
  }, [])

  const redraw = (remount: boolean) => {
    bump((value) => value + 1)
    if (remount) setGeneration((value) => value + 1)
  }

  const play = async (names: string[], looping = loop) => {
    if (names.length === 0) return
    setStatus(`Fetching ${names.length} motion file(s)...`)
    try {
      const files = await Promise.all([...names].sort().map(async (name) => {
        const response = await fetch(`/dev-motions/${encodeURIComponent(name)}`)
        if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`)
        return new File([await response.blob()], name, { type: 'model/gltf-binary' })
      }))
      motionId.current += 1
      setMotionRequest({ files, id: motionId.current, loop: looping })
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load those motions.')
    }
  }

  const groups: { title: string; knobs: Knob[] }[] = useMemo(() => [
    {
      title: 'Face',
      knobs: [
        { label: 'smile', min: 0, max: 1, step: 0.01, get: () => face.smile, set: (v) => { face.smile = v } },
        { label: 'smileSway', min: 0, max: 0.3, step: 0.01, get: () => face.smileSway, set: (v) => { face.smileSway = v } },
        { label: 'softness (relaxed)', min: 0, max: 1, step: 0.01, get: () => face.softness, set: (v) => { face.softness = v } },
        { label: 'headTurn', min: 0, max: 0.8, step: 0.01, get: () => face.headTurn, set: (v) => { face.headTurn = v } },
        { label: 'headLean', min: 0, max: 0.3, step: 0.01, get: () => face.headLean, set: (v) => { face.headLean = v } },
      ],
    },
    {
      title: 'Showcase turn',
      knobs: [
        { label: 'hold (s)', min: 0.2, max: 8, step: 0.1, get: () => showcase.hold, set: (v) => { showcase.hold = v } },
        { label: 'travel (s)', min: 0.3, max: 12, step: 0.1, get: () => showcase.travel, set: (v) => { showcase.travel = v } },
        { label: 'headHold (counter-rotate)', min: 0, max: 1, step: 0.05, get: () => showcase.headHold, set: (v) => { showcase.headHold = v } },
        { label: 'pointerNudge', min: 0, max: 0.4, step: 0.01, get: () => showcase.pointerNudge, set: (v) => { showcase.pointerNudge = v } },
      ],
    },
    {
      title: 'Stance and hands',
      knobs: [
        { label: 'stance.close', min: -0.1, max: 0.3, step: 0.005, get: () => stance.close, set: (v) => { stance.close = v } },
        { label: 'hands.straighten', min: 0, max: 1, step: 0.05, get: () => hands.straighten, set: (v) => { hands.straighten = v } },
      ],
    },
    {
      title: 'Speech',
      knobs: [
        { label: 'syllable (s)', min: 0.06, max: 0.4, step: 0.01, get: () => speech.syllable, set: (v) => { speech.syllable = v } },
        { label: 'consonant (s)', min: 0.02, max: 0.2, step: 0.01, get: () => speech.consonant, set: (v) => { speech.consonant = v } },
        { label: 'wordGap (s)', min: 0.02, max: 0.4, step: 0.01, get: () => speech.wordGap, set: (v) => { speech.wordGap = v } },
        { label: 'pause (s)', min: 0.05, max: 0.8, step: 0.05, get: () => speech.pause, set: (v) => { speech.pause = v } },
        { label: 'open (mouth weight)', min: 0.2, max: 1, step: 0.05, get: () => speech.open, set: (v) => { speech.open = v } },
        { label: 'blend (shape easing)', min: 4, max: 40, step: 1, get: () => speech.blend, set: (v) => { speech.blend = v } },
        { label: 'smileTalk', min: 0, max: 1, step: 0.05, get: () => speech.smileTalk, set: (v) => { speech.smileTalk = v } },
      ],
    },
    {
      title: 'Shirt print (remounts avatar)',
      knobs: [
        { label: 'shirt.y', min: -0.12, max: 0.08, step: 0.002, get: () => shirt.y, set: (v) => { shirt.y = v }, remount: true },
        { label: 'shirt.radius', min: 0.06, max: 0.2, step: 0.002, get: () => shirt.radius, set: (v) => { shirt.radius = v }, remount: true },
        { label: 'shirt.height', min: 0.02, max: 0.16, step: 0.002, get: () => shirt.height, set: (v) => { shirt.height = v }, remount: true },
        { label: 'shirt.arc (rad)', min: 0.4, max: 2.6, step: 0.05, get: () => shirt.arc, set: (v) => { shirt.arc = v }, remount: true },
      ],
    },
    {
      title: 'Stage and stand (remounts avatar)',
      knobs: [
        { label: 'cameraZ', min: 2.4, max: 9, step: 0.1, get: () => stage.cameraZ, set: (v) => { stage.cameraZ = v }, remount: true },
        { label: 'cameraY', min: -0.8, max: 0.5, step: 0.02, get: () => stage.cameraY, set: (v) => { stage.cameraY = v }, remount: true },
        { label: 'standX', min: -1.6, max: 1.6, step: 0.02, get: () => stage.standX, set: (v) => { stage.standX = v }, remount: true },
        { label: 'standY', min: -0.6, max: 0.8, step: 0.02, get: () => stage.standY, set: (v) => { stage.standY = v }, remount: true },
        { label: 'standZ', min: -3, max: 0.6, step: 0.02, get: () => stage.standZ, set: (v) => { stage.standZ = v }, remount: true },
        { label: 'standScale', min: 0.4, max: 2, step: 0.05, get: () => stage.standScale, set: (v) => { stage.standScale = v }, remount: true },
      ],
    },
    {
      title: 'Hat badge (remounts avatar)',
      knobs: [
        { label: 'badge.y', min: 0, max: 0.1, step: 0.002, get: () => badge.y, set: (v) => { badge.y = v }, remount: true },
        { label: 'badge.height', min: 0.01, max: 0.09, step: 0.002, get: () => badge.height, set: (v) => { badge.height = v }, remount: true },
        { label: 'badge.radiusTop', min: 0.09, max: 0.14, step: 0.001, get: () => badge.radiusTop, set: (v) => { badge.radiusTop = v }, remount: true },
        { label: 'badge.radiusBottom', min: 0.09, max: 0.14, step: 0.001, get: () => badge.radiusBottom, set: (v) => { badge.radiusBottom = v }, remount: true },
      ],
    },
  ], [])

  const { cycle, peak, squaresUp } = metrics()
  const speedDeg = toDeg(peakFromTravel())

  const source = [
    `const face = { smile: ${trim(face.smile)}, smileSway: ${trim(face.smileSway)}, softness: ${trim(face.softness)}, headTurn: ${trim(face.headTurn)}, headLean: ${trim(face.headLean)} }`,
    `const showcase = { poses: [${showcase.poses.map(trim).join(', ')}], hold: ${trim(showcase.hold)}, travel: ${trim(showcase.travel)}, headHold: ${trim(showcase.headHold)}, pointerNudge: ${trim(showcase.pointerNudge)} }`,
    `const stance = { close: ${trim(stance.close)} }`,
    `const hands = { straighten: ${trim(hands.straighten)} }`,
    `const badge = { y: ${trim(badge.y)}, height: ${trim(badge.height)}, radiusTop: ${trim(badge.radiusTop)}, radiusBottom: ${trim(badge.radiusBottom)} }`,
    `const shirt = { text: '${shirt.text}', y: ${trim(shirt.y)}, radius: ${trim(shirt.radius)}, height: ${trim(shirt.height)}, arc: ${trim(shirt.arc)} }`,
    `const stage = { standX: ${trim(stage.standX)}, standY: ${trim(stage.standY)}, standZ: ${trim(stage.standZ)}, standScale: ${trim(stage.standScale)}, cameraZ: ${trim(stage.cameraZ)}, cameraY: ${trim(stage.cameraY)} }`,
    `speech: syllable ${trim(speech.syllable)}, consonant ${trim(speech.consonant)}, wordGap ${trim(speech.wordGap)}, pause ${trim(speech.pause)}, open ${trim(speech.open)}, blend ${trim(speech.blend)}, smileTalk ${trim(speech.smileTalk)}`,
  ].join('\n')

  return (
    <div className="wrap">
      <div className="stage">
        <Avatar
          key={generation}
          hatColor={hatColor}
          wearing={wearing}
          wearingGlasses={wearingGlasses}
          motionRequest={motionRequest}
          onMotionStatus={setStatus}
          onSelect={(item) => setStatus(`Picked ${item.label}${item.sku ? ` (sku ${item.sku})` : ' (try-on only)'}`)}
        />
      </div>
      <div className="panel">
        <h1>Avatar motion debug</h1>
        <p className="hint">Dev-only page, absent from the production build. Sliders mutate the live module values, so they take effect on the next frame. Copy the block at the bottom into src/Avatar.tsx to keep them.</p>

        <fieldset>
          <legend>Stage</legend>
          <div className="row">
            <button onClick={() => setWearing((value) => !value)}>hat: {wearing ? 'on' : 'off'}</button>
            <button onClick={() => setWearingGlasses((value) => !value)}>shades: {wearingGlasses ? 'on' : 'off'}</button>
            <button onClick={() => setGeneration((value) => value + 1)}>remount</button>
          </div>
          <div className="swatches">
            {colors.map((color) => (
              <button
                key={color.hex}
                className="swatch"
                style={{ background: color.hex }}
                aria-pressed={hatColor === color.hex}
                title={color.name}
                onClick={() => setHatColor(color.hex)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Measured</legend>
          <dl className="metrics">
            <dt>peak turn</dt><dd>{deg(peak)}/s</dd>
            <dt>cycle</dt><dd>{cycle.toFixed(1)} s</dd>
            <dt>outer hold</dt><dd>{deg(Math.abs(outer))}</dd>
            <dt>inner hold</dt><dd>{deg(Math.abs(inner))}</dd>
            <dt>squares up</dt><dd>{squaresUp ? 'yes, holds at 0' : 'no'}</dd>
            <dt>stance</dt><dd>{deg(stance.close)} each leg</dd>
          </dl>
        </fieldset>

        <fieldset>
          <legend>Turn speed</legend>
          <div className="knob">
            <div className="knob-top">
              <span>peak speed (deg/s)</span>
              <span>{speedDeg.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={1}
              max={90}
              step={0.5}
              value={Math.min(90, Math.max(1, speedDeg))}
              onChange={(event) => {
                const wanted = toRad(Number(event.target.value))
                if (stepDelta() > 0 && wanted > 0) showcase.travel = travelFromPeak(wanted)
                redraw(false)
              }}
            />
          </div>
          <p className="hint" style={{ margin: 0 }}>Drives travel, so the two stay in step. For scale: VRMA_06 Model pose peaks at 66 deg/s, VRMA_01 at 233, VRMA_05 Spin at 473.</p>
          <div className="knob">
            <div className="knob-top"><span>outer angle (rad)</span><span>{trim(outer)}</span></div>
            <input type="range" min={0} max={1.6} step={0.01} value={outer}
              onChange={(event) => { const v = Number(event.target.value); setOuter(v); setPoses(v, inner); redraw(false) }} />
          </div>
          <div className="knob">
            <div className="knob-top"><span>inner angle (rad)</span><span>{trim(inner)}</span></div>
            <input type="range" min={0} max={1.6} step={0.01} value={inner}
              onChange={(event) => { const v = Number(event.target.value); setInner(v); setPoses(outer, v); redraw(false) }} />
          </div>
        </fieldset>

        {groups.map((group) => (
          <fieldset key={group.title}>
            <legend>{group.title}</legend>
            {group.knobs.map((knob) => <Slider key={knob.label} knob={knob} onChange={redraw} />)}
          </fieldset>
        ))}

        <fieldset>
          <legend>Say a line</legend>
          <textarea value={line} onChange={(event) => setLine(event.target.value)} style={{ height: 62 }} />
          <div className="row" style={{ marginTop: 8 }}>
            <button onClick={() => { say(line); redraw(false) }}>say it</button>
            <button onClick={() => { say(speech.line); redraw(false) }}>replay stored line</button>
          </div>
          <p className="hint" style={{ marginBottom: 0 }}>Silent. Mouth shapes come from the vowels; the words show in the shop bubble. Accented vowels fold to their base letter, so Vietnamese works.</p>
        </fieldset>

        <fieldset>
          <legend>Motion library</legend>
          <p className="hint" style={{ marginTop: 0 }}>Local only. These files are never built into dist, and the BOOTH licence forbids publishing them.</p>
          {library.files.length === 0 ? (
            <p className="hint" style={{ margin: 0 }}>
              No .vrma found. Drop files into dev-motions/ next to package.json, or start the server with VRMA_DIR pointing elsewhere, then reload. Served only in dev, never built into dist.
            </p>
          ) : (
            <>
              <div className="motions">
                {library.files.map((file) => {
                  const note = motionNotes[file.replace('.vrma', '')]
                  const on = picked.includes(file)
                  return (
                    <div key={file} className="motion">
                      <label>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => setPicked((list) => on ? list.filter((item) => item !== file) : [...list, file])}
                        />
                        <b>{file.replace('.vrma', '')}</b>
                        <span>{note ? note.name : ''}</span>
                      </label>
                      <span className="figures">{note ? `${note.amplitude} deg / ${note.peak} deg/s` : ''}</span>
                      <button onClick={() => void play([file])}>solo</button>
                    </div>
                  )
                })}
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <button onClick={() => void play(picked)} disabled={picked.length === 0}>
                  play {picked.length || ''} in sequence
                </button>
                <button onClick={() => setPicked([])} disabled={picked.length === 0}>clear</button>
                <label className="inline">
                  <input type="checkbox" checked={loop} onChange={() => setLoop((value) => !value)} />
                  loop the chain
                </label>
              </div>
              <div className="row">
                <button
                  onClick={() => {
                    const chain = ['01', '03', '04', '05', '06']
                      .map((n) => `VRMA_${n}.vrma`)
                      .filter((name) => library.files.includes(name))
                    setPicked(chain)
                    setLoop(true)
                    void play(chain, true)
                  }}
                >
                  idle chain: 01 03 04 05 06, looping
                </button>
                <button onClick={() => { setMotionRequest(null); setStatus('Back to the built-in idle clip.') }}>
                  back to built-in idle
                </button>
              </div>
            </>
          )}
          <p className="hint" style={{ marginBottom: 0 }}>Files play in name order. Idle tweaks switch off while a motion runs, matching the shop page.</p>
          <div className="row" style={{ marginTop: 8 }}>
            <input
              type="file"
              accept=".vrma"
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files ?? [])
                if (files.length === 0) return
                motionId.current += 1
                setMotionRequest({ files, id: motionId.current })
              }}
            />
          </div>
          <p className="status">{status}</p>
        </fieldset>

        <fieldset>
          <legend>Paste into src/Avatar.tsx</legend>
          <textarea readOnly value={source} onFocus={(event) => event.target.select()} />
          <div className="row" style={{ marginTop: 8 }}>
            <button onClick={() => void navigator.clipboard.writeText(source)}>copy</button>
          </div>
        </fieldset>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Debug />)
