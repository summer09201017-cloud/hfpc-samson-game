# 參孫打獅子 — 開發路線圖(roadmap)

> 更新:2026-06-20。核心關卡**已完整、已上線、可直接上課**;以下「待做」全是加值,非必要。
> 排序原則:**CP 值(價值÷開發時間)由高到低**。⏱ 是粗估開發時間。先做「快贏」區。

---

## ✅ 已完成(別重做)

**核心 boss 戰**
- 俯視角競技場走位戰;獅子 AI:enter→approach→telegraph(紅線追蹤、撲前 `aimLockLead` 0.2s 鎖定)→charge→recovery。
- 友善設計:受擊無敵閃爍、失敗零懲罰、撕裂收尾經文。

**完整 boss 戰生態(這幾輪加的)**
- 🍯 蜂窩補血(`HONEY`,不定時、滿血不吃)· 🪨 石頭反制(`ROCK`,碰到擲向獅子,走共用 `_damageLion`)。
- ⚡ 神蹟降臨(`MIRACLE`,每 30s 天降閃電 -3 血;地獄模式縮 20s)· 😡 最後狂暴(hp≤3 全攻擊加速)。
- 🦷 第二階段捕獸夾(hp<10,先警示再彈出)· 🩸 大範圍爪擊(hp≤15,紅線 3s 後斬擊)。
- 🕯️ 墮落系統(`CORRUPTION`:每死漸暗;累積死 3 次→地獄/死神模式,得勝不清零)· 💀 壞結局(地獄中再死→黑霧+黑手捏心+震動演出,指向羅 6:23)。
- 💛 金色的心(`GOLDEN_HEART`,每秒 2% 稀有出現,撿到突破血量上限 maxHearts+1;上限改 `s.maxHearts` 實例狀態)。
- ⏳ 死亡回歸(Re:Zero 式):前三次死亡黑霧轉場後,獅子血量倒退回 `rewindSeconds`(30s)前(`_clock`+`_hpLog`+`_hpAtRewind`);保留死神/黑暗,站位重置、動畫不變。
- 💥 打擊感:反擊命中 = 頓幀(`_hitStop`)+ 畫面震動(只搖世界層、連擊越強)+ 加大爆擊 + 獅子打退閃白 + 手機震動 + 三層打擊音。
- 🎵 背景音樂:原創 A 小調情感曲(憂傷→推進,Web Audio 合成、零音檔)。
- 數值:獅子 30 血、玩家 3 心、Shift 奔跑;`phaseOf` 按 30 重分。

**美術(零美術檔,純向量 / CSS)**
- 參孫(正常人體比例、長髮拿細耳人記號、直臂出拳)· 獅子/死神(雙層鬃毛、3/4 側臉透視五官、怒吼獠牙)· 黑手(真手:前臂+手背+四指對握)· 黑霧/閃電/螢幕震動。
- 背景葡萄園(藤架+葡萄串+耕作壟+石磚牆+暗角)· HUD(漸層血條依階段換色+分段刻度、滿/暗心)· 標題/勝負 DOM 卡片(羊皮紙+金邊+進場動畫+經文引號)。

**上線 / 基礎建設**
- 部署 `hfpc-samson-game.netlify.app`(資產 200 驗證)· GitHub `summer09201017-cloud/hfpc-samson-game`(public)。
- 進大廳:戰爭闖關合輯第 6 關,**PR #6 已 merge、線上大廳卡片已亮**。
- 測試鏈 `npm test` / `npm run test:offline` 全綠;另以 headless 模擬驗證機制時序與命中。
- 文件對齊實作(CLAUDE/README/roadmap/記憶);**doc-sync hook**(改玩法檔自動提醒同步文件)。
- **Skill 合輯一鍵跨機安裝**(私有 repo `hfpc-claude-skills`,31 skill + 2 指令 + 1 agent;`/plugin` 或 `install.bat`)。

---

## 🔜 待做 — 加值功能(按 CP 值排序)

### A. 快贏區(高 CP 值,半天內)— 建議先做

| # | 項目 | 類型 | 價值 | ⏱ | 備註 |
| --- | --- | --- | --- | --- | --- |
| 1 | **難度選單(易/中/難)** | 功能 | ★★★★★ | 1–2h | 標題三顆鈕 → 各一組 `config`(`maxHearts`/`aimLockLead`/`PHASES`/各階段門檻)。**現在最該做**:這輪堆了 30 血+3 心+爪擊+捕獸夾+地獄,對小小孩偏硬;一個「易」模式立刻救回兒童友善。做完抽成 skill `game-difficulty-presets`。 |
| 2 | **過關星級(1–3★)** | 好玩 | ★★★★☆ | 1h | 依剩餘心數+最高 combo 給星。資料已在追蹤,純顯示層,立刻有重玩動力。 |
| 3 | **勝利經文語音朗讀** | 好玩/無障礙 | ★★★★☆ | 1–2h | Web Speech API 朗讀和合本,不識字的孩子也能領受。零音檔;處理 zh-TW 無語音時靜默。做完抽 skill `web-speech-scripture`。 |
| 4 | **難度平衡校正(實玩)** | 體驗 | ★★★★☆ | 半天 | 這輪加太多硬機制,需實際玩一輪調 `config`(神蹟間隔/血量/捕獸夾頻率),確認「正常玩約 X 分鐘、不無聊也不勸退」。 |

### B. 中等區(半天～1 天)

| # | 項目 | 類型 | ⏱ | 備註 |
| --- | --- | --- | --- | --- |
| 5 | 首玩教學提示 | 功能 | 半天 | 第一次進場三步提示(走位/看紅線/抓💢),`localStorage` 記住不再顯示。 |
| 6 | 接大廳記分板 | 功能 | 半天–1天 | 星級/combo 上傳 `hfpc-bible-games` 的 `scoreboard.js`(跨 repo)。 |
| 7 | 蜂蜜謎語互動 | 好玩 | 半天 | 彩蛋升級成猜謎答對解鎖(士 14:14)。 |

### C. 願景區(多天)

| # | 項目 | ⏱ | 備註 |
| --- | --- | --- | --- |
| 8 | 第二關:驢腮骨之戰(士 15) | 多天 | `opts.level` 欄位已留;新機制(群敵?),參孫變 2–3 關小系列。 |
| 9 | 第三關:推柱結局(士 16) | 多天 | 大利拉→失明→最後呼求神推柱,神學收尾最重。 |

---

## 🧰 待做 — 跨專案 Skill / 指令 / Agent / Hook / MCP

> 合輯 repo `hfpc-claude-skills` 現有 **48 skill + 6 指令 + 4 agent + cuv MCP**(兩台 PC 共同推進)。以下只列與本遊戲直接相關者。

| 狀態 | 項目 | 類型 | 用途 |
| --- | --- | --- | --- |
| ✅ | `add-to-collection` / `ship-game-online` | skill | 加大廳卡 / 一條龍上架 |
| ✅ | `arena-pickups-hazards`(含金心)/ `boss-escalation` / `corruption-bad-ending` / `canvas-vector-characters` | skill | 本遊戲機制與美術已抽成可重用 skill |
| ✅ | `hit-feel-juice` / `procedural-bgm` / `canvas-playwright-verify` | skill | 打擊感配方 / 零音檔作曲 / Playwright 實機截圖驗收 |
| ✅ | **`cuv` 和合本經文查詢 MCP** | MCP | 本地 server,`lookup(書,章,節)` 回正確和合本(資料在 `~/.claude/cuv-data` 9 版本);杜絕經文寫錯。skill `cuv-scripture-mcp`。 |
| ✅ | `web-speech-scripture` | skill | 朗讀和合本 + zh-TW fallback(快贏 #3 的底,已抽出) |
| ✅ | `/sync-skills` / `/ship-check` / `/handoff` | 指令 | 同步 skill / 上線前體檢 / 交接一條龍 |
| ✅ | `bible-game-reviewer` / `qa-playtester` / `difficulty-balancer` | agent | 審關卡 / 跑測試回報失敗 / headless 自我對戰校正難度 |
| ✅ | `pre-push-guard`(hook)/ doc-sync(`.claude/settings.json`) | hook | push 前自動測試 / 改玩法檔提醒同步文件 |
| 💡 | `game-difficulty-presets` | skill | 快贏 #1 做完抽出:難度選單↔config 對應 |
| 💡 | `death-rewind`(死亡回歸) | skill | 把「死亡倒退進度」抽成可重用機制(時鐘+血量歷史+回歸,Re:Zero 式) |

---

## 📐 規則 / 慣例

| 狀態 | 規則 |
| --- | --- |
| ✅ | 改玩法 = 同 commit 同步更新文件 + 記憶(+ doc-sync hook 自動提醒) |
| ✅ | 每個遊戲 repo 標配 `roadmap.md` + `讀我-HANDOFF.txt` |
| ✅ | skill 改動走 `/sync-skills` 同步進合輯 repo |
| 💡 低優先 | 教室前一天 `/schedule` 自動 `/ship-check` 確認線上站 |

---

## 🚫 刻意不做(已決定,別提案)
- **倚靠值 meter / 反向 RPG**:這關保持「純動作 + 走位閃避」,神學靠文案帶出,不做能量條(反向 RPG 是別關設計,見 skill `reverse-rpg-design`)。
- 把關卡原始碼複製進大廳:大廳只深連結帶路,永不複製關卡。
