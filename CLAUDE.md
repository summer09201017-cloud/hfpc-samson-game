# 參孫打獅子 — 開發筆記(CLAUDE.md)

單一動作關的聖經小遊戲:**參孫打獅子**(士師記 14:5-6)。純 vanilla ES modules + Canvas,
零執行期相依、Web Audio 合成音效、可離線(PWA)。架構沿用「約拿闖關」引擎(arcade-game-kit)。

## 現況(2026-06-17)— 已完成 vs 待做

**✅ 已完成、已上線**
- 完整單一動作關(俯視角競技場走位 boss 戰),`npm test` / `npm run test:offline` 全綠。
- **已部署**:https://hfpc-samson-game.netlify.app(首頁/入口JS/經文/SW/manifest 皆 200 驗證)。
- **GitHub**:`summer09201017-cloud/hfpc-samson-game`(public)。
- **已進大廳**:`hfpc-bible-games` 戰爭闖關合輯第 6 關,卡片已點亮(PR #6,待 merge 進 main 才在線上正式大廳亮)。
- 文件已對齊實作(本檔、README、記憶);telegraph 紅線追蹤 + 撲出前 0.2s 鎖定(`LION.aimLockLead`)。

**🔜 真正待做** → 細節與優先序見 **`roadmap.md`**(按 CP 值 × 開發時間排序)。一句話:核心已完整可上課;待做都是「加值」,非必要。

**交接**:另一台 PC 接手請先讀 `讀我-HANDOFF.txt`。

## 玩法核心(俯視角競技場 boss 戰)

俯視角競技場(亭拿葡萄園的一塊地,`ARENA`)。參孫在場內自由走位,對抗在場上移動的少壯獅子。獅子節奏:

```
獅子:  enter → approach(走近) → telegraph(⚠ 預備·紅線追著你瞄準) → charge(衝刺·方向定住) → recovery(💢 破綻) → approach …
玩家:                                          ↑ 看到 ⚠ 就持續走位          ↑ 牠撲出後仍要側身離開那條直線   ↑ 趁破綻靠近反擊
```

- **走位即閃避**:WASD / 方向鍵(或觸控拖曳 = 虛擬搖桿)在場內自由移動。獅子 `telegraph` 期間紅線**追著參孫轉**(`lion._aimAt` 每幀更新衝刺方向),但在撲出前 `LION.aimLockLead`(預設 0.2 秒)**停止追蹤、把方向定住**(`l.aimLocked`,紅線由虛線轉亮實線)——給玩家公平的閃避窗:看到紅線停住就側身讓開。**沒有翻滾、沒有 i-frames**——唯一的無敵是受擊後的閃爍(`SAMSON.invulnTime`)。只有 `charge` 會撞傷參孫(`LION.contactR`),走近不會。
- **反擊**:空白/Enter/J/K/F,或**輕點畫面**(短按未拖曳)→ 出手。需同時滿足:靠近獅子(`SAMSON.attackReach`)+ 落在出手有效窗(`SAMSON.attackActive`)+ **獅子在 `open`(recovery 破綻窗)**才算數,扣 1 滴血;沒抓到破綻會被擋開(combo 歸零)。
- 反擊 `LION.maxHp`(預設 6)下 → 觸發「撕裂」收尾(`enterFinisher`),神的靈光暈 + 經文淡入 → 過關。
- 友善:參孫 5 顆心、受擊無敵閃爍、失敗零懲罰乾淨重來。神學訊息(力量出於神的靈)在標題/勝利/蜂蜜彩蛋帶出。

## 一檔一責

```
src/
  game.js      主迴圈 + 狀態機(title/intro/fight/finisher/win/lose/paused)+ 戰鬥裁判 + 嵌入契約
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
