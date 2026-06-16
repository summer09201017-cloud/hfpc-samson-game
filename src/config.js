// 參孫打獅子(俯視角競技場版)— 所有可調整的數值都集中在這裡。
// 調手感(難度、速度、判定)只動這個檔。

// 邏輯解析度(實際畫面會等比縮放填滿視窗,並做黑邊置中)
export const VIEW = { W: 960, H: 540 }

// 俯視競技場(亭拿葡萄園的一塊地):主角與獅子的 (x,y) 都夾在這個矩形內
export const ARENA = { x: 60, y: 120, w: 840, h: 392 }

// 參孫(玩家):上下左右自由走位 + 近戰反擊
export const SAMSON = {
  speed: 236, // 走位速度 (px/s)
  r: 17, // 身體半徑(夾在場內 / 碰撞用)
  maxHearts: 5, // 友善:5 顆心
  invulnTime: 1.1, // 受擊後無敵秒數(閃爍)
  attackTime: 0.36, // 出手(揮擊)動作總時長
  attackActive: [0.08, 0.24], // 出手的「有效判定」時間窗(秒)
  attackReach: 96, // 近戰命中距離(與獅子中心的距離)
  attackCooldown: 0.2,
  knockback: 30, // 被撞到往後彈開的距離
}

// 少壯獅子(boss)
export const LION = {
  r: 34, // 身體半徑
  maxHp: 6, // 有效反擊 6 下 → 觸發「撕裂」收尾
  contactR: 56, // 衝撞命中參孫的距離(中心距);只有「衝刺」會造成傷害
  chargeDist: 540, // 一次衝刺的最大距離(會直直衝過去,要側身閃開)
  aimLockLead: 0.2, // 撲出前這麼多秒停止追蹤、把紅線方向定住(給玩家公平的閃避窗;調大=更好閃)
}

// 分階段(血量越低越兇);index 0/1/2 = phase 1/2/3
//   想更簡單 → 調長 telegraph / recovery、調慢 approach / charge;想更難 → 反向。
export const PHASES = [
  // phase1(hp 6,5):蓄力久、好預判、破綻長
  { telegraph: 0.95, recovery: 1.45, approach: 110, charge: 600, lockRange: 320, roar: false },
  // phase2(hp 4,3):快一點、破綻略短
  { telegraph: 0.7, recovery: 1.1, approach: 150, charge: 690, lockRange: 340, roar: true },
  // phase3(hp 2,1):最兇、破綻短(仍可從容反擊)
  { telegraph: 0.54, recovery: 0.84, approach: 188, charge: 780, lockRange: 360, roar: true },
]

// 血量 → phase 索引(0/1/2)
export function phaseOf(hp) {
  return hp > 4 ? 0 : hp > 2 ? 1 : 2
}

// 開場短演出 / 撕裂收尾的長度(秒)
export const INTRO = { duration: 2.6 }
export const FINISHER = { duration: 2.4 }
