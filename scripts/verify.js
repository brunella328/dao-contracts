// scripts/verify.js — Verify deployed contracts on QAN Explorer
// Usage: npx hardhat run scripts/verify.js --network qanTestnet
const { run } = require("hardhat");
const fs = require("fs");

async function verify(address, constructorArgs) {
  try {
    await run("verify:verify", { address, constructorArguments: constructorArgs });
    console.log(`✅ Verified: ${address}`);
  } catch (e) {
    if (e.message.includes("Already Verified")) {
      console.log(`⏭️  Already verified: ${address}`);
    } else {
      console.warn(`⚠️  Failed to verify ${address}: ${e.message}`);
    }
  }
}

async function main() {
  const addresses = JSON.parse(fs.readFileSync("deployed-addresses.json"));
  const [deployer] = await ethers.getSigners();
  const admin = deployer.address;
  const USDC = process.env.USDC_ADDRESS || deployer.address;
  const TREASURY = process.env.TREASURY_ADDRESS || deployer.address;

  await verify(addresses.workToken, [admin]);
  await verify(addresses.govToken, [admin, TREASURY]);
  await verify(addresses.didRegistry, [addresses.workToken, admin]);
  await verify(addresses.taskMarket, [addresses.workToken, addresses.didRegistry, TREASURY, admin]);
  await verify(addresses.auditVoting, [addresses.didRegistry, addresses.taskMarket, admin]);
  await verify(addresses.optimisticChallenge, [addresses.workToken, addresses.taskMarket, addresses.didRegistry, admin]);
  await verify(addresses.votingPoints, [addresses.didRegistry, admin]);
  await verify(addresses.genesisLobster, [admin]);
  await verify(addresses.workBridge, [USDC, addresses.workToken, admin]);

  console.log("\nVerification complete.");
}

main().catch((err) => { console.error(err); process.exit(1); });
