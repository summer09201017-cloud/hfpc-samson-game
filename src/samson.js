import { ARENA, SAMSON } from './config.js'

// 參孫(玩家):俯視角,上下左右自由走位 + 近戰反擊。
// 走位本身就是閃避(側身躲開獅子的衝刺);靠近獅子、趁牠喘氣(open)時出手反擊。
// 被衝撞扣 1 顆心 + 無敵閃爍(不會立刻 game over)。

export class Samson {
  constructor() {
    this.reset()
  }

  reset() {
    this.x = ARENA.x + 130
    this.y = ARENA.y + ARENA.h / 2
    this.maxHearts = SAMSON.maxHearts // 目前血量上限(可被金色的心突破而提高)
    this.hearts = this.maxHearts
    this.invuln = 0
    this.face = 1 // -1 朝左 / 1 朝右(畫圖用)
    this.moving = false
    this.running = false // 是否正在奔跑(Shift)
    this.walkPhase = 0 // 走路動畫相位
    this.action = 'idle' // idle / attack
    this.actionT = 0
    this.cooldown = 0 // 出手後的小硬直
    this.attackedThisSwing = false // 一次出手只判一次命中
  }

  // 反擊(出手):不在出手中、且沒硬直時才能起手
  attack() {
    if (this.action === 'attack' || this.cooldown > 0) return false
    this.action = 'attack'
    this.actionT = 0
    this.attackedThisSwing = false
    return true
  }

  attackActive() {
    return (
      this.action === 'attack' &&
      this.actionT >= SAMSON.attackActive[0] &&
      this.actionT <= SAMSON.attackActive[1]
    )
  }

  // 被獅子衝撞(從 (fromX,fromY) 方向彈開)
  hurt(fromX, fromY) {
    this.hearts -= 1
    this.invuln = SAMSON.invulnTime
    const a = Math.atan2(this.y - fromY, this.x - fromX)
    this.x += Math.cos(a) * SAMSON.knockback
    this.y += Math.sin(a) * SAMSON.knockback
    this._clamp()
  }

  // mvx, mvy:輸入的移動向量(已大致正規化,長度 0..1);running:按住 Shift 奔跑
  update(dt, mvx, mvy, running = false) {
    if (this.invuln > 0) this.invuln -= dt
    if (this.cooldown > 0) this.cooldown -= dt

    let vx = mvx
    let vy = mvy
    if (this.action === 'attack') {
      vx *= 0.22 // 出手時幾乎定住
      vy *= 0.22
    }
    // 出手中不奔跑(保持出手定住的手感);其餘時候按住 Shift 加速
    const runMul = running && this.action !== 'attack' ? SAMSON.runMultiplier : 1
    this.running = false
    let len = Math.hypot(vx, vy)
    this.moving = len > 0.05
    if (len > 0.0001) {
      if (len > 1) {
        vx /= len
        vy /= len
        len = 1
      }
      if (Math.abs(mvx) > 0.05) this.face = mvx < 0 ? -1 : 1
      this.x += vx * SAMSON.speed * runMul * dt
      this.y += vy * SAMSON.speed * runMul * dt
      this.walkPhase += dt * len * 11 * runMul // 奔跑時腿擺動也加快
      this.running = runMul > 1 // 給 renderer 用(可畫奔跑特效)
      this._clamp()
    }

    if (this.action === 'attack') {
      this.actionT += dt
      if (this.actionT >= SAMSON.attackTime) {
        this.action = 'idle'
        this.cooldown = SAMSON.attackCooldown
      }
    }
  }

  _clamp() {
    this.x = Math.max(ARENA.x + SAMSON.r, Math.min(ARENA.x + ARENA.w - SAMSON.r, this.x))
    this.y = Math.max(ARENA.y + SAMSON.r, Math.min(ARENA.y + ARENA.h - SAMSON.r, this.y))
  }
}
