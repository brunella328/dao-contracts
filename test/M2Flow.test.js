const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("M2 — WorkBridge + GenesisLobster + CliffVesting", function () {
  let admin, treasury, user1, agent1, agent2;
  let workToken, didRegistry, taskMarket;
  let genesisLobster, workBridge;
  let mockUSDC;

  const STAKE  = ethers.parseEther("100");
  const REWARD = ethers.parseEther("1000");

  const keccak = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));

  beforeEach(async () => {
    [admin, treasury, user1, agent1, agent2] = await ethers.getSigners();

    // Mock USDC (reuse WorkToken as mintable ERC20)
    const WorkTokenF = await ethers.getContractFactory("WorkToken");
    mockUSDC = await WorkTokenF.deploy(admin.address);
    await mockUSDC.grantRole(keccak("MINTER_ROLE"), admin.address);
    await mockUSDC.mint(user1.address, ethers.parseEther("100000"));

    // Core contracts
    workToken = await WorkTokenF.deploy(admin.address);
    await workToken.grantRole(keccak("MINTER_ROLE"), admin.address);

    const DIDRegistry = await ethers.getContractFactory("DIDRegistry");
    didRegistry = await DIDRegistry.deploy(await workToken.getAddress(), admin.address);

    const TaskMarket = await ethers.getContractFactory("TaskMarket");
    taskMarket = await TaskMarket.deploy(
      await workToken.getAddress(),
      await didRegistry.getAddress(),
      treasury.address,
      admin.address
    );

    // GenesisLobster
    const GenesisLobster = await ethers.getContractFactory("GenesisLobster");
    genesisLobster = await GenesisLobster.deploy(admin.address);
    await genesisLobster.grantRole(keccak("MINTER_ROLE"), await taskMarket.getAddress());
    await taskMarket.setGenesisLobster(await genesisLobster.getAddress());

    // Grant VERIFIER_ROLE to admin for test simplicity
    await taskMarket.grantRole(keccak("VERIFIER_ROLE"), admin.address);

    // WorkBridge
    const WorkBridge = await ethers.getContractFactory("WorkBridge");
    workBridge = await WorkBridge.deploy(
      await mockUSDC.getAddress(),
      await workToken.getAddress(),
      admin.address
    );
    await workToken.grantRole(keccak("MINTER_ROLE"), await workBridge.getAddress());
    await workToken.grantRole(keccak("BURNER_ROLE"), await workBridge.getAddress());

    // Fund agents for staking + users for posting tasks
    await workToken.mint(agent1.address, STAKE.mul ? STAKE * 2n : ethers.parseEther("200"));
    await workToken.mint(agent2.address, ethers.parseEther("200"));
    await workToken.mint(user1.address, REWARD * 5n);
  });

  // Helper: register DID, post task, accept, submit, verify → returns taskId
  async function runFullTask(agent) {
    await workToken.connect(agent).approve(await didRegistry.getAddress(), STAKE);
    await didRegistry.connect(agent).registerDID(STAKE);

    await workToken.connect(user1).approve(await taskMarket.getAddress(), REWARD);
    await taskMarket.connect(user1).postTask(REWARD, (await time.latest()) + 86400, "QmHash", 0);
    const taskId = await taskMarket.taskCount();

    await taskMarket.connect(agent).acceptTask(taskId);
    await taskMarket.connect(agent).submitResult(taskId, "QmResult");
    await taskMarket.connect(admin).verifyTask(taskId, true);
    return taskId;
  }

  // ─── P-1: WorkBridge ──────────────────────────────────────────────────────

  describe("P-1: WorkBridge", function () {
    it("deposit mints WORK 1:1", async () => {
      const amount = ethers.parseEther("500");
      await mockUSDC.connect(user1).approve(await workBridge.getAddress(), amount);
      const before = await workToken.balanceOf(user1.address);
      await workBridge.connect(user1).deposit(amount);
      expect(await workToken.balanceOf(user1.address)).to.equal(before + amount);
    });

    it("redeem burns WORK and returns USDC", async () => {
      const amount = ethers.parseEther("500");
      await mockUSDC.connect(user1).approve(await workBridge.getAddress(), amount);
      await workBridge.connect(user1).deposit(amount);

      const usdcBefore = await mockUSDC.balanceOf(user1.address);
      await workBridge.connect(user1).redeem(amount);
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(usdcBefore + amount);
    });

    it("Circuit Breaker blocks redeem when reserve drops below threshold", async () => {
      // Deposit 1000 USDC → bridge has 1000 USDC, bridgeMinted = 1000
      const depositAmt = ethers.parseEther("1000");
      await mockUSDC.connect(user1).approve(await workBridge.getAddress(), depositAmt);
      await workBridge.connect(user1).deposit(depositAmt);

      // Admin withdraws 910 USDC (simulating yield deployment) → bridge has 90 USDC
      // reserveRatio = 90 * 10000 / 1000 = 900 BPS (9%) < 1000 BPS (10%)
      await workBridge.connect(admin).withdrawUSDC(ethers.parseEther("910"));

      // Any redeem should fail: 89/999 BPS < 1000
      await expect(workBridge.connect(user1).redeem(ethers.parseEther("1")))
        .to.be.revertedWith("Circuit breaker: reserve ratio too low");
    });

    it("admin can pause and unpause redeem", async () => {
      const amount = ethers.parseEther("200");
      await mockUSDC.connect(user1).approve(await workBridge.getAddress(), amount);
      await workBridge.connect(user1).deposit(amount);

      await workBridge.connect(admin).setRedeemPaused(true);
      await expect(workBridge.connect(user1).redeem(amount))
        .to.be.revertedWith("Redemption paused");

      await workBridge.connect(admin).setRedeemPaused(false);
      await workBridge.connect(user1).redeem(amount); // should pass
    });

    it("concurrent deposits from 5 signers all succeed", async () => {
      const signers = (await ethers.getSigners()).slice(5, 10);
      const amount = ethers.parseEther("100");
      for (const s of signers) {
        await mockUSDC.mint(s.address, amount);
        await mockUSDC.connect(s).approve(await workBridge.getAddress(), amount);
      }
      await Promise.all(signers.map(s => workBridge.connect(s).deposit(amount)));
      for (const s of signers) {
        expect(await workToken.balanceOf(s.address)).to.be.gte(amount);
      }
    });
  });

  // ─── P-2: GenesisLobster NFT ──────────────────────────────────────────────

  describe("P-2: GenesisLobster NFT", function () {
    it("mints NFT on first successful task", async () => {
      expect(await genesisLobster.totalMinted()).to.equal(0n);
      await runFullTask(agent1);
      expect(await genesisLobster.totalMinted()).to.equal(1n);
      expect(await genesisLobster.balanceOf(agent1.address)).to.equal(1n);
    });

    it("hasDiscount returns true for NFT holder", async () => {
      await runFullTask(agent1);
      expect(await genesisLobster.hasDiscount(agent1.address)).to.be.true;
      expect(await genesisLobster.hasDiscount(agent2.address)).to.be.false;
    });

    it("does not mint second NFT for same agent", async () => {
      await runFullTask(agent1);
      await workToken.mint(user1.address, REWARD);
      await workToken.connect(user1).approve(await taskMarket.getAddress(), REWARD);
      await taskMarket.connect(user1).postTask(REWARD, (await time.latest()) + 86400, "Qm2", 0);
      const taskId2 = await taskMarket.taskCount();
      await taskMarket.connect(agent1).acceptTask(taskId2);
      await taskMarket.connect(agent1).submitResult(taskId2, "QmResult2");
      await taskMarket.connect(admin).verifyTask(taskId2, true);
      expect(await genesisLobster.totalMinted()).to.equal(1n);
    });

    it("Genesis Lobster holder receives 73.5% contributor share", async () => {
      await runFullTask(agent1); // agent1 gets NFT

      // Second task for agent1 (now has NFT = discount)
      await workToken.mint(user1.address, REWARD);
      await workToken.connect(user1).approve(await taskMarket.getAddress(), REWARD);
      await taskMarket.connect(user1).postTask(REWARD, (await time.latest()) + 86400, "Qm3", 0);
      const taskId = await taskMarket.taskCount();
      await taskMarket.connect(agent1).acceptTask(taskId);
      await taskMarket.connect(agent1).submitResult(taskId, "QmResult3");

      const before = await workToken.balanceOf(agent1.address);
      await taskMarket.connect(admin).verifyTask(taskId, true);
      const received = (await workToken.balanceOf(agent1.address)) - before;
      const expected = REWARD * 7350n / 10000n;
      expect(received).to.equal(expected);
    });

    it("tokenURI returns valid on-chain base64 JSON", async () => {
      await runFullTask(agent1);
      const uri = await genesisLobster.tokenURI(1);
      expect(uri).to.match(/^data:application\/json;base64,/);
      const decoded = Buffer.from(uri.split(",")[1], "base64").toString();
      const json = JSON.parse(decoded);
      expect(json.name).to.equal("Genesis Lobster #1");
      expect(json.attributes.find(a => a.trait_type === "FeeDiscount").value).to.equal("5%");
    });
  });

  // ─── P-3: CliffVesting ────────────────────────────────────────────────────

  describe("P-3: CliffVesting", function () {
    let govToken, cliffVesting;

    beforeEach(async () => {
      const GovToken = await ethers.getContractFactory("GovToken");
      govToken = await GovToken.deploy(admin.address, admin.address);
    });

    it("cannot release before cliff ends", async () => {
      const now = await time.latest();
      const CliffVesting = await ethers.getContractFactory("CliffVesting");
      cliffVesting = await CliffVesting.deploy(
        user1.address, now, 365 * 24 * 3600, 3 * 365 * 24 * 3600
      );
      await govToken.transfer(await cliffVesting.getAddress(), ethers.parseEther("1000000"));
      await expect(cliffVesting["release(address)"](await govToken.getAddress()))
        .to.be.revertedWith("Cliff not reached");
    });

    it("releases tokens linearly after cliff", async () => {
      const now = await time.latest();
      const CLIFF = 365 * 24 * 3600;
      const VEST  = 3 * 365 * 24 * 3600;
      const CliffVesting = await ethers.getContractFactory("CliffVesting");
      cliffVesting = await CliffVesting.deploy(user1.address, now, CLIFF, VEST);

      const total = ethers.parseEther("3000000");
      await govToken.transfer(await cliffVesting.getAddress(), total);

      // Advance past cliff + 1/3 of vesting period
      await time.increase(CLIFF + Math.floor(VEST / 3));
      await cliffVesting["release(address)"](await govToken.getAddress());

      const released = await govToken.balanceOf(user1.address);
      expect(released).to.be.gt(ethers.parseEther("900000"));
      expect(released).to.be.lt(ethers.parseEther("1100000"));
    });
  });
});
