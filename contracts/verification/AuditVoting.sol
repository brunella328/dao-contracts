// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "../identity/DIDRegistry.sol";
import "../market/TaskMarket.sol";

/**
 * @title AuditVoting
 * @notice N=5 audit agent voting for task verification.
 *         Auditors are pseudo-randomly selected using block hash.
 *         3/5 majority triggers automatic PASS or routes to OptimisticChallenge.
 */
contract AuditVoting is AccessControl, Pausable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 public constant AUDIT_POOL_SIZE = 5;
    uint256 public constant PASS_THRESHOLD = 3;
    uint256 public constant AUDITOR_TIP_BPS = 500; // 5% of reward split among auditors

    DIDRegistry public immutable didRegistry;
    TaskMarket public immutable taskMarket;

    struct AuditSession {
        uint256 taskId;
        address[5] auditors;
        mapping(address => bool) hasVoted;
        mapping(address => bool) vote;
        uint256 passVotes;
        uint256 failVotes;
        bool finalized;
        uint256 createdAt;
    }

    mapping(uint256 => AuditSession) public sessions;
    address[] public auditorPool;

    event AuditStarted(uint256 indexed taskId, address[5] auditors);
    event VoteCast(uint256 indexed taskId, address indexed auditor, bool pass);
    event AuditFinalized(uint256 indexed taskId, bool passed, uint256 passVotes);

    constructor(address didRegistry_, address taskMarket_, address admin) {
        didRegistry = DIDRegistry(didRegistry_);
        taskMarket = TaskMarket(taskMarket_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    function registerAsAuditor() external {
        require(didRegistry.isValid(msg.sender), "Invalid DID");
        for (uint256 i = 0; i < auditorPool.length; i++) {
            require(auditorPool[i] != msg.sender, "Already registered");
        }
        auditorPool.push(msg.sender);
    }

    function startAudit(uint256 taskId) external whenNotPaused {
        require(auditorPool.length >= AUDIT_POOL_SIZE, "Insufficient auditors");
        AuditSession storage session = sessions[taskId];
        require(session.taskId == 0, "Audit already started");

        session.taskId = taskId;
        session.createdAt = block.timestamp;

        address[5] memory selected = _selectAuditors(taskId);
        for (uint256 i = 0; i < AUDIT_POOL_SIZE; i++) {
            session.auditors[i] = selected[i];
        }

        emit AuditStarted(taskId, selected);
    }

    function castVote(uint256 taskId, bool pass) external whenNotPaused {
        AuditSession storage session = sessions[taskId];
        require(!session.finalized, "Already finalized");
        require(!session.hasVoted[msg.sender], "Already voted");

        bool isAuditor = false;
        for (uint256 i = 0; i < AUDIT_POOL_SIZE; i++) {
            if (session.auditors[i] == msg.sender) { isAuditor = true; break; }
        }
        require(isAuditor, "Not selected auditor");

        session.hasVoted[msg.sender] = true;
        session.vote[msg.sender] = pass;

        if (pass) session.passVotes++; else session.failVotes++;

        emit VoteCast(taskId, msg.sender, pass);

        if (session.passVotes >= PASS_THRESHOLD || session.failVotes >= PASS_THRESHOLD) {
            _finalize(taskId);
        }
    }

    function _finalize(uint256 taskId) internal {
        AuditSession storage session = sessions[taskId];
        session.finalized = true;
        bool passed = session.passVotes >= PASS_THRESHOLD;
        taskMarket.verifyTask(taskId, passed);
        emit AuditFinalized(taskId, passed, session.passVotes);
    }

    function _selectAuditors(uint256 taskId) internal view returns (address[5] memory selected) {
        uint256 poolLen = auditorPool.length;
        bool[] memory picked = new bool[](poolLen);
        uint256 count = 0;

        for (uint256 nonce = 0; count < AUDIT_POOL_SIZE; nonce++) {
            uint256 idx = uint256(keccak256(abi.encodePacked(
                blockhash(block.number - 1), taskId, nonce
            ))) % poolLen;

            if (!picked[idx] && didRegistry.isValid(auditorPool[idx])) {
                picked[idx] = true;
                selected[count] = auditorPool[idx];
                count++;
            }
        }
    }

    function getAuditors(uint256 taskId) external view returns (address[5] memory) {
        return sessions[taskId].auditors;
    }

    function addToPool(address agent) external onlyRole(DEFAULT_ADMIN_ROLE) {
        auditorPool.push(agent);
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
}
