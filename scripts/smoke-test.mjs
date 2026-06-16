// 參孫打獅子 — 煙霧測試(零相依、可離線跑,不需瀏覽器或測試框架)
//
// 為什麼有這支:這個遊戲沒有自動化測試,會在主日學課堂上爆掉的錯(少了某段文案、
// 改壞狀態機、嵌入契約被破壞、離線裝不起來)只能靠手動玩才發現。這支腳本把這些
// 「上課前必檢查」的事變成一個指令。
//
// 跑法:
//   npm test                 內容 + 語法 + 狀態機/嵌入契約(快,不 build)
//   npm test -- --offline    再加:build → 檢查 PWA 離線就緒(sw 預快取 / manifest / 資產齊備)
//   npm run test:offline      同上
//
// 跨專案:這支是「可攜的」——換到同類遊戲只要改最上面的 CONFIG(見 skill: game-smoke-test)。

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, extname } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// ───────────────────────── 專案設定(換專案改這裡)─────────────────────────
const CONFIG = {
  srcDir: 'src',
  syntaxExts: ['.js', '.mjs'],

  skipQuiz: true, // 參孫打獅子是單一動作關,沒有題庫(quiz.js)
  skipContent: false, // 仍驗證 scripture.js(LEVEL1 文案)
  skipRouting: false,

  scriptureModule: 'src/scripture.js', // 需 export LEVEL1
  levels: ['LEVEL1'],

  gameModule: 'src/game.js',
  routingMustInclude: [
    'startIntro', // 開場短演出進入點
    'startFight', // 戰鬥進入點
    'enterFinisher', // 撕裂收尾進入點
    'gameOver', // 失敗流程
    'LEVEL1', // 文案有接上
  ],
  routingMustMatch: [
    /state\s*=\s*STATE\.FINISHER/, // hp 歸零 → 進入撕裂收尾
    /lion\.hp\s*<=\s*0/, // 反擊命中且獅子血歸零的判定
    /STATE\.FIGHT/, // 核心戰鬥狀態存在
  ],
  // 嵌入契約:game.js 不可自己 import UI(ui 必須由外部注入)
  embedForbid: [/from ['"]\.\/ui\.js['"]/],

  buildCmd: 'npm run build',
  siteDir: 'site',
  entryHtml: 'index.html',
  swFile: 'sw.js',
  manifestFile: 'manifest.webmanifest',
}
// ─────────────────────────────────────────────────────────────────────────

const WANT_OFFLINE = process.argv.includes('--offline')
let pass = 0
let fail = 0
const fails = []
const warns = []

function ok(msg) {
  pass++
  console.log(`  \x1b[32m✓\x1b[0m ${msg}`)
}
function bad(msg) {
  fail++
  fails.push(msg)
  console.log(`  \x1b[31m✗\x1b[0m ${msg}`)
}
function warn(msg) {
  warns.push(msg)
  console.log(`  \x1b[33m!\x1b[0m ${msg}`)
}
function check(cond, msg) {
  cond ? ok(msg) : bad(msg)
  return cond
}
function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`)
}
const isStr = (v) => typeof v === 'string' && v.trim().length > 0

function walk(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name)
    if (ent.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

async function importLocal(rel) {
  return import(pathToFileURL(join(root, rel)).href)
}

// ── 1. 內容:各關經文 / 文案 ────────────────────────────────────────
async function checkScripture() {
  section('1. 經文 / 文案 (scripture.js)')
  let mod
  try {
    mod = await importLocal(CONFIG.scriptureModule)
  } catch (e) {
    return bad(`無法 import ${CONFIG.scriptureModule}:${e.message}`)
  }
  for (const name of CONFIG.levels) {
    const L = mod[name]
    if (!check(L && typeof L === 'object', `${name} 存在`)) continue
    check(isStr(L.title) && isStr(L.subtitle) && isStr(L.ref) && isStr(L.verse), `${name}:title/subtitle/ref/verse 齊備`)
    check(L.win && isStr(L.win.head) && isStr(L.win.body), `${name}:win.head/body 齊備`)
    if (L.lose) check(isStr(L.lose.head) && isStr(L.lose.body), `${name}:lose.head/body 齊備`)
    if (L.hud) check(isStr(L.hud.start) && isStr(L.hud.goal), `${name}:hud.start/goal 齊備`)
    if (L.honey) check(isStr(L.honey.head) && isStr(L.honey.ref) && isStr(L.honey.verse) && isStr(L.honey.body), `${name}:honey 彩蛋齊備`)
  }
}

// ── 2. 語法:所有原始碼都能被解析 ───────────────────────────────────
function checkSyntax() {
  section('2. 原始碼語法 (node --check)')
  const files = walk(join(root, CONFIG.srcDir)).filter((f) => CONFIG.syntaxExts.includes(extname(f)))
  if (!check(files.length > 0, `找到 ${files.length} 個原始檔`)) return
  for (const f of files) {
    try {
      execSync(`node --check "${f}"`, { stdio: 'pipe' })
      ok(`解析 OK:${f.slice(root.length + 1)}`)
    } catch (e) {
      bad(`語法錯誤:${f.slice(root.length + 1)} — ${String(e.stderr || e.message).split('\n')[0]}`)
    }
  }
}

// ── 3. 狀態機 / 嵌入契約(對 game.js 做靜態斷言)──────────────────────
function checkRouting() {
  section('3. 狀態機路由 + 嵌入契約 (game.js)')
  let src
  try {
    src = readFileSync(join(root, CONFIG.gameModule), 'utf8')
  } catch (e) {
    return bad(`讀不到 ${CONFIG.gameModule}:${e.message}`)
  }
  for (const tok of CONFIG.routingMustInclude) check(src.includes(tok), `包含關鍵字「${tok}」`)
  for (const re of CONFIG.routingMustMatch) check(re.test(src), `符合路由規則 ${re}`)
  for (const re of CONFIG.embedForbid) check(!re.test(src), `嵌入契約:game.js 未自行 import UI(${re})`)
}

// ── 4. PWA / 離線就緒(--offline)──────────────────────────────────
function checkOffline() {
  section('4. PWA 離線就緒(build → 檢查 site/)')
  try {
    console.log(`  · 執行 ${CONFIG.buildCmd} …`)
    execSync(CONFIG.buildCmd, { cwd: root, stdio: 'pipe' })
    ok(`build 成功`)
  } catch (e) {
    return bad(`build 失敗:${String(e.stderr || e.message).split('\n')[0]}`)
  }
  const site = join(root, CONFIG.siteDir)
  if (!check(existsSync(site), `產生了 ${CONFIG.siteDir}/`)) return

  const allFiles = walk(site).map((f) => f.slice(site.length + 1).replace(/\\/g, '/'))
  const inSite = (p) => {
    const rel = p.replace(/^\//, '') || CONFIG.entryHtml
    return allFiles.includes(rel === '' ? CONFIG.entryHtml : rel)
  }

  check(inSite('/' + CONFIG.entryHtml), `${CONFIG.entryHtml} 已輸出`)

  const html = readFileSync(join(site, CONFIG.entryHtml), 'utf8')
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1])
  const external = refs.filter((r) => /^https?:\/\//.test(r))
  check(external.length === 0, `index.html 無外部資產參照(離線安全)${external.length ? ':' + external.join(', ') : ''}`)
  for (const r of refs.filter((r) => r.startsWith('/'))) {
    check(inSite(r), `index.html 參照存在:${r}`)
  }

  const cssRel = refs.find((r) => r.endsWith('.css'))
  if (cssRel && inSite(cssRel)) {
    const css = readFileSync(join(site, cssRel.replace(/^\//, '')), 'utf8')
    check(!/@import|https?:\/\//.test(css), `${cssRel} 無外部字型/@import(離線安全)`)
  }

  const manRel = CONFIG.manifestFile
  if (check(inSite('/' + manRel), `${manRel} 已輸出`)) {
    try {
      const man = JSON.parse(readFileSync(join(site, manRel), 'utf8'))
      check(isStr(man.name) && isStr(man.start_url) && isStr(man.display), 'manifest 有 name/start_url/display')
      check(Array.isArray(man.icons) && man.icons.length > 0, `manifest 有 icons(${man.icons?.length ?? 0})`)
      for (const ic of man.icons || []) check(inSite(ic.src), `圖示存在:${ic.src}`)
    } catch (e) {
      bad(`manifest 不是合法 JSON:${e.message}`)
    }
  }

  const swRel = CONFIG.swFile
  if (check(inSite('/' + swRel), `${swRel} 已輸出`)) {
    const sw = readFileSync(join(site, swRel), 'utf8')
    check(/CACHE\s*=\s*['"][^'"]+['"]/.test(sw), 'sw.js 有 CACHE 版本號(改版用)')
    const coreBlock = sw.match(/CORE\s*=\s*\[([\s\S]*?)\]/)
    if (check(!!coreBlock, 'sw.js 有 CORE 預快取清單')) {
      const core = [...coreBlock[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1])
      for (const c of core) check(inSite(c), `預快取檔存在:${c}`)
    }
    const jsRefs = refs.filter((r) => r.endsWith('.js'))
    const coreList = coreBlock ? coreBlock[1] : ''
    if (jsRefs.some((j) => !coreList.includes(j)))
      warn('入口 JS 未列入 CORE 預快取(此 SW 為 network-first,首次線上載入後才離線可用——建議裝好後先線上完整玩一輪)')
  }
}

// ── 跑 ──────────────────────────────────────────────────────────────
console.log('\x1b[1m參孫打獅子 · 煙霧測試\x1b[0m' + (WANT_OFFLINE ? '(含離線就緒)' : ''))
if (!CONFIG.skipContent) {
  await checkScripture()
}
checkSyntax()
if (!CONFIG.skipRouting) checkRouting()
if (WANT_OFFLINE) checkOffline()
else console.log('\n\x1b[2m(略過 PWA 離線檢查;加 --offline 可一併檢查 build + sw + manifest)\x1b[0m')

section('結果')
console.log(`  通過 ${pass}　失敗 ${fail}　提醒 ${warns.length}`)
if (fail > 0) {
  console.log('\n\x1b[31m有失敗項目:\x1b[0m')
  fails.forEach((f) => console.log('  · ' + f))
  process.exit(1)
}
console.log('\n\x1b[32m全部通過 ✓\x1b[0m')
