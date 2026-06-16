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
