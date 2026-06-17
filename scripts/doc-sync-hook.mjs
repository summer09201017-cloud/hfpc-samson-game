// PostToolUse hook:改到「玩法 / 文案 / 狀態機」檔時,提醒同步文件。
// 為什麼:本專案曾發生「文件說 A、程式做 B」(對峙翻滾 vs 俯視走位),害老師會教錯。
// 由 .claude/settings.json 接上;從 stdin 讀 Claude Code 傳入的工具事件 JSON,只在相關檔觸發。
// 非阻斷:永遠 exit 0,只印一行提醒(失敗也不影響任何操作)。
import { readFileSync } from 'node:fs'

let path = ''
try {
  const ev = JSON.parse(readFileSync(0, 'utf8'))
  path = (ev.tool_input && ev.tool_input.file_path) || ''
} catch {
  /* 讀不到就安靜結束 */
}

// 會影響玩法/文案/狀態機,改了通常要同步文件的檔
const WATCH = /src[\\/](config|scripture|game|lion|samson|renderer|input|ui)\.js$/i
if (WATCH.test(path)) {
  const f = path.split(/[\\/]/).pop()
  console.log(
    `📝 你改了 ${f} —— 若動到玩法/文案/數值,記得同一輪同步:` +
      `CLAUDE.md「玩法核心」、README 操作表、roadmap.md。(本專案曾文件/實作脫節)`
  )
}
process.exit(0)
