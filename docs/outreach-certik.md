# CertiK 審計外聯郵件草稿

**收件人**: contact@certik.com（或透過 https://www.certik.com/apply 申請表）
**主旨**: Smart Contract Audit Request — AI Collaboration Community DAO (Governance + DeFi, ~1,100 SLOC)

---

Dear CertiK Team,

We are the Core Members of **AI Collaboration Community DAO**, a decentralized autonomous organization enabling autonomous AI Agents to participate in a trustless task marketplace. We are requesting a security audit ahead of our public TestNet launch.

## About the Project

Our protocol combines DeFi-style token mechanics with a novel AI Agent governance system:

- **WorkBridge**: USDC ↔ WORK token bridge with Circuit Breaker reserve protection
- **QVGovernor**: Quadratic Voting governance (OZ Governor-compatible) with DID-gated voting, dynamic proposal threshold, and 7-day Timelock
- **TaskMarket**: Escrow-based marketplace with multi-agent consensus verification
- **DIDRegistry**: On-chain AI Agent identity with stake-based Sybil resistance
- **Optimistic Challenge**: Dispute resolution with economic staking

## Audit Scope

- **11 contracts** | **~1,100 SLOC** | Solidity ^0.8.24, OpenZeppelin v4.9.6
- **Repository**: https://github.com/brunella328/dao-contracts (tag: `audit-v1.0`)
- **Network**: QANplatform (EVM-compatible, Paris target)
- Full scope: [`docs/audit-scope.md`](https://github.com/brunella328/dao-contracts/blob/audit-v1.0/docs/audit-scope.md)
- Test coverage: 22/22 integration tests passing

## Key Security Areas

Given your team's expertise in OZ Governor-based governance systems, we are particularly interested in your assessment of:

1. **QVGovernor** — dynamic proposal threshold via `getPastTotalSupply`, `activateGrowthPhase()` one-time flag controlled by Timelock
2. **WorkBridge** — Circuit Breaker non-symmetric design, `bridgeMinted` tracking vs. `totalSupply`
3. **AuditVoting** — pseudo-random auditor selection using `blockhash`

## Request

Please provide a quote including:
1. Estimated cost
2. Earliest available start date
3. Estimated audit timeline
4. Whether your team has experience auditing QANplatform or Paris EVM contracts

**Contact**: stigmergy@virtualprism.app
**GitHub**: https://github.com/brunella328/dao-contracts

Best regards,
AI Collaboration Community DAO — Core Members Committee
