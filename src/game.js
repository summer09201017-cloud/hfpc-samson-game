import { SAMSON, LION, HONEY, ROCK, MIRACLE, CORRUPTION, GOLDEN_HEART, ESCAPE, ARENA, INTRO, FINISHER, BADEND } from './config.js'
import { Samson } from './samson.js'
import { Lion } from './lion.js'
import { Renderer } from './renderer.js'
import { Input } from './input.js'
import { Audio } from './audio.js'
import { LEVEL1 } from './scripture.js'
import { initSpeech, speakScripture, stopSpeech } from './speak.js'

const STATE = {
  TITLE: 'title',
  INTRO: 'intro', // 走向葡萄園、獅子吼叫(可跳過)
  FIGHT: 'fight', // 核心:俯視角自由走位 + 近戰
  FINISHER: 'finisher', // 「撕裂」收尾(不可失敗,玩家不操控)
  REVIVING: 'reviving', // 無縫復活轉場:黑霧聚攏到全黑,全黑底下重置站位,再揭開續戰
  BADENDING: 'badending', // 壞結局演出:黑霧 + 漆黑細手捏心臟(地獄模式中死亡,玩家不操控)
  WIN: 'win',
  LOSE: 'lose',
  ESCAPED: 'escaped', // 隱藏結局:走到右下角隱形出口逃跑(彩蛋)
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
    this.miracleText = LEVEL1.miracle || '' // 神蹟降臨時浮現的字(renderer 讀,不寫死)

    this.samson = new Samson()
    this.lion = new Lion()
    this.state = STATE.TITLE
    this.combo = 0 // 連續有效反擊(視覺爽感用)
    this.intro = { t: 0 }
    this.fin = { t: 0 }
    this.bad = { t: 0 } // 壞結局演出計時
    this.revive = { t: 0, done: false } // 無縫復活轉場計時(黑霧聚攏 → 全黑底下重置站位)
    this.fx = { hitT: 0, hurtT: 0, healT: 0, healX: 0, healY: 0, boltT: 0, reviveT: 0, shakeT: 0, shakeMag: 0 } // 特效計時(renderer 讀);shake = 命中震動
    this._hitStop = 0 // 命中頓幀:>0 時暫停戰鬥模擬數十毫秒,增強打擊感
    this._clock = 0 // 戰鬥時鐘(僅 FIGHT 累加;死亡回歸用來找「30 秒前」)
    this._hpLog = [] // 獅子血量歷史 [{t,hp}](死亡回歸倒退用)
    this._hpLogTimer = 0
    this.honeys = [] // 場上的蜂窩補血道具:{ x, y, t }
    this._honeyTimer = 0
    this._honeyNext = HONEY.spawnMax
    this.rocks = [] // 場上的石頭:{ x, y, t, state:'ground'|'thrown', dx, dy, spin }
    this._rockTimer = 0
    this._rockNext = ROCK.spawnMax
    this.golden = [] // 場上的金色的心:{ x, y, t }(撿到突破血量上限)
    this._goldenTimer = 0
    this._miracleTimer = 0 // 神蹟降臨倒數(每 MIRACLE.interval 秒一次)

    this.deaths = 0 // 本輪累積死亡數(回標題 / 得勝才清零)→ 畫面漸暗、滿 deathModeAt 進死神模式
    this.deathMode = false // 心智被侵蝕、獅子化為死神

    this.last = 0
    this.acc = 0
    this.stopped = false // 嵌入卸載時設 true,停止迴圈
    this._done = false // 嵌入結束回呼只觸發一次
  }

  boot() {
    initSpeech()
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
    this.fx = { hitT: 0, hurtT: 0, healT: 0, healX: 0, healY: 0, boltT: 0, reviveT: 0, shakeT: 0, shakeMag: 0 }
    this._hitStop = 0
    this.honeys = []
    this._honeyTimer = 0
    this._honeyNext = this._rollHoneyDelay()
    this.rocks = []
    this._rockTimer = 0
    this._rockNext = this._rollRockDelay()
    this.golden = []
    this._goldenTimer = 0
    this._miracleTimer = 0
    this._clock = 0
    this._hpLog = [{ t: 0, hp: this.lion.hp }]
    this._hpLogTimer = 0
    this.acc = 0
    this.lion.deathMode = this.deathMode // 死神模式:獅子全面強化(見 lion.cfg / renderer)
    this.state = STATE.FIGHT
    this.hudLabels = this._hudOverride || {
      ...LEVEL1.hud,
      ...(this.deathMode && LEVEL1.deathHud ? LEVEL1.deathHud : {}),
    }
    this.ui.hide()
    this.ui.showPauseButton()
    Audio.unlock()
    Audio.startMusic()
  }

  // 戰鬥裁判(固定步長)
  step(dt) {
    const s = this.samson
    const l = this.lion

    // 戰鬥時鐘 + 每 0.5s 記一次獅子血量(死亡回歸倒退用);只留約 rewindSeconds+2 秒的歷史
    this._clock += dt
    this._hpLogTimer += dt
    if (this._hpLogTimer >= 0.5) {
      this._hpLogTimer = 0
      this._hpLog.push({ t: this._clock, hp: l.hp })
      const cutoff = this._clock - CORRUPTION.rewindSeconds - 2
      while (this._hpLog.length > 1 && this._hpLog[0].t < cutoff) this._hpLog.shift()
    }

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
    // 右下角牆有缺口(非嵌入時),參孫可從那裡走出場外;走出邊界 → 隱藏結局
    s.update(dt, mv.x, mv.y, running, this.embed ? null : { w: ESCAPE.w, h: ESCAPE.h })
    l.update(dt, s)

    // 隱藏結局:參孫從右下角缺口走出戰鬥範圍、再走遠 ESCAPE.out 像素 → 逃跑彩蛋
    if (!this.embed && (s.x > ARENA.x + ARENA.w + ESCAPE.out || s.y > ARENA.y + ARENA.h + ESCAPE.out)) {
      return this.enterEscape()
    }

    if (l.state === 'telegraph' && prevLionState !== 'telegraph') {
      Audio.sfx('roar', { big: l.phase() > 0 })
    }
    if (l.claw.state === 'warn' && prevClaw === 'idle') Audio.sfx('roar', { big: true }) // 大爪擊預警
    if (l.claw.state === 'strike' && prevClaw === 'warn') Audio.sfx('dodge') // 斬擊揮下的破風聲

    this._stepHoney(dt, s) // 蜂窩補血道具:老化 / 拾取 / 不定時生成
    this._stepGolden(dt, s) // 金色的心:每秒 2% 機率出現,撿到突破血量上限
    if (this._stepRocks(dt, s, l)) return // 石頭:撿到→扔向獅子→砸中扣血(可能觸發收尾)

    // 神蹟降臨:每 MIRACLE.interval 秒(死神/地獄模式縮短為 deathInterval),天降閃電打獅子
    this._miracleTimer += dt
    const miracleEvery = this.deathMode ? MIRACLE.deathInterval : MIRACLE.interval
    if (this._miracleTimer >= miracleEvery) {
      this._miracleTimer -= miracleEvery
      this.fx.boltT = 0.6
      l.flash = Math.max(l.flash, 0.5)
      Audio.sfx('tear') // 借用「撕裂」的爆發聲當雷擊
      if (this._damageLion(MIRACLE.damage)) return // 閃電可能直接收尾
    }

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
        this.combo += 1
        // ── 打擊感:爆擊特效 + 頓幀 + 畫面震動 + 獅子被打退/閃白 + 手機震動 ──
        this.fx.hitT = 0.5
        this.fx.shakeT = 0.2
        this.fx.shakeMag = 5 + Math.min(this.combo, 6) * 0.8 // 連擊越高震越有勁
        this._hitStop = 0.07 // 命中瞬間頓一下(增強重量感)
        const a = Math.atan2(l.y - s.y, l.x - s.x) // 把獅子往遠離參孫方向打退
        l.x += Math.cos(a) * 16
        l.y += Math.sin(a) * 16
        l.flash = Math.max(l.flash, 0.32) // 獅子受擊閃白(flinch)
        s.face = l.x < s.x ? -1 : 1
        try { if (navigator.vibrate) navigator.vibrate(18) } catch {}
        Audio.sfx('clash')
        if (this._damageLion(1)) return // 血歸零 → 撕裂收尾
      } else {
        this.combo = 0
        Audio.sfx('clash', { weak: true }) // 沒抓到破綻:被擋開
      }
    }
  }

  // 對獅子造成 n 點傷害,處理收尾與跨階段提示。回傳 true 表示已進入收尾(呼叫端應 return)。
  // 反擊與「石頭砸中」共用。
  _damageLion(n) {
    const l = this.lion
    const before = l.phase()
    const hpBefore = l.hp
    for (let i = 0; i < n; i++) l.hit()
    if (this.lion.hp <= 0) {
      this.enterFinisher()
      return true
    }
    // 一次性提示:剛跨入新階段(爪擊 hp<=15 / 捕獸夾 hp<10 / 狂暴 hp<=3)→ 大吼 + 閃光
    const crossedClaw = hpBefore > LION.clawHpThreshold && l.hp <= LION.clawHpThreshold
    const crossedFang = hpBefore >= LION.fangHpThreshold && l.hp < LION.fangHpThreshold
    const crossedEnrage = hpBefore > LION.enrageHpThreshold && l.hp <= LION.enrageHpThreshold
    if (crossedClaw || crossedFang || crossedEnrage) {
      l.flash = crossedEnrage ? 0.6 : 0.4
      Audio.sfx('roar', { big: true })
    } else if (l.phase() !== before) {
      Audio.sfx('roar', { big: true })
    }
    return false
  }

  // 蜂窩補血道具:老化移除 → 拾取補血(滿血則不吃、留在場上)→ 不定時生成
  _stepHoney(dt, s) {
    if (this.honeys.length) {
      for (const h of this.honeys) h.t += dt
      this.honeys = this.honeys.filter((h) => h.t < HONEY.life)
    }
    if (s.hearts < s.maxHearts) {
      const rr = HONEY.r + SAMSON.r
      for (let i = 0; i < this.honeys.length; i++) {
        const h = this.honeys[i]
        if (Math.hypot(h.x - s.x, h.y - s.y) < rr) {
          s.hearts = Math.min(s.maxHearts, s.hearts + HONEY.heal)
          this.honeys.splice(i, 1)
          this.fx.healT = 0.6
          this.fx.healX = s.x
          this.fx.healY = s.y
          Audio.sfx('heal')
          break
        }
      }
    }
    this._honeyTimer += dt
    if (this._honeyTimer >= this._honeyNext && this.honeys.length < HONEY.maxOnField) {
      this._honeyTimer = 0
      this._honeyNext = this._rollHoneyDelay()
      this.honeys.push(this._spawnHoney(s))
    }
  }

  _rollHoneyDelay() {
    return HONEY.spawnMin + Math.random() * (HONEY.spawnMax - HONEY.spawnMin)
  }

  _spawnHoney(s) {
    const minX = ARENA.x + 34
    const maxX = ARENA.x + ARENA.w - 34
    const minY = ARENA.y + 34
    const maxY = ARENA.y + ARENA.h - 34
    let x = minX
    let y = minY
    for (let i = 0; i < 8; i++) {
      x = minX + Math.random() * (maxX - minX)
      y = minY + Math.random() * (maxY - minY)
      if (Math.hypot(x - s.x, y - s.y) >= HONEY.safeR) break
    }
    return { x, y, t: 0 }
  }

  // 金色的心:老化移除 → 撿到「突破血量上限」(maxHearts+1、補 1 滴)→ 每秒擲一次 2% 機率生成
  _stepGolden(dt, s) {
    if (this.golden.length) {
      for (const h of this.golden) h.t += dt
      this.golden = this.golden.filter((h) => h.t < GOLDEN_HEART.life)
    }
    const rr = GOLDEN_HEART.r + SAMSON.r
    for (let i = 0; i < this.golden.length; i++) {
      const h = this.golden[i]
      if (Math.hypot(h.x - s.x, h.y - s.y) < rr) {
        s.maxHearts += 1 // ★ 突破上限
        s.hearts += 1
        this.golden.splice(i, 1)
        this.fx.healT = 0.6
        this.fx.healX = s.x
        this.fx.healY = s.y
        Audio.sfx('heal')
        break
      }
    }
    // 每滿 1 秒,擲一次 chancePerSec 機率
    this._goldenTimer += dt
    if (this._goldenTimer >= 1) {
      this._goldenTimer -= 1
      if (this.golden.length < GOLDEN_HEART.maxOnField && Math.random() < GOLDEN_HEART.chancePerSec) {
        const minX = ARENA.x + 34
        const maxX = ARENA.x + ARENA.w - 34
        const minY = ARENA.y + 34
        const maxY = ARENA.y + ARENA.h - 34
        let x = minX
        let y = minY
        for (let i = 0; i < 8; i++) {
          x = minX + Math.random() * (maxX - minX)
          y = minY + Math.random() * (maxY - minY)
          if (Math.hypot(x - s.x, y - s.y) >= GOLDEN_HEART.safeR) break
        }
        this.golden.push({ x, y, t: 0 })
      }
    }
  }

  // 石頭:地上石頭老化/被撿(→扔出)、飛行石頭追向獅子並砸中扣血、不定時生成。
  // 回傳 true 表示石頭砸中後觸發收尾(呼叫端應 return)。
  _stepRocks(dt, s, l) {
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const r = this.rocks[i]
      if (r.state === 'ground') {
        r.t += dt
        if (r.t >= ROCK.life) {
          this.rocks.splice(i, 1)
          continue
        }
        // 玩家碰到 → 立刻朝獅子扔出
        if (Math.hypot(r.x - s.x, r.y - s.y) < ROCK.r + SAMSON.r) {
          r.state = 'thrown'
          r.spin = 0
          Audio.sfx('dodge') // 扔出的破風聲
        }
      } else {
        // 飛行:輕度追向獅子當下位置(確保這份獎勵會命中)
        const a = Math.atan2(l.y - r.y, l.x - r.x)
        r.dx = Math.cos(a)
        r.dy = Math.sin(a)
        r.x += r.dx * ROCK.speed * dt
        r.y += r.dy * ROCK.speed * dt
        r.spin = (r.spin || 0) + dt * 20
        // 砸中獅子 → 扣血
        if (Math.hypot(r.x - l.x, r.y - l.y) < LION.r + ROCK.r) {
          this.rocks.splice(i, 1)
          this.fx.hitT = 0.35
          Audio.sfx('clash')
          if (this._damageLion(ROCK.damage)) return true
          continue
        }
        // 安全網:飛出場外就移除
        if (
          r.x < ARENA.x - 60 ||
          r.x > ARENA.x + ARENA.w + 60 ||
          r.y < ARENA.y - 60 ||
          r.y > ARENA.y + ARENA.h + 60
        ) {
          this.rocks.splice(i, 1)
        }
      }
    }
    // 生成(只算地上的石頭數,飛行中的不佔額)
    const groundCount = this.rocks.reduce((n, r) => n + (r.state === 'ground' ? 1 : 0), 0)
    this._rockTimer += dt
    if (this._rockTimer >= this._rockNext && groundCount < ROCK.maxOnField) {
      this._rockTimer = 0
      this._rockNext = this._rollRockDelay()
      this.rocks.push(this._spawnRock())
    }
    return false
  }

  _rollRockDelay() {
    return ROCK.spawnMin + Math.random() * (ROCK.spawnMax - ROCK.spawnMin)
  }

  _spawnRock() {
    const minX = ARENA.x + 40
    const maxX = ARENA.x + ARENA.w - 40
    const minY = ARENA.y + 40
    const maxY = ARENA.y + ARENA.h - 40
    const x = minX + Math.random() * (maxX - minX)
    const y = minY + Math.random() * (maxY - minY)
    return { x, y, t: 0, state: 'ground', dx: 0, dy: 0, spin: 0 }
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
    if (this.fx.healT > 0) this.fx.healT = Math.max(0, this.fx.healT - dt)
    if (this.fx.boltT > 0) this.fx.boltT = Math.max(0, this.fx.boltT - dt)
    if (this.fx.reviveT > 0) this.fx.reviveT = Math.max(0, this.fx.reviveT - dt)
    if (this.fx.shakeT > 0) this.fx.shakeT = Math.max(0, this.fx.shakeT - dt)

    if (this.state === STATE.FIGHT) {
      if (this._hitStop > 0) {
        // 命中頓幀:暫停戰鬥模擬(但畫面照常重繪、特效照跑)
        this._hitStop = Math.max(0, this._hitStop - dt)
        this.acc = 0
      } else {
        this.acc += dt
        while (this.acc >= STEP) {
          this.step(STEP)
          if (this.state !== STATE.FIGHT) break
          if (this._hitStop > 0) { this.acc = 0; break } // 這一步觸發頓幀 → 立刻停
          this.acc -= STEP
        }
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
    } else if (this.state === STATE.REVIVING) {
      // 黑霧聚攏到全黑(約 reviveDuration 秒);過半(全黑)時在暗處重置站位,結束揭開續戰
      this.revive.t += dt
      this.input.consumeAttack()
      this.input.consumeSkip()
      this.input.consumePause()
      if (!this.revive.done && this.revive.t >= CORRUPTION.reviveDuration * 0.8) {
        this._revive()
        this.revive.done = true
      }
      if (this.revive.t >= CORRUPTION.reviveDuration) {
        this.state = STATE.FIGHT
        this.acc = 0
        this.fx.reviveT = 0.5 // 由全黑快速淡入揭開場景
        this.ui.showPauseButton()
      }
    } else if (this.state === STATE.BADENDING) {
      const prev = this.bad.t
      this.bad.t += dt
      this.input.consumeAttack()
      this.input.consumeSkip()
      if (prev < 1.2 && this.bad.t >= 1.2) Audio.sfx('roar', { big: true }) // 黑手自黑霧伸出
      if (prev < 3.6 && this.bad.t >= 3.6) Audio.sfx('hit') // 心臟被捏住的悶擊
      if (this.bad.t >= BADEND.duration) {
        this.deaths = 0 // 黑暗贏了這一輪 → 下一輪從頭(恩典讓人重新開始)
        this.deathMode = false
        this.state = STATE.LOSE
        this.ui.showBadEnding(LEVEL1)
      }
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

  // 隱藏結局:走到右下角隱形出口逃跑(彩蛋)。不算過關也不算失敗,清掉墮落、回到可重玩。
  enterEscape() {
    this.state = STATE.ESCAPED
    this.ui.hidePauseButton()
    Audio.stopMusic()
    Audio.sfx('dodge') // 溜走的氣聲
    this.deaths = 0
    this.deathMode = false
    if (this.embed) return this._finish(false)
    this.ui.showEscape(LEVEL1)
  }

  win() {
    speakScripture(LEVEL1.verse)
    this.state = STATE.WIN
    this.ui.hidePauseButton()
    Audio.stopMusic()
    Audio.sfx('win')
    // 注意:得勝「不」清零死亡數——死亡數是整輪累積的,只有「回標題」或壞結局才歸零。
    // (否則中間贏一場就會把進度洗掉,導致「總共死了 3 次卻進不了地獄模式」。)
    if (this.embed) return this._finish(true)
    this.ui.showWin(LEVEL1, { hearts: this.samson.hearts, combo: this.combo })
  }

  gameOver() {
    // 已在地獄(死神)模式中又死一次 → 黑暗奪心的壞結局演出
    if (this.deathMode) return this.enterBadEnding()

    this.deaths += 1 // 累積死亡 → 畫面漸暗

    // 嵌入模式:沒有「無縫復活/劇情」的空間,維持原本回呼
    if (this.embed) {
      if (this.deaths >= CORRUPTION.deathModeAt) this.deathMode = true
      return this._finish(false)
    }

    // 前 deathModeAt 次死亡:進入「無縫復活轉場」——不跳失敗畫面,黑霧自四周聚攏到全黑,
    // 全黑底下重置站位(由 loop 在轉場過半時呼叫 _revive),再揭開續戰。獅子血量保留。
    // 第 deathModeAt 次(預設第 3 次)復活時,無縫轉入地獄(死神)模式。
    Audio.sfx('hit') // 倒下的悶擊(不停音樂)
    if (this.deaths >= CORRUPTION.deathModeAt) {
      this.deathMode = true
      this.lion.deathMode = true // 獅子化為死神(全面強化,見 lion.cfg / renderer)
      this.hudLabels = this._hudOverride || { ...LEVEL1.hud, ...(LEVEL1.deathHud || {}) }
      Audio.sfx('roar', { big: true })
    }
    this.ui.hidePauseButton()
    this.revive = { t: 0, done: false }
    this.state = STATE.REVIVING
  }

  // 死亡回歸的「重置」:在黑霧全黑底下執行,站位瞬移不會被看到。
  // 參孫與獅子回原本站位、獅子動畫重新登場(清掉進行中的衝刺/捕獸夾/爪擊);
  // ★ 獅子血量「倒退回 rewindSeconds 秒前」的值(Re:Zero 死亡回歸,損失這段進度),
  //   但**保留死神模式與累積的黑暗**(時間倒退、墮落不倒退)。
  _revive() {
    const s = this.samson
    const l = this.lion
    const rewindHp = this._hpAtRewind()
    const keepDeath = l.deathMode
    const keepMax = s.maxHearts // 金色的心突破的上限是永久增益,死亡回歸不收回
    s.reset() // 參孫回起始站位、滿血、idle
    l.reset() // 獅子回起始站位、enter 登場動畫、清掉捕獸夾/爪擊
    s.maxHearts = keepMax
    s.hearts = keepMax // 復活補滿到(突破後的)上限
    l.hp = rewindHp // 血量倒退回 30 秒前(reset 已設 maxHp,這裡覆寫)
    l.deathMode = keepDeath
    s.invuln = SAMSON.reviveInvuln // 復活後一段無敵
    this.combo = 0
    this.golden = [] // 清掉場上殘留的金心(站位已重置)
    // 回歸後從這個血量重新計時(下次倒退以此為新基準)
    this._clock = 0
    this._hpLog = [{ t: 0, hp: rewindHp }]
    this._hpLogTimer = 0
  }

  // 查「rewindSeconds 秒前」的獅子血量;歷史不足(開場未滿 30s)→ 用最舊樣本(通常=滿血)
  _hpAtRewind() {
    const target = this._clock - CORRUPTION.rewindSeconds
    let hp = this._hpLog.length ? this._hpLog[0].hp : this.lion.hp
    for (const e of this._hpLog) {
      if (e.t <= target) hp = e.hp
      else break
    }
    return Math.max(1, Math.min(LION.maxHp, hp)) // 夾在合理範圍,至少 1(避免一復活就 0 血收尾)
  }

  // 壞結局:黑霧 + 漆黑細手捏住心臟,演完進入壞結局畫面。演完後墮落清零(下一輪重新開始)。
  enterBadEnding() {
    this.ui.hidePauseButton()
    Audio.stopMusic()
    Audio.sfx('lose')
    if (this.embed) {
      this.deaths = 0
      this.deathMode = false
      return this._finish(false)
    }
    this.bad.t = 0
    this.state = STATE.BADENDING
  }

  toTitle() {
    this.state = STATE.TITLE
    this.deaths = 0 // 回標題 → 墮落清零
    this.deathMode = false
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
    stopSpeech()
    this.stopped = true
    if (this._onResize) window.removeEventListener('resize', this._onResize)
    if (this.input && this.input.detach) this.input.detach()
    Audio.stopMusic()
    Audio.pauseAll()
  }
}
