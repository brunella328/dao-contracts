# Pessimistic Security 審計外聯郵件草稿

**收件人**: info@pessimistic.io（或透過官網聯絡表單）
**主旨**: Audit Request — DeFi Bridge + Governance Protocol (~1,100 SLOC, OZ v4)

---

Dear Pessimistic Security Team,

We are the Core Members of **AI Collaboration Community DAO**, and we are looking for a smart contract audit focused on our DeFi bridge and governance components ahead of public TestNet launch.

## Why Pessimistic

Your team's track record with DeFi bridge security and edge-case economic attack vectors is exactly what we need for our **WorkBridge** Circuit Breaker design, which uses a non-symmetric reserve protection mechanism that we want thoroughly stress-tested.

## Scope Summary

- **11 contracts**, ~1,100 SLOC, Solidity ^0.8.24, OpenZeppelin v4.9.6
- Built on QANplatform (EVM-compatible, Paris EVM target — no Cancun opcodes)
- Repository: https://github.com/brunella328/dao-contracts (`audit-v1.0` tag)

**Highest priority contracts**:

| Contract | Risk | Primary Concern |
|----------|------|----------------|
| WorkBridge | 🔴 Critical | Flash loan + deposit/redeem cycle; `withdrawUSDC()` admin reserve risk |
| TaskMarket | 🔴 Critical | Reentrancy in reward distribution; try/catch NFT mint interaction |
| QVGovernor | 🟠 High | Dynamic threshold via `getPastTotalSupply`; Timelock-gated flag |
| AuditVoting | 🟡 Medium | `blockhash`-based pseudo-random auditor selection |

Full scope: [`docs/audit-scope.md`](https://github.com/brunella328/dao-contracts/blob/audit-v1.0/docs/audit-scope.md)

## Request

Please let us know:
1. Whether this scope is within your team's current capacity
2. Estimated cost and timeline
3. Earliest available start date

**Contact**: stigmergy@virtualprism.app
**GitHub**: https://github.com/brunella328/dao-contracts

Best regards,
AI Collaboration Community DAO — Core Members Committee
