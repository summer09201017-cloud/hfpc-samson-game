import { ARENA, LION, PHASES, phaseOf } from './config.js'

// 少壯獅子(boss):俯視角,在場上移動的單一物件狀態機。
//   enter      登場:從場邊走向參孫
//   approach   走向參孫,準備下一次衝刺
//   telegraph  明顯的預備動作(後仰、鬃毛炸開、紅光、低吼)——此時「鎖定」衝刺方向,給玩家時間側身閃開
//   charge     衝刺:沿鎖定方向直直衝過去(只有這時會撞傷參孫);撞牆或衝完 → recovery
//   recovery   衝刺後喘氣的破綻窗(open=true)——玩家靠近反擊
// 血量越低 phase 越高、越兇(計時更短、衝得更快)。

export class Lion {
  constructor() {
    this.reset()
  }

  reset() {
    this.x = ARENA.x + ARENA.w - 150
    this.y = ARENA.y + ARENA.h / 2
    this.hp = LION.maxHp
    this.state = 'enter'
    this.t = 0
    this.open = false // recovery 的破綻窗
    this.flash = 0 // 進 phase / 受擊的閃光
    this.dirX = -1 // 鎖定的衝刺方向
    this.dirY = 0
    this.aimLocked = false // telegraph 末段:紅線方向已定住(不再追蹤玩家)
    this.face = -1 // 畫圖朝向(-1 朝左 / 1 朝右)
    this.chargeLeft = 0
    this.fangs = [] // 第二階段地上的捕獸夾:{ x, y, t }(t = 已存在秒數)
    this._fangTimer = 0
    // 大範圍爪擊(血量 <= clawHpThreshold):state = idle(等待)/ warn(紅線預警)/ strike(揮下)
    this.claw = { state: 'idle', t: 0, x: 0, y: 0, dx: 1, dy: 0 }
  }

  // 第二階段(血量 < fangHpThreshold):每 fangInterval 秒放一根尖牙,每根 fangLife 秒後消失
  inStage2() {
    return this.hp < LION.fangHpThreshold
  }

  phase() {
    return phaseOf(this.hp)
  }
  cfg() {
    return PHASES[this.phase()]
  }
  charging() {
    return this.state === 'charge'
  }

  hit() {
    this.hp -= 1
    this.flash = 0.28
  }

  update(dt, s) {
    if (this.flash > 0) this.flash -= dt
    this._updateFangs(dt, s)
    this._updateClaw(dt, s)
    const c = this.cfg()
    this.t += dt
    const d = Math.hypot(s.x - this.x, s.y - this.y)

    if (this.state === 'enter') {
      this.open = false
      this._moveToward(s.x, s.y, c.approach * 1.5 * dt)
      this.face = s.x < this.x ? -1 : 1
      if (d < c.lockRange) this._toTelegraph(s)
    } else if (this.state === 'approach') {
      this.open = false
      this._moveToward(s.x, s.y, c.approach * dt)
      this.face = s.x < this.x ? -1 : 1
      if (d < c.lockRange && this.t > 0.35) this._toTelegraph(s)
    } else if (this.state === 'telegraph') {
      this.open = false
      // 蓄力時紅線持續追著參孫轉;但在撲出前 LION.aimLockLead 秒「定住」方向不再追蹤,
      // 給玩家一個公平的閃避窗——看到紅線停住,就知道牠要從這條線撲出來、趕快側身讓開。
      this.aimLocked = this.t >= c.telegraph - LION.aimLockLead
      if (!this.aimLocked) this._aimAt(s)
      if (this.t >= c.telegraph) {
        this.state = 'charge'
        this.t = 0
        this.chargeLeft = LION.chargeDist
      }
    } else if (this.state === 'charge') {
      this.open = false
      const step = c.charge * dt
      this.x += this.dirX * step
      this.y += this.dirY * step
      this.chargeLeft -= step
      const hitWall = this._clamp()
      if (this.chargeLeft <= 0 || hitWall) {
        this.state = 'recovery'
        this.t = 0
        this.open = true
      }
    } else if (this.state === 'recovery') {
      this.open = true // 破綻窗:衝完喘氣,參孫可反擊
      if (this.t >= c.recovery) {
        this.open = false
        this.state = 'approach'
        this.t = 0
      }
    }
  }

  _toTelegraph(s) {
    this.state = 'telegraph'
    this.t = 0
    this._aimAt(s)
  }

  // 瞄準參孫:更新衝刺方向(紅線指向)與朝向。telegraph 每幀呼叫 → 紅線追著玩家。
  _aimAt(s) {
    const a = Math.atan2(s.y - this.y, s.x - this.x)
    this.dirX = Math.cos(a)
    this.dirY = Math.sin(a)
    this.face = s.x < this.x ? -1 : 1
  }

  // 第二階段尖牙:老化 + 移除過期 + 依間隔生成(碰撞與繪製分別在 game.js / renderer.js)
  _updateFangs(dt, s) {
    if (this.fangs.length) {
      for (const f of this.fangs) f.t += dt
      // 總壽命 = 警示期 + 出現期;過了才移除
      this.fangs = this.fangs.filter((f) => f.t < LION.fangWarn + LION.fangLife)
    }
    if (!this.inStage2()) {
      this._fangTimer = 0
      return
    }
    this._fangTimer += dt
    if (this._fangTimer >= LION.fangInterval) {
      this._fangTimer -= LION.fangInterval
      this.fangs.push(this._spawnFang(s))
    }
  }

  // 在場內隨機位置生成一根尖牙,但避開玩家腳下(fangSafeR 內)以求公平
  _spawnFang(s) {
    const minX = ARENA.x + 34
    const maxX = ARENA.x + ARENA.w - 34
    const minY = ARENA.y + 34
    const maxY = ARENA.y + ARENA.h - 34
    let x = minX
    let y = minY
    for (let i = 0; i < 8; i++) {
      x = minX + Math.random() * (maxX - minX)
      y = minY + Math.random() * (maxY - minY)
      if (Math.hypot(x - s.x, y - s.y) >= LION.fangSafeR) break
    }
    return { x, y, t: 0 }
  }

  // 大範圍爪擊狀態機(idle → warn → strike → idle)。紅線在進入 warn 時定住,不再追蹤。
  _updateClaw(dt, s) {
    const cl = this.claw
    if (this.hp > LION.clawHpThreshold) {
      cl.state = 'idle'
      cl.t = 0
      return
    }
    cl.t += dt
    if (cl.state === 'idle') {
      if (cl.t >= LION.clawGap) {
        cl.state = 'warn'
        cl.t = 0
        // 紅線:穿過此刻玩家位置,方向由獅子指向玩家(之後定住,給 3 秒往垂直方向閃)
        const a = Math.atan2(s.y - this.y, s.x - this.x)
        cl.dx = Math.cos(a)
        cl.dy = Math.sin(a)
        cl.x = s.x
        cl.y = s.y
      }
    } else if (cl.state === 'warn') {
      if (cl.t >= LION.clawTelegraph) {
        cl.state = 'strike'
        cl.t = 0
      }
    } else if (cl.state === 'strike') {
      if (cl.t >= LION.clawStrike) {
        cl.state = 'idle'
        cl.t = 0
      }
    }
  }

  // 玩家中心到爪擊線的垂直距離(線:過 (claw.x,claw.y)、單位方向 (claw.dx,claw.dy))
  clawPerpDist(px, py) {
    const cl = this.claw
    return Math.abs((px - cl.x) * -cl.dy + (py - cl.y) * cl.dx)
  }

  _moveToward(tx, ty, step) {
    const a = Math.atan2(ty - this.y, tx - this.x)
    this.x += Math.cos(a) * step
    this.y += Math.sin(a) * step
    this._clamp()
  }

  // 夾在場內;回傳是否撞到牆(衝刺撞牆 → 進 recovery)
  _clamp() {
    const minX = ARENA.x + LION.r
    const maxX = ARENA.x + ARENA.w - LION.r
    const minY = ARENA.y + LION.r
    const maxY = ARENA.y + ARENA.h - LION.r
    let wall = false
    if (this.x < minX) {
      this.x = minX
      wall = true
    } else if (this.x > maxX) {
      this.x = maxX
      wall = true
    }
    if (this.y < minY) {
      this.y = minY
      wall = true
    } else if (this.y > maxY) {
      this.y = maxY
      wall = true
    }
    return wall
  }
}
