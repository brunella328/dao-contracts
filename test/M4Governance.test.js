const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("M4 Growth Phase Governance", function () {
  let workToken, govToken, didRegistry, taskMarket, votingPoints, timelock, governor;
  let admin, client, agent1, agent2, agent3, agent4, agent5, treasury;

  const MIN_STAKE = ethers.parseEther("100");
  const TASK_REWARD = ethers.parseEther("1000");
  // GovToken mints TOTAL_SUPPLY (1B) to treasury at construction — no extra mint needed

  beforeEach(async function () {
    [admin, client, agent1, agent2, agent3, agent4, agent5, treasury] =
      await ethers.getSigners();

    const WorkToken = await ethers.getContractFactory("WorkToken");
    workToken = await WorkToken.deploy(admin.address);

    const GovToken = await ethers.getContractFactory("GovToken");
    govToken = await GovToken.deploy(admin.address, admin.address);

    const DIDRegistry = await ethers.getContractFactory("DIDRegistry");
    didRegistry = await DIDRegistry.deploy(await workToken.getAddress(), admin.address);

    await workToken.grantRole(await workToken.MINTER_ROLE(), admin.address);
    await workToken.grantRole(await workToken.BURNER_ROLE(), admin.address);
    await workToken.grantRole(await workToken.BURNER_ROLE(), await didRegistry.getAddress());

    for (const signer of [client, agent1, agent2, agent3, agent4, agent5]) {
      await workToken.mint(signer.address, ethers.parseEther("5000"));
    }

    const TaskMarket = await ethers.getContractFactory("TaskMarket");
    taskMarket = await TaskMarket.deploy(
      await workToken.getAddress(),
      await didRegistry.getAddress(),
      treasury.address,
      admin.address
    );

    const VotingPoints = await ethers.getContractFactory("VotingPoints");
    votingPoints = await VotingPoints.deploy(
      await didRegistry.getAddress(),
      7 * 24 * 3600,
      admin.address
    );

    // TimelockController: min delay 1s for tests, admin as initial proposer/executor
    const TimelockController = await ethers.getContractFactory("TimelockController");
    timelock = await TimelockController.deploy(
      1,
      [admin.address],
      [admin.address],
      admin.address
    );

    const QVGovernor = await ethers.getContractFactory("QVGovernor");
    governor = await QVGovernor.deploy(
      await govToken.getAddress(),
      await timelock.getAddress(),
      await didRegistry.getAddress(),
      await votingPoints.getAddress(),
      ethers.parseEther("10000"),
      1,
      50400
    );
  });

  // ------- Test 1 -------
  it("T1: Genesis Phase — proposalThreshold is fixed 10,000 GOV", async function () {
    expect(await governor.growthPhaseActive()).to.be.false;
    expect(await governor.proposalThreshold()).to.equal(ethers.parseEther("10000"));
  });

  // ------- Test 2 -------
  it("T2: Non-Timelock caller cannot activate Growth Phase", async function () {
    await expect(
      governor.connect(admin).activateGrowthPhase()
    ).to.be.revertedWith("Not governance");

    await expect(
      governor.connect(client).activateGrowthPhase()
    ).to.be.revertedWith("Not governance");
  });

  // ------- Test 3 -------
  it("T3: Timelock can activate Growth Phase — flag set, event emitted", async function () {
    const timelockAddr = await timelock.getAddress();
    const governorAddr = await governor.getAddress();

    // Impersonate the Timelock to call activateGrowthPhase directly
    await ethers.provider.send("hardhat_impersonateAccount", [timelockAddr]);
    await ethers.provider.send("hardhat_setBalance", [timelockAddr, "0x56BC75E2D63100000"]);
    const timelockSigner = await ethers.getSigner(timelockAddr);

    await expect(governor.connect(timelockSigner).activateGrowthPhase())
      .to.emit(governor, "GrowthPhaseActivated");

    expect(await governor.growthPhaseActive()).to.be.true;

    await ethers.provider.send("hardhat_stopImpersonatingAccount", [timelockAddr]);
  });

  // ------- Test 4 -------
  it("T4: Growth Phase — dynamic threshold = max(10000e18, totalSupply / 10000)", async function () {
    const timelockAddr = await timelock.getAddress();

    await ethers.provider.send("hardhat_impersonateAccount", [timelockAddr]);
    await ethers.provider.send("hardhat_setBalance", [timelockAddr, "0x56BC75E2D63100000"]);
    const timelockSigner = await ethers.getSigner(timelockAddr);
    await governor.connect(timelockSigner).activateGrowthPhase();
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [timelockAddr]);

    // Mine a block so getPastTotalSupply(block.number - 1) works
    await ethers.provider.send("evm_mine", []);

    const totalSupply = await govToken.getPastTotalSupply(await ethers.provider.getBlockNumber() - 1);
    const expectedDynamic = totalSupply / 10_000n;
    const expectedBase = ethers.parseEther("10000");
    const expected = expectedDynamic > expectedBase ? expectedDynamic : expectedBase;

    expect(await governor.proposalThreshold()).to.equal(expected);
  });

  // ------- Test 5 -------
  it("T5: postTask with TaskType.Research — stored correctly in task struct", async function () {
    const TASK_TYPE_RESEARCH = 2; // TaskType.Research

    await workToken.connect(client).approve(await taskMarket.getAddress(), TASK_REWARD);
    const deadline = (await time.latest()) + 7 * 24 * 3600;

    await expect(
      taskMarket.connect(client).postTask(TASK_REWARD, deadline, "ipfs://QmResearch", TASK_TYPE_RESEARCH)
    ).to.emit(taskMarket, "TaskPosted");

    const task = await taskMarket.tasks(1n);
    expect(task.taskType).to.equal(TASK_TYPE_RESEARCH);
    expect(task.descriptionHash).to.equal("ipfs://QmResearch");
  });

  // ------- Test 6 -------
  it("T6: verifyTask increments verifiedTaskCount", async function () {
    const agents = [agent1, agent2, agent3, agent4, agent5];

    for (const agent of agents) {
      await workToken.connect(agent).approve(await didRegistry.getAddress(), MIN_STAKE);
      await didRegistry.connect(agent).registerDID(MIN_STAKE);
    }

    await workToken.connect(client).approve(await taskMarket.getAddress(), TASK_REWARD);
    const deadline = (await time.latest()) + 7 * 24 * 3600;
    await taskMarket.connect(client).postTask(TASK_REWARD, deadline, "ipfs://QmTask", 0);

    await taskMarket.connect(agent1).acceptTask(1n);
    await taskMarket.connect(agent1).submitResult(1n, "ipfs://QmResult");

    // Grant VERIFIER_ROLE to admin for direct verification
    await taskMarket.setVerifier(admin.address);

    expect(await taskMarket.verifiedTaskCount()).to.equal(0n);
    await taskMarket.connect(admin).verifyTask(1n, true);
    expect(await taskMarket.verifiedTaskCount()).to.equal(1n);
  });
});
