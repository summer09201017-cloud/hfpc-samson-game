import { VIEW, ARENA, SAMSON, LION, INTRO, FINISHER } from './config.js'

// 俯視角(3/4 視角)繪製:地面是一塊俯視的競技場,角色是站立的小人/小獅,
// 用 y 座標排序前後、腳下加陰影做出在地面走動的感覺。背景與角色全用 Canvas 向量
// (零美術檔),emoji 只用在提示/特效(⚠ 💢 👊 💥 ❤️)。邏輯解析度 960×540,等比縮放置中。
// renderer 只讀狀態,不改狀態。

const FONT = '"Noto Sans TC","Microsoft JhengHei",sans-serif'

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.cssW = VIEW.W
    this.cssH = VIEW.H
    this.dpr = 1
    this._t = 0
  }

  resize() {
    const stage = this.canvas.parentElement
    const w = stage.clientWidth
    const h = stage.clientHeight
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.cssW = w
    this.cssH = h
    this.canvas.width = Math.floor(w * this.dpr)
    this.canvas.height = Math.floor(h * this.dpr)
    this.canvas.style.width = w + 'px'
    this.canvas.style.height = h + 'px'
  }

  _begin() {
    const ctx = this.ctx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.cssW, this.cssH)
    const scale = Math.min(this.cssW / VIEW.W, this.cssH / VIEW.H)
    const ox = (this.cssW - VIEW.W * scale) / 2
    const oy = (this.cssH - VIEW.H * scale) / 2
    ctx.setTransform(this.dpr * scale, 0, 0, this.dpr * scale, this.dpr * ox, this.dpr * oy)
  }

  _emoji(e, x, y, size, baseline = 'alphabetic') {
    const ctx = this.ctx
    ctx.font = `${size}px "Segoe UI Emoji","Apple Color Emoji",serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = baseline
    ctx.fillText(e, x, y)
  }

  draw(game) {
    this._begin()
    this._t += 1 / 60
    const t = this._t
    if (game.state === 'intro') {
      this._drawIntro(game, t)
      return
    }
    if (game.state === 'finisher') {
      this._drawFinisher(game, t)
      return
    }
    this._drawArena(game, t)
  }

  // ---- 競技場場景(title / fight / paused / win / lose)----
  _drawArena(game, t) {
    const ctx = this.ctx
    const s = game.samson
    const l = game.lion
    this._bgArena(t)

    // 獅子蓄力:畫出「衝刺預示線」(紅色),讓玩家看清楚要往哪邊閃。
    // 追蹤中=半透明虛線(會跟著你轉);定住後(aimLocked)=更亮的實線(代表方向已鎖,要撲了)。
    if (l.state === 'telegraph') {
      const pulse = 0.45 + 0.4 * Math.abs(Math.sin(t * 10))
      const a = l.aimLocked ? 0.9 : 0.55 * pulse
      ctx.strokeStyle = `rgba(210,50,40,${a})`
      ctx.lineWidth = l.aimLocked ? 12 : 9
      ctx.setLineDash(l.aimLocked ? [] : [16, 12])
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(l.x, l.y)
      ctx.lineTo(l.x + l.dirX * LION.chargeDist, l.y + l.dirY * LION.chargeDist)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // 依 y 排序前後(y 大的在前/下方)
    const drawSamson = () => {
      const blink = s.invuln > 0 && Math.floor(s.invuln * 12) % 2 === 0 && game.state === 'fight'
      if (!blink) this._samson(s.x, s.y, s.face, s.action, s.actionT, s.moving, s.walkPhase)
    }
    const drawLion = () => this._lion(l.x, l.y, l.face, l.state, l.phase(), t, l.flash, l.open)
    if (s.y <= l.y) {
      drawSamson()
      drawLion()
    } else {
      drawLion()
      drawSamson()
    }

    // 提示:預備動作 ⚠ / 破綻 💢
    if (l.state === 'telegraph') {
      const bob = Math.sin(t * 12) * 3
      this._emoji('⚠️', l.x, l.y - 112 + bob, 38, 'middle')
    }
    if (l.open) {
      const bob = Math.sin(t * 8) * 4
      this._emoji('💢', l.x, l.y - 110 + bob, 34, 'middle')
      ctx.fillStyle = '#c0612a'
      ctx.font = `800 19px ${FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(t * 6))
      ctx.fillText('👊 靠近反擊!', l.x, l.y - 128)
      ctx.globalAlpha = 1
    }

    // 反擊命中爆擊
    if (game.fx.hitT > 0) {
      const k = game.fx.hitT / 0.35
      const cx = (s.x + l.x) / 2
      const cy = (s.y + l.y) / 2 - 30
      ctx.strokeStyle = `rgba(255,240,180,${k})`
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.arc(cx, cy, 18 + (1 - k) * 44, 0, Math.PI * 2)
      ctx.stroke()
      this._emoji('💥', cx, cy, 30 + (1 - k) * 16, 'middle')
    }

    // 受傷紅暈
    if (game.fx.hurtT > 0) {
      ctx.fillStyle = `rgba(190,40,30,${0.3 * (game.fx.hurtT / 0.4)})`
      ctx.fillRect(0, 0, VIEW.W, VIEW.H)
    }

    this._hud(game, t)
  }

  // ---- 開場:參孫站在葡萄園,少壯獅子從場邊登場吼叫 ----
  _drawIntro(game, t) {
    const ctx = this.ctx
    const p = Math.min(1, game.intro.t / INTRO.duration)
    const ease = p * p * (3 - 2 * p)
    this._bgArena(t)

    const sx = ARENA.x + 130
    const sy = ARENA.y + ARENA.h / 2
    const lx = VIEW.W + 60 + (ARENA.x + ARENA.w - 170 - (VIEW.W + 60)) * ease
    const ly = ARENA.y + ARENA.h / 2
    this._samson(sx, sy, 1, 'idle', 0, false, 0)
    this._lion(lx, ly, -1, p > 0.55 ? 'telegraph' : 'approach', 0, t, 0, false)

    if (p > 0.5) {
      const bob = Math.sin(t * 12) * 3
      this._emoji('💢', lx, ly - 112 + bob, 40, 'middle')
      ctx.fillStyle = '#b03020'
      ctx.font = `800 28px ${FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(t * 9))
      ctx.fillText('吼——!', lx - 76, ly - 70)
      ctx.globalAlpha = 1
    }

    ctx.fillStyle = 'rgba(40,20,8,0.6)'
    roundRect(ctx, VIEW.W / 2 - 320, VIEW.H - 60, 640, 42, 12)
    ctx.fill()
    ctx.fillStyle = '#ffe9cf'
    ctx.font = `600 19px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('一隻少壯獅子向參孫吼叫!　（輕點畫面跳過）', VIEW.W / 2, VIEW.H - 39)
  }

  // ---- 撕裂收尾:耶和華的靈大大感動參孫 ----
  _drawFinisher(game, t) {
    const ctx = this.ctx
    const s = game.samson
    const l = game.lion
    const p = Math.min(1, game.fin.t / FINISHER.duration)
    this._bgArena(t)

    const cx = (s.x + l.x) / 2
    const cy = (s.y + l.y) / 2 - 30
    const R = 40 + p * 460
    const halo = ctx.createRadialGradient(cx, cy, 8, cx, cy, R)
    halo.addColorStop(0, `rgba(255,242,196,${0.9 - p * 0.3})`)
    halo.addColorStop(0.5, `rgba(255,212,116,${0.45 - p * 0.2})`)
    halo.addColorStop(1, 'rgba(255,212,116,0)')
    ctx.fillStyle = halo
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2)
    ctx.strokeStyle = `rgba(255,236,172,${0.5 * (1 - p)})`
    ctx.lineWidth = 3
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + t * 0.4
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * 42, cy + Math.sin(a) * 42)
      ctx.lineTo(cx + Math.cos(a) * (62 + p * 220), cy + Math.sin(a) * (62 + p * 220))
      ctx.stroke()
    }

    // 獅子裂開淡出
    ctx.globalAlpha = Math.max(0, 1 - p * 1.25)
    ctx.save()
    ctx.translate(-p * 30, 0)
    this._lion(l.x, l.y, l.face, 'recovery', l.phase(), t, 0, false)
    ctx.restore()
    ctx.globalAlpha = 1

    this._samson(s.x, s.y, l.x < s.x ? -1 : 1, 'idle', 0, false, 0)

    const vk = Math.max(0, (p - 0.35) / 0.65)
    if (vk > 0) {
      ctx.globalAlpha = Math.min(1, vk)
      ctx.fillStyle = 'rgba(40,20,8,0.55)'
      roundRect(ctx, VIEW.W / 2 - 310, 30, 620, 56, 14)
      ctx.fill()
      ctx.fillStyle = '#ffe9b0'
      ctx.font = `800 26px ${FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('耶和華的靈大大感動參孫', VIEW.W / 2, 58)
      ctx.globalAlpha = 1
    }
  }

  // ---- 背景:俯視的亭拿葡萄園競技場 ----
  _bgArena(t) {
    const ctx = this.ctx
    const A = ARENA
    // 場外(葡萄園邊緣的暗土色)
    ctx.fillStyle = '#2e1d0c'
    ctx.fillRect(0, 0, VIEW.W, VIEW.H)

    // 場外四角的葡萄叢點綴
    const bush = (bx, by) => {
      ctx.fillStyle = '#4d7230'
      ctx.beginPath()
      ctx.arc(bx, by, 16, 0, Math.PI * 2)
      ctx.arc(bx + 14, by + 6, 12, 0, Math.PI * 2)
      ctx.arc(bx - 12, by + 7, 11, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#6a3d8a'
      ctx.beginPath()
      ctx.arc(bx, by + 4, 3, 0, Math.PI * 2)
      ctx.arc(bx + 7, by + 8, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    bush(30, 70)
    bush(VIEW.W - 34, 74)
    bush(34, VIEW.H - 30)
    bush(VIEW.W - 30, VIEW.H - 26)

    // 競技場地面(土黃)
    ctx.fillStyle = '#cdaa6a'
    ctx.fillRect(A.x, A.y, A.w, A.h)
    // 葡萄行條紋(直紋)
    ctx.strokeStyle = 'rgba(120,92,52,0.32)'
    ctx.lineWidth = 10
    for (let x = A.x + 54; x < A.x + A.w; x += 82) {
      ctx.beginPath()
      ctx.moveTo(x, A.y + 10)
      ctx.lineTo(x, A.y + A.h - 10)
      ctx.stroke()
    }
    // 土地細點(固定位置,不閃爍)
    ctx.fillStyle = 'rgba(150,115,60,0.4)'
    for (let i = 0; i < 44; i++) {
      const hx = A.x + 12 + ((i * 97) % (A.w - 24))
      const hy = A.y + 12 + ((i * 53) % (A.h - 24))
      ctx.fillRect(hx, hy, 5, 3)
    }

    // 邊牆(低矮泥磚框)
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#8a5e30'
    ctx.lineWidth = 12
    ctx.strokeRect(A.x, A.y, A.w, A.h)
    ctx.strokeStyle = '#a8743c'
    ctx.lineWidth = 4
    ctx.strokeRect(A.x, A.y, A.w, A.h)
  }

  _shadow(x, y, r) {
    const ctx = this.ctx
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.beginPath()
    ctx.ellipse(x, y + 2, r, r * 0.4, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // ---- 參孫(俯視站立小人,可左右朝向、走路擺動、出手前傾)----
  _samson(x, footY, face, action, actionT, moving, walkPhase) {
    const ctx = this.ctx
    const SKIN = '#e3a76b'
    const SKIN_D = '#c98b50'
    const HAIR = '#3a2412'
    const TUNIC = '#9a6a34'
    const TUNIC_D = '#7d5328'
    const BELT = '#5b3a16'

    this._shadow(x, footY, 20)
    ctx.save()
    ctx.translate(x, footY)
    if (face < 0) ctx.scale(-1, 1)

    const sw = moving ? Math.sin(walkPhase) * 0.5 : 0
    const aF = action === 'attack' ? Math.min(1, actionT / SAMSON.attackTime) : 0
    const lean = action === 'attack' ? Math.sin(aF * Math.PI) * 0.45 : 0
    const hipY = -30
    const shoulderY = -54
    const headY = -64
    const headR = 8

    const drawLeg = (ang, color) => {
      const fx = Math.sin(ang) * 15
      ctx.strokeStyle = color
      ctx.lineWidth = 9
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(0, hipY)
      ctx.lineTo(fx, -2)
      ctx.stroke()
      ctx.fillStyle = '#5e3c18'
      ctx.beginPath()
      ctx.ellipse(fx + 2, -1, 7, 3.4, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 0.9
    drawLeg(-sw, SKIN_D)
    ctx.globalAlpha = 1
    drawLeg(sw, SKIN)

    ctx.save()
    ctx.translate(0, hipY)
    ctx.rotate(lean)
    ctx.translate(0, -hipY)

    // 軀幹(束腰短袍)
    ctx.fillStyle = TUNIC
    ctx.beginPath()
    ctx.moveTo(-12, shoulderY)
    ctx.lineTo(12, shoulderY)
    ctx.lineTo(13, hipY)
    ctx.lineTo(-13, hipY)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = TUNIC_D
    ctx.beginPath()
    ctx.moveTo(3, shoulderY)
    ctx.lineTo(12, shoulderY)
    ctx.lineTo(13, hipY)
    ctx.lineTo(4, hipY)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = BELT
    ctx.lineWidth = 4
    ctx.lineCap = 'butt'
    ctx.beginPath()
    ctx.moveTo(-12, hipY - 3)
    ctx.lineTo(13, hipY - 3)
    ctx.stroke()

    // 後手臂
    ctx.strokeStyle = SKIN_D
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-6, shoulderY + 3)
    ctx.lineTo(-13, shoulderY + 20)
    ctx.stroke()

    // 前手臂(出手時往前伸拳)
    const reach = action === 'attack' ? 16 + Math.sin(aF * Math.PI) * 24 : 9
    const fistY = action === 'attack' ? shoulderY + 6 : shoulderY + 22
    ctx.strokeStyle = SKIN
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.moveTo(6, shoulderY + 3)
    ctx.lineTo(reach, fistY)
    ctx.stroke()
    ctx.fillStyle = SKIN
    ctx.beginPath()
    ctx.arc(reach, fistY, 5.2, 0, Math.PI * 2)
    ctx.fill()

    // 脖子 + 頭
    ctx.strokeStyle = SKIN
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(0, shoulderY)
    ctx.lineTo(0, headY + headR - 2)
    ctx.stroke()
    ctx.fillStyle = SKIN
    ctx.beginPath()
    ctx.arc(0, headY, headR, 0, Math.PI * 2)
    ctx.fill()

    // 長髮(力量的記號)
    ctx.fillStyle = HAIR
    ctx.beginPath()
    ctx.arc(0, headY - 1, headR + 2, Math.PI * 0.92, Math.PI * 2.08)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(-headR, headY - 4)
    ctx.quadraticCurveTo(-headR - 11, headY + 16, -headR - 2, headY + 26)
    ctx.quadraticCurveTo(-2, headY + 12, -headR + 2, headY - 2)
    ctx.closePath()
    ctx.fill()

    // 臉朝右(本地座標):鼻、眼、短鬍
    ctx.fillStyle = SKIN
    ctx.beginPath()
    ctx.arc(headR - 1, headY + 1, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2a1a0e'
    ctx.beginPath()
    ctx.arc(headR - 3.5, headY - 1, 1.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = HAIR
    ctx.beginPath()
    ctx.moveTo(-2, headY + 4)
    ctx.quadraticCurveTo(headR - 1, headY + headR + 6, headR - 1, headY + 3)
    ctx.quadraticCurveTo(headR - 4, headY + headR, -2, headY + 4)
    ctx.closePath()
    ctx.fill()

    ctx.restore()
    ctx.restore()
  }

  // ---- 少壯獅子(俯視站立小獅,本地座標朝左;face>0 時水平翻轉成朝右)----
  _lion(x, footY, face, state, phase, t, flash, open) {
    const ctx = this.ctx
    const BODY = ['#c98a3a', '#b3742a', '#9a5f22'][phase] || '#c98a3a'
    const BODY_D = ['#a8702a', '#8f5a1e', '#774717'][phase] || '#a8702a'
    const MANE = ['#7a4a1c', '#683f17', '#542f10'][phase] || '#7a4a1c'

    this._shadow(x, footY, 38)
    ctx.save()
    ctx.translate(x, footY)
    if (face > 0) ctx.scale(-1, 1) // 本地朝左,需要朝右時翻轉

    const walking = state === 'enter' || state === 'approach'
    const walk = walking ? Math.sin(t * 9) : 0
    let bodyY = -46
    let bodyW = 64
    const bodyH = 30
    let headX = -54
    let headY = -52
    let rear = 0
    if (state === 'telegraph') {
      rear = 1
      headY = -66
      bodyY = -50
    } else if (state === 'charge') {
      headX = -66
      headY = -46
      bodyW = 72
    } else if (state === 'recovery') {
      headY = -36
      bodyY = -40
    }

    // 尾巴
    ctx.strokeStyle = BODY_D
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(52, bodyY + 4)
    ctx.quadraticCurveTo(78 + walk * 4, bodyY - 10, 72, bodyY - 28)
    ctx.stroke()
    ctx.fillStyle = MANE
    ctx.beginPath()
    ctx.arc(72, bodyY - 30, 5, 0, Math.PI * 2)
    ctx.fill()

    // 遠側腿
    const leg = (lx, swing, color) => {
      ctx.strokeStyle = color
      ctx.lineWidth = 9
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(lx, bodyY + bodyH - 8)
      ctx.lineTo(lx + swing, -2)
      ctx.stroke()
      ctx.fillStyle = BODY_D
      ctx.beginPath()
      ctx.ellipse(lx + swing, -1, 7, 3.2, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 0.88
    leg(42, walk * 8, BODY_D)
    leg(-26, -walk * 8, BODY_D)
    ctx.globalAlpha = 1

    // 軀幹
    ctx.fillStyle = BODY
    ctx.beginPath()
    ctx.ellipse(8, bodyY, bodyW, bodyH, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = BODY_D
    ctx.beginPath()
    ctx.ellipse(8, bodyY + 9, bodyW * 0.88, bodyH * 0.5, 0, 0, Math.PI * 2)
    ctx.fill()

    // 近側腿
    leg(38, -walk * 8, BODY)
    leg(-20, walk * 8, BODY)

    // 鬃毛(放射)
    const mx = headX + 12
    const my = headY + 6
    ctx.fillStyle = MANE
    ctx.beginPath()
    ctx.arc(mx, my, 28 + rear * 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = MANE
    ctx.lineWidth = 4
    const spikes = 13
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2
      const r1 = 25 + rear * 3
      const r2 = r1 + (rear ? 13 : 8) + (i % 2)
      ctx.beginPath()
      ctx.moveTo(mx + Math.cos(a) * r1, my + Math.sin(a) * r1)
      ctx.lineTo(mx + Math.cos(a) * r2, my + Math.sin(a) * r2)
      ctx.stroke()
    }

    // 頭
    ctx.fillStyle = BODY
    ctx.beginPath()
    ctx.arc(headX, headY, 17, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(headX + 9, headY - 14, 5, 0, Math.PI * 2) // 耳
    ctx.fill()
    ctx.fillStyle = BODY_D
    ctx.beginPath()
    ctx.ellipse(headX - 12, headY + 4, 9, 7, 0, 0, Math.PI * 2)
    ctx.fill()
    const roar = state === 'telegraph' || state === 'charge'
    if (roar) {
      ctx.fillStyle = '#4a1810'
      ctx.beginPath()
      ctx.ellipse(headX - 13, headY + 8, 7, 6, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.moveTo(headX - 19, headY + 3)
      ctx.lineTo(headX - 16, headY + 9)
      ctx.lineTo(headX - 21, headY + 8)
      ctx.closePath()
      ctx.fill()
    } else {
      ctx.strokeStyle = '#4a1810'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(headX - 18, headY + 9)
      ctx.lineTo(headX - 8, headY + 9)
      ctx.stroke()
    }
    ctx.fillStyle = '#2a160a'
    ctx.beginPath()
    ctx.arc(headX - 19, headY + 1, 2.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = open ? '#fff' : '#2a160a'
    ctx.beginPath()
    ctx.arc(headX - 6, headY - 4, 2.3, 0, Math.PI * 2)
    ctx.fill()

    if (flash > 0) {
      ctx.globalAlpha = Math.min(0.6, flash * 2)
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.ellipse(8, bodyY, bodyW + 22, bodyH + 22, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    ctx.restore()
  }

  // ---- HUD:參孫的心、獅子血條、操作提示 ----
  _hud(game, t) {
    const ctx = this.ctx
    const s = game.samson
    const l = game.lion
    if (game.state !== 'fight' && game.state !== 'paused') return

    for (let i = 0; i < s.hearts; i++) this._emoji('❤️', 34 + i * 38, 38, 30, 'middle')

    const barW = 300
    const barH = 18
    const bx = (VIEW.W - barW) / 2
    const by = 26
    const colors = ['#4caf50', '#ff9800', '#e53935']
    ctx.fillStyle = 'rgba(20,12,4,0.5)'
    roundRect(ctx, bx - 2, by - 2, barW + 4, barH + 4, 9)
    ctx.fill()
    const hpFrac = Math.max(0, l.hp) / LION.maxHp
    ctx.fillStyle = colors[l.phase()] || colors[0]
    roundRect(ctx, bx, by, barW * hpFrac, barH, 8)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 2
    for (let i = 1; i < LION.maxHp; i++) {
      const xx = bx + (barW * i) / LION.maxHp
      ctx.beginPath()
      ctx.moveTo(xx, by)
      ctx.lineTo(xx, by + barH)
      ctx.stroke()
    }
    const goal = (game.hudLabels && game.hudLabels.goal) || '少壯獅子'
    ctx.fillStyle = '#f3ead0'
    ctx.font = `700 15px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(`🦁 ${goal}`, VIEW.W / 2, by - 4)

    if (game.combo >= 2) {
      ctx.fillStyle = '#ffd27a'
      ctx.font = `800 22px ${FONT}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.globalAlpha = 0.7 + 0.3 * Math.abs(Math.sin(t * 8))
      ctx.fillText(`連擊 ×${game.combo}`, 34, 70)
      ctx.globalAlpha = 1
    }

    ctx.fillStyle = 'rgba(245,234,208,0.92)'
    ctx.font = `600 16px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(
      'WASD／方向鍵(或拖曳畫面)走位閃避　·　靠近獅子、趁牠喘氣 💢 時攻擊(空白／點一下)',
      VIEW.W / 2,
      VIEW.H - 10
    )
  }
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, h / 2, w / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
