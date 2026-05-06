const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("DAO Full Integration", function () {
  let workToken, govToken, didRegistry, taskMarket, auditVoting, votingPoints;
  let admin, client, agent1, agent2, agent3, agent4, agent5, treasury, challenger;

  const MIN_STAKE = ethers.parseEther("100");
  const TASK_REWARD = ethers.parseEther("1000");
  const PROPOSAL_THRESHOLD = ethers.parseEther("10000");

  beforeEach(async function () {
    [admin, client, agent1, agent2, agent3, agent4, agent5, treasury, challenger] =
      await ethers.getSigners();

    // Deploy tokens
    const WorkToken = await ethers.getContractFactory("WorkToken");
    workToken = await WorkToken.deploy(admin.address);

    const GovToken = await ethers.getContractFactory("GovToken");
    govToken = await GovToken.deploy(admin.address, admin.address);

    // Deploy DIDRegistry
    const DIDRegistry = await ethers.getContractFactory("DIDRegistry");
    didRegistry = await DIDRegistry.deploy(await workToken.getAddress(), admin.address);

    // Grant roles
    await workToken.grantRole(await workToken.MINTER_ROLE(), admin.address);
    await workToken.grantRole(await workToken.BURNER_ROLE(), admin.address);
    await workToken.grantRole(await workToken.BURNER_ROLE(), await didRegistry.getAddress());

    // Mint WORK tokens to participants
    for (const signer of [client, agent1, agent2, agent3, agent4, agent5, challenger]) {
      await workToken.mint(signer.address, ethers.parseEther("5000"));
    }

    // Deploy TaskMarket
    const TaskMarket = await ethers.getContractFactory("TaskMarket");
    taskMarket = await TaskMarket.deploy(
      await workToken.getAddress(),
      await didRegistry.getAddress(),
      treasury.address,
      admin.address
    );

    // Grant BURNER_ROLE to TaskMarket for revenue distribution
    await workToken.grantRole(await workToken.BURNER_ROLE(), await taskMarket.getAddress());

    // Deploy AuditVoting
    const AuditVoting = await ethers.getContractFactory("AuditVoting");
    auditVoting = await AuditVoting.deploy(
      await didRegistry.getAddress(),
      await taskMarket.getAddress(),
      admin.address
    );

    // Grant VERIFIER_ROLE to AuditVoting
    await taskMarket.setVerifier(await auditVoting.getAddress());

    // Deploy VotingPoints (7-day epoch)
    const VotingPoints = await ethers.getContractFactory("VotingPoints");
    votingPoints = await VotingPoints.deploy(
      await didRegistry.getAddress(),
      7 * 24 * 3600,
      admin.address
    );
  });

  describe("P-7.1: Lobster full flow — DID → Stake → Accept → Submit → Audit → Payout", function () {
    it("Agent registers DID, accepts task, submits, passes 3/5 audit, receives payout", async function () {
      const agents = [agent1, agent2, agent3, agent4, agent5];

      // Register all agents as DIDs
      for (const agent of agents) {
        await workToken.connect(agent).approve(await didRegistry.getAddress(), MIN_STAKE);
        await didRegistry.connect(agent).registerDID(MIN_STAKE);
        expect(await didRegistry.isValid(agent.address)).to.be.true;
      }

      // Add agents to auditor pool
      for (const agent of agents) {
        await auditVoting.connect(agent).registerAsAuditor();
      }

      // Client posts task
      await workToken.connect(client).approve(await taskMarket.getAddress(), TASK_REWARD);
      const deadline = (await time.latest()) + 7 * 24 * 3600;
      const tx = await taskMarket.connect(client).postTask(TASK_REWARD, deadline, "ipfs://QmTask123", 0);
      const receipt = await tx.wait();
      const taskId = 1n;

      expect((await taskMarket.tasks(taskId)).status).to.equal(0); // Pending

      // Agent1 accepts task
      await taskMarket.connect(agent1).acceptTask(taskId);
      expect((await taskMarket.tasks(taskId)).status).to.equal(1); // Active
      expect((await taskMarket.tasks(taskId)).assignee).to.equal(agent1.address);

      // Agent1 submits result
      await taskMarket.connect(agent1).submitResult(taskId, "ipfs://QmResult456");
      expect((await taskMarket.tasks(taskId)).status).to.equal(2); // Submitted

      // Start audit
      await auditVoting.startAudit(taskId);
      const auditors = await auditVoting.getAuditors(taskId);
      expect(auditors.length).to.equal(5);

      // 3 auditors vote PASS
      let passCount = 0;
      for (const auditorAddr of auditors) {
        if (passCount < 3) {
          const auditorSigner = agents.find(a => a.address === auditorAddr);
          if (auditorSigner) {
            await auditVoting.connect(auditorSigner).castVote(taskId, true);
            passCount++;
          }
        }
      }

      // Task should be Verified
      expect((await taskMarket.tasks(taskId)).status).to.equal(3); // Verified

      // Agent1 received 70% of reward
      const agentBalance = await workToken.balanceOf(agent1.address);
      const expectedPayout = TASK_REWARD * 7000n / 10000n;
      expect(agentBalance).to.be.gte(ethers.parseEther("4900") + expectedPayout - MIN_STAKE);
    });
  });

  describe("P-7.3: Slashing flow — negligent agent", function () {
    it("Slash 20% of stake for negligent behaviour", async function () {
      await workToken.connect(agent1).approve(await didRegistry.getAddress(), MIN_STAKE);
      await didRegistry.connect(agent1).registerDID(MIN_STAKE);

      const stakeBefore = await didRegistry.getStake(agent1.address);
      expect(stakeBefore).to.equal(MIN_STAKE);

      await workToken.grantRole(await workToken.BURNER_ROLE(), await didRegistry.getAddress());
      await didRegistry.connect(admin).slashStake(agent1.address, 2000, "Negligent: no response");

      const stakeAfter = await didRegistry.getStake(agent1.address);
      expect(stakeAfter).to.equal(MIN_STAKE * 8000n / 10000n);
    });
  });

  describe("P-7.4: VotingPoints QV logic", function () {
    it("Spending N votes costs N² points; insufficient points reverts", async function () {
      await workToken.connect(agent1).approve(await didRegistry.getAddress(), MIN_STAKE);
      await didRegistry.connect(agent1).registerDID(MIN_STAKE);
      await votingPoints.grantRole(await votingPoints.GOVERNOR_ROLE(), admin.address);

      // Spend 5 votes → costs 25 points
      await votingPoints.connect(admin).spendPoints(agent1.address, 5);
      expect(await votingPoints.pointsAvailable(agent1.address)).to.equal(75);

      // Spend 9 votes → costs 81 points (75 available → should revert)
      await expect(
        votingPoints.connect(admin).spendPoints(agent1.address, 9)
      ).to.be.revertedWith("Insufficient voting points");
    });

    it("Points reset in new epoch", async function () {
      await workToken.connect(agent1).approve(await didRegistry.getAddress(), MIN_STAKE);
      await didRegistry.connect(agent1).registerDID(MIN_STAKE);
      await votingPoints.grantRole(await votingPoints.GOVERNOR_ROLE(), admin.address);

      await votingPoints.connect(admin).spendPoints(agent1.address, 10); // 100 points spent
      expect(await votingPoints.pointsAvailable(agent1.address)).to.equal(0);

      // Advance 7 days
      await time.increase(7 * 24 * 3600 + 1);

      // Points reset
      expect(await votingPoints.pointsAvailable(agent1.address)).to.equal(100);
    });
  });
});
