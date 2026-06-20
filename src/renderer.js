import { VIEW, ARENA, SAMSON, LION, HONEY, ROCK, CORRUPTION, GOLDEN_HEART, ESCAPE, INTRO, FINISHER, BADEND } from './config.js'

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
    if (game.state === 'badending') {
      this._drawBadEnding(game, t)
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

    // 命中震動:只搖「世界層」(地面紋已畫,搖角色/特效;HUD 與全螢幕覆蓋層不搖)
    const sk = game.fx.shakeT > 0 ? (game.fx.shakeMag || 4) * (game.fx.shakeT / 0.2) : 0
    const shakeOn = sk > 0.2
    if (shakeOn) {
      ctx.save()
      ctx.translate(Math.sin(t * 90) * sk, Math.cos(t * 113) * sk)
    }

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

    // 第二階段:捕獸夾。先在地上顯示警示提示(fangWarn,無傷),時間到才彈出捕獸夾(傷人)。
    for (const f of l.fangs) {
      const R = LION.fangR
      ctx.save()
      ctx.translate(f.x, f.y)
      if (f.t < LION.fangWarn) {
        // —— 警示期:紅色目標圈(逐漸收緊 + 脈動 + 中央十字),告訴你捕獸夾要在這裡彈出 ——
        const prog = f.t / LION.fangWarn
        const pulse = 0.4 + 0.45 * Math.abs(Math.sin(t * 10))
        ctx.globalAlpha = 0.16 + 0.24 * prog
        ctx.fillStyle = '#d23228'
        ctx.beginPath()
        ctx.arc(0, 0, R * 0.95, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = pulse
        ctx.strokeStyle = '#d23228'
        ctx.lineWidth = 2.5
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.arc(0, 0, R * (1.35 - 0.35 * prog), 0, Math.PI * 2) // 收緊 → 快彈出
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 0.55 + 0.35 * prog
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(-7, 0)
        ctx.lineTo(7, 0)
        ctx.moveTo(0, -7)
        ctx.lineTo(0, 7)
        ctx.stroke()
      } else {
        // —— 出現期:俯視「捕獸夾」(set 狀態:鋼底盤 + 兩側彈簧 + 鋸齒環 + 中央踏板)——
        const age2 = f.t - LION.fangWarn
        const pop = Math.min(1, age2 / 0.12) // 彈出
        const fade = age2 > LION.fangLife - 0.6 ? Math.max(0, (LION.fangLife - age2) / 0.6) : 1
        const rr = R * (0.82 + 0.18 * pop)
        ctx.globalAlpha = fade
        // 陰影
        ctx.fillStyle = 'rgba(0,0,0,0.30)'
        ctx.beginPath()
        ctx.ellipse(0, rr * 0.3, rr * 1.1, rr * 0.5, 0, 0, Math.PI * 2)
        ctx.fill()
        // 兩側彈簧(左右小圓)
        ctx.fillStyle = '#8b9097'
        for (const sgn of [-1, 1]) {
          ctx.beginPath()
          ctx.arc(sgn * rr * 1.05, 0, rr * 0.3, 0, Math.PI * 2)
          ctx.fill()
        }
        // 鋼底盤
        ctx.fillStyle = '#6b7077'
        ctx.beginPath()
        ctx.arc(0, 0, rr, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#3c4045'
        ctx.beginPath()
        ctx.arc(0, 0, rr * 0.72, 0, Math.PI * 2)
        ctx.fill()
        // 鋸齒環(指向中心;左右留鉸鏈缺口 → 看起來是兩片夾顎)
        ctx.fillStyle = '#eef2f6'
        const N = 12
        for (let k = 0; k < N; k++) {
          const ang = (k / N) * Math.PI * 2
          const norm = Math.atan2(Math.sin(ang), Math.cos(ang))
          if (Math.abs(norm) < 0.4 || Math.abs(Math.abs(norm) - Math.PI) < 0.4) continue // 鉸鏈缺口
          const half = 0.17
          const baseR = rr * 0.95
          const tipR = rr * 0.5
          ctx.beginPath()
          ctx.moveTo(Math.cos(ang - half) * baseR, Math.sin(ang - half) * baseR)
          ctx.lineTo(Math.cos(ang + half) * baseR, Math.sin(ang + half) * baseR)
          ctx.lineTo(Math.cos(ang) * tipR, Math.sin(ang) * tipR)
          ctx.closePath()
          ctx.fill()
        }
        // 中央踏板(觸發盤)
        ctx.fillStyle = '#2b2e33'
        ctx.beginPath()
        ctx.arc(0, 0, rr * 0.28, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#a8324a'
        ctx.beginPath()
        ctx.arc(0, 0, rr * 0.12, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
    ctx.globalAlpha = 1

    // 大範圍爪擊:warn = 沿線的紅色預警(穿過全場、會越來越亮);strike = 沿線揮下的亮白斬擊 + 三道爪痕。
    const cl = l.claw
    if (cl.state === 'warn' || cl.state === 'strike') {
      const L = 1200
      const x1 = cl.x - cl.dx * L
      const y1 = cl.y - cl.dy * L
      const x2 = cl.x + cl.dx * L
      const y2 = cl.y + cl.dy * L
      ctx.save()
      ctx.beginPath()
      ctx.rect(ARENA.x, ARENA.y, ARENA.w, ARENA.h) // 限制在場內
      ctx.clip()
      ctx.lineCap = 'butt'
      if (cl.state === 'warn') {
        const prog = cl.t / LION.clawTelegraph
        const pulse = 0.4 + 0.5 * Math.abs(Math.sin(t * 12))
        // 半寬警示帶(會被掃到的範圍)
        ctx.globalAlpha = 0.1 + 0.16 * prog
        ctx.strokeStyle = '#d23228'
        ctx.lineWidth = LION.clawHalfWidth * 2
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
        // 中央紅線(越接近揮下越亮越粗)
        ctx.globalAlpha = 0.5 + 0.5 * prog * pulse
        ctx.lineWidth = 3 + 4 * prog
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      } else {
        // strike:亮白主刃快速淡出
        const k = cl.t / LION.clawStrike // 0..1
        ctx.globalAlpha = Math.max(0, 1 - k)
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = LION.clawHalfWidth * 2 * (1 - 0.3 * k)
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
        // 三道爪痕(沿法線偏移)
        ctx.strokeStyle = 'rgba(210,50,40,0.92)'
        ctx.lineWidth = 4
        for (const off of [-18, 0, 18]) {
          const ox = -cl.dy * off
          const oy = cl.dx * off
          ctx.beginPath()
          ctx.moveTo(x1 + ox, y1 + oy)
          ctx.lineTo(x2 + ox, y2 + oy)
          ctx.stroke()
        }
      }
      ctx.restore()
      ctx.globalAlpha = 1
    }

    // 蜂窩補血道具(呼應「從死獅取蜜」):金色光暈 + 🍯 + 小愛心;將消失時閃爍。
    for (const h of game.honeys) {
      if (h.t > HONEY.life - 1.5 && Math.floor(h.t * 8) % 2 === 0) continue // 快消失:閃爍提示
      const cy = h.y + Math.sin(t * 3 + h.x * 0.05) * 3 // 上下飄浮
      const glow = ctx.createRadialGradient(h.x, cy, 2, h.x, cy, HONEY.r + 12)
      glow.addColorStop(0, 'rgba(255,201,71,0.55)')
      glow.addColorStop(1, 'rgba(255,201,71,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(h.x, cy, HONEY.r + 12, 0, Math.PI * 2)
      ctx.fill()
      this._emoji('🍯', h.x, cy, 36, 'middle')
      this._emoji('❤️', h.x + 15, cy - 16, 17, 'middle')
    }

    // 金色的心(💛):稀有,撿到突破血量上限。比蜂窩更閃耀的金光暈 + 旋轉星芒 + 💛 + ✨。
    for (const h of game.golden || []) {
      if (h.t > GOLDEN_HEART.life - 1.5 && Math.floor(h.t * 8) % 2 === 0) continue // 快消失:閃爍
      const cy = h.y + Math.sin(t * 3 + h.x * 0.05) * 4
      const pulse = 0.7 + 0.3 * Math.abs(Math.sin(t * 4))
      const glow = ctx.createRadialGradient(h.x, cy, 2, h.x, cy, (GOLDEN_HEART.r + 16) * pulse)
      glow.addColorStop(0, 'rgba(255,215,70,0.85)')
      glow.addColorStop(0.6, 'rgba(255,196,40,0.35)')
      glow.addColorStop(1, 'rgba(255,196,40,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(h.x, cy, (GOLDEN_HEART.r + 16) * pulse, 0, Math.PI * 2)
      ctx.fill()
      // 旋轉星芒
      ctx.strokeStyle = `rgba(255,240,170,${0.5 * pulse})`
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + t * 1.2
        ctx.beginPath()
        ctx.moveTo(h.x + Math.cos(a) * 16, cy + Math.sin(a) * 16)
        ctx.lineTo(h.x + Math.cos(a) * 26, cy + Math.sin(a) * 26)
        ctx.stroke()
      }
      this._emoji('💛', h.x, cy, 34, 'middle')
      this._emoji('✨', h.x + 16, cy - 15, 16, 'middle')
    }

    // 最後狂暴:獅子腳下脈動紅光暈(暗示「所有攻擊加快」)
    if (l.enraged()) {
      const pulse = 0.5 + 0.5 * Math.abs(Math.sin(t * 9))
      const rad = LION.r * (1.5 + 0.25 * pulse)
      const aura = ctx.createRadialGradient(l.x, l.y, LION.r * 0.4, l.x, l.y, rad)
      aura.addColorStop(0, `rgba(220,40,30,${0.35 * pulse})`)
      aura.addColorStop(1, 'rgba(220,40,30,0)')
      ctx.fillStyle = aura
      ctx.beginPath()
      ctx.arc(l.x, l.y, rad, 0, Math.PI * 2)
      ctx.fill()
    }

    // 依 y 排序前後(y 大的在前/下方)
    const drawSamson = () => {
      const blink = s.invuln > 0 && Math.floor(s.invuln * 12) % 2 === 0 && game.state === 'fight'
      if (!blink) this._samson(s.x, s.y, s.face, s.action, s.actionT, s.moving, s.walkPhase)
    }
    const drawLion = () => this._lion(l.x, l.y, l.face, l.state, l.phase(), t, l.flash, l.open, l.deathMode)
    if (s.y <= l.y) {
      drawSamson()
      drawLion()
    } else {
      drawLion()
      drawSamson()
    }

    // 石頭:地上=帶陰影的灰石(將消失時閃爍);飛行=旋轉的石塊 + 後方塵痕。
    for (const r of game.rocks) {
      if (r.state === 'ground' && r.t > ROCK.life - 1.5 && Math.floor(r.t * 8) % 2 === 0) continue
      ctx.save()
      if (r.state === 'thrown') {
        // 後方塵痕(逆飛行方向)
        ctx.globalAlpha = 0.4
        ctx.strokeStyle = 'rgba(180,180,180,0.7)'
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.moveTo(r.x, r.y)
        ctx.lineTo(r.x - r.dx * 26, r.y - r.dy * 26)
        ctx.stroke()
        ctx.globalAlpha = 1
        ctx.translate(r.x, r.y)
        ctx.rotate(r.spin || 0)
      } else {
        ctx.translate(r.x, r.y)
        // 腳下陰影
        ctx.fillStyle = 'rgba(0,0,0,0.28)'
        ctx.beginPath()
        ctx.ellipse(0, ROCK.r * 0.5, ROCK.r * 0.95, ROCK.r * 0.4, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      // 石塊本體
      const g = ctx.createRadialGradient(-ROCK.r * 0.3, -ROCK.r * 0.3, 2, 0, 0, ROCK.r)
      g.addColorStop(0, '#9aa0a6')
      g.addColorStop(1, '#565b61')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(0, 0, ROCK.r, ROCK.r * 0.85, 0, 0, Math.PI * 2)
      ctx.fill()
      // 裂痕
      ctx.strokeStyle = 'rgba(40,44,48,0.5)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(-ROCK.r * 0.4, -ROCK.r * 0.1)
      ctx.lineTo(ROCK.r * 0.1, ROCK.r * 0.25)
      ctx.stroke()
      ctx.restore()
    }

    // 吃到蜂窩:上升的愛心(補血回饋)
    if (game.fx.healT > 0) {
      const p = 1 - game.fx.healT / 0.6
      ctx.save()
      ctx.globalAlpha = Math.min(1, game.fx.healT / 0.6)
      this._emoji('❤️', game.fx.healX, game.fx.healY - 30 - p * 28, 30, 'middle')
      ctx.restore()
      ctx.globalAlpha = 1
    }

    // 死神模式:獅子頭上飄一個 💀(在翻轉的 _lion 之外畫,方向才正確)
    if (l.deathMode) {
      const bob = Math.sin(t * 2.5) * 4
      this._emoji('💀', l.x, l.y - 96 + bob, 30, 'middle')
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

    // 反擊命中爆擊(加大:雙重衝擊環 + 放射星芒 + 白閃 + 大 💥,連擊越高越誇張)
    if (game.fx.hitT > 0) {
      const k = game.fx.hitT / 0.5 // 1 → 0
      const e = 1 - k // 0 → 1(擴散進度)
      const cx = (s.x + l.x) / 2
      const cy = (s.y + l.y) / 2 - 26
      const combo = Math.min(game.combo || 1, 8)
      const boost = 1 + combo * 0.08
      // 命中瞬間白閃(很短)
      if (k > 0.72) {
        ctx.fillStyle = `rgba(255,250,235,${(k - 0.72) / 0.28 * 0.5})`
        ctx.fillRect(0, 0, VIEW.W, VIEW.H)
      }
      // 放射星芒
      ctx.strokeStyle = `rgba(255,238,150,${k})`
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      const spokes = 8
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * Math.PI * 2 + 0.2
        const r1 = 14 + e * 26
        const r2 = r1 + (22 + e * 40) * boost
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2)
        ctx.stroke()
      }
      // 雙重衝擊環
      ctx.strokeStyle = `rgba(255,240,180,${k})`
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.arc(cx, cy, (16 + e * 50) * boost, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = `rgba(255,255,255,${k * 0.8})`
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(cx, cy, (8 + e * 30) * boost, 0, Math.PI * 2)
      ctx.stroke()
      this._emoji('💥', cx, cy, (34 + e * 22) * boost, 'middle')
    }

    if (shakeOn) ctx.restore() // 結束「世界層」震動(以下覆蓋層/HUD 不震)

    // 墮落漸暗:每死一次畫面更黑一點;死神模式再加深 + 暗紫邊角暈影
    if (game.deaths > 0) {
      const lv = Math.min(game.deaths, CORRUPTION.deathModeAt)
      ctx.fillStyle = `rgba(0,0,0,${lv * CORRUPTION.darkenPerDeath})`
      ctx.fillRect(0, 0, VIEW.W, VIEW.H)
      if (game.deathMode) {
        const vg = ctx.createRadialGradient(VIEW.W / 2, VIEW.H / 2, 120, VIEW.W / 2, VIEW.H / 2, VIEW.W * 0.62)
        vg.addColorStop(0, 'rgba(20,0,30,0)')
        vg.addColorStop(1, 'rgba(20,0,30,0.55)')
        ctx.fillStyle = vg
        ctx.fillRect(0, 0, VIEW.W, VIEW.H)
      }
    }

    // 受傷紅暈
    if (game.fx.hurtT > 0) {
      ctx.fillStyle = `rgba(190,40,30,${0.3 * (game.fx.hurtT / 0.4)})`
      ctx.fillRect(0, 0, VIEW.W, VIEW.H)
    }

    // 神蹟降臨:天降閃電打在獅子身上 + 全場神聖白光 + 經文(得勝出於神的靈)
    if (game.fx.boltT > 0) this._lightning(game, l)

    // 無縫復活轉場:黑霧自四周往中間聚攏直到全黑(約 3 秒)
    if (game.state === 'reviving') this._reviveMist(game)
    // 復活完成後:由全黑快速淡入,揭開重置好的場景
    if (game.fx.reviveT > 0) {
      ctx.fillStyle = `rgba(4,2,10,${Math.min(1, game.fx.reviveT / 0.5)})`
      ctx.fillRect(0, 0, VIEW.W, VIEW.H)
    }

    this._hud(game, t)
  }

  // 無縫復活轉場:黑霧鋪滿全場 + 四邊湧入 + 向心聚攏,整體加速變黑,末段全黑(站位在暗處重置)
  _reviveMist(game) {
    const ctx = this.ctx
    const tt = game.revive.t
    const p = Math.min(1, tt / CORRUPTION.reviveDuration) // 0 → 1
    const grow = 0.45 + 0.55 * p // 濃度隨進度上升(一開始就有、越來越濃)

    // 1) 鋪滿整個畫面的飄動煙團(質數步進避免規則排列;四角四邊都覆蓋)
    for (let i = 0; i < 44; i++) {
      const bx = ((i * 167 + 30) % VIEW.W) + Math.sin(tt * 0.9 + i) * 28
      const by = ((i * 109 + 24) % VIEW.H) + Math.cos(tt * 0.8 + i * 1.7) * 24
      const rad = 90 + 50 * Math.sin(tt * 1.4 + i * 2.1)
      this._smokePuff(bx, by, rad, 0.42 * grow)
    }
    // 2) 四邊向內湧的濃霧帶(上/下/左/右)
    for (let i = 0; i < 9; i++) {
      const f = i / 8
      const d = Math.sin(tt * 0.8 + i) * 22
      this._smokePuff(VIEW.W * f + d, 4, 120, 0.5 * grow)
      this._smokePuff(VIEW.W * f - d, VIEW.H - 4, 120, 0.5 * grow)
      this._smokePuff(4, VIEW.H * f + d, 120, 0.5 * grow)
      this._smokePuff(VIEW.W - 4, VIEW.H * f - d, 120, 0.5 * grow)
    }
    // 3) 繞著「自外向內收縮的環」向中央聚攏
    const ring = (1 - p) * VIEW.W * 0.6
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + tt * 0.8
      const cx = VIEW.W / 2 + Math.cos(a) * ring
      const cy = VIEW.H / 2 + Math.sin(a) * ring * 0.62
      this._smokePuff(cx, cy, 100 + 40 * Math.sin(i * 2 + tt * 3), 0.5 * grow)
    }
    // 4) 整體變黑(加速 p²),末段全黑
    ctx.fillStyle = `rgba(6,4,12,${Math.min(1, p * p * 1.08)})`
    ctx.fillRect(0, 0, VIEW.W, VIEW.H)
  }

  // 天降閃電(神蹟):鋸齒狀亮白閃電從天打到獅子,伴隨全場白光與經文淡出
  _lightning(game, l) {
    const ctx = this.ctx
    const k = game.fx.boltT / 0.6 // 1 → 0
    // 全場神聖白光(快速淡出)
    ctx.fillStyle = `rgba(255,250,235,${0.5 * k})`
    ctx.fillRect(0, 0, VIEW.W, VIEW.H)
    // 鋸齒閃電:從畫面頂端打到獅子頭頂(用 walkPhase 無關的固定折線,boltT 決定可見度)
    const topY = 0
    const tx = l.x
    const ty = l.y - LION.r
    const segs = 7
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const pass of [{ w: 11, c: `rgba(190,225,255,${0.55 * k})` }, { w: 4.5, c: `rgba(255,255,255,${k})` }]) {
      ctx.strokeStyle = pass.c
      ctx.lineWidth = pass.w
      ctx.beginPath()
      ctx.moveTo(tx, topY)
      for (let i = 1; i < segs; i++) {
        const f = i / segs
        // 固定鋸齒(不用亂數,避免逐幀跳動):用 sin 製造左右偏移,越接近獅子越收斂
        const jag = Math.sin(i * 2.3) * 34 * (1 - f)
        ctx.lineTo(tx + jag, topY + (ty - topY) * f)
      }
      ctx.lineTo(tx, ty)
      ctx.stroke()
    }
    // 擊中點爆光
    ctx.fillStyle = `rgba(255,255,255,${0.8 * k})`
    ctx.beginPath()
    ctx.arc(tx, ty, 26 * (0.5 + (1 - k)), 0, Math.PI * 2)
    ctx.fill()
    // 經文(神蹟降臨的意義)
    if (game.miracleText) {
      ctx.fillStyle = `rgba(60,40,15,${k})`
      ctx.font = `800 26px ${FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(game.miracleText, VIEW.W / 2, 70)
    }
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

  // ---- 壞結局演出:黑霧聚攏 → 漆黑細手「緩緩」伸出捏住心臟 → 全黑(伴隨畫面震動)----
  _drawBadEnding(game, t) {
    const ctx = this.ctx
    const s = game.samson
    const p = Math.min(1, game.bad.t / BADEND.duration)

    // 時間軸(總長拉長 → 伸手過程更慢更有壓迫感)
    const gather = Math.max(0, Math.min(1, p / 0.3)) // 黑霧聚攏:0→30%
    const reach = Math.max(0, Math.min(1, (p - 0.22) / 0.5)) // 手緩緩伸入:22%→72%
    const grip = Math.max(0, Math.min(1, (p - 0.66) / 0.2)) // 收攏捏住:66%→86%

    // 背景與壓暗層(不震動 → 邊緣不露空)
    this._bgArena(t)
    ctx.fillStyle = `rgba(8,2,12,${0.45 + 0.5 * p})`
    ctx.fillRect(0, 0, VIEW.W, VIEW.H)

    // 畫面震動:伸手時微震,捏住時加劇(只震動「動作層」)
    const shakeI = Math.min(1, reach * 0.4 + grip * 1.0)
    const amp = BADEND.shake * shakeI
    const shx = Math.sin(t * 53) * amp + Math.sin(t * 89) * amp * 0.4
    const shy = Math.cos(t * 61) * amp + Math.cos(t * 97) * amp * 0.4
    ctx.save()
    ctx.translate(shx, shy)

    // 參孫(站在中央,逐漸被吞沒)
    this._samson(s.x, s.y, 1, 'idle', 0, false, 0)
    const heartX = s.x
    const heartY = s.y - 42

    // 黑霧(四面八方):鋪滿全場的飄動煙團 + 四邊壓濃,隨 gather 變濃
    for (let i = 0; i < 30; i++) {
      // 散布到整個畫面(用質數步進避免規則排列)
      const bx = ((i * 167 + 40) % VIEW.W) + Math.sin(t * 0.5 + i) * 22
      const by = ((i * 109 + 30) % VIEW.H) + Math.cos(t * 0.45 + i * 1.7) * 18
      const rad = 46 + 22 * Math.sin(t * 1.2 + i * 2.1)
      this._smokePuff(bx, by, rad, 0.42 * gather)
    }
    // 四邊向內湧的濃霧帶(上/下/左/右)
    for (let i = 0; i < 8; i++) {
      const f = i / 7
      const drift = Math.sin(t * 0.8 + i) * 16
      this._smokePuff(VIEW.W * f + drift, 8, 70, 0.5 * gather) // 上
      this._smokePuff(VIEW.W * f - drift, VIEW.H - 8, 70, 0.5 * gather) // 下
      this._smokePuff(8, VIEW.H * f + drift, 70, 0.5 * gather) // 左
      this._smokePuff(VIEW.W - 8, VIEW.H * f - drift, 70, 0.5 * gather) // 右
    }
    // 圍繞參孫的較濃聚攏霧(吞沒感)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + t * 0.6
      const dist = 140 - 100 * gather + Math.sin(t * 2 + i) * 10
      const cx = s.x + Math.cos(a) * dist
      const cy = s.y - 20 + Math.sin(a) * dist * 0.7
      this._smokePuff(cx, cy, 34 + 14 * Math.sin(t * 1.5 + i * 2), 0.55 * gather)
    }

    // 漆黑細長的手:從右側黑霧深處的「固定根部」伸長出去,手指收攏到心臟位置
    if (reach > 0) {
      // ★ 根部固定不動(在右側深處的一團濃煙裡);手臂只「伸長」、不整支平移
      const rootX = s.x + 300
      const rootY = s.y - 8
      // 手掌位置:由固定根部往心臟推進(reach 0→1 = 伸長過去)
      const palmX = rootX + (heartX + 22 - rootX) * reach
      const palmY = rootY + (heartY - rootY) * reach
      // 固定不動的根部濃煙(手從這團煙裡伸出來)
      this._smokePuff(rootX, rootY, 64, 0.85)
      this._smokePuff(rootX + 16, rootY - 12, 46, 0.7)
      this._smokePuff(rootX - 12, rootY + 16, 50, 0.7)
      this._shadowHand(rootX, rootY, palmX, palmY, grip, t)

      // 心臟(被捏住 → 收縮 + 裂痕)
      const beat = 1 - 0.18 * Math.abs(Math.sin(t * 6))
      const squeeze = 1 - 0.5 * grip
      const hr = 11 * beat * squeeze
      ctx.fillStyle = `rgb(${170 - 60 * grip},${30 - 20 * grip},${40 - 20 * grip})`
      this._heart(heartX, heartY, hr)
      if (grip > 0.3) {
        ctx.strokeStyle = 'rgba(0,0,0,0.7)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(heartX, heartY - hr)
        ctx.lineTo(heartX - hr * 0.4, heartY + hr * 0.5)
        ctx.moveTo(heartX + hr * 0.3, heartY - hr * 0.3)
        ctx.lineTo(heartX - hr * 0.2, heartY + hr * 0.6)
        ctx.stroke()
      }
    }

    ctx.restore() // 結束震動層

    // 收尾全黑 + 字幕(不震動,維持可讀)
    if (p > 0.86) {
      const k = (p - 0.86) / 0.14
      ctx.fillStyle = `rgba(0,0,0,${k})`
      ctx.fillRect(0, 0, VIEW.W, VIEW.H)
    }
  }

  // 小愛心(以 (x,y) 為中心,r 為大致半徑)
  _heart(x, y, r) {
    const ctx = this.ctx
    ctx.beginPath()
    ctx.moveTo(x, y + r * 0.8)
    ctx.bezierCurveTo(x - r * 1.4, y - r * 0.4, x - r * 0.5, y - r * 1.2, x, y - r * 0.4)
    ctx.bezierCurveTo(x + r * 0.5, y - r * 1.2, x + r * 1.4, y - r * 0.4, x, y + r * 0.8)
    ctx.closePath()
    ctx.fill()
  }

  // 一團黑煙(放射漸層)
  _smokePuff(cx, cy, rad, alpha) {
    const ctx = this.ctx
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, rad)
    g.addColorStop(0, `rgba(10,6,16,${alpha})`)
    g.addColorStop(0.6, `rgba(12,7,18,${alpha * 0.6})`)
    g.addColorStop(1, 'rgba(12,7,18,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, rad, 0, Math.PI * 2)
    ctx.fill()
  }

  // 漆黑的手(從「固定根部」伸長出去抓心臟):手臂從 (rootX,rootY) 伸到手掌 (px,py)——
  // 根部不動,只有手臂變長、手掌前進(不是整支手平移)。grip 0→1 = 張開→收攏抓握。
  _shadowHand(rootX, rootY, px, py, grip, t = 0) {
    const ctx = this.ctx
    const DARK = '#06040e'
    const EDGE = '#241d3e' // 指節微光(讓人讀得出是手指)
    const ang = Math.atan2(py - rootY, px - rootX)
    const dist = Math.hypot(px - rootX, py - rootY)
    const open = 1 - grip

    // ── (a) 霧邊光暈:沿手臂與手掌鋪黑煙,邊緣化成煙霧(畫在實心手之下)──
    const steps = Math.max(2, Math.round(dist / 22))
    for (let i = 0; i <= steps; i++) {
      const f = i / steps
      const hx = rootX + (px - rootX) * f
      const hy = rootY + (py - rootY) * f
      this._smokePuff(hx, hy, 14 + 5 * Math.sin(f * 8 + t * 4), 0.5)
    }
    this._smokePuff(px, py, 22, 0.5) // 手掌處濃一點(縮小,避免糊成圓團)
    this._smokePuff(px + Math.cos(ang) * 20, py + Math.sin(ang) * 20, 13, 0.38) // 指尖外飄煙

    // ── (b) 實心手:疊在霧上,用陰影模糊讓邊緣「化開」=煙霧感,但形狀仍清楚 ──
    ctx.save()
    ctx.shadowColor = 'rgba(8,5,16,0.9)'
    ctx.shadowBlur = 5
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    // 前臂(root→palm,根部細、近掌粗)
    ctx.save()
    ctx.translate(rootX, rootY)
    ctx.rotate(ang)
    ctx.fillStyle = DARK
    ctx.beginPath()
    ctx.moveTo(0, -4)
    ctx.quadraticCurveTo(dist * 0.5, -7, dist, -8)
    ctx.lineTo(dist, 8)
    ctx.quadraticCurveTo(dist * 0.5, 7, 0, 4)
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    // 手掌 + 手指(本地 +x = 手指朝向)
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(ang)
    ctx.fillStyle = DARK
    // 手背(掌)
    ctx.beginPath()
    ctx.moveTo(-8, -9)
    ctx.quadraticCurveTo(11, -10, 12, -7)
    ctx.lineTo(12, 7)
    ctx.quadraticCurveTo(11, 10, -8, 9)
    ctx.closePath()
    ctx.fill()

    // 四指
    const fingers = [-7, -2.5, 2, 6.5]
    const segW = [4.4, 4.8, 4.6, 4.0]
    const fingerPaths = []
    for (let i = 0; i < 4; i++) {
      const yb = fingers[i]
      const reach = 16 + (i === 1 || i === 2 ? 3 : 0)
      const midX = 12 + reach * 0.55 * (0.6 + 0.4 * open)
      const midY = yb + grip * yb * -0.15
      const tipX = 12 + reach * (0.5 + 0.5 * open)
      const tipY = yb * (0.35 + 0.65 * open)
      fingerPaths.push({ yb, midX, midY, tipX, tipY, w: segW[i] })
      ctx.strokeStyle = DARK
      ctx.lineWidth = segW[i]
      ctx.beginPath()
      ctx.moveTo(12, yb)
      ctx.quadraticCurveTo(midX, midY - 3 * open, tipX, tipY)
      ctx.stroke()
    }
    // 拇指
    const thBaseX = 2
    const thBaseY = 10
    const thTipX = 12 + 9 * open
    const thTipY = 10 - 12 * grip
    ctx.strokeStyle = DARK
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(thBaseX, thBaseY)
    ctx.quadraticCurveTo(thBaseX + 8, thBaseY + 1, thTipX, thTipY)
    ctx.stroke()

    // 指節微光(關掉模糊,保持清晰 → 讀得出是手指)
    ctx.shadowBlur = 0
    ctx.strokeStyle = EDGE
    ctx.lineWidth = 1
    for (const f of fingerPaths) {
      ctx.beginPath()
      ctx.moveTo(13, f.yb - f.w * 0.3)
      ctx.quadraticCurveTo(f.midX, f.midY - 3 * open - f.w * 0.3, f.tipX, f.tipY)
      ctx.stroke()
    }
    ctx.restore()

    ctx.restore()
  }

  // 一串葡萄(以 (x,y) 為頂端掛點,s 為大小;含葉與藤捲鬚)
  _grapes(x, y, s) {
    const ctx = this.ctx
    // 葉
    ctx.fillStyle = '#5a8a32'
    ctx.beginPath()
    ctx.ellipse(x - 4 * s, y - 2 * s, 6 * s, 4 * s, -0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#6fa23d'
    ctx.beginPath()
    ctx.ellipse(x + 4 * s, y - 2 * s, 5 * s, 3.5 * s, 0.5, 0, Math.PI * 2)
    ctx.fill()
    // 葡萄粒(倒三角串)
    const rows = [[-2, 0], [0, 0], [2, 0], [-1, 2], [1, 2], [0, 4]]
    for (const [dx, dy] of rows) {
      const gx = x + dx * 3.1 * s
      const gy = y + (dy + 1) * 3.1 * s
      ctx.fillStyle = '#6a3d8a'
      ctx.beginPath()
      ctx.arc(gx, gy, 2.6 * s, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(180,140,210,0.7)' // 高光
      ctx.beginPath()
      ctx.arc(gx - 0.8 * s, gy - 0.8 * s, 1 * s, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // ---- 背景:俯視的亭拿葡萄園競技場 ----
  _bgArena(t) {
    const ctx = this.ctx
    const A = ARENA

    // 場外土壤(上深下淺的暖土漸層)
    const soil = ctx.createLinearGradient(0, 0, 0, VIEW.H)
    soil.addColorStop(0, '#33210e')
    soil.addColorStop(1, '#241608')
    ctx.fillStyle = soil
    ctx.fillRect(0, 0, VIEW.W, VIEW.H)

    // 環場葡萄園:沿四周(主要上/下帶)立藤架柱 + 拉線 + 掛葡萄串
    ctx.save()
    // 上方葡萄園帶(y 0..A.y)
    const postY0 = 16
    const postY1 = A.y - 14
    ctx.strokeStyle = 'rgba(90,66,38,0.9)'
    for (let x = 40; x < VIEW.W; x += 96) {
      // 立柱
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(x, postY0)
      ctx.lineTo(x, postY1)
      ctx.stroke()
    }
    // 拉線(兩條水平)
    ctx.strokeStyle = 'rgba(120,92,52,0.6)'
    ctx.lineWidth = 1.5
    for (const wy of [postY0 + 22, postY0 + 52]) {
      ctx.beginPath()
      ctx.moveTo(20, wy)
      ctx.lineTo(VIEW.W - 20, wy)
      ctx.stroke()
    }
    // 葡萄串(沿線掛,固定位置)
    for (let x = 64; x < VIEW.W; x += 96) {
      this._grapes(x, postY0 + 30, 1.05)
      this._grapes(x - 30, postY0 + 60, 0.9)
    }
    // 下方葡萄園帶(較窄,只掛矮葡萄叢)
    for (let x = 60; x < VIEW.W; x += 110) {
      this._grapes(x, A.y + A.h + 12, 0.85)
    }
    ctx.restore()

    // 競技場地面(土黃漸層 + 內陰影框)
    const floor = ctx.createLinearGradient(0, A.y, 0, A.y + A.h)
    floor.addColorStop(0, '#d8b676')
    floor.addColorStop(1, '#c39e5f')
    ctx.fillStyle = floor
    ctx.fillRect(A.x, A.y, A.w, A.h)
    // 耕作壟(交替亮暗直條,像犁過的葡萄園地)
    for (let x = A.x; x < A.x + A.w; x += 40) {
      ctx.fillStyle = 'rgba(120,92,52,0.10)'
      ctx.fillRect(x, A.y, 20, A.h)
    }
    ctx.strokeStyle = 'rgba(110,84,46,0.28)'
    ctx.lineWidth = 2
    for (let x = A.x + 40; x < A.x + A.w; x += 40) {
      ctx.beginPath()
      ctx.moveTo(x, A.y + 8)
      ctx.lineTo(x, A.y + A.h - 8)
      ctx.stroke()
    }
    // 土地細點(固定位置,不閃爍)
    ctx.fillStyle = 'rgba(150,115,60,0.38)'
    for (let i = 0; i < 60; i++) {
      const hx = A.x + 12 + ((i * 97) % (A.w - 24))
      const hy = A.y + 12 + ((i * 53) % (A.h - 24))
      ctx.fillRect(hx, hy, 4, 2.5)
    }
    // 地面內陰影(四邊向內壓暗,做出凹下的競技場感)
    const inner = ctx.createLinearGradient(0, A.y, 0, A.y + 40)
    inner.addColorStop(0, 'rgba(60,40,16,0.35)')
    inner.addColorStop(1, 'rgba(60,40,16,0)')
    ctx.fillStyle = inner
    ctx.fillRect(A.x, A.y, A.w, 40)

    // 石磚邊牆(分段磚塊 + 內外描邊);右下角留一道缺口(逃跑出口)
    ctx.fillStyle = '#7a5128'
    const bw = 12
    const gapW = ESCAPE.w // 底牆右端缺口寬
    const gapH = ESCAPE.h // 右牆底端缺口高
    ctx.fillRect(A.x - bw, A.y - bw, A.w + bw * 2, bw) // 上(完整)
    ctx.fillRect(A.x - bw, A.y - bw, bw, A.h + bw * 2) // 左(完整)
    ctx.fillRect(A.x - bw, A.y + A.h, A.w + bw - gapW, bw) // 下(右端斷開 gapW)
    ctx.fillRect(A.x + A.w, A.y - bw, bw, A.h + bw - gapH) // 右(底端斷開 gapH)
    // 磚縫
    ctx.strokeStyle = 'rgba(40,26,10,0.5)'
    ctx.lineWidth = 1.5
    for (let x = A.x - bw; x < A.x + A.w - gapW; x += 26) {
      ctx.beginPath()
      ctx.moveTo(x + 13, A.y + A.h)
      ctx.lineTo(x + 13, A.y + A.h + bw)
      ctx.stroke()
    }
    // 內框亮線:分四段,底/右避開缺口
    ctx.strokeStyle = '#a8743c'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(A.x - 1, A.y - 1)
    ctx.lineTo(A.x + A.w + 1, A.y - 1) // 上
    ctx.lineTo(A.x + A.w + 1, A.y + A.h - gapH) // 右(到缺口)
    ctx.moveTo(A.x - 1, A.y - 1)
    ctx.lineTo(A.x - 1, A.y + A.h + 1) // 左
    ctx.lineTo(A.x + A.w - gapW, A.y + A.h + 1) // 下(到缺口)
    ctx.stroke()
    // 缺口兩側的門柱端點(暗示「這裡是開口」)
    ctx.fillStyle = '#5e3c18'
    ctx.fillRect(A.x + A.w - gapW - 3, A.y + A.h, 5, bw)
    ctx.fillRect(A.x + A.w, A.y + A.h - gapH - 3, bw, 5)

    // 全畫面暗角(vignette),把視線收向中央
    const vg = ctx.createRadialGradient(VIEW.W / 2, VIEW.H / 2, VIEW.H * 0.34, VIEW.W / 2, VIEW.H / 2, VIEW.W * 0.62)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(1, 'rgba(0,0,0,0.32)')
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, VIEW.W, VIEW.H)
  }

  _shadow(x, y, r) {
    const ctx = this.ctx
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.beginPath()
    ctx.ellipse(x, y + 2, r, r * 0.4, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // ---- 參孫(俯視站立小人,正常人體比例,可左右朝向、走路擺動、出手前傾)----
  _samson(x, footY, face, action, actionT, moving, walkPhase) {
    const ctx = this.ctx
    const SKIN = '#e7ac72'
    const SKIN_D = '#c9874b'
    const HAIR = '#3a2412'
    const HAIR_HI = '#5a3a1c'
    const TUNIC = '#a9762f'
    const TUNIC_D = '#80561f'
    const TUNIC_HI = '#c1893f'
    const BELT = '#5b3a16'
    const BAND = '#b23b2e' // 紅頭帶

    this._shadow(x, footY, 18)
    ctx.save()
    ctx.translate(x, footY)
    if (face < 0) ctx.scale(-1, 1)

    const sw = moving ? Math.sin(walkPhase) * 0.5 : 0
    const aF = action === 'attack' ? Math.min(1, actionT / SAMSON.attackTime) : 0
    const punch = Math.sin(aF * Math.PI) // 0→1→0 出拳曲線
    const lean = action === 'attack' ? punch * 0.32 : 0
    // 正常比例的骨架點
    const hipY = -30
    const chestY = -46
    const shoulderY = -52
    const headY = -66
    const headR = 8

    // ---- 腿(大腿+小腿兩段、正常粗細,有涼鞋)----
    const drawLeg = (ang, skin, skinD) => {
      const kneeX = Math.sin(ang) * 7
      const footX = Math.sin(ang) * 13
      const kneeY = hipY / 2
      ctx.lineCap = 'round'
      ctx.strokeStyle = skinD
      ctx.lineWidth = 7.5 // 大腿
      ctx.beginPath()
      ctx.moveTo(-2, hipY + 1)
      ctx.lineTo(kneeX, kneeY)
      ctx.stroke()
      ctx.strokeStyle = skin
      ctx.lineWidth = 6 // 小腿
      ctx.beginPath()
      ctx.moveTo(kneeX, kneeY)
      ctx.lineTo(footX, -2)
      ctx.stroke()
      // 涼鞋
      ctx.fillStyle = '#5e3c18'
      ctx.beginPath()
      ctx.ellipse(footX + 1, -1.5, 6.5, 3, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 0.92
    drawLeg(-sw, SKIN_D, '#a86e3a') // 遠腿(暗)
    ctx.globalAlpha = 1
    drawLeg(sw, SKIN, SKIN_D) // 近腿

    ctx.save()
    ctx.translate(0, hipY)
    ctx.rotate(lean)
    ctx.translate(0, -hipY)

    // ---- 後手臂(出手時向後拉作勢)----
    {
      const backReach = action === 'attack' ? -13 - punch * 6 : -10
      ctx.strokeStyle = SKIN_D
      ctx.lineCap = 'round'
      ctx.lineWidth = 5.5
      ctx.beginPath()
      ctx.moveTo(-7, shoulderY + 4)
      ctx.lineTo(-11, chestY + 11)
      ctx.lineTo(backReach, hipY - 5)
      ctx.stroke()
      ctx.fillStyle = SKIN_D
      ctx.beginPath()
      ctx.arc(backReach, hipY - 5, 3.4, 0, Math.PI * 2)
      ctx.fill()
    }

    // ---- 軀幹:束腰短袍(正常身形,簡潔的高光/陰影分面 + 下襬)----
    ctx.fillStyle = TUNIC
    ctx.beginPath()
    ctx.moveTo(-9, shoulderY + 1)
    ctx.lineTo(9, shoulderY + 1)
    ctx.lineTo(8, hipY + 2)
    ctx.lineTo(-8, hipY + 2)
    ctx.closePath()
    ctx.fill()
    // 高光(左半)
    ctx.fillStyle = TUNIC_HI
    ctx.beginPath()
    ctx.moveTo(-9, shoulderY + 1)
    ctx.lineTo(-1, shoulderY + 1)
    ctx.lineTo(-1, hipY + 2)
    ctx.lineTo(-8, hipY + 2)
    ctx.closePath()
    ctx.fill()
    // 陰影(右半)
    ctx.fillStyle = TUNIC_D
    ctx.beginPath()
    ctx.moveTo(4, shoulderY + 1)
    ctx.lineTo(9, shoulderY + 1)
    ctx.lineTo(8, hipY + 2)
    ctx.lineTo(4, hipY + 2)
    ctx.closePath()
    ctx.fill()
    // 下襬
    ctx.fillStyle = TUNIC_D
    ctx.beginPath()
    ctx.moveTo(-8, hipY + 2)
    ctx.lineTo(8, hipY + 2)
    ctx.lineTo(7, hipY + 10)
    ctx.lineTo(-7, hipY + 10)
    ctx.closePath()
    ctx.fill()
    // 領口(露出脖子下方一點膚色)
    ctx.fillStyle = SKIN
    ctx.beginPath()
    ctx.moveTo(-3, shoulderY + 1)
    ctx.lineTo(3, shoulderY + 1)
    ctx.lineTo(0, shoulderY + 5)
    ctx.closePath()
    ctx.fill()
    // 腰帶
    ctx.strokeStyle = BELT
    ctx.lineWidth = 3.5
    ctx.lineCap = 'butt'
    ctx.beginPath()
    ctx.moveTo(-9, hipY)
    ctx.lineTo(9, hipY)
    ctx.stroke()
    ctx.fillStyle = '#caa14a'
    ctx.fillRect(-2.5, hipY - 2, 5, 4) // 帶釦

    // ---- 前手臂 ----
    const shX = 7
    const shoY = shoulderY + 4
    let reachX, fistY
    ctx.strokeStyle = SKIN
    ctx.lineCap = 'round'
    ctx.lineWidth = 6
    if (action === 'attack') {
      // 出拳:手臂「打直」往前平伸(肩 → 拳 一直線,不彎肘)
      reachX = 14 + punch * 26
      fistY = shoY + 1
      ctx.beginPath()
      ctx.moveTo(shX, shoY)
      ctx.lineTo(reachX, fistY)
      ctx.stroke()
    } else {
      // 待機:自然彎臂下垂(肩 → 肘 → 拳)
      reachX = 11
      fistY = chestY + 15
      ctx.beginPath()
      ctx.moveTo(shX, shoY)
      ctx.lineTo(7, chestY + 9)
      ctx.lineTo(reachX, fistY)
      ctx.stroke()
    }
    // 拳頭
    ctx.fillStyle = SKIN
    ctx.beginPath()
    ctx.arc(reachX, fistY, 4.8, 0, Math.PI * 2)
    ctx.fill()
    if (action === 'attack' && punch > 0.5) {
      ctx.strokeStyle = `rgba(255,240,200,${(punch - 0.5) * 1.6})`
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(reachX + 7, fistY, 6, -0.8, 0.8)
      ctx.stroke()
    }

    // ---- 脖子 + 頭 ----
    ctx.strokeStyle = SKIN_D
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(0, shoulderY + 1)
    ctx.lineTo(1, headY + headR - 1)
    ctx.stroke()
    ctx.fillStyle = SKIN
    ctx.beginPath()
    ctx.arc(1, headY, headR, 0, Math.PI * 2)
    ctx.fill()

    // ---- 長髮(拿細耳人不剃髮 = 力量的記號;整齊的長髮,不過量)----
    const hairSway = moving ? Math.sin(walkPhase) * 2.5 : 0
    ctx.fillStyle = HAIR
    // 頭頂與後腦的髮罩
    ctx.beginPath()
    ctx.arc(0, headY - 1, headR + 2, Math.PI * 0.8, Math.PI * 2.04)
    ctx.fill()
    // 後披長髮(整片,到肩胛)
    ctx.beginPath()
    ctx.moveTo(-headR, headY - 4)
    ctx.quadraticCurveTo(-headR - 7 + hairSway, headY + 12, -headR - 1 + hairSway, headY + 26)
    ctx.quadraticCurveTo(-1, headY + 16, -2, headY)
    ctx.closePath()
    ctx.fill()
    // 髮絲高光
    ctx.strokeStyle = HAIR_HI
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(-2, headY - headR + 1)
    ctx.quadraticCurveTo(-headR, headY + 6, -headR - 1 + hairSway, headY + 18)
    ctx.stroke()
    // 紅頭帶
    ctx.strokeStyle = BAND
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.arc(1, headY - 1, headR + 0.5, Math.PI * 1.05, Math.PI * 1.95)
    ctx.stroke()

    // ---- 臉(朝右):眉、眼、鼻、短鬍 ----
    ctx.fillStyle = '#2a1a0e'
    ctx.beginPath()
    ctx.arc(headR - 2.5, headY - 1, 1.4, 0, Math.PI * 2) // 眼
    ctx.fill()
    ctx.strokeStyle = HAIR // 眉
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(headR - 5, headY - 3.5)
    ctx.lineTo(headR - 0.5, headY - 3)
    ctx.stroke()
    ctx.strokeStyle = SKIN_D // 鼻
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(headR - 0.5, headY)
    ctx.lineTo(headR + 1.5, headY + 2)
    ctx.lineTo(headR - 1, headY + 2.5)
    ctx.stroke()
    // 短鬍(下顎)
    ctx.fillStyle = HAIR
    ctx.beginPath()
    ctx.moveTo(-1, headY + 3)
    ctx.quadraticCurveTo(headR - 2, headY + headR + 4, headR, headY + 3)
    ctx.quadraticCurveTo(headR - 3, headY + headR, -1, headY + 3)
    ctx.closePath()
    ctx.fill()

    ctx.restore()
    ctx.restore()
  }

  // ---- 少壯獅子(俯視站立小獅,本地座標朝左;face>0 時水平翻轉成朝右)----
  _lion(x, footY, face, state, phase, t, flash, open, deathMode = false) {
    const ctx = this.ctx
    // 死神模式:暗黑死神配色(取代依 phase 的獅色)
    const BODY = deathMode ? '#2a2330' : ['#d09543', '#bd7d2f', '#a36526'][phase] || '#d09543'
    const BODY_D = deathMode ? '#171320' : ['#a8702a', '#8f5a1e', '#774717'][phase] || '#a8702a'
    const BODY_HI = deathMode ? '#3a3142' : ['#e8b766', '#d49a4a', '#c1853a'][phase] || '#e8b766'
    const MANE = deathMode ? '#100c1a' : ['#7a4a1c', '#683f17', '#542f10'][phase] || '#7a4a1c'
    const MANE_D = deathMode ? '#070510' : ['#5e3713', '#4e2e0f', '#3e240b'][phase] || '#5e3713'
    const MUZZLE = deathMode ? '#3a3142' : '#f0d9a8'

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

    // 尾巴(末端毛球)
    ctx.strokeStyle = BODY_D
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(52, bodyY + 4)
    ctx.quadraticCurveTo(80 + walk * 4, bodyY - 12, 70, bodyY - 30)
    ctx.stroke()
    ctx.fillStyle = MANE
    ctx.beginPath()
    ctx.arc(69, bodyY - 32, 6, 0, Math.PI * 2)
    ctx.fill()

    // 腿 + 爪(兩段感:腿幹 + 腳掌與趾線)
    const leg = (lx, swing, color, dark) => {
      ctx.strokeStyle = color
      ctx.lineWidth = 10
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(lx, bodyY + bodyH - 10)
      ctx.lineTo(lx + swing, -3)
      ctx.stroke()
      // 腳掌
      ctx.fillStyle = dark
      ctx.beginPath()
      ctx.ellipse(lx + swing + 1, -1.5, 8, 4, 0, 0, Math.PI * 2)
      ctx.fill()
      // 趾線
      ctx.strokeStyle = MANE_D
      ctx.lineWidth = 1
      for (const tx of [-3, 0, 3]) {
        ctx.beginPath()
        ctx.moveTo(lx + swing + 1 + tx, -3.5)
        ctx.lineTo(lx + swing + 1 + tx, 0.5)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 0.86
    leg(42, walk * 8, BODY_D, MANE_D) // 遠側腿(暗)
    leg(-26, -walk * 8, BODY_D, MANE_D)
    ctx.globalAlpha = 1

    // 軀幹(主體 + 背部高光 + 腹部陰影)
    ctx.fillStyle = BODY
    ctx.beginPath()
    ctx.ellipse(8, bodyY, bodyW, bodyH, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = BODY_HI // 背部高光
    ctx.beginPath()
    ctx.ellipse(2, bodyY - 11, bodyW * 0.7, bodyH * 0.42, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = BODY_D // 腹部陰影
    ctx.beginPath()
    ctx.ellipse(8, bodyY + 11, bodyW * 0.86, bodyH * 0.46, 0, 0, Math.PI * 2)
    ctx.fill()

    // 近側腿
    leg(38, -walk * 8, BODY, BODY_D)
    leg(-20, walk * 8, BODY, BODY_D)

    // 鬃毛:外圈長毛(深)+ 內圈短毛(淺),雙層更厚實
    const mx = headX + 12
    const my = headY + 6
    const spikes = 15
    ctx.strokeStyle = MANE_D
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2 + 0.1
      const r1 = 24 + rear * 3
      const r2 = r1 + (rear ? 17 : 12) + (i % 2) * 2
      ctx.beginPath()
      ctx.moveTo(mx + Math.cos(a) * r1, my + Math.sin(a) * r1)
      ctx.lineTo(mx + Math.cos(a) * r2, my + Math.sin(a) * r2)
      ctx.stroke()
    }
    ctx.fillStyle = MANE
    ctx.beginPath()
    ctx.arc(mx, my, 27 + rear * 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = MANE_D // 鬃毛內陰影環
    ctx.beginPath()
    ctx.arc(mx, my, 27 + rear * 3, Math.PI * 0.15, Math.PI * 0.85)
    ctx.arc(mx, my, 20, Math.PI * 0.85, Math.PI * 0.15, true)
    ctx.fill()

    // ===== 頭(3/4 側面朝左:前方=左。五官分層、透視一致)=====
    // 臉盤(球)
    ctx.fillStyle = BODY
    ctx.beginPath()
    ctx.arc(headX, headY, 18, 0, Math.PI * 2)
    ctx.fill()

    // 兩耳(後耳小且高、前耳大且低 → 3/4 透視)
    const drawEar = (ex, ey, er) => {
      ctx.fillStyle = BODY
      ctx.beginPath()
      ctx.arc(ex, ey, er, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = MANE_D
      ctx.beginPath()
      ctx.arc(ex, ey + er * 0.15, er * 0.5, 0, Math.PI * 2)
      ctx.fill()
    }
    drawEar(headX + 12, headY - 14, 5) // 後耳(遠)
    drawEar(headX - 4, headY - 17, 6.5) // 前耳(近,較大)

    // 吻部(向前下方突出的口鼻;前端=左)
    ctx.fillStyle = MUZZLE
    ctx.beginPath()
    ctx.ellipse(headX - 9, headY + 6, 11, 8.5, -0.12, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(0,0,0,0.08)' // 吻部下緣陰影
    ctx.beginPath()
    ctx.ellipse(headX - 8, headY + 9, 9, 4, 0, 0, Math.PI * 2)
    ctx.fill()

    // 鼻頭(在吻部最前端=左上;倒三角 + 人中線)
    const noseX = headX - 18
    const noseY = headY + 2
    ctx.fillStyle = deathMode ? '#000' : '#3a1e12'
    ctx.beginPath()
    ctx.moveTo(noseX - 3, noseY - 1.5)
    ctx.quadraticCurveTo(noseX + 3, noseY - 2.5, noseX + 3, noseY + 1)
    ctx.lineTo(noseX, noseY + 3.5) // 鼻尖朝下
    ctx.quadraticCurveTo(noseX - 3, noseY + 1.5, noseX - 3, noseY - 1.5)
    ctx.closePath()
    ctx.fill()

    const roar = state === 'telegraph' || state === 'charge'
    if (roar) {
      // 張口怒吼:口在鼻下、沿吻部往後(右下)張開 + 上排獠牙
      ctx.fillStyle = '#4a1810'
      ctx.beginPath()
      ctx.ellipse(headX - 10, headY + 11, 7.5, 5.5, -0.1, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      for (const fx of [headX - 15, headX - 6]) {
        ctx.beginPath()
        ctx.moveTo(fx - 2, headY + 8)
        ctx.lineTo(fx + 2, headY + 8)
        ctx.lineTo(fx, headY + 12.5) // 獠牙朝下
        ctx.closePath()
        ctx.fill()
      }
    } else {
      // 閉口:人中 + 沿吻部往後的嘴線
      ctx.strokeStyle = '#3a1e12'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(noseX, noseY + 3.5)
      ctx.lineTo(headX - 11, headY + 10) // 人中
      ctx.moveTo(headX - 16, headY + 10)
      ctx.quadraticCurveTo(headX - 11, headY + 12, headX - 5, headY + 9) // 嘴角往後上揚
      ctx.stroke()
    }

    // 鬍鬚(自吻部兩側往前散出=左)
    ctx.strokeStyle = deathMode ? 'rgba(180,180,200,0.45)' : 'rgba(50,32,18,0.45)'
    ctx.lineWidth = 1
    for (const dy of [0, 3]) {
      ctx.beginPath()
      ctx.moveTo(headX - 13, headY + 5 + dy)
      ctx.quadraticCurveTo(headX - 24, headY + 3 + dy, headX - 30, headY + dy * 1.5)
      ctx.stroke()
    }

    // 眼睛:在「額頭、吻部之上」,近眼(前/左)大而低、遠眼(後/右)小而高
    const eyeNear = [headX - 7, headY - 4, 2.7]
    const eyeFar = [headX + 4, headY - 6, 2.1]
    // 眉骨(順著兩眼上緣)
    ctx.strokeStyle = BODY_D
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(eyeNear[0] - 4, eyeNear[1] - 3)
    ctx.quadraticCurveTo(eyeNear[0], eyeNear[1] - 5, eyeNear[0] + 4, eyeNear[1] - 3)
    ctx.moveTo(eyeFar[0] - 3, eyeFar[1] - 2.5)
    ctx.quadraticCurveTo(eyeFar[0], eyeFar[1] - 4, eyeFar[0] + 3, eyeFar[1] - 2.5)
    ctx.stroke()
    // 眼白(recovery 破綻時亮起)/ 眼珠
    for (const [ex, ey, er] of [eyeNear, eyeFar]) {
      ctx.fillStyle = open ? '#ffe9a8' : '#f3e3c0'
      ctx.beginPath()
      ctx.ellipse(ex, ey, er, er * 0.82, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#241208' // 瞳孔(朝前=左)
      ctx.beginPath()
      ctx.arc(ex - er * 0.4, ey, er * 0.55, 0, Math.PI * 2)
      ctx.fill()
    }

    if (flash > 0) {
      ctx.globalAlpha = Math.min(0.6, flash * 2)
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.ellipse(8, bodyY, bodyW + 22, bodyH + 22, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // 死神模式:發光紅眼(對齊 3/4 透視的眼睛位置)
    if (deathMode) {
      const glow = 0.6 + 0.4 * Math.abs(Math.sin(t * 5))
      const eyes = [eyeNear, eyeFar]
      ctx.fillStyle = `rgba(255,90,90,${0.5 * glow})` // 眼睛外暈
      for (const [ex, ey, er] of eyes) {
        ctx.beginPath()
        ctx.arc(ex, ey, er + 3.5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = `rgba(255,30,30,${glow})`
      for (const [ex, ey, er] of eyes) {
        ctx.beginPath()
        ctx.arc(ex, ey, er + 0.6, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    ctx.restore()
  }

  // ---- HUD:參孫的心、獅子血條、操作提示 ----
  _hud(game, t) {
    const ctx = this.ctx
    const s = game.samson
    const l = game.lion
    if (game.state !== 'fight' && game.state !== 'paused') return

    // 心:滿格 ❤️、已失去的格用暗心墊底(看得出 目前/上限)。上限讀 s.maxHearts(可被金心突破)
    const maxH = s.maxHearts || SAMSON.maxHearts
    if (maxH <= 8) {
      // 一般:逐顆畫 + 半透明圓底板(深背景上醒目)
      const plateW = (maxH - 1) * 36 + 42
      ctx.fillStyle = 'rgba(20,12,4,0.5)'
      roundRect(ctx, 13, 21, plateW, 34, 11)
      ctx.fill()
      for (let i = 0; i < maxH; i++) {
        const hx = 34 + i * 36
        if (i >= s.hearts) {
          ctx.globalAlpha = 0.32
          this._emoji('🖤', hx, 38, 28, 'middle')
          ctx.globalAlpha = 1
        } else {
          this._emoji('❤️', hx, 38, 30, 'middle')
        }
      }
    } else {
      // 突破很多顆 → 緊湊顯示:一顆 ❤️ + 「目前/上限」數字,避免爆版
      ctx.fillStyle = 'rgba(20,12,4,0.5)'
      roundRect(ctx, 13, 21, 118, 34, 11)
      ctx.fill()
      this._emoji('❤️', 34, 38, 30, 'middle')
      ctx.fillStyle = '#ffd9d0'
      ctx.font = `800 18px ${FONT}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${s.hearts} / ${maxH}`, 52, 39)
    }

    // boss 血條:外框 + 漸層填色 + 內高光 + 分段刻度
    const barW = 320
    const barH = 20
    const bx = (VIEW.W - barW) / 2
    const by = 30
    // 外框底板
    ctx.fillStyle = 'rgba(20,12,4,0.62)'
    roundRect(ctx, bx - 4, by - 4, barW + 8, barH + 8, 11)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    ctx.lineWidth = 1.5
    roundRect(ctx, bx - 4, by - 4, barW + 8, barH + 8, 11)
    ctx.stroke()
    // 空槽
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    roundRect(ctx, bx, by, barW, barH, 8)
    ctx.fill()
    // 填色(依 phase 換色 + 上下漸層;死神模式暗紫)
    const hpFrac = Math.max(0, l.hp) / LION.maxHp
    const pal = l.deathMode
      ? ['#6a2da8', '#6a2da8', '#6a2da8']
      : ['#5bc05f', '#ff9d2e', '#e8413a']
    const top = pal[l.phase()] || pal[0]
    if (hpFrac > 0) {
      const fillW = barW * hpFrac
      const grad = ctx.createLinearGradient(0, by, 0, by + barH)
      grad.addColorStop(0, '#ffffff55')
      grad.addColorStop(0.12, top)
      grad.addColorStop(1, 'rgba(0,0,0,0.35)')
      ctx.save()
      roundRect(ctx, bx, by, barW, barH, 8)
      ctx.clip()
      ctx.fillStyle = top
      ctx.fillRect(bx, by, fillW, barH)
      ctx.fillStyle = grad
      ctx.fillRect(bx, by, fillW, barH)
      // 上緣高光條
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.fillRect(bx, by + 2, fillW, 3)
      ctx.restore()
    }
    // 分段刻度(每 5 點一條,避免 30 條太密)
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'
    ctx.lineWidth = 1
    const tick = LION.maxHp > 12 ? 5 : 1
    for (let i = tick; i < LION.maxHp; i += tick) {
      const xx = bx + (barW * i) / LION.maxHp
      ctx.beginPath()
      ctx.moveTo(xx, by + 2)
      ctx.lineTo(xx, by + barH - 2)
      ctx.stroke()
    }
    // 血量百分比(疊在血條中央,描邊讓深淺底都讀得清楚)
    const pct = Math.ceil(hpFrac * 100)
    ctx.font = `800 13px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.strokeText(`${pct}%`, VIEW.W / 2, by + barH / 2 + 1)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(`${pct}%`, VIEW.W / 2, by + barH / 2 + 1)
    const goal = (game.hudLabels && game.hudLabels.goal) || '少壯獅子'
    ctx.fillStyle = l.deathMode ? '#e3b6ff' : '#f3ead0'
    ctx.font = `700 15px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(`${l.deathMode ? '💀' : '🦁'} ${goal}`, VIEW.W / 2, by - 6)

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
