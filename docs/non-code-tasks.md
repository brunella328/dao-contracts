# Non-Code Task Types

Starting from M4, TaskMarket supports four task types via the `TaskType` enum.

---

## Task Type Definitions

| Enum Value | Name | Description | Example Tasks |
|------------|------|-------------|---------------|
| `0` | **Code** | Programming, smart contract development, bug fixes, security review | Code review, Solidity audit, API integration, test writing |
| `1` | **Design** | UI/UX design, visual assets, brand materials | Landing page mockup, logo design, icon set, Figma prototype |
| `2` | **Research** | Market analysis, technical research, documentation | Competitor analysis, tokenomics research, whitepaper section, translation |
| `3` | **Community** | Community management, content creation, outreach | Discord moderation, Twitter thread, tutorial writing, meetup organizing |

---

## How to Post a Non-Code Task (ethers.js v6)

```javascript
const TASK_TYPE = {
  Code:      0,
  Design:    1,
  Research:  2,
  Community: 3,
};

// Post a Research task
await taskMarket.postTask(
  ethers.parseEther("500"),          // reward in WORK
  Math.floor(Date.now() / 1000) + 7 * 86400, // 7-day deadline
  "ipfs://QmResearchBrief",          // IPFS CID with task details
  TASK_TYPE.Research                 // TaskType enum value
);
```

---

## Current Audit Mechanism (M4)

All task types use the **same audit process** in M4:

- 5 auditors selected pseudo-randomly from the registered auditor pool
- **3/5 PASS** threshold to verify and release reward
- 7-day Optimistic Challenge period applies to all disputes

This unified approach lets us observe real task patterns before tuning parameters per type.

---

## M5 Roadmap: Per-Type Audit Parameters

Based on Genesis Phase data, M5 will introduce differentiated audit settings:

| Task Type | Planned Quorum | Rationale |
|-----------|----------------|-----------|
| Code | 5 auditors, 3/5 | Objective correctness — current default |
| Design | 3 auditors, 2/3 | Subjective quality — smaller panel, lower threshold |
| Research | 3 auditors, 2/3 | Quality judgement requires domain expertise |
| Community | 3 auditors, 2/3 | Engagement metrics are more binary |

These values will be confirmed by governance vote in M5.

---

## On-Chain Task Count Tracking

`TaskMarket.verifiedTaskCount()` aggregates all verified tasks across all types. Use The Graph to filter by type:

```graphql
{
  tasks(where: { taskType: "Research", status: "Verified" }) {
    id
    reward
    client
    assignee
  }
}
```
