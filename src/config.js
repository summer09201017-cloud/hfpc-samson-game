// 參孫打獅子(俯視角競技場版)— 所有可調整的數值都集中在這裡。
// 調手感(難度、速度、判定)只動這個檔。

// 邏輯解析度(實際畫面會等比縮放填滿視窗,並做黑邊置中)
export const VIEW = { W: 960, H: 540 }

// 俯視競技場(亭拿葡萄園的一塊地):主角與獅子的 (x,y) 都夾在這個矩形內
export const ARENA = { x: 60, y: 120, w: 840, h: 392 }

// 參孫(玩家):上下左右自由走位 + 近戰反擊
export const SAMSON = {
  speed: 236, // 走位速度 (px/s)
  runMultiplier: 1.6, // 按住 Shift 奔跑時的速度倍率(1 = 不奔跑)
  r: 17, // 身體半徑(夾在場內 / 碰撞用)
  maxHearts: 3, // 玩家血量(心數)
  invulnTime: 1.1, // 受擊後無敵秒數(閃爍)
  reviveInvuln: 2.2, // 無縫復活後的無敵秒數(較長,避免被進行中的攻擊連續秒殺)
  attackTime: 0.36, // 出手(揮擊)動作總時長
  attackActive: [0.08, 0.24], // 出手的「有效判定」時間窗(秒)
  attackReach: 96, // 近戰命中距離(與獅子中心的距離)
  attackCooldown: 0.2,
  knockback: 30, // 被撞到往後彈開的距離
}

// 少壯獅子(boss)
export const LION = {
  r: 34, // 身體半徑
  maxHp: 30, // 有效反擊 30 下 → 觸發「撕裂」收尾
  contactR: 56, // 衝撞命中參孫的距離(中心距);只有「衝刺」會造成傷害
  chargeDist: 540, // 一次衝刺的最大距離(會直直衝過去,要側身閃開)
  aimLockLead: 0.2, // 撲出前這麼多秒停止追蹤、把紅線方向定住(給玩家公平的閃避窗;調大=更好閃)

  // 第二階段:血量低於 fangHpThreshold 時,獅子在場上週期性放置「捕獸夾」,玩家踩到受傷。
  // 每根的生命週期:先在地上顯示 fangWarn 秒「警示提示」(無傷)→ 捕獸夾彈出並傷人 fangLife 秒 → 消失。
  fangHpThreshold: 10, // 血量 < 此值 → 進入第二階段(放捕獸夾)
  fangInterval: 2, // 每幾秒放一個捕獸夾
  fangWarn: 0.8, // 捕獸夾出現前,先在地上顯示這麼多秒的警示提示(無傷,給玩家躲開)
  fangLife: 5, // 捕獸夾出現(彈出)後存在且傷人幾秒
  fangR: 26, // 捕獸夾傷害半徑(玩家中心距 < fangR + 玩家半徑 即受傷)
  fangSafeR: 110, // 生成時避開玩家這麼近的範圍(不會直接長在腳下)

  // 血量 <= clawHpThreshold(15)時啟用「大範圍爪擊」:先出現一條紅線預警,clawTelegraph 秒後沿線揮下斬擊。
  // 紅線在預警開始時就定住(穿過當下玩家位置、方向由獅子指向玩家)→ 往垂直方向走開即可閃過。
  clawHpThreshold: 15, // 血量 <= 此值 → 啟用大範圍爪擊
  clawTelegraph: 3, // 紅線預警幾秒後揮下
  clawStrike: 0.28, // 斬擊揮下的持續時間(視覺 + 傷害判定窗)
  clawGap: 2.5, // 兩次爪擊之間的間隔(揮完等多久再預警下一次)
  clawHalfWidth: 46, // 斬擊線的半寬(玩家到線的垂直距 < clawHalfWidth + 玩家半徑 即受傷)

  // 最後狂暴(血量 <= enrageHpThreshold):衝刺循環 + 捕獸夾/爪擊的「頻率與移動速度」全部加快。
  //   只加快節奏與移動;預警窗(charge telegraph 除外、claw/fang 的警示)保留,對玩家仍公平。
  enrageHpThreshold: 3, // 血量 <= 此值 → 進入狂暴
  enrageSpeedup: 1.3, // 狂暴加速倍率(時長 ÷ 此值、速度 × 此值)
}

// 分階段(血量越低越兇);index 0/1/2 = phase 1/2/3
//   想更簡單 → 調長 telegraph / recovery、調慢 approach / charge;想更難 → 反向。
export const PHASES = [
  // phase1(hp 21–30):蓄力久、好預判、破綻長
  { telegraph: 0.95, recovery: 1.45, approach: 110, charge: 600, lockRange: 320, roar: false },
  // phase2(hp 11–20):快一點、破綻略短
  { telegraph: 0.7, recovery: 1.1, approach: 150, charge: 690, lockRange: 340, roar: true },
  // phase3(hp 1–10):最兇、破綻短(仍可從容反擊)
  { telegraph: 0.54, recovery: 0.84, approach: 188, charge: 780, lockRange: 360, roar: true },
]

// 血量 → phase 索引(0/1/2)。門檻按 maxHp=30 等比分成約三等分(越低越兇)。
//   ⚠ 若改 LION.maxHp,記得同步調這裡的門檻與上面 PHASES 註解。
export function phaseOf(hp) {
  return hp > 20 ? 0 : hp > 10 ? 1 : 2
}

// 蜂窩補血道具(呼應士 14:8-9「從死獅之內取蜜」):場上不定時出現,吃到補血。
export const HONEY = {
  spawnMin: 6, // 兩個蜂窩之間最短間隔(秒)
  spawnMax: 11, // 最長間隔(秒)→ 介於兩者之間隨機 = 不定時出現
  life: 8, // 在場上停留幾秒沒被吃就消失(消失前會閃爍)
  r: 22, // 拾取半徑(玩家中心距 < r + 玩家半徑 即吃到)
  heal: 1, // 吃到補幾滴血
  maxOnField: 2, // 場上最多同時幾個
  safeR: 80, // 生成時避開玩家這麼近的範圍
}

// 石頭道具:場上不定時出現,玩家碰到 → 石頭自動朝獅子扔出 → 砸中對獅子造成傷害。
export const ROCK = {
  spawnMin: 7, // 兩顆石頭之間最短間隔(秒)
  spawnMax: 13, // 最長間隔(秒)→ 不定時出現
  life: 9, // 地上的石頭沒被撿就在幾秒後消失(消失前閃爍)
  r: 18, // 拾取半徑(玩家)/ 命中半徑(獅子)
  speed: 640, // 扔出後飛向獅子的速度 (px/s)
  damage: 1, // 砸中對獅子扣幾滴血
  maxOnField: 2, // 場上最多同時幾顆「地上的」石頭
}

// 神蹟降臨:每隔 interval 秒,天降閃電打在獅子身上(神的幫助,不是玩家的本事),扣 damage 滴血。
export const MIRACLE = {
  interval: 30, // 每幾秒觸發一次
  deathInterval: 20, // 死神/地獄模式時改用此間隔(神在最黑暗時更頻繁地伸手)
  damage: 3, // 閃電對獅子扣幾滴血
}

// 墮落系統:每死一次畫面變暗一點;死滿 deathModeAt 次 → 參孫心智被魔鬼侵蝕、獅子化為死神、難度大增。
//   士師記的影子:一再失敗、心被蒙蔽,黑暗就趁虛而入(參孫最終的下場,士 16)。
//   ※ 死亡數在「回標題」或「得勝」時清零;同一輪不斷重試才會累積。
export const CORRUPTION = {
  deathModeAt: 3, // 第幾次死亡進入「死神」模式
  darkenPerDeath: 0.16, // 每死一次,戰鬥畫面疊加的黑暗 alpha(死神模式再額外加深)
  speedup: 1.5, // 死神模式:衝刺循環時長 ÷ 此值、移動與出招頻率 × 此值(比狂暴更兇)
  reviveDuration: 3.0, // 無縫復活轉場:黑霧自四周聚攏到全黑的秒數(全黑底下重置站位)
  rewindSeconds: 30, // 死亡回歸:前 deathModeAt 次死亡復活時,獅子血量倒退回「這麼多秒前」的值
                     //   (Re:Zero 式;玩家損失這 30 秒的傷害進度 → 死亡有代價但不從頭)
}

// 金色的心(💛):場上稀有出現,撿到「突破血量上限」——maxHearts +1 且補 1 滴。
export const GOLDEN_HEART = {
  chancePerSec: 0.02, // 每秒出現機率(2%)
  life: 7, // 沒撿走幾秒後消失(消失前閃爍)
  r: 24, // 拾取半徑
  maxOnField: 1, // 場上最多同時 1 個(稀有)
  safeR: 90, // 不生在玩家腳下
}

// 開場短演出 / 撕裂收尾的長度(秒)
export const INTRO = { duration: 2.6 }
export const FINISHER = { duration: 2.4 }

// 壞結局演出:在地獄(死神)模式中再死一次 → 黑霧聚攏、漆黑細手「緩緩」伸出捏住心臟 → 壞結局畫面。
//   duration 拉長讓伸手過程更有壓迫感;shake = 畫面震動的最大位移(px)。
export const BADEND = { duration: 5.4, shake: 7 }
