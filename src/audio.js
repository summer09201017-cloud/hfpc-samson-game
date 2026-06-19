// 程序化音效與背景音樂 —— 用 Web Audio API 即時合成,零音檔、零相依、可離線。
// 瀏覽器規定:音訊必須在使用者手勢中啟動,所以遊戲開始(按鈕/按鍵)時呼叫 unlock()。
// 框架沿用約拿引擎;音效菜單換成參孫打獅子(閃避/反擊/獅吼/受擊/撕裂/勝負)。

let ctx = null
let masterGain, sfxGain, musicGain
let muted = false
let musicOn = false
let musicTimer = null
let nextLoopTime = 0

// 讀取靜音偏好
try {
  muted = localStorage.getItem('samson_muted') === '1'
} catch {
  /* ignore */
}

function ensure() {
  if (ctx) return
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    ctx = new AC()
    masterGain = ctx.createGain()
    masterGain.gain.value = muted ? 0 : 0.9
    masterGain.connect(ctx.destination)
    sfxGain = ctx.createGain()
    sfxGain.gain.value = 0.55
    sfxGain.connect(masterGain)
    musicGain = ctx.createGain()
    musicGain.gain.value = 0.14 // 背景音樂偏小聲,不蓋過音效
    musicGain.connect(masterGain)
  } catch {
    ctx = null
  }
}

// 合成一個音(帶柔和的起音/收音包絡)
function tone(freq, dur, startT, vol, type, dest) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, startT)
  const a = 0.012
  const rel = Math.min(0.12, dur * 0.5)
  g.gain.setValueAtTime(0.0001, startT)
  g.gain.exponentialRampToValueAtTime(vol, startT + a)
  g.gain.setValueAtTime(vol, startT + Math.max(a, dur - rel))
  g.gain.exponentialRampToValueAtTime(0.0001, startT + dur)
  osc.connect(g)
  g.connect(dest)
  osc.start(startT)
  osc.stop(startT + dur + 0.03)
}

// 短促音效:可滑音(slideTo)
function blip(freq, dur, type = 'square', vol = 0.5, slideTo = null) {
  ensure()
  if (!ctx) return
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g)
  g.connect(sfxGain)
  osc.start(t)
  osc.stop(t + dur + 0.03)
}

// 一串音符(用於過關/失敗短曲)
function arp(notes, type = 'square', noteDur = 0.12, vol = 0.5) {
  ensure()
  if (!ctx) return
  let t = ctx.currentTime
  for (const f of notes) {
    tone(f, noteDur * 1.4, t, vol, type, sfxGain)
    t += noteDur
  }
}

// 過濾雜訊式的「吼叫」:低頻 sawtooth + 緩慢下滑 + 顫動
function growl(dur = 0.5, base = 150, vol = 0.5) {
  ensure()
  if (!ctx) return
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  const lfo = ctx.createOscillator()
  const lfoG = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(base, t)
  osc.frequency.exponentialRampToValueAtTime(base * 0.6, t + dur)
  lfo.type = 'sine' // 顫動(像低吼的振動)
  lfo.frequency.setValueAtTime(22, t)
  lfoG.gain.setValueAtTime(base * 0.18, t)
  lfo.connect(lfoG)
  lfoG.connect(osc.frequency)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.04)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g)
  g.connect(sfxGain)
  osc.start(t)
  lfo.start(t)
  osc.stop(t + dur + 0.03)
  lfo.stop(t + dur + 0.03)
}

// ---- 背景音樂:原創 A 小調情感曲(前半低迴憂傷 → 後半上揚推進)。----
//   ※ 全原創旋律(非任何商業歌曲);零音檔、Web Audio 合成、可離線。
const BEAT = 0.4 // 放慢一點 → 較抒情
// [頻率, 拍數],0 = 休止
const MELODY = [
  // A 段:低迴、嘆息般下行(憂傷)
  [440, 1], [392, 1], [330, 2],
  [349, 1], [330, 1], [294, 2],
  [330, 1], [294, 1], [262, 2],
  [294, 1], [262, 1], [220, 2],
  // B 段:逐步攀升、推進(轉激昂)
  [330, 1], [392, 1], [440, 1], [494, 1],
  [523, 2], [494, 1], [440, 1],
  [440, 1], [523, 1], [587, 1], [659, 1],
  [587, 2], [523, 2],
]
const BASS = [110, 87, 131, 98, 110, 87, 98, 82] // Am–F–C–G ／ Am–F–G–E(每 4 拍一個根音)
const LOOP_BEATS = MELODY.reduce((s, [, b]) => s + b, 0)

function scheduleLoop(start) {
  let t = start
  for (const [f, b] of MELODY) {
    if (f) tone(f, b * BEAT * 0.92, t, 0.5, 'triangle', musicGain)
    t += b * BEAT
  }
  for (let i = 0; i < BASS.length; i++) {
    tone(BASS[i], BEAT * 3.6, start + i * 4 * BEAT, 0.42, 'sine', musicGain)
  }
}

function pump() {
  if (!musicOn || !ctx) return
  const loopDur = LOOP_BEATS * BEAT
  while (nextLoopTime < ctx.currentTime + 1.2) {
    scheduleLoop(nextLoopTime)
    nextLoopTime += loopDur
  }
  musicTimer = setTimeout(pump, 280)
}

export const Audio = {
  // 在使用者手勢中呼叫一次,解鎖音訊
  unlock() {
    ensure()
    if (ctx && ctx.state === 'suspended') ctx.resume()
  },

  get muted() {
    return muted
  },
  setMuted(m) {
    muted = m
    if (masterGain) masterGain.gain.value = m ? 0 : 0.9
    try {
      localStorage.setItem('samson_muted', m ? '1' : '0')
    } catch {
      /* ignore */
    }
  },
  toggleMute() {
    this.setMuted(!muted)
    return muted
  },

  startMusic() {
    ensure()
    if (!ctx) return
    if (musicOn) return
    musicOn = true
    nextLoopTime = ctx.currentTime + 0.12
    pump()
  },
  stopMusic() {
    musicOn = false
    if (musicTimer) {
      clearTimeout(musicTimer)
      musicTimer = null
    }
  },
  pauseAll() {
    this.stopMusic()
    if (ctx && ctx.state === 'running') ctx.suspend()
  },
  resumeAll() {
    if (ctx && ctx.state === 'suspended') ctx.resume()
    this.startMusic()
  },

  // ---- 音效 ----
  sfx(name, opt = {}) {
    switch (name) {
      case 'dodge': // 參孫揮擊出手的氣聲(輕快的滑音)
        blip(520, 0.18, 'triangle', 0.4, 240)
        break
      case 'clash': // 反擊:命中破綻=有力的重擊;沒抓到破綻(weak)=被擋的悶響
        if (opt.weak) {
          blip(150, 0.12, 'square', 0.32, 90)
        } else {
          // 三層疊出扎實打擊:低頻重擊(body)+ 中頻爆裂(crack)+ 高頻脆響(snap)
          blip(110, 0.18, 'sine', 0.7, 42) // 低頻往下沉 → 重量
          blip(300, 0.1, 'square', 0.55, 150) // 中頻爆裂
          blip(680, 0.07, 'square', 0.4, 420) // 高頻脆響
          blip(900, 0.05, 'triangle', 0.3) // 一點亮邊
        }
        break
      case 'roar': // 獅吼(telegraph / 進入新 phase)
        growl(opt.big ? 0.62 : 0.45, opt.big ? 130 : 160, 0.5)
        break
      case 'hit': // 參孫被撲擊:低沉的受擊
        blip(170, 0.3, 'sawtooth', 0.45, 65)
        break
      case 'tear': // 撕裂收尾:上揚的爆發 + 勝利感
        blip(220, 0.18, 'sawtooth', 0.45, 520)
        arp([392, 523, 659, 880], 'triangle', 0.1, 0.45)
        break
      case 'heal': // 吃到蜂蜜補血:溫暖上揚的小分解和弦
        arp([523, 659, 784, 1047], 'triangle', 0.07, 0.42)
        break
      case 'win':
        arp([523, 659, 784, 1047, 1319], 'square', 0.13, 0.5)
        break
      case 'lose':
        arp([392, 330, 262, 196], 'triangle', 0.18, 0.5)
        break
    }
  },
}
