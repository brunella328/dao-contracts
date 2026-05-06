# Growth Phase Activation SOP

How Core Members verify readiness and submit the governance proposal to activate Growth Phase dynamic threshold.

---

## Activation Conditions (all must be met)

| Condition | How to verify | Threshold |
|-----------|---------------|-----------|
| Monthly task volume | The Graph query below | ≥ 50 verified tasks/month for 2+ consecutive months |
| Treasury self-sustainability | On-chain GOV/WORK balance | Covers ≥ 6 months of operating costs |
| Auditor pool health | `AuditVoting.getAuditorCount()` | ≥ 20 registered auditors |

---

## Step 1: Verify Task Volume via The Graph

Query the subgraph at `https://api.thegraph.com/subgraphs/name/<org>/dao-contracts`:

```graphql
{
  dailyStats(
    where: { date_gte: "<YYYY-MM-DD 30 days ago>" }
    orderBy: date
  ) {
    date
    tasksVerified
    cumulativeTasksVerified
  }
}
```

Monthly count = sum of `tasksVerified` over the last 30 days.

Alternatively, read `TaskMarket.verifiedTaskCount()` and compare two monthly snapshots:

```javascript
const count = await taskMarket.verifiedTaskCount();
// Record on day 0 and day 30 — delta ≥ 50 for two consecutive months
```

---

## Step 2: Generate activateGrowthPhase() Calldata

```javascript
const { ethers } = require("ethers");
const ABI = ["function activateGrowthPhase() external"];
const iface = new ethers.Interface(ABI);
const calldata = iface.encodeFunctionData("activateGrowthPhase", []);
console.log("calldata:", calldata);
// => 0x5c60ac2f
```

---

## Step 3: Submit Governance Proposal via Tally

On Tally (or directly via QVGovernor):

| Field | Value |
|-------|-------|
| **Target** | `QVGovernor` contract address |
| **Value** | 0 |
| **Calldata** | `0x5c60ac2f` (activateGrowthPhase) |
| **Description** | "Activate Growth Phase: switch to dynamic proposal threshold" |

The proposal must pass QV voting (≥ 10 DID quorum) and survive the 7-day Timelock delay before execution.

---

## Step 4: Execute Governance Handoff (transfer-governance.js)

After Growth Phase is active, Core Members execute the two-phase governance transfer:

**Phase 1** (immediately after Growth Phase activation):
```bash
PHASE=1 CONFIRM=true npx hardhat run scripts/transfer-governance.js --network qanMainnet
```
- Increases Timelock delay: 72h → 7 days
- Grants `PROPOSER_ROLE` to QVGovernor

**Phase 2** (after community validates self-governance for ≥ 1 month):
```bash
PHASE=2 CONFIRM=true npx hardhat run scripts/transfer-governance.js --network qanMainnet
```
- Grants `EXECUTOR_ROLE` to `address(0)` (anyone can execute)
- Core Members renounce `TIMELOCK_ADMIN_ROLE`

---

## Dry Run (verify calldata without executing)

```bash
npx hardhat run scripts/transfer-governance.js --network qanMainnet
# No PHASE or CONFIRM env vars — prints all 4 calldata only
```

---

## Dynamic Threshold Formula (post-activation)

```
proposalThreshold = max(10,000 GOV, circulatingSupply × 0.01%)
```

Example: if GOV circulating supply = 500M, threshold = max(10,000, 50,000) = **50,000 GOV**.

The threshold updates automatically each block — no manual intervention needed.
