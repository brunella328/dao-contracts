// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../tokens/WorkToken.sol";
import "../market/TaskMarket.sol";
import "../identity/DIDRegistry.sol";

/**
 * @title OptimisticChallenge
 * @notice 7-day challenge window for disputed tasks.
 *         Challengers stake WORK tokens. Successful challenges earn from slashed stake.
 *         Core Members arbitrate unresolved challenges.
 */
contract OptimisticChallenge is AccessControl, ReentrancyGuard {
    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");

    uint256 public constant CHALLENGE_PERIOD = 7 days;
    uint256 public constant CHALLENGER_STAKE = 50 * 1e18;

    // Slashing basis points
    uint256 public constant SLASH_MALICIOUS_BPS = 5000;  // 50%
    uint256 public constant SLASH_NEGLIGENT_BPS = 2000;  // 20%

    WorkToken public immutable workToken;
    TaskMarket public immutable taskMarket;
    DIDRegistry public immutable didRegistry;

    struct Challenge {
        uint256 taskId;
        address challenger;
        uint256 challengerStake;
        uint256 openedAt;
        bool resolved;
        bool challengerWon;
        string evidenceHash;
    }

    mapping(uint256 => Challenge) public challenges;
    uint256 public challengeCount;

    event ChallengeOpened(uint256 indexed challengeId, uint256 indexed taskId, address challenger);
    event ChallengeResolved(uint256 indexed challengeId, bool challengerWon, address arbitrator);
    event ChallengExpired(uint256 indexed challengeId, uint256 indexed taskId);

    constructor(address workToken_, address taskMarket_, address didRegistry_, address admin) {
        workToken = WorkToken(workToken_);
        taskMarket = TaskMarket(taskMarket_);
        didRegistry = DIDRegistry(didRegistry_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ARBITRATOR_ROLE, admin);
    }

    function openChallenge(uint256 taskId, string calldata evidenceHash)
        external
        nonReentrant
        returns (uint256 challengeId)
    {
        require(didRegistry.isValid(msg.sender), "Invalid DID");
        workToken.transferFrom(msg.sender, address(this), CHALLENGER_STAKE);

        challengeId = ++challengeCount;
        challenges[challengeId] = Challenge({
            taskId: taskId,
            challenger: msg.sender,
            challengerStake: CHALLENGER_STAKE,
            openedAt: block.timestamp,
            resolved: false,
            challengerWon: false,
            evidenceHash: evidenceHash
        });

        emit ChallengeOpened(challengeId, taskId, msg.sender);
    }

    function resolveChallenge(uint256 challengeId, bool challengerWon, bool /* isMalicious */)
        external
        onlyRole(ARBITRATOR_ROLE)
        nonReentrant
    {
        Challenge storage challenge = challenges[challengeId];
        require(!challenge.resolved, "Already resolved");
        require(
            block.timestamp <= challenge.openedAt + CHALLENGE_PERIOD,
            "Challenge period expired"
        );

        challenge.resolved = true;
        challenge.challengerWon = challengerWon;

        if (challengerWon) {
            // Return challenger stake + reward from task agent's slashed stake
            workToken.transfer(challenge.challenger, challenge.challengerStake);
            taskMarket.settleDispute(challenge.taskId, false);
            // Credit challenger's DID for valid challenge
            didRegistry.updateCredit(challenge.challenger, 2);
        } else {
            // Challenger loses stake — burned
            workToken.slash(address(this), challenge.challengerStake, "Failed challenge stake");
            taskMarket.settleDispute(challenge.taskId, true);
            // Penalise challenger's credit score
            didRegistry.updateCredit(challenge.challenger, -1);
        }

        emit ChallengeResolved(challengeId, challengerWon, msg.sender);
    }

    function expireChallenge(uint256 challengeId) external nonReentrant {
        Challenge storage challenge = challenges[challengeId];
        require(!challenge.resolved, "Already resolved");
        require(
            block.timestamp > challenge.openedAt + CHALLENGE_PERIOD,
            "Challenge period not over"
        );

        challenge.resolved = true;
        // No challenge submitted or expired: default pass, return stake
        workToken.transfer(challenge.challenger, challenge.challengerStake);
        taskMarket.settleDispute(challenge.taskId, true);

        emit ChallengExpired(challengeId, challenge.taskId);
    }

    function addArbitrator(address arbitrator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ARBITRATOR_ROLE, arbitrator);
    }
}
