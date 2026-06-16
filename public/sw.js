// 參孫打獅子 — 手寫 Service Worker(可安裝 + 離線)
// 策略:核心檔案安裝時預快取;所有 GET 都「網路優先」——線上一律拿最新,
// 順手更新快取;離線時才退回快取。這樣改版不會被舊快取黏住。
// 改版時把 CACHE 版本號 +1,舊快取會在啟用時自動清除。

const CACHE = 'samson-v1'
// 預快取「整個 app shell」(HTML + CSS + 全部 ES 模組 + 圖示),安裝後馬上離線也能玩。
// ⚠ 新增 src/ 模組時,記得把它加進這份清單(npm run test:offline 會檢查)。
const CORE = [
  '/',
  '/index.html',
  '/styles.css',
  '/src/main.js',
  '/src/game.js',
  '/src/config.js',
  '/src/scripture.js',
  '/src/samson.js',
  '/src/lion.js',
  '/src/renderer.js',
  '/src/input.js',
  '/src/ui.js',
  '/src/audio.js',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/pwa-192x192.png',
  '/icons/pwa-512x512.png',
  '/icons/apple-touch-icon-180x180.png',
]

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/index.html', copy))
          return res
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    )
    return
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
        }
        return res
      })
      .catch(() => caches.match(req))
  )
})
