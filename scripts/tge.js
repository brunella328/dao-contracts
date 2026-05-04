// scripts/tge.js — GOV Token Generation Event distribution
// Run AFTER deploy.js; requires deployed-addresses.json + TREASURY_PRIVATE_KEY
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();
  const addresses = JSON.parse(fs.readFileSync("deployed-addresses.json"));

  const govToken = await ethers.getContractAt("GovToken", addresses.govToken);
  const TOTAL = ethers.utils.parseEther("1000000000"); // 1B GOV

  // Beneficiary addresses — set via env or replace with real addresses
  const FOUNDATION_SAFE    = process.env.FOUNDATION_SAFE    || deployer.address;
  const ECOSYSTEM_SAFE     = process.env.ECOSYSTEM_SAFE     || deployer.address;
  const DEX_LM_CONTRACT    = process.env.DEX_LM_CONTRACT    || deployer.address;
  const AIRDROP_CONTRACT   = process.env.AIRDROP_CONTRACT   || deployer.address;
  const GOVERNANCE_CONTRACT= process.env.GOVERNANCE_CONTRACT|| deployer.address;
  const TASK_REWARD_POOL   = process.env.TASK_REWARD_POOL   || addresses.taskMarket;

  // Team members — 7 CliffVesting contracts (10% / 7 each)
  const TEAM_MEMBERS = process.env.TEAM_MEMBERS
    ? JSON.parse(process.env.TEAM_MEMBERS)
    : Array(7).fill(deployer.address);

  const tgeTimestamp = Math.floor(Date.now() / 1000);
  const ONE_YEAR = 365 * 24 * 3600;
  const THREE_YEARS = 3 * ONE_YEAR;

  console.log("TGE timestamp:", tgeTimestamp);
  console.log("Total GOV supply:", ethers.utils.formatEther(TOTAL));

  // Deploy CliffVesting for each team member (10% / 7)
  const perMember = TOTAL.mul(10).div(100).div(7);
  const CliffVesting = await ethers.getContractFactory("CliffVesting");
  const vestingAddresses = [];

  for (let i = 0; i < TEAM_MEMBERS.length; i++) {
    const vesting = await CliffVesting.deploy(
      TEAM_MEMBERS[i],
      tgeTimestamp,
      ONE_YEAR,
      THREE_YEARS
    );
    await vesting.deployed();
    vestingAddresses.push(vesting.address);
    console.log(`CliffVesting[${i}] for ${TEAM_MEMBERS[i]}: ${vesting.address}`);
  }

  // Distribution (from treasury = deployer in this script)
  const distributions = [
    { label: "Governance (35%)",      to: GOVERNANCE_CONTRACT, bps: 3500 },
    { label: "DEX Liquidity (10%)",   to: DEX_LM_CONTRACT,     bps: 1000 },
    { label: "Airdrop (5%)",          to: AIRDROP_CONTRACT,    bps: 500  },
    { label: "Foundation Safe (20%)", to: FOUNDATION_SAFE,     bps: 2000 },
    { label: "Task Reward Pool (10%)",to: TASK_REWARD_POOL,    bps: 1000 },
    { label: "Ecosystem Safe (10%)",  to: ECOSYSTEM_SAFE,      bps: 1000 },
  ];

  for (const d of distributions) {
    const amount = TOTAL.mul(d.bps).div(10000);
    await govToken.transfer(d.to, amount);
    console.log(`${d.label}: ${ethers.utils.formatEther(amount)} GOV → ${d.to}`);
  }

  // Team vesting (10% split across 7 wallets)
  for (let i = 0; i < vestingAddresses.length; i++) {
    await govToken.transfer(vestingAddresses[i], perMember);
    console.log(`Team[${i}] CliffVesting: ${ethers.utils.formatEther(perMember)} GOV → ${vestingAddresses[i]}`);
  }

  // Save vesting addresses
  addresses.cliffVestings = vestingAddresses;
  fs.writeFileSync("deployed-addresses.json", JSON.stringify(addresses, null, 2));
  console.log("\nTGE complete. Vesting addresses saved.");
}

main().catch((err) => { console.error(err); process.exit(1); });
