// scripts/transfer-governance.js — Generate calldata for Core Members → DAO governance handoff
// Usage: npx hardhat run scripts/transfer-governance.js --network qanTestnet
//
// Executes in two phases:
//   Phase 1 (pre-growth):  Step 1 + Step 2 — increase delay + grant PROPOSER to Governor
//   Phase 2 (post-growth): Step 3 + Step 4 — open EXECUTOR + Core Members renounce ADMIN
//
// Pass --phase 1 or --phase 2 as env var: PHASE=1 or PHASE=2 (default: dry-run all steps)

const { ethers } = require("hardhat");
const fs = require("fs");

const SEVEN_DAYS = 604800;

async function main() {
  const addresses = JSON.parse(fs.readFileSync("deployed-addresses.json"));
  const [admin] = await ethers.getSigners();
  const phase = parseInt(process.env.PHASE || "0");

  const timelockABI = [
    "function PROPOSER_ROLE() view returns (bytes32)",
    "function EXECUTOR_ROLE() view returns (bytes32)",
    "function TIMELOCK_ADMIN_ROLE() view returns (bytes32)",
    "function updateDelay(uint256) external",
    "function grantRole(bytes32,address) external",
    "function renounceRole(bytes32,address) external",
    "function getMinDelay() view returns (uint256)"
  ];

  const timelock = new ethers.Contract(addresses.timelock, timelockABI, admin);
  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
  const ADMIN_ROLE = await timelock.TIMELOCK_ADMIN_ROLE();

  const iface = new ethers.Interface(timelockABI);

  const steps = [
    {
      num: 1,
      phase: 1,
      description: "Increase Timelock delay: 72h → 7 days (604800s)",
      target: addresses.timelock,
      calldata: iface.encodeFunctionData("updateDelay", [SEVEN_DAYS]),
    },
    {
      num: 2,
      phase: 1,
      description: "Grant PROPOSER_ROLE to QVGovernor (governance can now queue proposals)",
      target: addresses.timelock,
      calldata: iface.encodeFunctionData("grantRole", [PROPOSER_ROLE, addresses.governor]),
    },
    {
      num: 3,
      phase: 2,
      description: "Grant EXECUTOR_ROLE to address(0) (anyone can execute passed proposals)",
      target: addresses.timelock,
      calldata: iface.encodeFunctionData("grantRole", [EXECUTOR_ROLE, ethers.ZeroAddress]),
    },
    {
      num: 4,
      phase: 2,
      description: "Core Members renounce TIMELOCK_ADMIN_ROLE (full decentralization)",
      target: addresses.timelock,
      calldata: iface.encodeFunctionData("renounceRole", [ADMIN_ROLE, admin.address]),
    },
  ];

  const currentDelay = await timelock.getMinDelay();
  console.log(`\nCurrent Timelock delay: ${currentDelay}s (${Number(currentDelay) / 3600}h)`);
  console.log(`Admin: ${admin.address}`);
  console.log(`Governor: ${addresses.governor}`);
  console.log(`Timelock: ${addresses.timelock}\n`);

  const stepsToRun = phase === 0 ? steps : steps.filter(s => s.phase === phase);

  for (const step of stepsToRun) {
    console.log(`--- Step ${step.num} (Phase ${step.phase}) ---`);
    console.log(`Description: ${step.description}`);
    console.log(`Target:      ${step.target}`);
    console.log(`Calldata:    ${step.calldata}\n`);
  }

  if (phase === 0) {
    console.log("Dry-run complete. Set PHASE=1 or PHASE=2 to execute transactions.");
    return;
  }

  const confirm = process.env.CONFIRM === "true";
  if (!confirm) {
    console.log(`Set CONFIRM=true to execute Phase ${phase} transactions.`);
    return;
  }

  for (const step of stepsToRun) {
    console.log(`Executing Step ${step.num}...`);
    const tx = await admin.sendTransaction({ to: step.target, data: step.calldata });
    await tx.wait();
    console.log(`✅ Step ${step.num} done: ${tx.hash}`);
  }

  console.log(`\nPhase ${phase} complete.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
