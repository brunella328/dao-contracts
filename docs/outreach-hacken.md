# Hacken 審計外聯郵件草稿

**收件人**: audits@hacken.io
**主旨**: Smart Contract Audit Request — AI Collaboration Community DAO (QANplatform, ~1,100 SLOC)

---

Dear Hacken Team,

We are the Core Members of **AI Collaboration Community DAO**, a decentralized autonomous organization built on **QANplatform** — the quantum-resistant, EVM-compatible Layer 1 blockchain that your team has previously audited. We are reaching out to request a smart contract security audit ahead of our TestNet public launch.

## About the Project

Our DAO enables autonomous AI Agents ("Lobsters") to accept, execute, and receive payment for code tasks through a decentralized marketplace. Key mechanisms include:

- **WorkBridge**: USDC ↔ WORK token 1:1 bridge with a non-symmetric Circuit Breaker
- **TaskMarket**: Task escrow with multi-agent audit consensus (N=5, 3/5 threshold)
- **QVGovernor**: Quadratic Voting governance with DID-gated voting and dynamic proposal threshold
- **DIDRegistry**: Sybil-resistant AI Agent identity with stake-based registration
- **Optimistic Challenge**: 7-day dispute resolution fallback

## Why Hacken

Your team's prior audit of the QANplatform QVM gives you unique familiarity with the underlying execution environment, Paris EVM target, and potential edge cases specific to this chain. We believe this translates directly into more precise findings and shorter clarification cycles.

## Audit Scope

- **11 contracts** across tokens, identity, market, verification, and governance layers
- **~1,100 SLOC** (Solidity ^0.8.24, OpenZeppelin v4.9.6)
- **Repository**: https://github.com/brunella328/dao-contracts (tag: `audit-v1.0`)
- Full scope document: [`docs/audit-scope.md`](https://github.com/brunella328/dao-contracts/blob/audit-v1.0/docs/audit-scope.md)
- Self-check checklist: [`docs/pre-audit-checklist.md`](https://github.com/brunella328/dao-contracts/blob/audit-v1.0/docs/pre-audit-checklist.md)
- Test suite: 22/22 integration tests passing

## Priority Focus Areas

1. **WorkBridge** — USDC reserve manipulation, flash loan attack vectors, Circuit Breaker bypass
2. **QVGovernor** — `activateGrowthPhase()` access control, dynamic threshold manipulation via `getPastTotalSupply`
3. **AuditVoting** — `blockhash`-based auditor selection bias
4. **TaskMarket** — reentrancy in reward distribution, GenesisLobster mint try/catch interaction

## Budget & Timeline

- **Budget**: Up to **$25,000 USD**
- **Preferred start**: As soon as possible (contracts frozen at `audit-v1.0`)
- **Requested delivery**: Full audit report within 4–6 weeks of engagement start
- **Remediation**: We will address all Critical/High findings and request a fix review before MainNet deployment

## Request

Please provide:
1. Estimated cost for the scope described
2. Earliest available start date
3. Estimated delivery timeline
4. Any questions about the codebase

We are available for a technical call at your convenience to walk through the architecture.

**Contact**: stigmergy@virtualprism.app
**GitHub**: https://github.com/brunella328/dao-contracts

Thank you for your time. We look forward to working with your team.

Best regards,
AI Collaboration Community DAO — Core Members Committee
