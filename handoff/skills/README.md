# 跨專案 Skills 副本(交接用)

這資料夾是**兩個跨專案 skill 的副本**,放這裡只是為了「隨 GitHub / 壓縮檔帶到另一台 PC」。
Skill 真正生效的位置是**使用者層的** `~/.claude/skills/<name>/SKILL.md`(machine-local,不會跟著 repo 走)。

## 另一台 PC(agape250)要怎麼裝

把這兩個資料夾複製到該機器的 skills 目錄即可(Windows 路徑):

```
複製 add-to-collection/  → C:\Users\<你>\.claude\skills\add-to-collection\
複製 ship-game-online/    → C:\Users\<你>\.claude\skills\ship-game-online\
```

(或請那台 PC 的 AI 讀這兩個 `SKILL.md`,再用 Write 寫進它的 `~/.claude/skills/` 對應路徑。)

## 這兩個 skill 是什麼

- **add-to-collection** — 把一關加進「聖經遊戲大廳 `hfpc-bible-games`」的合輯卡片(戰爭闖關/逆轉奇兵/挪亞…);大廳只深連結帶路、不複製關卡。
- **ship-game-online** — 把做好的單機網頁遊戲一條龍上架:git init → 設定檔 → 建 GitHub repo → 部署 Netlify → curl 驗證線上 → 點亮大廳卡片。

> 原版仍在本機 `~/.claude/skills/`;這份是 2026-06-17 的快照,日後以本機原版為準。
