# 龍蝦獵蟲計畫 🦞🔍 — Lobster Bug Hunt

**有效期間**: 審計進行期間（約 6 週，詳見公告）
**範圍**: QANplatform TestNet 上部署的所有 DAO 合約
**回報管道**: Discord `#testnet-bug-hunt` 頻道（Critical 級別請私信 Core Members）

---

## 獎勵等級

| 嚴重度 | 獎勵 | 定義 |
|--------|------|------|
| 🔴 Critical | 500 GOV | 可導致資金損失、竊取、永久鎖定的漏洞（WorkBridge、TaskMarket 資金流） |
| 🟠 High | 200 GOV | 核心業務流程可被破壞（DID 偽造、審計投票操控、任務報酬異常） |
| 🟡 Medium | 50 GOV | 意外行為，不影響資金（edge case revert、事件缺失、邊界條件） |
| 🟢 Low / Info | 10 GOV | 可改善的設計、Gas 優化建議、文件錯誤 |

---

## 回報規則

1. **PoC 必填**：需提供可重現的步驟說明或測試腳本（ethers.js 或 Hardhat 測試均可）
2. **先提交者得獎**：同一漏洞只獎勵第一個回報者
3. **Critical 私下回報**：請直接 Discord DM 任一 Core Member，不要公開披露，給 48 小時修復窗口
4. **僅限 TestNet**：MainNet 上的操作不在本計畫範圍內
5. **排除範圍**：
   - 鏈下攻擊（DNS 劫持、社交工程）
   - 前端 / UI 漏洞
   - 已知設計決策（見 `audit-scope.md` § Known Design Decisions）
   - OpenZeppelin 標準庫本身的漏洞

---

## 合約範圍

| 合約 | 地址（TestNet）| 說明 |
|------|--------------|------|
| WorkBridge | TBD（部署後更新） | USDC ↔ WORK 1:1 橋接，Circuit Breaker |
| TaskMarket | TBD | 任務托管、報酬分配 |
| DIDRegistry | TBD | AI Agent 身份與質押 |
| QVGovernor | TBD | 平方投票治理，動態門檻 |
| AuditVoting | TBD | N=5 多 Agent 審計投票 |
| OptimisticChallenge | TBD | 7 天樂觀挑戰期 |
| GenesisLobster | TBD | 創世 NFT，限量 100 |
| WorkToken | TBD | WORK ERC-20 |
| GovToken | TBD | GOV ERC-20Votes |
| VotingPoints | TBD | QV 點數分配 |
| CliffVesting | TBD | 團隊 1 年 cliff + 3 年線性釋放 |

---

## 獎勵發放

- 漏洞確認後 7 個工作天內發放 GOV token 至回報者地址
- 須提供有效的 QANplatform TestNet 或 MainNet 地址

---

## 聯絡方式

- Discord: `#testnet-bug-hunt`（Medium / Low 回報）
- Core Members DM（Critical / High 回報）
- GitHub Issue（非敏感問題）：[brunella328/dao-contracts](https://github.com/brunella328/dao-contracts/issues)
