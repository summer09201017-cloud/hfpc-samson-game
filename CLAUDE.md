# 參孫打獅子 — 開發筆記(CLAUDE.md)

單一動作關的聖經小遊戲:**參孫打獅子**(士師記 14:5-6)。純 vanilla ES modules + Canvas,
零執行期相依、Web Audio 合成音效、可離線(PWA)。架構沿用「約拿闖關」引擎(arcade-game-kit)。

## 現況(2026-06-18)— 已完成 vs 待做

**✅ 已完成、已上線**
- 完整 boss 戰生態:走位閃避 + 蜂窩補血/石頭反制 + 神蹟閃電/最後狂暴 + 捕獸夾/大範圍爪擊 + 墮落/地獄(死神)模式 + 壞結局。`npm test` / `npm run test:offline` 全綠。
- 美術全面升級(零美術檔):背景葡萄園、HUD 漸層血條/心、標題勝負羊皮紙卡片、向量參孫/獅子(3/4 透視)/黑手/煙/閃電。
- **已部署**:https://hfpc-samson-game.netlify.app(資產 200 驗證)。**GitHub**:`summer09201017-cloud/hfpc-samson-game`(public)。
- **已進大廳**:`hfpc-bible-games` 戰爭闖關合輯第 6 關,**PR #6 已 merge、線上大廳卡片已亮**。
- 文件已對齊實作(本檔、README、roadmap、記憶);`.claude/settings.json` 有 doc-sync hook(改玩法檔自動提醒同步文件)。
- **Skill 合輯一鍵跨機安裝**:私有 repo `hfpc-claude-skills`(31 skill + `/sync-skills`、`/ship-check` 指令 + `bible-game-reviewer` agent)。換機用 `/plugin` 或 `install.bat`。

**🔜 真正待做** → 細節與優先序見 **`roadmap.md`**(按 CP 值 × 開發時間排序)。一句話:核心已完整可上課;**唯一較急的是難度選單**(這輪堆了 30 血/3 心/地獄,對小小孩偏硬),其餘都是加值。

**交接**:另一台 PC 接手請先讀 `讀我-HANDOFF.txt`(含「一鍵裝齊所有 skill」)。

## 玩法核心(俯視角競技場 boss 戰)

俯視角競技場(亭拿葡萄園的一塊地,`ARENA`)。參孫在場內自由走位,對抗在場上移動的少壯獅子。獅子節奏:

```
獅子:  enter → approach(走近) → telegraph(⚠ 預備·紅線追著你瞄準) → charge(衝刺·方向定住) → recovery(💢 破綻) → approach …
玩家:                                          ↑ 看到 ⚠ 就持續走位          ↑ 牠撲出後仍要側身離開那條直線   ↑ 趁破綻靠近反擊
```

- **走位即閃避**:WASD / 方向鍵(或觸控拖曳 = 虛擬搖桿)在場內自由移動,**按住 Shift 奔跑**(`SAMSON.runMultiplier`,出手中不奔跑)。獅子 `telegraph` 期間紅線**追著參孫轉**(`lion._aimAt` 每幀更新衝刺方向),但在撲出前 `LION.aimLockLead`(預設 0.2 秒)**停止追蹤、把方向定住**(`l.aimLocked`,紅線由虛線轉亮實線)——給玩家公平的閃避窗:看到紅線停住就側身讓開。**沒有翻滾、沒有 i-frames**——唯一的無敵是受擊後的閃爍(`SAMSON.invulnTime`)。只有 `charge` 會撞傷參孫(`LION.contactR`),走近不會。
- **反擊**:空白/Enter/J/K/F,或**輕點畫面**(短按未拖曳)→ 出手。需同時滿足:靠近獅子(`SAMSON.attackReach`)+ 落在出手有效窗(`SAMSON.attackActive`)+ **獅子在 `open`(recovery 破綻窗)**才算數,扣 1 滴血;沒抓到破綻會被擋開(combo 歸零)。
- **大範圍爪擊(血量 ≤ `LION.clawHpThreshold`,預設 15)**:`lion.claw` 子狀態機 `idle→warn→strike`。每隔 `clawGap`(2.5s)起一次:`warn` 期在地上顯示一條**穿過全場的紅線**(進 warn 時定住:穿過當下玩家位置、方向由獅子指向玩家),`clawTelegraph`(3s)後進 `strike`——沿線揮下斬擊 `clawStrike`(0.28s)。玩家到線的**垂直距 < `clawHalfWidth`(46)+ 半徑**才會被打(往垂直方向走開即閃過)。判定在 `game.js`(用 `lion.clawPerpDist`),繪製在 `renderer.js`(限制在 `ARENA` 內)。
- **第二階段(血量 < `LION.fangHpThreshold`,預設 10)**:獅子每 `fangInterval`(2 秒)在場上放一個**捕獸夾**。每個生命週期:先在地上顯示 `fangWarn`(0.8 秒)**警示提示**(收緊的紅色目標圈+十字,無傷)→ 捕獸夾**彈出**並傷人 `fangLife`(5 秒)→ 消失。彈出後踩到扣 1 心(吃受擊無敵)。由 `lion.fangs[]`(每個 `{x,y,t}`,`t`=已存在秒數)自持:spawn/老化/cull 在 `lion._updateFangs`(總壽命 = `fangWarn+fangLife`),碰撞判定在 `game.js`(`f.t >= fangWarn` 才傷人),捕獸夾向量繪製在 `renderer.js`。不會生在玩家腳下(`fangSafeR`)。
- **最後狂暴(血量 ≤ `LION.enrageHpThreshold`,預設 3)**:`lion.enraged()` 為真時,`cfg()` 把衝刺循環的時長 ÷`enrageSpeedup`(1.3)、移動速度 ×`enrageSpeedup`,捕獸夾 `fangInterval` 與爪擊 `clawGap` 也同步縮短 → 所有攻擊加快。只加快節奏/移動,大招預警窗保留。renderer 在獅子腳下畫脈動紅光暈。
- **神蹟降臨(`MIRACLE`)**:每隔 `interval`(30 秒;死神/地獄模式縮短為 `deathInterval`=20 秒)天降閃電打在獅子身上,扣 `damage`(3)血——把「耶和華的靈大大感動參孫」直接演出來(得勝出於神、非人的本事)。計時在 `game.step`(`_miracleTimer`),傷害走共用 `_damageLion`(可直接觸發收尾),全場白光+鋸齒閃電+經文(`scripture.js` 的 `LEVEL1.miracle`,經 `game.miracleText` 餵給 renderer,不寫死)繪製在 `renderer._lightning`。
- **墮落系統(`CORRUPTION`)+ 黑霧復活轉場**:玩家死亡(心歸零)時 `gameOver()` **不跳失敗畫面**,改進入新狀態 `STATE.REVIVING`——**黑霧自四周往中間聚攏直到全黑**(`reviveDuration` 約 3 秒,`renderer._reviveMist`);轉場過半(全黑)時在暗處呼叫 `_revive()`:**參孫與獅子重置回原本起始站位、獅子動畫重新登場(`enter`)、清掉進行中的衝刺/捕獸夾/爪擊**,滿血 + `SAMSON.reviveInvuln`(2.2s)無敵;**獅子血量「死亡回歸」倒退回 `CORRUPTION.rewindSeconds`(30 秒)前的值**(Re:Zero 式——`game._clock` 戰鬥時鐘 + `_hpLog` 每 0.5s 記血量歷史,`_hpAtRewind()` 查 30 秒前;玩家損失這段進度,死亡有代價但不從頭),但**保留死神模式與累積的黑暗**(時間倒退、墮落不倒退);轉場結束由全黑快速淡入(`fx.reviveT`)揭開續戰。每死一次 `game.deaths` 累積、戰鬥畫面疊加 `darkenPerDeath` 黑暗。死滿 `deathModeAt`(3)次那一刻 → `game.deathMode=true`,**無縫**轉入地獄模式:獅子當場化為**死神**(`lion.deathMode` → 暗黑配色+發光紅眼+💀+暗紫暈影,HUD 名稱換 `LEVEL1.deathHud`),難度大增(`cfg()` 再乘 `speedup` 1.5、捕獸夾與爪擊滿血就啟用)。**地獄模式中再死一次**才走壞結局(見下)。`deaths/deathMode` 在 `win()` 不清零(整輪累積)、`toTitle()` 與壞結局收尾才清零。士師記的影子(士 16:一再失敗、心被蒙蔽)。(嵌入模式無此演出,死亡仍直接 `onComplete`。)
- **壞結局(地獄模式中再死一次)**:已在 `deathMode` 時 `gameOver()` 改走 `enterBadEnding()` → 新狀態 `STATE.BADENDING` 演出(`renderer._drawBadEnding`:黑霧聚攏 → 漆黑細手伸入捏住心臟[`_heart`]→ 全黑字幕,長度 `BADEND.duration`),演完顯示壞結局畫面(`ui.showBadEnding` + `scripture.js` 的 `LEVEL1.badEnd`,羅 6:23 指向基督的盼望),並把 `deaths/deathMode` 清零讓下一輪重新開始。象徵性、不血腥。
- 反擊 `LION.maxHp`(目前 30)下 → 觸發「撕裂」收尾(`enterFinisher`),神的靈光暈 + 經文淡入 → 過關。
- **蜂窩補血(`HONEY`)**:場上每隔 `spawnMin~spawnMax`(6~11s 隨機=不定時)出現一個 🍯 蜂窩(場上最多 `maxOnField`,`life` 秒沒吃會閃爍後消失,不生在玩家腳下 `safeR`)。走過去(`HONEY.r`)補 `heal`(1)滴血,**滿血則不吃、留在場上**。由 `game.honeys[]` 自管(`_stepHoney`/`_spawnHoney`),呼應士 14:8-9「從死獅之內取蜜」。
- **金色的心(`GOLDEN_HEART`)**:場上每秒 `chancePerSec`(2%)機率出現一顆稀有 💛(場上最多 `maxOnField`=1,`life` 秒沒撿會閃爍消失)。撿到**突破血量上限**:`samson.maxHearts +1` 且補 1 滴。★ 因此血量上限改為**參孫實例狀態** `s.maxHearts`(reset 初始化為 `SAMSON.maxHearts`),HUD/`win` 都讀它;HUD 超過 8 顆改顯示「目前/上限」緊湊版避免爆版。死亡回歸**保留**突破後的上限(永久增益)。由 `game.golden[]` 自管(`_stepGolden`)。
- **石頭反制(`ROCK`)**:場上不定時(`spawnMin~spawnMax`)出現灰石,玩家碰到(`ROCK.r`)→ 石頭自動**朝獅子扔出**(輕度追蹤確保命中)→ 砸中扣 `ROCK.damage`(1)血。由 `game.rocks[]`(`state:'ground'|'thrown'`)管理(`_stepRocks`),傷害走共用的 `_damageLion`(與反擊同一條路徑,含收尾與跨階段提示)。
- 友善:參孫 `SAMSON.maxHearts`(目前 3)顆心、受擊無敵閃爍、**前 3 次死亡無縫復活**(見墮落系統)。神學訊息(力量出於神的靈)在標題/勝利/蜂蜜彩蛋帶出。HUD 血條顯示獅子血量**百分比**。
- **美術(`renderer.js` + `styles.css`)**:背景 `_bgArena` = 環場葡萄園(藤架柱+拉線+葡萄串 `_grapes`)、競技場乾淨耕作壟地、石磚邊牆、全畫面暗角;HUD = 漸層血條(依 phase/死神換色、分段刻度)+ 心(滿/暗心顯示上限);標題/勝利/失敗 DOM 卡片(`styles.css`)= 羊皮紙質感+金色裝飾線+進場動畫+經文引號。純向量/CSS 漸層,零美術檔、離線安全。

## 一檔一責

```
src/
  game.js      主迴圈 + 狀態機(title/intro/fight/reviving/finisher/badending/win/lose/paused)+ 戰鬥裁判 + 嵌入契約
  config.js    ★ 所有可調數值(SAMSON / LION / PHASES / 判定窗 / INTRO / FINISHER)——調手感只動這裡
  scripture.js ★ 經文與文案(LEVEL1:title/verse/win/lose/hud/honey,和合本)——改文案只動這裡
  samson.js    參孫:俯視角走位(idle/move)+ attack(反擊,有效判定窗)、hearts、受擊無敵
  lion.js      少壯獅子 AI 狀態機:enter/approach/telegraph/charge/recovery + 依血量分 phase
  renderer.js  所有 Canvas 繪製:葡萄園背景、向量參孫、向量獅子、HUD、開場、撕裂收尾——只讀狀態
  input.js     原始輸入(移動向量 moveVector + 攻擊邊緣訊號 consumeAttack + 觸控搖桿/輕點 + 暫停熱區);不懂遊戲規則
  ui.js        DOM 覆蓋層(標題/勝利/失敗/暫停/蜂蜜彩蛋)+ 右上 pause/mute 鈕
  audio.js     Web Audio 即時合成音效 + 背景音樂(零音檔、可離線)
index.html / styles.css / main.js   外殼:建 canvas、new Game(canvas,{ui:new UI()}).boot()
```

迴圈用**固定時間步長**累加器(`STEP = 1/60`),物理在任何更新率下一致;邏輯解析度固定 960×540,
renderer 量 `canvas.parentElement` 等比縮放置中。

## 嵌入契約(即使現在單機也保留)

未來要把這關接進保羅大富翁 / 聖經遊戲大廳時不用大改:

1. **`ui` 由外部注入**——`game.js` 不 `import './ui.js'`。單機 `new Game(canvas,{ui:new UI()})`;嵌入傳空殼 `NullUI`(這關是純 Canvas 戰鬥,不需卡片 UI)。
2. **`embed` 旗標**:`opts.embed=true` 時跳過標題、直接 `startFight()`;`win()/gameOver()` 改呼叫 `opts.onComplete({won,score,level})`;`_enterImmersive()` 一律 no-op。
3. **`stopped` 旗標 + `destroy()`**:停迴圈、`window.removeEventListener`、`input.detach()`、停音訊。
4. **HUD 文字走 `this.hudLabels`**(`opts.hudLabels` 可覆蓋),renderer 別寫死。
5. `opts.level` 保留欄位:日後本 repo 可加士 15 驢腮骨、士 16 推柱。

## 本機地雷(務必遵守)

- **不要用 `vite build`**:這台 Node 24 在遞迴 `cpSync/rmSync` 會無聲被殺(exit 127)。`npm run build` 走自寫的 `scripts/bundle-static.mjs`(單檔 copy + 逐層 readdir → 輸出 `site/`)。
- **`.bat` 純 ASCII + CRLF**:中文會亂碼、LF 會讓 `goto` 解析失敗閃退。
- **localhost 自動 unregister SW**(`main.js`):否則「快取優先」會餵舊檔,改了沒反應。只有正式環境才註冊。
- 新增 `src/` 模組時,記得加進 `public/sw.js` 的 `CORE` 預快取清單(`npm run test:offline` 會檢查)。
- **改玩法 = 同一個 commit 內同步更新文件**:本檔「玩法核心」、`README.md` 操作表、`roadmap.md`、以及自動記憶。本專案曾發生文件描述「對峙固定站位+翻滾 i-frames」但實作早已是「俯視角走位、無翻滾」,害老師會教錯——避免再脫節。
- **上架/部署流程**走 skill `ship-game-online`(git→GitHub→Netlify→curl 驗證→點亮大廳卡);大廳卡片走 skill `add-to-collection`。`site/` 不入庫,Netlify 端 `npm run build` 重建。
- **`.claude/settings.json` 有 PostToolUse hook**(`scripts/doc-sync-hook.mjs`):改到 `src/*.js` 玩法/文案/狀態機檔時,提醒同步文件。非阻斷、只印一行;不想要可刪 `.claude/settings.json`。
- **工具**:`/ship-check`(上課前體檢:測試+curl 驗證線上)、`/sync-skills`(同步 skill 合輯並推送)、`bible-game-reviewer` agent(審關卡能否放心給孩子)。這些隨 skill 合輯 `hfpc-claude-skills` 走;裝法見 `讀我-HANDOFF.txt`。

## 指令

```
npm install            # 第一次(裝 vite + sharp)
npm run dev            # 開發(port 5273)
npm run icons          # 由 scripts/logo.svg 產生 PWA 圖示(需 sharp)
npm run build          # 產生 site/(逐檔複製,避開 Node 24 地雷)
npm run serve:dist     # 本機預覽 site/(port 8080)
npm test               # 煙霧測試:文案 + 語法 + 狀態機/嵌入契約
npm run test:offline   # 再加 build → PWA 離線就緒檢查
```

調手感 → `config.js`(尤其 `PHASES` 的 telegraph/recovery 長度、`LION.maxHp`、`SAMSON.maxHearts`)。
偏難就調短 telegraph/recovery、調快 approach;偏易就反向。兒童友善優先,寧可偏簡單。
