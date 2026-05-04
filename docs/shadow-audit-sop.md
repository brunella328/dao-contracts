# Shadow Audit SOP — Genesis Phase

Version: 1.0 | Effective: 2026 Q2

## 1. Purpose

During Genesis Phase, Core Members perform parallel human audits alongside the AI AuditVoting system to:
- Validate AI auditor accuracy before full trust is established
- Catch systematic errors early (before reputation damage occurs)
- Build a calibration dataset to improve future AI auditor selection weights

## 2. Roles

| Role | Responsibility |
|------|---------------|
| Core Member On-Duty | Performs human audit for all tasks submitted that week |
| Rotation Schedule | Weekly rotation; 7 members → 1 week per member per cycle |
| Arbitrator | Any 2 Core Members (non-on-duty) to resolve disagreements |

## 3. Trigger

Shadow Audit is triggered whenever a task enters `Submitted` status in TaskMarket.

## 4. Process

```
Task → Submitted
    │
    ├── [Automated] AuditVoting selects 5 AI auditors → vote → result recorded on-chain
    │
    └── [Manual] Core Member On-Duty reviews:
            - Source code diff or deliverable
            - Test suite results (if provided)
            - Security checklist (see §6)
            → Records judgment: PASS / FAIL + brief rationale
            → Enters into Google Sheet (link: internal)
```

## 5. Comparison & Resolution

| Outcome | Action |
|---------|--------|
| AI and human agree (PASS/PASS or FAIL/FAIL) | Record as "Consistent" — no action needed |
| AI PASS, Human FAIL | Immediately flag for OptimisticChallenge; Arbitrator reviews within 24h |
| AI FAIL, Human PASS | Review AI reasoning; if human judgment upheld, adjust AI auditor credit scores |
| Disagree 3+ consecutive times (same AI auditor) | Reduce that AI auditor's selection weight; flag for governance review |

## 6. Code Audit Security Checklist

- [ ] Re-entrancy vulnerabilities
- [ ] Integer overflow / underflow
- [ ] Access control correctness (role assignments)
- [ ] External call safety (checks-effects-interactions)
- [ ] Event emission completeness
- [ ] Logic matches specification / task description
- [ ] No hardcoded secrets or addresses
- [ ] Gas efficiency (no unbounded loops)

## 7. Calibration Report

At the end of each month, the On-Duty rotation publishes a Calibration Report including:
- Total tasks reviewed
- AI/Human agreement rate (target: ≥ 90%)
- Any systematic errors identified
- Proposed changes to AI auditor weights

Calibration Reports are posted to DAO governance forum.

## 8. Graduation Criteria

Shadow Audit may be retired by governance vote when:
- AI/Human agreement rate ≥ 95% for 3 consecutive months
- At least 20 tasks completed
- No unresolved disagreements in the past 60 days
