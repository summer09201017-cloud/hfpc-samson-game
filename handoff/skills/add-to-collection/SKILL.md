---
name: add-to-collection
description: 把一個「已存在、各自獨立部署」的聖經闖關,加進總入口大廳 hfpc-bible-games 的卡片牆——可以是「直達卡片」(連到某遊戲網址)或「合輯卡片」(戰爭闖關合輯 / 逆轉奇兵 / 挪亞方舟…就地展開的一組關卡)。當使用者說「把某關放進戰爭合輯 / 加進大廳合輯 / 大廳多一張卡片 / 把參孫(某關)接到戰爭闖關 / 合輯卡片 / 總入口加一段旅程 / 戰爭闖關合輯加一關 / 開一個新合輯」時使用。大廳「只帶路、不放遊戲、不複製關卡」。
---

# 把一關加進總入口大廳的合輯（add-to-collection）

> 大廳 = `hfpc-bible-games`（容器:`C:\Users\HFP\Downloads\0615晚\hfpc-git\hfpc-git\hfpc-bible-games`）。
> 唯一要改的檔:**`src/data.js`**(★ 單一真相之源,**不是 `site/`**——`site/` 是 build 產物)。
> 活範例:`COLLECTIONS.war`(戰爭闖關合輯:摩西/大衛/聖歌/反轉/紅海/參孫)、`COLLECTIONS.reversal`(逆轉奇兵 5×2)、`COLLECTIONS.noah`(挪亞方舟)。

## 鐵律:大廳只帶路,不放遊戲

```
大廳「不放遊戲、不複製關卡,只帶路」。卡片 = 一張「精選播放清單」,
每一關用 url 深連結到那關『已部署的網址』。改數值只改原 repo 一處。
```

所以加一關 = **加一張卡片 + 給它一個已部署的網址**。**永遠不要**把遊戲原始碼搬進大廳。
遊戲沒部署前,卡片先 `soon: true`(顯示「敬請期待」、不可點),上線後拿掉 soon、補正式 url。

## 一、先確定「這關的家」(url 從哪來)

大廳不托管遊戲,所以先讓那關有個網址。三種家(挑一種):

| 家 | url 形態 | 何時用 |
| --- | --- | --- |
| **自己的 Netlify 站**(最低工) | `https://hfpc-<名>-game.netlify.app/` | 那關本身就是可獨立 build 的 PWA(像約拿、參孫)。連 GitHub 自動部署即可。 |
| **嵌入保羅大富翁**(永久家路線) | `https://hfpc-paul-game.netlify.app/?demo=<id>` | 想集中托管、消除跨 repo 漂移。需 [[embed-minigame]] 把原碼搬進 `hfpc-paul-game/src/minigames/` + 接 `?demo=` 入口。 |
| **戰爭原型站**(手動部署) | `https://hfpc-war-games.netlify.app/?level=<id>` | vanilla 引擎聚合站,沿用約拿引擎 `?level=` 路由。 |

> 我(Claude)無法替你部署到 Netlify(需你的帳號)。流程:你把那關的 repo build + 部署 → 拿到網址 → 回來把卡片的 `soon:true` 拿掉、填上 url。在那之前,卡片掛 `soon:true` 照樣能上(顯示「敬請期待」)。

## 二、加一關到「既有合輯」(最常做)

在 `src/data.js` 的 `COLLECTIONS.<合輯id>.items[]` 加一筆。欄位形狀(照現有關卡):

```js
{
  // 一行註解:這關住哪個 repo、用什麼入口、部署狀態(沿用現有關卡的註解風格)
  id: 'samson',                 // 此合輯內唯一的英文代號(別跟同合輯其他關撞)
  name: '參孫打獅子',            // 卡片大標(中文)
  subtitle: '士 14・耶和華的靈感動,徒手撕獅',  // 小字(約 10–16 字最好看)
  color: '#9c5a2a',            // 卡片主題色(必填;挑一個跟同合輯其他關不同的色)
  emoji: '🦁',                  // 圖示
  url: 'https://hfpc-samson-game.netlify.app/',  // 部署網址
  soon: true,                  // ⏳ 還沒部署就留著;上線後刪這行
}
```

煙霧測試(`scripts/smoke-test.mjs`)會擋的事 —— **務必滿足**:
- `id`、`name`、`color` 一定要有;`id` 在同一個合輯內不可重複。
- **非 `soon`、非合輯卡片**就一定要有 `url`,且必須 `http(s)://` 開頭。
- `soon: true` 時 `url` 可省(但建議照 README 慣例「先填好 url + soon:true」,上線只要刪 soon)。

## 三、開一個「全新合輯」(較少做)

兩步,缺一不可(否則測試報「孤兒合輯」):

1. **首頁卡片** —— 在 `JOURNEYS[]` 加一張 `collection: '<新id>'` 的卡(`category` 用 `'series'`,**不要寫 url**):
   ```js
   { id:'war', name:'戰爭闖關合輯', subtitle:'…', category:'series',
     color:'#a8324a', emoji:'⚔️', collection:'war' }
   ```
2. **合輯內容** —— 在 `COLLECTIONS` 加 `<新id>: { title, desc, color, emoji, items:[…] }`。
   - `items` 至少一筆(空 items 會被測試擋下)。
   - 想做「卡片版 / 動作版」兩欄並排:加 `paired: true`(見 `COLLECTIONS.reversal`,大廳以「N 列 2 欄」呈現)。

## 四、驗證 + 部署

```bash
# 在 hfpc-bible-games/ 底下:
npm test            # 卡片資料齊備 + 分類有效 + url 合法 + id 不重複 + 接線 + SW 離線清單
npm run test:offline   # 再加:build → site/ app shell 齊備(可離線)
npm run build       # = node scripts/bundle-static.mjs(逐檔複製到 site/)
```

- **地雷**:**不要用 `vite build` / rollup**(這台 Windows + Node 24 遞迴 cpSync/rmSync 會無聲被殺)。build 一律走 `bundle-static.mjs`。
- 部署:`netlify.toml` 已設好(`command=npm run build`、`publish=site`);連 GitHub 自動部署到 `hfpc-bible-games.netlify.app`。
- 離線:大廳 SW 只快取「選單畫面」;各遊戲是別的網域,要離線需各自安裝。

## 鐵則

- 改 **`src/data.js`**,不是 `site/src/data.js`(後者 build 會覆蓋)。
- **不複製關卡進大廳**:只放一張指向原網址的卡片;改關卡數值永遠回原 repo 改。
- 沒部署的關 → `soon: true`(敬請期待);別填一個還不存在的 url 又不掛 soon(會 404)。
- 加完一定 `npm test`;動到 build/SW/離線就 `npm run test:offline`。
- 關卡怎麼來:現成關卡接到保羅站 → [[embed-minigame]];全新動作關 → [[arcade-game-kit]];部署/投影/離線交付 → [[classroom-game-deploy]];把整卷書開成新專案 → [[bible-game-scaffold]];往保羅棋盤(不是大廳)加站 → [[add-challenge-station]]。
