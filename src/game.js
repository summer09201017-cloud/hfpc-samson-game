import { SAMSON, LION, INTRO, FINISHER } from './config.js'
import { Samson } from './samson.js'
import { Lion } from './lion.js'
import { Renderer } from './renderer.js'
import { Input } from './input.js'
import { Audio } from './audio.js'
import { LEVEL1 } from './scripture.js'

const STATE = {
  TITLE: 'title',
  INTRO: 'intro', // 走向葡萄園、獅子吼叫(可跳過)
  FIGHT: 'fight', // 核心:俯視角自由走位 + 近戰
  FINISHER: 'finisher', // 「撕裂」收尾(不可失敗,玩家不操控)
  WIN: 'win',
  LOSE: 'lose',
  PAUSED: 'paused',
}
const STEP = 1 / 60 // 固定時間步長,讓物理在任何更新率下都一致

export class Game {
  // opts(單機 / 嵌入共用,皆可省略 → 用預設):
  //   ui         —— 由外部注入。單機 main.js 傳 new UI();未來嵌入傳空殼 NullUI。
  //   embed      —— true 時跳過標題、直接開打、結束時回呼 onComplete。
  //   level      —— 保留欄位(日後可加士 15 驢腮骨、士 16 推柱)。
  //   hudLabels  —— { start, goal, short }。
  //   onComplete({ won, score, level }) —— 嵌入過關 / 失敗時呼叫。
  constructor(canvas, opts = {}) {
    this.canvas = canvas
    this.renderer = new Renderer(canvas)
    this.input = new Input()
    this.ui = opts.ui // 由外部注入(單機 new UI()／嵌入 NullUI)
    this.embed = !!opts.embed
    this.onComplete = opts.onComplete || null
    this.level = [1].includes(opts.level) ? opts.level : 1
    this._hudOverride = opts.hudLabels || null
    this.hudLabels = this._hudOverride || { ...LEVEL1.hud }

    this.samson = new Samson()
    this.lion = new Lion()
    this.state = STATE.TITLE
    this.combo = 0 // 連續有效反擊(視覺爽感用)
    this.intro = { t: 0 }
    this.fin = { t: 0 }
    this.fx = { hitT: 0, hurtT: 0 } // 打擊 / 受傷特效計時(renderer 讀)

    this.last = 0
    this.acc = 0
    this.stopped = false // 嵌入卸載時設 true,停止迴圈
    this._done = false // 嵌入結束回呼只觸發一次
  }

  boot() {
    this.input.attach(this.canvas)
    this.renderer.resize()
    this._onResize = () => this.renderer.resize()
    window.addEventListener('resize', this._onResize)

    if (this.embed) {
      Audio.unlock()
      this.startFight()
      requestAnimationFrame((t) => this.loop(t))
      return
    }

    this.ui.onStart(() => this.startIntro())
    this.ui.onRestart(() => this.startFight())
    this.ui.onResume(() => this.resume())
    this.ui.onPause(() => this.pause())
    this.ui.onMute(() => this.toggleMute())
    this.ui.onAction((act) => {
      if (act === 'honey') this.ui.showHoney(LEVEL1)
      else if (act === 'home') this.toTitle()
    })
    this.ui.setMuteIcon(Audio.muted)
    this.ui.showTitle(LEVEL1)

    requestAnimationFrame((t) => this.loop(t))
  }

  // 手機/平板(觸控)開始時進全螢幕並鎖橫向;桌機不打擾;嵌入一律 no-op。
  _enterImmersive() {
    try {
      if (this.embed) return
      if (!window.matchMedia || !window.matchMedia('(pointer: coarse)').matches) return
      const lockLandscape = () => {
        try {
          if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {})
        } catch {}
      }
      const el = document.documentElement
      if (!document.fullscreenElement && el.requestFullscreen) {
        const p = el.requestFullscreen()
        if (p && p.then) p.then(lockLandscape).catch(() => {})
        else lockLandscape()
      } else {
        lockLandscape()
      }
    } catch {}
  }

  startIntro() {
    this._enterImmersive()
    this.samson.reset()
    this.lion.reset()
    this.combo = 0
    this.intro.t = 0
    this.fx = { hitT: 0, hurtT: 0 }
    this.state = STATE.INTRO
    this.hudLabels = this._hudOverride || { ...LEVEL1.hud }
    this.ui.hide()
    this.ui.hidePauseButton()
    Audio.unlock()
    Audio.startMusic()
  }

  startFight() {
    this._enterImmersive()
    this.samson.reset()
    this.lion.reset()
    this.combo = 0
    this.fx = { hitT: 0, hurtT: 0 }
    this.acc = 0
    this.state = STATE.FIGHT
    this.hudLabels = this._hudOverride || { ...LEVEL1.hud }
    this.ui.hide()
    this.ui.showPauseButton()
    Audio.unlock()
    Audio.startMusic()
  }

  // 戰鬥裁判(固定步長)
  step(dt) {
    const s = this.samson
    const l = this.lion

    // 輸入 → 意圖
    if (this.input.consumeAttack()) {
      if (s.attack()) {
        s.face = l.x < s.x ? -1 : 1 // 出手時轉身面向獅子
        Audio.sfx('dodge') // 揮擊的氣聲
      }
    }
    const mv = this.input.moveVector()
    const running = this.input.isRunning()

    const prevLionState = l.state
    const prevClaw = l.claw.state
    s.update(dt, mv.x, mv.y, running)
    l.update(dt, s)

    if (l.state === 'telegraph' && prevLionState !== 'telegraph') {
      Audio.sfx('roar', { big: l.phase() > 0 })
    }
    if (l.claw.state === 'warn' && prevClaw === 'idle') Audio.sfx('roar', { big: true }) // 大爪擊預警
    if (l.claw.state === 'strike' && prevClaw === 'warn') Audio.sfx('dodge') // 斬擊揮下的破風聲

    const d = Math.hypot(l.x - s.x, l.y - s.y)

    // A) 獅子衝撞參孫(只有 charge 會造成傷害;走近不會)
    if (l.charging() && s.invuln <= 0 && d < LION.contactR) {
      s.hurt(l.x, l.y)
      this.fx.hurtT = 0.4
      Audio.sfx('hit')
      if (s.hearts <= 0) {
        this.gameOver()
        return
      }
    }

    // A2) 第二階段:踩到捕獸夾受傷(警示期 fangWarn 內不傷人,彈出後才傷人;受擊無敵期間免疫)
    if (s.invuln <= 0 && l.fangs.length) {
      const hitR = LION.fangR + SAMSON.r
      for (const f of l.fangs) {
        if (f.t >= LION.fangWarn && Math.hypot(f.x - s.x, f.y - s.y) < hitR) {
          s.hurt(f.x, f.y)
          this.fx.hurtT = 0.4
          Audio.sfx('hit')
          if (s.hearts <= 0) {
            this.gameOver()
            return
          }
          break
        }
      }
    }

    // A3) 大範圍爪擊:斬擊揮下(strike)時,玩家落在線的半寬內 → 受傷(受擊無敵期間免疫)
    if (l.claw.state === 'strike' && s.invuln <= 0) {
      if (l.clawPerpDist(s.x, s.y) < LION.clawHalfWidth + SAMSON.r) {
        const proj = (s.x - l.claw.x) * l.claw.dx + (s.y - l.claw.y) * l.claw.dy
        const footX = l.claw.x + l.claw.dx * proj // 線上離玩家最近的點
        const footY = l.claw.y + l.claw.dy * proj
        s.hurt(footX, footY) // 往垂直方向把玩家推離斬擊線
        this.fx.hurtT = 0.4
        Audio.sfx('hit')
        if (s.hearts <= 0) {
          this.gameOver()
          return
        }
      }
    }

    // B) 參孫反擊(靠近 + 出手有效窗 + 獅子露破綻)
    if (s.attackActive() && !s.attackedThisSwing && d < SAMSON.attackReach) {
      s.attackedThisSwing = true
      if (l.open) {
        const before = l.phase()
        const hpBefore = l.hp
        l.hit()
        this.combo += 1
        this.fx.hitT = 0.35
        Audio.sfx('clash')
        if (this.lion.hp <= 0) {
          this.enterFinisher()
          return
        }
        // 一次性提示:剛跨入新階段(爪擊 hp<=15 / 捕獸夾 hp<10)→ 大吼 + 閃光
        const crossedClaw = hpBefore > LION.clawHpThreshold && l.hp <= LION.clawHpThreshold
        const crossedFang = hpBefore >= LION.fangHpThreshold && l.hp < LION.fangHpThreshold
        if (crossedClaw || crossedFang) {
          l.flash = 0.4
          Audio.sfx('roar', { big: true })
        } else if (l.phase() !== before) {
          Audio.sfx('roar', { big: true })
        }
      } else {
        this.combo = 0
        Audio.sfx('clash', { weak: true }) // 沒抓到破綻:被擋開
      }
    }
  }

  // 「撕裂」收尾:耶和華的靈大大感動參孫(不可失敗、玩家不操控)
  enterFinisher() {
    this.state = STATE.FINISHER
    this.fin.t = 0
    Audio.stopMusic()
    Audio.sfx('tear')
  }

  loop(t) {
    if (this.stopped) return
    if (!this.last) this.last = t
    let dt = (t - this.last) / 1000
    this.last = t
    if (dt > 0.1) dt = 0.1

    if (this.input.consumeMute()) this.toggleMute()
    if (this.input.consumePause()) {
      if (this.state === STATE.FIGHT) this.pause()
      else if (this.state === STATE.PAUSED) this.resume()
    }

    if (this.fx.hitT > 0) this.fx.hitT = Math.max(0, this.fx.hitT - dt)
    if (this.fx.hurtT > 0) this.fx.hurtT = Math.max(0, this.fx.hurtT - dt)

    if (this.state === STATE.FIGHT) {
      this.acc += dt
      while (this.acc >= STEP) {
        this.step(STEP)
        if (this.state !== STATE.FIGHT) break
        this.acc -= STEP
      }
    } else if (this.state === STATE.INTRO) {
      this.intro.t += dt
      const skip = this.input.consumeSkip()
      this.input.consumeAttack()
      if (skip || this.intro.t >= INTRO.duration) this.startFight()
    } else if (this.state === STATE.FINISHER) {
      this.fin.t += dt
      this.input.consumeAttack()
      this.input.consumeSkip()
      if (this.fin.t >= FINISHER.duration) this.win()
    } else {
      // TITLE / LOSE:任意鍵 / 點擊 = 開始 / 重試(WIN / PAUSED 等按鈕)
      const skip = this.input.consumeSkip()
      this.input.consumeAttack()
      if (skip) {
        if (this.state === STATE.TITLE) this.startIntro()
        else if (this.state === STATE.LOSE) this.startFight()
      }
    }

    this.renderer.draw(this)
    requestAnimationFrame((tt) => this.loop(tt))
  }

  toggleMute() {
    Audio.unlock()
    const m = Audio.toggleMute()
    this.ui.setMuteIcon(m)
  }

  pause() {
    if (this.state !== STATE.FIGHT) return
    this.state = STATE.PAUSED
    this.ui.hidePauseButton()
    this.ui.showPaused()
    Audio.pauseAll()
  }

  resume() {
    if (this.state !== STATE.PAUSED) return
    this.ui.hide()
    this.ui.showPauseButton()
    this.state = STATE.FIGHT
    Audio.resumeAll()
  }

  win() {
    this.state = STATE.WIN
    this.ui.hidePauseButton()
    Audio.stopMusic()
    Audio.sfx('win')
    if (this.embed) return this._finish(true)
    this.ui.showWin(LEVEL1, { hearts: this.samson.hearts, combo: this.combo })
  }

  gameOver() {
    this.state = STATE.LOSE
    this.ui.hidePauseButton()
    Audio.stopMusic()
    Audio.sfx('lose')
    if (this.embed) return this._finish(false)
    this.ui.showLose(LEVEL1)
  }

  toTitle() {
    this.state = STATE.TITLE
    Audio.stopMusic()
    this.ui.hidePauseButton()
    this.ui.showTitle(LEVEL1)
  }

  _finish(won) {
    if (this._done) return
    this._done = true
    this.stopped = true
    if (this.onComplete) this.onComplete({ won, score: this.combo, level: this.level })
  }

  destroy() {
    this.stopped = true
    if (this._onResize) window.removeEventListener('resize', this._onResize)
    if (this.input && this.input.detach) this.input.detach()
    Audio.stopMusic()
    Audio.pauseAll()
  }
}
