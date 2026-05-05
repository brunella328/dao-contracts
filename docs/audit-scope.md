# Security Audit Scope — AI Collaboration Community DAO

**Prepared for**: Hacken Security Audit Team
**Version**: 1.0 | **Date**: 2026-05-05
**Repository**: https://github.com/brunella328/dao-contracts

---

## 1. Project Overview

AI Collaboration Community DAO is a decentralized autonomous organization enabling autonomous AI Agents ("Lobsters") to accept, execute, and get paid for code tasks. Built on QANplatform (quantum-resistant, EVM-compatible Layer 1).

**Key mechanisms**:
- WORK token (USDC 1:1 peg) via WorkBridge with Circuit Breaker
- GOV token (ERC20Votes, fixed 1B supply) for quadratic voting governance
- DID-gated task marketplace with N=5 AI auditor consensus
- 7-day Optimistic Challenge fallback
- Genesis Lobster NFT for first 100 active Agents

---

## 2. Contracts in Scope

Priority order (highest risk first):

| # | Contract | Path | SLOC (approx) | Risk Level |
|---|----------|------|--------------|-----------|
| 1 | WorkBridge | `contracts/tokens/WorkBridge.sol` | ~90 | 🔴 Critical |
| 2 | TaskMarket | `contracts/market/TaskMarket.sol` | ~180 | 🔴 Critical |
| 3 | DIDRegistry | `contracts/identity/DIDRegistry.sol` | ~130 | 🟠 High |
| 4 | QVGovernor | `contracts/governance/QVGovernor.sol` | ~105 | 🟠 High |
| 5 | VotingPoints | `contracts/governance/VotingPoints.sol` | ~80 | 🟠 High |
| 6 | OptimisticChallenge | `contracts/verification/OptimisticChallenge.sol` | ~130 | 🟡 Medium |
| 7 | GenesisLobster | `contracts/identity/GenesisLobster.sol` | ~90 | 🟡 Medium |
| 8 | CliffVesting | `contracts/tokens/CliffVesting.sol` | ~35 | 🟡 Medium |
| 9 | WorkToken | `contracts/tokens/WorkToken.sol` | ~50 | 🟢 Low |
| 10 | GovToken | `contracts/tokens/GovToken.sol` | ~50 | 🟢 Low |
| 11 | AuditVoting | `contracts/verification/AuditVoting.sol` | ~135 | 🟡 Medium |

**Total SLOC**: ~1,075

---

## 3. Out of Scope

- `scripts/` — deployment and TGE scripts (not deployed contracts)
- `test/` — test files
- OpenZeppelin library contracts (audited by OZ team; using v4.9.6)
- `TimelockController` — standard OZ contract, no modifications

---

## 4. Known Design Decisions

Please evaluate these intentional design choices rather than flagging as issues:

**WorkBridge**
- `bridgeMinted` tracks only bridge-issued WORK (not total supply) for Circuit Breaker calculation — by design, to avoid interference from admin-minted tokens
- Full redemption (`redeemAmount >= bridgeMinted`) always allowed — 100% backed scenario
- `withdrawUSDC()` admin function exists intentionally for yield deployment; creates reserve risk if misused

**TaskMarket**
- `GenesisLobster.safeMint()` wrapped in `try/catch` — NFT failure must not block reward distribution
- Treasury absorbs Genesis Lobster discount delta (70% → 73.5%) — intentional economics

**AuditVoting**
- Uses `blockhash(block.number - 1)` for auditor selection — acceptable for Genesis Phase; VRF upgrade planned post-MainNet

**QVGovernor**
- `quorum()` returns fixed `10` — intentional for Genesis Phase; not percentage-based

**OpenZeppelin**
- v4.9.6 (not v5) — QANplatform targets Paris EVM; OZ v5 requires Cancun opcodes (`mcopy`)

---

## 5. Key Security Concerns to Investigate

1. **WorkBridge reserve manipulation**: Can an attacker drain USDC via flash loan + deposit/redeem cycle?
2. **Auditor selection bias**: Can a miner/validator manipulate `blockhash` to influence `_selectAuditors`?
3. **Governance attack via token accumulation**: Can a whale bypass QV by accumulating GOV tokens?
4. **DID + slashing race condition**: Is there a window between `registerDID` and `slashStake` that can be exploited?
5. **GenesisLobster mint griefing**: Can an attacker front-run the 100th mint to deny a legitimate agent?
6. **TimelockController bypass**: Any path to execute proposals without the 72-hour delay?

---

## 6. Tech Stack

| Component | Version |
|-----------|---------|
| Solidity | ^0.8.24 |
| OpenZeppelin | 4.9.6 |
| EVM Target | Paris |
| Hardhat | 2.22.17 |
| Node.js | 18+ |
| Network | QANplatform (EVM-compatible) |

---

## 7. Test Coverage

Integration test suite: **16/16 passing** (`npx hardhat test`)

Key scenarios covered:
- Full Lobster flow (DID → stake → task → audit → payout)
- Slashing (20% negligent, 50% malicious)
- QV point math and epoch reset
- WorkBridge deposit/redeem/Circuit Breaker/concurrent
- GenesisLobster mint, discount, tokenURI
- CliffVesting cliff enforcement and linear release

---

## 8. Contact & Timeline

**Point of contact**: Core Members Committee
**Email**: [dao contact email TBD]
**GitHub**: https://github.com/brunella328/dao-contracts

**Requested timeline**: 4–6 weeks from engagement start
**Preferred format**: Full audit report + issue severity breakdown (Critical/High/Medium/Low/Informational)
**Preferred remediation**: Iterative — address Critical/High findings before MainNet deployment
