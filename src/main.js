import { Game } from './game.js'
import { UI } from './ui.js'

// 進入點:建立遊戲、啟動。
// ui 由進入點注入(單機用真 UI;未來嵌入桌遊時改注入空殼 NullUI)。
const canvas = document.getElementById('game')
const game = new Game(canvas, { ui: new UI() })
game.boot()

// 偵錯掛點:只在 localhost 暴露 game,方便瀏覽器主控台 / Playwright 驗收(正式站不暴露)
if (['localhost', '127.0.0.1', '::1'].includes(location.hostname)) window.__game = game

// Service Worker 策略:
//   - 開發環境(localhost):移除任何已註冊的 SW 並清掉快取,確保永遠載入最新程式
//     (否則「快取優先」的 SW 會一直餵舊檔,改了沒反應)。
//   - 正式環境(Netlify 等):註冊 SW,提供可安裝/離線能力。
const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(location.hostname)

if ('serviceWorker' in navigator) {
  if (isLocalhost) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister())
    })
    if (window.caches) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
    }
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  }
}
