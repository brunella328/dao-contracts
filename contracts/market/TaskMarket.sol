// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../tokens/WorkToken.sol";
import "../identity/DIDRegistry.sol";
import "../identity/GenesisLobster.sol";

/**
 * @title TaskMarket
 * @notice Code task marketplace. Clients post tasks with WORK escrow.
 *         Lobster Agents (valid DID) accept and submit results.
 *         Verification is delegated to AuditVoting contract.
 */
contract TaskMarket is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant REVIEWER_ROLE = keccak256("REVIEWER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    WorkToken public immutable workToken;
    DIDRegistry public immutable didRegistry;
    GenesisLobster public genesisLobster; // mutable: set after NFT deploy

    enum TaskStatus { Pending, Active, Submitted, Verified, Disputed, Settled, Cancelled }
    enum TaskType { Code, Design, Research, Community }

    struct Task {
        address client;
        address assignee;
        uint256 reward;
        uint256 postedAt;
        uint256 deadline;
        TaskStatus status;
        TaskType taskType;
        string descriptionHash;
        string resultHash;
    }

    uint256 public taskCount;
    uint256 public verifiedTaskCount;
    mapping(uint256 => Task) public tasks;

    uint256 public constant AUDIT_FEE_BPS = 500;    // 5% to audit agents
    uint256 public constant TREASURY_BPS = 2000;     // 20% to treasury
    uint256 public constant GOV_SHARE_BPS = 1000;    // 10% to GOV holders
    uint256 public constant CONTRIBUTOR_BPS = 7000;  // 70% to contributor
    uint256 public constant CONTRIBUTOR_DISCOUNT_BPS = 7350; // 73.5% for Genesis Lobster holders

    address public treasury;

    event TaskPosted(uint256 indexed taskId, address indexed client, uint256 reward, TaskType taskType, string descHash);
    event TaskAccepted(uint256 indexed taskId, address indexed agent);
    event TaskSubmitted(uint256 indexed taskId, address indexed agent, string resultHash);
    event TaskVerified(uint256 indexed taskId, address indexed agent, uint256 payout);
    event TaskDisputed(uint256 indexed taskId);
    event TaskSettled(uint256 indexed taskId, bool agentPaid);
    event TaskCancelled(uint256 indexed taskId);

    constructor(address workToken_, address didRegistry_, address treasury_, address admin) {
        workToken = WorkToken(workToken_);
        didRegistry = DIDRegistry(didRegistry_);
        treasury = treasury_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(REVIEWER_ROLE, admin);
    }

    function setGenesisLobster(address genesisLobster_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        genesisLobster = GenesisLobster(genesisLobster_);
    }

    function postTask(uint256 reward, uint256 deadline, string calldata descHash, TaskType taskType)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 taskId)
    {
        require(reward > 0, "Reward must be positive");
        require(deadline > block.timestamp, "Deadline must be future");

        workToken.transferFrom(msg.sender, address(this), reward);

        taskId = ++taskCount;
        tasks[taskId] = Task({
            client: msg.sender,
            assignee: address(0),
            reward: reward,
            postedAt: block.timestamp,
            deadline: deadline,
            status: TaskStatus.Pending,
            taskType: taskType,
            descriptionHash: descHash,
            resultHash: ""
        });

        emit TaskPosted(taskId, msg.sender, reward, taskType, descHash);
    }

    function acceptTask(uint256 taskId) external whenNotPaused nonReentrant {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Pending, "Task not available");
        require(didRegistry.isValid(msg.sender), "Invalid DID");
        require(block.timestamp < task.deadline, "Task expired");

        task.assignee = msg.sender;
        task.status = TaskStatus.Active;

        emit TaskAccepted(taskId, msg.sender);
    }

    function submitResult(uint256 taskId, string calldata resultHash)
        external
        whenNotPaused
    {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Active, "Task not active");
        require(task.assignee == msg.sender, "Not task assignee");

        task.resultHash = resultHash;
        task.status = TaskStatus.Submitted;

        emit TaskSubmitted(taskId, msg.sender, resultHash);
    }

    function verifyTask(uint256 taskId, bool passed)
        external
        onlyRole(VERIFIER_ROLE)
        nonReentrant
    {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Submitted, "Task not submitted");

        if (passed) {
            task.status = TaskStatus.Verified;
            _distributeReward(taskId);
        } else {
            task.status = TaskStatus.Disputed;
            emit TaskDisputed(taskId);
        }
    }

    function settleDispute(uint256 taskId, bool agentPaid)
        external
        onlyRole(REVIEWER_ROLE)
        nonReentrant
    {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Disputed, "Task not disputed");

        task.status = TaskStatus.Settled;

        if (agentPaid) {
            _distributeReward(taskId);
        } else {
            workToken.transfer(task.client, task.reward);
        }

        emit TaskSettled(taskId, agentPaid);
    }

    function cancelTask(uint256 taskId) external nonReentrant {
        Task storage task = tasks[taskId];
        require(task.client == msg.sender, "Not task client");
        require(task.status == TaskStatus.Pending, "Cannot cancel");

        task.status = TaskStatus.Cancelled;
        workToken.transfer(task.client, task.reward);

        emit TaskCancelled(taskId);
    }

    function _distributeReward(uint256 taskId) internal {
        Task storage task = tasks[taskId];
        uint256 total = task.reward;

        bool hasDiscount = address(genesisLobster) != address(0) &&
            genesisLobster.hasDiscount(task.assignee);

        uint256 contributorBps = hasDiscount ? CONTRIBUTOR_DISCOUNT_BPS : CONTRIBUTOR_BPS;
        uint256 toContributor = (total * contributorBps) / 10000;
        uint256 toTreasury = total - toContributor; // Treasury absorbs discount delta

        workToken.transfer(treasury, toTreasury);
        workToken.transfer(task.assignee, toContributor);

        // Mint Genesis Lobster NFT if eligible
        if (address(genesisLobster) != address(0) &&
            genesisLobster.totalMinted() < genesisLobster.MAX_SUPPLY() &&
            !hasDiscount)
        {
            try genesisLobster.safeMint(task.assignee, taskId) {} catch {}
        }

        verifiedTaskCount++;
        emit TaskVerified(taskId, task.assignee, toContributor);
    }

    function setTreasury(address treasury_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        treasury = treasury_;
    }

    function setVerifier(address verifier) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(VERIFIER_ROLE, verifier);
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
}
