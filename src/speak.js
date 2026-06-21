// speak.js —— 經文朗讀(瀏覽器內建 speechSynthesis,零音檔、離線可用、免費)。
// 能用就用,不能用就「安靜略過」——絕不報錯、不卡關。心法見 skill web-speech-scripture。
// 系列預設:每一關過關都自動朗讀經文。沒中文語音的裝置會靜默 fallback。
let voicesReady = false

function pickZh() {
  const vs = speechSynthesis.getVoices()
  return (
    vs.find((v) => /zh[-_]TW/i.test(v.lang)) ||
    vs.find((v) => /^zh/i.test(v.lang)) ||
    null
  )
}

export function initSpeech() {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.getVoices()
  speechSynthesis.onvoiceschanged = () => {
    voicesReady = true
  }
}

export function speakScripture(text, { isMuted = () => false, rate = 0.92, pitch = 1 } = {}) {
  if (!('speechSynthesis' in window) || !text) return false
  if (isMuted()) return false
  try {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(String(text).replace(/\s+/g, ''))
    const v = pickZh()
    if (!v) return false
    u.voice = v
    u.lang = v.lang
    u.rate = rate
    u.pitch = pitch
    speechSynthesis.speak(u)
    return true
  } catch {
    return false
  }
}

export function stopSpeech() {
  if ('speechSynthesis' in window) speechSynthesis.cancel()
}
