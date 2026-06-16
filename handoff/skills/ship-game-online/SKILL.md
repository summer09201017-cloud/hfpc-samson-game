---
name: ship-game-online
description: 把一個「做好的單機網頁遊戲 repo」一條龍上架——git init + 設定檔(.gitignore/.gitattributes/netlify.toml)+ 建 GitHub repo + 推送 + 部署 Netlify + 驗證線上資產(curl 200)+ 在總入口大廳點亮卡片。當使用者說「把這個遊戲推上線 / 上架 / git init 並推 GitHub / 部署到 Netlify / 建 repo 推上去 / 發佈這關 / 讓網站上線 / 線上驗證 / 點亮大廳卡片」時使用。針對這台 Windows + Node 24、約拿/參孫那種「vanilla + 可獨立 build 成 site/ 的 PWA」。延續 [[classroom-game-deploy]](交付/離線 UX)與 [[add-to-collection]](大廳卡片)。
---

# 把單機網頁遊戲一條龍上架(ship-game-online）

> 適用:vanilla ES modules + Canvas、`npm run build` 會逐檔複製到 **`site/`** 的 PWA(約拿、參孫那一型)。
> 活範例(此流程實際跑過):參孫打獅子 → GitHub `summer09201017-cloud/hfpc-samson-game` → `hfpc-samson-game.netlify.app` → 點亮戰爭合輯卡(2026-06-17)。
> 分工:遊戲怎麼做 → [[arcade-game-kit]];交付/離線/教室 UX → [[classroom-game-deploy]];大廳卡片資料 → [[add-to-collection]]。本 skill 只管「**從本機 repo 到線上可玩、並在大廳亮起來**」。

## 前提檢查
- `npm run build` 能成功產生 `site/`(含 `index.html`、`sw.js`、`manifest.webmanifest`、`src/`、`icons/`)。先跑 `npm run test:offline` 確認。
- 有 `gh`(GitHub CLI)且已登入:`gh auth status`。沒有就改用網頁建 repo + `git remote add`。

## 一、設定檔(照系列慣例,可從姊妹 repo 複製)
在遊戲 repo 根目錄建三個檔(內容與 `hfpc-bible-games` / 約拿同套):
```gitignore
# .gitignore
node_modules/
site/            # build 產物,不入庫(Netlify 會重建)
.DS_Store
*.log
.netlify
```
```gitattributes
# .gitattributes —— .bat 一律 CRLF,否則雙擊時 cmd 解析 goto 失敗閃退
*.bat text eol=crlf
*.cmd text eol=crlf
```
```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "site"
[[headers]]
  for = "/manifest.webmanifest"
  [headers.values]
    Content-Type = "application/manifest+json; charset=utf-8"
[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache"   # SW 不快取,改版才即時送到已安裝裝置
```

## 二、git init + 首次提交
⚠ 這台機器**全域 git 身分可能是空的**(`git config --global user.name` 為空)→ commit 會失敗。先設**這個 repo 的本機身分**:
```bash
git init -b main
git config user.name "HFPC"
git config user.email "agape250@hfpchurch.org.tw"   # 用使用者的教會信箱
git add -A
# 確認排除生效(應為 0):
git ls-files | grep -cE '^(node_modules|site)/'
git commit -m "chore: 初始化 git 與 Netlify 部署設定"
```
(Windows 的 `LF will be replaced by CRLF` 警告正常,不影響。)

## 三、建 GitHub repo 並推送(gh,一行)
命名跟系列一致、且**對齊未來 Netlify 網址**:`hfpc-<名>-game`(→ `hfpc-<名>-game.netlify.app`)。
```bash
gh repo create hfpc-samson-game --source=. --remote=origin --push --public \
  --description "參孫打獅子(士師記 14)— 主日學聖經互動小遊戲"
```
> 公開/私有先問使用者(教會主日學遊戲通常 public,Netlify 接 GitHub 最簡單)。

## 四、部署 Netlify(使用者動作,AI 代登不了)
1. Netlify → **Add new site → Import from Git → GitHub → 選這個 repo**。build 設定會自動讀 `netlify.toml`(不用手填)。
2. **Site name 改成 `hfpc-<名>-game`**(Site configuration → Change site name),網址才剛好等於你要連的那個。

## 五、★ 驗證線上(別只看 HTTP 200,要確認是真遊戲)
部署完用 curl 驗證——這步抓得到「200 但其實是 Netlify 空白頁 / 漏檔」:
```bash
# ⚠ Git Bash 會把 URL 裡的 /path 轉成 Windows 路徑 → 一定要 export MSYS_NO_PATHCONV=1
export MSYS_NO_PATHCONV=1
# 1) 首頁標題是不是真遊戲
curl -s --max-time 15 "https://hfpc-samson-game.netlify.app/" | grep -oE "<title>[^<]*</title>"
# 2) 離線核心資產逐一 200(入口/主迴圈/經文/SW/manifest)
for p in /src/main.js /src/game.js /src/scripture.js /sw.js /manifest.webmanifest; do
  echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://hfpc-samson-game.netlify.app${p}")"
done
```
全 200 + 標題正確 = 真的上線了。

## 六、在大廳點亮卡片
**驗證通過後**才動 → 用 [[add-to-collection]]:在 `hfpc-bible-games/src/data.js` 把那張卡的 `soon: true` 拿掉(url 早已填好),`npm test`、`npm run build`,commit/PR。沒驗證就點亮會讓孩子點到 404。

## 鐵則
- **`site/` 不入庫**(.gitignore 排除);Netlify 端用 `npm run build` 重建,別用 `vite build`(這台 Node 24 遞迴 cpSync 會無聲被殺)。
- **本機 git 身分**:全域常是空的,記得設 per-repo `user.name/email` 再 commit。
- **curl 驗證一定加 `MSYS_NO_PATHCONV=1`**,否則 `/src/main.js` 會被轉成 `C:/Program Files/Git/...` 而誤判。
- repo 名 = `hfpc-<名>-game`,與 Netlify 站名、與大廳卡片 url 三者對齊。
- 大廳卡片在「線上正式站」亮 = 要等大廳那條改動 **merge 進 main**(Netlify 從 main 自動部署);只在功能分支不會上線。
