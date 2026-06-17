// 原始輸入提供者(俯視角:上下左右走位 + 攻擊)。
//
//   移動:WASD / 方向鍵(持續按住),或「在畫面上按住拖曳」= 虛擬搖桿
//   攻擊:空白 / Enter / J / K / F,或「輕點畫面」(短按即放、沒怎麼移動)
//   暫停:P / Esc,或右上角熱區　|　靜音:M
//
// game.js 用 moveVector() 取得 -1..1 的移動向量;用 consumeAttack() 取一次攻擊。

export class Input {
  constructor() {
    this.up = false
    this.down = false
    this.left = false
    this.right = false
    this.run = false // 按住 Shift = 奔跑(持續狀態,非邊緣訊號)
    this.attackQueued = false
    this.pauseQueued = false
    this.muteQueued = false
    this.skipQueued = false // 標題/開場/結束畫面的「任意鍵繼續」
    // 觸控虛擬搖桿
    this.touchActive = false
    this.touchMvx = 0
    this.touchMvy = 0
    this._ox = 0
    this._oy = 0
    this._moved = false
    this._downT = 0
    this.viewW = 1
    this.viewH = 1
  }

  attach(canvas) {
    this.canvas = canvas
    this._onKeyDown = (e) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault()
          this.up = true
          this.skipQueued = true
          break
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault()
          this.down = true
          this.skipQueued = true
          break
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault()
          this.left = true
          this.skipQueued = true
          break
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault()
          this.right = true
          this.skipQueued = true
          break
        case 'Space':
        case 'Enter':
        case 'KeyJ':
        case 'KeyK':
        case 'KeyF':
          e.preventDefault()
          this.attackQueued = true
          this.skipQueued = true
          break
        case 'KeyP':
        case 'Escape':
          e.preventDefault()
          this.pauseQueued = true
          break
        case 'KeyM':
          this.muteQueued = true
          break
        case 'ShiftLeft':
        case 'ShiftRight':
          this.run = true
          break
      }
    }
    this._onKeyUp = (e) => {
      switch (e.code) {
        case 'ShiftLeft':
        case 'ShiftRight':
          this.run = false
          break
        case 'ArrowUp':
        case 'KeyW':
          this.up = false
          break
        case 'ArrowDown':
        case 'KeyS':
          this.down = false
          break
        case 'ArrowLeft':
        case 'KeyA':
          this.left = false
          break
        case 'ArrowRight':
        case 'KeyD':
          this.right = false
          break
      }
    }

    const pos = (e) => {
      const rect = canvas.getBoundingClientRect()
      this.viewW = rect.width
      this.viewH = rect.height
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    this._onPointerDown = (e) => {
      e.preventDefault()
      const p = pos(e)
      // 右上角熱區 → 暫停
      if (p.x >= this.viewW - 70 && p.y <= 70) {
        this.pauseQueued = true
        return
      }
      this.touchActive = true
      this._ox = p.x
      this._oy = p.y
      this.touchMvx = 0
      this.touchMvy = 0
      this._moved = false
      this._downT = performance.now()
    }
    this._onPointerMove = (e) => {
      if (!this.touchActive) return
      const p = pos(e)
      const dx = p.x - this._ox
      const dy = p.y - this._oy
      const R = 56 // 搖桿半徑(到此即滿速)
      if (Math.hypot(dx, dy) > 14) this._moved = true
      this.touchMvx = Math.max(-1, Math.min(1, dx / R))
      this.touchMvy = Math.max(-1, Math.min(1, dy / R))
    }
    this._onPointerEnd = () => {
      if (this.touchActive) {
        // 短按(<260ms)且幾乎沒移動 = 輕點 → 攻擊
        if (performance.now() - this._downT < 260 && !this._moved) {
          this.attackQueued = true
          this.skipQueued = true
        }
      }
      this.touchActive = false
      this.touchMvx = 0
      this.touchMvy = 0
    }
    this._onBlur = () => {
      this.up = this.down = this.left = this.right = false
      this.run = false
      this.touchActive = false
      this.touchMvx = 0
      this.touchMvy = 0
    }

    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
    canvas.addEventListener('pointerdown', this._onPointerDown)
    canvas.addEventListener('pointermove', this._onPointerMove)
    canvas.addEventListener('pointerup', this._onPointerEnd)
    canvas.addEventListener('pointercancel', this._onPointerEnd)
    window.addEventListener('blur', this._onBlur)
  }

  detach() {
    if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown)
    if (this._onKeyUp) window.removeEventListener('keyup', this._onKeyUp)
    if (this._onBlur) window.removeEventListener('blur', this._onBlur)
    const c = this.canvas
    if (c) {
      if (this._onPointerDown) c.removeEventListener('pointerdown', this._onPointerDown)
      if (this._onPointerMove) c.removeEventListener('pointermove', this._onPointerMove)
      if (this._onPointerEnd) {
        c.removeEventListener('pointerup', this._onPointerEnd)
        c.removeEventListener('pointercancel', this._onPointerEnd)
      }
    }
  }

  // 合併鍵盤 + 觸控搖桿 → 移動向量(長度夾到 1)
  moveVector() {
    let x = (this.right ? 1 : 0) - (this.left ? 1 : 0)
    let y = (this.down ? 1 : 0) - (this.up ? 1 : 0)
    if (this.touchActive) {
      x += this.touchMvx
      y += this.touchMvy
    }
    const len = Math.hypot(x, y)
    if (len > 1) {
      x /= len
      y /= len
    }
    return { x, y }
  }

  // 是否按住奔跑(持續狀態,像 moveVector 一樣每幀讀,不 consume)
  isRunning() {
    return this.run
  }

  consumeAttack() {
    const v = this.attackQueued
    this.attackQueued = false
    return v
  }
  consumePause() {
    const v = this.pauseQueued
    this.pauseQueued = false
    return v
  }
  consumeMute() {
    const v = this.muteQueued
    this.muteQueued = false
    return v
  }
  consumeSkip() {
    const v = this.skipQueued
    this.skipQueued = false
    return v
  }
}
