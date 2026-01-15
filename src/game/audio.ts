let audioContext: AudioContext | null = null
let audioMasterGain: GainNode | null = null
let ambientMusic: AudioScheduledSourceNode[] = []
let ambientSfxSource: AudioBufferSourceNode | null = null
let ambientChordTimer: number | null = null
let ambientSchedulerTimer: number | null = null
let lastDamageSoundTime = 0

export function initAudio() {
  if (audioContext) return
  audioContext = new AudioContext()
  audioMasterGain = audioContext.createGain()
  audioMasterGain.gain.value = 0.75
  audioMasterGain.connect(audioContext.destination)

  startAmbientMusic()
}

export function playGunshot() {
  if (!audioContext || !audioMasterGain) return
  const duration = 0.08
  const buffer = createNoiseBuffer(duration)
  const noiseSource = audioContext.createBufferSource()
  noiseSource.buffer = buffer
  const noiseGain = audioContext.createGain()
  noiseGain.gain.setValueAtTime(0.8, audioContext.currentTime)
  noiseGain.gain.exponentialRampToValueAtTime(
    0.001,
    audioContext.currentTime + duration
  )

  const filter = audioContext.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 1200

  noiseSource.connect(filter)
  filter.connect(noiseGain)
  noiseGain.connect(audioMasterGain)
  noiseSource.start()

  const click = audioContext.createOscillator()
  const clickGain = audioContext.createGain()
  click.type = 'triangle'
  click.frequency.value = 180
  clickGain.gain.setValueAtTime(0.4, audioContext.currentTime)
  clickGain.gain.exponentialRampToValueAtTime(
    0.001,
    audioContext.currentTime + 0.05
  )
  click.connect(clickGain)
  clickGain.connect(audioMasterGain)
  click.start()
  click.stop(audioContext.currentTime + 0.05)
}

export function playHitmarker() {
  if (!audioContext || !audioMasterGain) return
  const tone = audioContext.createOscillator()
  const toneGain = audioContext.createGain()
  tone.type = 'square'
  tone.frequency.value = 1200
  toneGain.gain.setValueAtTime(0.25, audioContext.currentTime)
  toneGain.gain.exponentialRampToValueAtTime(
    0.001,
    audioContext.currentTime + 0.06
  )
  tone.connect(toneGain)
  toneGain.connect(audioMasterGain)
  tone.start()
  tone.stop(audioContext.currentTime + 0.06)
}

export function playDamageSound() {
  if (!audioContext || !audioMasterGain) return
  const now = audioContext.currentTime
  if (now - lastDamageSoundTime < 0.4) return
  lastDamageSoundTime = now
  const osc = audioContext.createOscillator()
  const gain = audioContext.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(90, now)
  gain.gain.setValueAtTime(0.3, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
  osc.connect(gain)
  gain.connect(audioMasterGain)
  osc.start()
  osc.stop(now + 0.2)
}

function startAmbientMusic() {
  if (!audioContext || !audioMasterGain) return

  ambientMusic.forEach((node) => {
    try {
      node.stop()
    } catch {
      // ignore
    }
  })
  ambientMusic = []

  if (ambientChordTimer) {
    window.clearInterval(ambientChordTimer)
    ambientChordTimer = null
  }
  if (ambientSchedulerTimer) {
    window.clearInterval(ambientSchedulerTimer)
    ambientSchedulerTimer = null
  }

  const musicGain = audioContext.createGain()
  musicGain.gain.value = 0.32
  musicGain.connect(audioMasterGain)

  const filter = audioContext.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 1600
  filter.connect(musicGain)

  const delay = audioContext.createDelay()
  delay.delayTime.value = 0.22
  const feedback = audioContext.createGain()
  feedback.gain.value = 0.25
  delay.connect(feedback)
  feedback.connect(delay)

  const delayMix = audioContext.createGain()
  delayMix.gain.value = 0.22
  delay.connect(delayMix)
  delayMix.connect(filter)

  // Dry goes to filter as well
  const dry = audioContext.createGain()
  dry.gain.value = 0.9
  dry.connect(filter)

  const midiToHz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

  // A minor-ish progression: Am -> F -> G -> E
  const chordProgression: number[][] = [
    [45, 48, 52],
    [41, 45, 48],
    [43, 47, 50],
    [40, 44, 47],
  ]

  let chordIndex = 0
  let arpeggioIndex = 0
  let nextNoteTime = audioContext.currentTime + 0.05

  const bpm = 84
  const step = (60 / bpm) / 2 // 8th notes
  const scheduleAhead = 0.2

  const arpeggioPattern = [0, 1, 2, 1, 2, 1, 0, 1]

  const playPluck = (frequency: number, time: number, velocity: number) => {
    const osc = audioContext!.createOscillator()
    const gain = audioContext!.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(frequency, time)

    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(velocity, time + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.35)

    osc.connect(gain)
    gain.connect(dry)
    gain.connect(delay)

    osc.start(time)
    osc.stop(time + 0.4)
    ambientMusic.push(osc)
  }

  const playSoftPad = (midiNotes: number[], time: number) => {
    midiNotes.forEach((midi) => {
      const osc = audioContext!.createOscillator()
      const gain = audioContext!.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(midiToHz(midi), time)
      gain.gain.setValueAtTime(0.0001, time)
      gain.gain.exponentialRampToValueAtTime(0.03, time + 0.8)
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 3.8)
      osc.connect(gain)
      gain.connect(dry)
      gain.connect(delay)
      osc.start(time)
      osc.stop(time + 4)
      ambientMusic.push(osc)
    })
  }

  // Start immediately
  playSoftPad(chordProgression[chordIndex], audioContext.currentTime)

  // Change chord every 4 beats
  ambientChordTimer = window.setInterval(() => {
    chordIndex = (chordIndex + 1) % chordProgression.length
    playSoftPad(chordProgression[chordIndex], audioContext!.currentTime)
  }, Math.round(4 * (60 / bpm) * 1000))

  ambientSchedulerTimer = window.setInterval(() => {
    const now = audioContext!.currentTime
    while (nextNoteTime < now + scheduleAhead) {
      const chord = chordProgression[chordIndex]
      const stepIndex = arpeggioPattern[arpeggioIndex % arpeggioPattern.length]
      const midi = chord[stepIndex] + 12 // play one octave above
      playPluck(midiToHz(midi), nextNoteTime, 0.06)
      arpeggioIndex += 1
      nextNoteTime += step
    }
  }, 25)
}

function startAmbientSfx() {
  if (!audioContext || !audioMasterGain) return
  if (ambientSfxSource) ambientSfxSource.stop()

  const buffer = createNoiseBuffer(2)
  const source = audioContext.createBufferSource()
  source.buffer = buffer
  source.loop = true

  const filter = audioContext.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 500

  const gain = audioContext.createGain()
  gain.gain.value = 0.005

  source.connect(filter)
  filter.connect(gain)
  gain.connect(audioMasterGain)
  source.start()
  ambientSfxSource = source
}

function createNoiseBuffer(duration: number) {
  if (!audioContext) throw new Error('AudioContext not initialized')
  const sampleRate = audioContext.sampleRate
  const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * 0.5
  }
  return buffer
}
