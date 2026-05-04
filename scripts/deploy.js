// scripts/deploy.js — Full suite deployment for QAN TestNet
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const admin = deployer.address;
  // On TestNet: use a mock USDC or real testnet USDC address
  const USDC_ADDRESS = process.env.USDC_ADDRESS || deployer.address; // fallback for local
  const TREASURY = process.env.TREASURY_ADDRESS || deployer.address;

  const addresses = {};

  // 1. WorkToken
  const WorkToken = await ethers.getContractFactory("WorkToken");
  const workToken = await WorkToken.deploy(admin);
  await workToken.deployed();
  addresses.workToken = workToken.address;
  console.log("WorkToken:", workToken.address);

  // 2. GovToken
  const GovToken = await ethers.getContractFactory("GovToken");
  const govToken = await GovToken.deploy(admin, TREASURY);
  await govToken.deployed();
  addresses.govToken = govToken.address;
  console.log("GovToken:", govToken.address);

  // 3. DIDRegistry
  const DIDRegistry = await ethers.getContractFactory("DIDRegistry");
  const didRegistry = await DIDRegistry.deploy(workToken.address, admin);
  await didRegistry.deployed();
  addresses.didRegistry = didRegistry.address;
  console.log("DIDRegistry:", didRegistry.address);

  // 4. TaskMarket
  const TaskMarket = await ethers.getContractFactory("TaskMarket");
  const taskMarket = await TaskMarket.deploy(workToken.address, didRegistry.address, TREASURY, admin);
  await taskMarket.deployed();
  addresses.taskMarket = taskMarket.address;
  console.log("TaskMarket:", taskMarket.address);

  // 5. AuditVoting
  const AuditVoting = await ethers.getContractFactory("AuditVoting");
  const auditVoting = await AuditVoting.deploy(didRegistry.address, taskMarket.address, admin);
  await auditVoting.deployed();
  addresses.auditVoting = auditVoting.address;
  console.log("AuditVoting:", auditVoting.address);

  // Grant AuditVoting the VERIFIER_ROLE on TaskMarket
  const VERIFIER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("VERIFIER_ROLE"));
  await taskMarket.setVerifier(auditVoting.address);
  console.log("AuditVoting granted VERIFIER_ROLE on TaskMarket");

  // 6. OptimisticChallenge
  const OptimisticChallenge = await ethers.getContractFactory("OptimisticChallenge");
  const optimisticChallenge = await OptimisticChallenge.deploy(
    workToken.address, taskMarket.address, didRegistry.address, admin
  );
  await optimisticChallenge.deployed();
  addresses.optimisticChallenge = optimisticChallenge.address;
  console.log("OptimisticChallenge:", optimisticChallenge.address);

  // 7. VotingPoints
  const VotingPoints = await ethers.getContractFactory("VotingPoints");
  const votingPoints = await VotingPoints.deploy(didRegistry.address, admin);
  await votingPoints.deployed();
  addresses.votingPoints = votingPoints.address;
  console.log("VotingPoints:", votingPoints.address);

  // 8. TimelockController (72h = 259200s)
  const TimelockController = await ethers.getContractFactory("TimelockController");
  const timelock = await TimelockController.deploy(
    259200,
    [admin], // proposers
    [admin], // executors
    admin    // admin
  );
  await timelock.deployed();
  addresses.timelock = timelock.address;
  console.log("TimelockController:", timelock.address);

  // 9. QVGovernor
  const QVGovernor = await ethers.getContractFactory("QVGovernor");
  const governor = await QVGovernor.deploy(
    govToken.address,
    timelock.address,
    didRegistry.address,
    votingPoints.address,
    ethers.utils.parseEther("10000"), // proposalThreshold: 10,000 GOV
    1,     // votingDelay: 1 block
    50400  // votingPeriod: ~7 days in blocks
  );
  await governor.deployed();
  addresses.governor = governor.address;
  console.log("QVGovernor:", governor.address);

  // 10. GenesisLobster
  const GenesisLobster = await ethers.getContractFactory("GenesisLobster");
  const genesisLobster = await GenesisLobster.deploy(admin);
  await genesisLobster.deployed();
  addresses.genesisLobster = genesisLobster.address;
  console.log("GenesisLobster:", genesisLobster.address);

  // Grant TaskMarket MINTER_ROLE on GenesisLobster
  const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));
  await genesisLobster.grantRole(MINTER_ROLE, taskMarket.address);
  await taskMarket.setGenesisLobster(genesisLobster.address);
  console.log("GenesisLobster wired to TaskMarket");

  // 11. WorkBridge
  const WorkBridge = await ethers.getContractFactory("WorkBridge");
  const workBridge = await WorkBridge.deploy(USDC_ADDRESS, workToken.address, admin);
  await workBridge.deployed();
  addresses.workBridge = workBridge.address;
  console.log("WorkBridge:", workBridge.address);

  // Grant WorkBridge MINTER_ROLE + BURNER_ROLE on WorkToken
  const BURNER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BURNER_ROLE"));
  await workToken.grantRole(MINTER_ROLE, workBridge.address);
  await workToken.grantRole(BURNER_ROLE, workBridge.address);
  console.log("WorkBridge granted MINTER + BURNER on WorkToken");

  // Save addresses
  fs.writeFileSync("deployed-addresses.json", JSON.stringify(addresses, null, 2));
  console.log("\nDeployment complete. Addresses saved to deployed-addresses.json");
}

main().catch((err) => { console.error(err); process.exit(1); });
