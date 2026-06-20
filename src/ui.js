// 標題 / 過關 / 失敗 / 暫停 / 蜂蜜彩蛋的覆蓋畫面,用 DOM 呈現(文字、經文、按鈕排版較容易)。
// 骨架沿用約拿引擎:overlay + card + 事件委派 + on* 回呼 + show/hide。

export class UI {
  constructor() {
    this.overlay = document.getElementById('overlay')
    this.card = document.getElementById('card')
    this.pauseBtn = document.getElementById('pauseBtn')
    this.muteBtn = document.getElementById('muteBtn')
    this._start = null
    this._restart = null
    this._resume = null
    this._pause = null
    this._mute = null
    this._action = null

    // 用事件委派處理卡片內的按鈕
    this.card.addEventListener('click', (e) => {
      const ds = e.target && e.target.dataset ? e.target.dataset : null
      if (!ds) return
      const act = ds.act
      if (act === 'start' && this._start) this._start()
      else if (act === 'restart' && this._restart) this._restart()
      else if (act === 'resume' && this._resume) this._resume()
      // 其餘(honey / home …)走通用 action 回呼
      else if (act && this._action) this._action(act)
    })

    // 右上角暫停/靜音:用 pointerdown(比 click 早,且攔住事件不外漏到 canvas)
    this.pauseBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (this._pause) this._pause()
    })
    this.muteBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (this._mute) this._mute()
    })
  }

  onStart(fn) {
    this._start = fn
  }
  onRestart(fn) {
    this._restart = fn
  }
  onResume(fn) {
    this._resume = fn
  }
  onPause(fn) {
    this._pause = fn
  }
  onMute(fn) {
    this._mute = fn
  }
  // 通用按鈕回呼:fn(act)(honey / home …)
  onAction(fn) {
    this._action = fn
  }

  setMuteIcon(muted) {
    this.muteBtn.textContent = muted ? '🔇' : '🔊'
    this.muteBtn.title = muted ? '取消靜音 (M)' : '靜音 (M)'
  }

  showPauseButton() {
    this.pauseBtn.classList.add('show')
  }
  hidePauseButton() {
    this.pauseBtn.classList.remove('show')
  }

  show(html) {
    this.card.innerHTML = html
    this.overlay.classList.add('show')
  }
  hide() {
    this.overlay.classList.remove('show')
  }

  showTitle(L) {
    this.show(`
      <div class="kicker">參孫打獅子 · 士師記 14</div>
      <h1>${L.title}</h1>
      <p class="sub">${L.subtitle}</p>
      <div class="verse"><span class="ref">${L.ref}</span>${L.verse}</div>
      <div class="row">
        <button class="btn" data-act="start">⚔️ 開始打獅子</button>
      </div>
      <p class="hint">
        🏃 <b>走位</b>:WASD / 方向鍵,或<b>在畫面上拖曳</b> —— 上下左右自由移動,側身閃開獅子的衝刺。<br>
        👊 <b>反擊</b>:空白 / Enter / J,或<b>輕點畫面</b> —— 靠近獅子、趁牠衝完喘氣(💢)時出手。<br>
        看準「預備動作(⚠,會畫出衝刺路線)→ 衝刺 → 喘氣(💢)」的節奏,閃開再靠近反擊,把獅子打倒!
      </p>
    `)
  }

  // info: { hearts, combo }
  showWin(L, info = {}) {
    const hearts = '❤️'.repeat(Math.max(0, info.hearts || 0))
    this.show(`
      <div class="kicker win">得勝了!</div>
      <h2>${L.win.head}</h2>
      <p class="body">${L.win.body.replace(/\n/g, '<br>')}</p>
      <div class="verse"><span class="ref">${L.ref}</span>${L.verse}</div>
      ${hearts ? `<p class="score">剩餘體力 ${hearts}</p>` : ''}
      <div class="row">
        <button class="btn ghost" data-act="restart">↻ 再玩一次</button>
        <button class="btn" data-act="honey">🍯 蜂蜜與謎語</button>
      </div>
    `)
  }

  // info.corrupt:第三次死亡時改顯示「心智被侵蝕」的劇情文案
  showLose(L, info = {}) {
    if (info.corrupt && L.corrupt) {
      this.show(`
        <div class="kicker lose">${L.corrupt.head}</div>
        <p class="body" style="text-align:center">${L.corrupt.body.replace(/\n/g, '<br>')}</p>
        <button class="btn" data-act="restart">↻ 再次面對死神</button>
      `)
      return
    }
    this.show(`
      <div class="kicker lose">${L.lose.head}</div>
      <p class="body" style="text-align:center">${L.lose.body}</p>
      <button class="btn" data-act="restart">↻ 再試一次</button>
    `)
  }

  // 壞結局(地獄模式中再次死亡):黑暗奪心,但仍指向基督的盼望
  showBadEnding(L) {
    const b = L.badEnd || L.lose
    this.show(`
      <div class="kicker lose">💀 ${b.head}</div>
      <p class="body" style="text-align:center">${b.body.replace(/\n/g, '<br>')}</p>
      <button class="btn" data-act="restart">↻ 倚靠主,重新開始</button>
    `)
  }

  // 隱藏結局:走到右下角隱形出口逃跑(彩蛋)
  showEscape(L) {
    const e = L.escape || { head: '逃跑成功', body: '你溜走了。' }
    this.show(`
      <div class="kicker">${e.head}</div>
      <p class="body" style="text-align:center">${e.body.replace(/\n/g, '<br>')}</p>
      <div class="row">
        <button class="btn" data-act="restart">↻ 回去面對獅子</button>
        <button class="btn ghost" data-act="home">🏠 回標題</button>
      </div>
    `)
  }

  showPaused() {
    this.show(`
      <div class="kicker">⏸ 暫停</div>
      <p class="sub">深呼吸一下,預備好就繼續。</p>
      <div class="row">
        <button class="btn" data-act="resume">▶ 繼續</button>
        <button class="btn ghost" data-act="restart">↻ 重新開始</button>
      </div>
    `)
  }

  // 勝利後的教學彩蛋:蜂蜜與謎語(士 14:8-9, 14)
  showHoney(L) {
    const h = L.honey
    this.show(`
      <div class="kicker">🍯 ${h.head}</div>
      <div class="verse"><span class="ref">${h.ref}</span>${h.verse}</div>
      <p class="body">${h.body.replace(/\n/g, '<br>')}</p>
      <div class="row">
        <button class="btn ghost" data-act="restart">↻ 再玩一次</button>
        <button class="btn" data-act="home">🏠 回標題</button>
      </div>
    `)
  }
}
