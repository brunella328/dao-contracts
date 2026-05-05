# Pre-Audit Self-Check Checklist

Version: 1.0 | Prepared for: Hacken Security Audit

Run this checklist before submitting contracts for third-party audit to reduce scope ambiguity and save audit hours.

---

## 1. Access Control

| Contract | Function | Required Role | Verified |
|----------|----------|--------------|---------|
| WorkToken | `mint()` | MINTER_ROLE | ☐ |
| WorkToken | `burn()` | BURNER_ROLE | ☐ |
| WorkToken | `slash()` | BURNER_ROLE | ☐ |
| WorkToken | `pause()/unpause()` | PAUSER_ROLE | ☐ |
| GovToken | `pause()/unpause()` | PAUSER_ROLE | ☐ |
| DIDRegistry | `updateCredit()` | SLASHER_ROLE | ☐ |
| DIDRegistry | `slashStake()` | SLASHER_ROLE | ☐ |
| DIDRegistry | `pause()/unpause()` | PAUSER_ROLE | ☐ |
| TaskMarket | `verifyTask()` | VERIFIER_ROLE | ☐ |
| TaskMarket | `settleDispute()` | REVIEWER_ROLE | ☐ |
| TaskMarket | `setGenesisLobster()` | DEFAULT_ADMIN_ROLE | ☐ |
| TaskMarket | `setTreasury()` | DEFAULT_ADMIN_ROLE | ☐ |
| TaskMarket | `setVerifier()` | DEFAULT_ADMIN_ROLE | ☐ |
| AuditVoting | `pause()/unpause()` | PAUSER_ROLE | ☐ |
| AuditVoting | `addToPool()` | DEFAULT_ADMIN_ROLE | ☐ |
| OptimisticChallenge | `resolveChallenge()` | ARBITRATOR_ROLE | ☐ |
| OptimisticChallenge | `addArbitrator()` | DEFAULT_ADMIN_ROLE | ☐ |
| WorkBridge | `setMinReserveRatioBps()` | DEFAULT_ADMIN_ROLE | ☐ |
| WorkBridge | `setRedeemPaused()` | PAUSER_ROLE | ☐ |
| WorkBridge | `withdrawUSDC()` | DEFAULT_ADMIN_ROLE | ☐ |
| GenesisLobster | `safeMint()` | MINTER_ROLE | ☐ |

---

## 2. Reentrancy Protection

| Contract | Protected Functions | Guard | Verified |
|----------|-------------------|-------|---------|
| TaskMarket | `postTask`, `acceptTask`, `settleDispute`, `cancelTask` | ReentrancyGuard | ☐ |
| DIDRegistry | `registerDID`, `revokeDID` | — (no external calls after state change?) | ☐ |
| OptimisticChallenge | `openChallenge`, `resolveChallenge`, `expireChallenge` | ReentrancyGuard | ☐ |
| WorkBridge | `deposit`, `redeem` | ReentrancyGuard | ☐ |

**Check**: All external token transfers follow Checks-Effects-Interactions pattern?
- TaskMarket `_distributeReward`: state set before `transfer` calls ☐
- WorkBridge `redeem`: `bridgeMinted -= amount` before `safeTransfer` ☐
- DIDRegistry `revokeDID`: `record.active = false` before `transfer` ☐

---

## 3. Event Coverage

| Event | Trigger | Verified |
|-------|---------|---------|
| `TaskPosted` | `postTask()` | ☐ |
| `TaskAccepted` | `acceptTask()` | ☐ |
| `TaskSubmitted` | `submitResult()` | ☐ |
| `TaskVerified` | `_distributeReward()` | ☐ |
| `TaskDisputed` | `verifyTask(passed=false)` | ☐ |
| `TaskSettled` | `settleDispute()` | ☐ |
| `TaskCancelled` | `cancelTask()` | ☐ |
| `DIDRegistered` | `registerDID()` | ☐ |
| `DIDRevoked` | `revokeDID()` | ☐ |
| `CreditUpdated` | `updateCredit()` | ☐ |
| `Deposited` | `WorkBridge.deposit()` | ☐ |
| `Redeemed` | `WorkBridge.redeem()` | ☐ |
| `RedeemPausedChanged` | `setRedeemPaused()` | ☐ |
| `LobsterMinted` | `GenesisLobster.safeMint()` | ☐ |
| `AuditStarted` | `startAudit()` | ☐ |
| `VoteCast` | `castVote()` | ☐ |
| `AuditFinalized` | `_finalize()` | ☐ |
| `ChallengeOpened` | `openChallenge()` | ☐ |
| `ChallengeResolved` | `resolveChallenge()` | ☐ |

---

## 4. Boundary Conditions

### Integer Overflow / Underflow
- [ ] `DIDRegistry.slashStake`: `record.stakedAmount -= slashAmount` — verify `slashAmount <= stakedAmount`
- [ ] `WorkBridge._checkCircuitBreaker`: `bridgeMinted - redeemAmount` — protected by `if (bridgeMinted <= redeemAmount) return`
- [ ] `VotingPoints.spendPoints`: `votes * votes` overflow for large `votes` — verify max safe input
- [ ] `TaskMarket._distributeReward`: BPS arithmetic stays within uint256

### Zero / Empty Inputs
- [ ] `WorkBridge.deposit(0)` → reverts with "Amount must be positive"
- [ ] `WorkBridge.redeem(0)` → reverts with "Amount must be positive"
- [ ] `TaskMarket.postTask(reward=0)` → reverts
- [ ] `DIDRegistry.registerDID(stakeAmount < MIN_STAKE)` → reverts

### Timestamp / Deadline Edge Cases
- [ ] `TaskMarket.postTask(deadline = block.timestamp)` → reverts (must be future)
- [ ] `TaskMarket.acceptTask` after deadline → reverts
- [ ] `OptimisticChallenge.resolveChallenge` after CHALLENGE_PERIOD → reverts
- [ ] `CliffVesting.release` before cliffEnd → reverts

### GenesisLobster Supply Cap
- [ ] 101st `safeMint` → reverts with "Max supply reached"
- [ ] Second mint to same address → reverts with "Agent already has Genesis Lobster"

---

## 5. Known Design Decisions (Inform Auditor)

1. **WorkBridge Circuit Breaker** tracks `bridgeMinted` (not `totalSupply`) to avoid interference from admin-minted WORK tokens outside the bridge
2. **GenesisLobster.safeMint** is wrapped in `try/catch` in TaskMarket — NFT mint failure does not block reward distribution
3. **QVGovernor quorum** is fixed at 10 (not percentage-based) — intentional for Genesis Phase simplicity
4. **OpenZeppelin v4.9.6** (not v5) — Paris EVM target; v5 requires Cancun opcodes incompatible with QANplatform
5. **AuditVoting._selectAuditors** uses `blockhash(block.number - 1)` — acceptable for Genesis Phase; upgrade to VRF planned for MainNet
6. **WorkBridge.withdrawUSDC** is admin-only — intended for yield deployment and emergency scenarios; creates reserve risk if misused
