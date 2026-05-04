// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "../tokens/WorkToken.sol";

/**
 * @title DIDRegistry
 * @notice ERC-1056 inspired DID registry for Lobster Agents.
 *         DID format: did:ethr:qan:<address>
 *         Registration requires staking WORK tokens as Sybil defense.
 */
contract DIDRegistry is AccessControl, Pausable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");

    uint256 public constant MIN_STAKE = 100 * 1e18;

    WorkToken public immutable workToken;

    struct DIDRecord {
        bool active;
        uint256 stakedAmount;
        uint256 registeredAt;
        uint256 creditScore;
        string controller;
    }

    mapping(address => DIDRecord) public dids;
    mapping(address => address) public delegates;
    uint256 public totalActiveDIDs;

    event DIDRegistered(address indexed agent, uint256 stake, uint256 timestamp);
    event DIDRevoked(address indexed agent, uint256 stakeReturned);
    event DelegateChanged(address indexed identity, address indexed delegate, uint256 validity);
    event AttributeChanged(address indexed identity, bytes32 indexed name, bytes value, uint256 validity);
    event CreditUpdated(address indexed agent, int256 delta, uint256 newScore);

    constructor(address workToken_, address admin) {
        workToken = WorkToken(workToken_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(SLASHER_ROLE, admin);
    }

    function registerDID(uint256 stakeAmount) external whenNotPaused {
        require(!dids[msg.sender].active, "DID already registered");
        require(stakeAmount >= MIN_STAKE, "Stake below minimum");

        workToken.transferFrom(msg.sender, address(this), stakeAmount);

        dids[msg.sender] = DIDRecord({
            active: true,
            stakedAmount: stakeAmount,
            registeredAt: block.timestamp,
            creditScore: 100,
            controller: ""
        });
        totalActiveDIDs++;

        emit DIDRegistered(msg.sender, stakeAmount, block.timestamp);
    }

    function revokeDID() external whenNotPaused {
        DIDRecord storage record = dids[msg.sender];
        require(record.active, "DID not active");

        uint256 stakeToReturn = record.stakedAmount;
        record.active = false;
        record.stakedAmount = 0;
        totalActiveDIDs--;

        workToken.transfer(msg.sender, stakeToReturn);
        emit DIDRevoked(msg.sender, stakeToReturn);
    }

    function isValid(address agent) external view returns (bool) {
        return dids[agent].active;
    }

    function getStake(address agent) external view returns (uint256) {
        return dids[agent].stakedAmount;
    }

    function getCreditScore(address agent) external view returns (uint256) {
        return dids[agent].creditScore;
    }

    function updateCredit(address agent, int256 delta) external onlyRole(SLASHER_ROLE) {
        DIDRecord storage record = dids[agent];
        require(record.active, "DID not active");

        uint256 current = record.creditScore;
        if (delta < 0 && uint256(-delta) >= current) {
            record.creditScore = 0;
        } else if (delta < 0) {
            record.creditScore = current - uint256(-delta);
        } else {
            record.creditScore = current + uint256(delta);
        }

        emit CreditUpdated(agent, delta, record.creditScore);
    }

    function slashStake(address agent, uint256 basisPoints, string calldata reason)
        external
        onlyRole(SLASHER_ROLE)
    {
        DIDRecord storage record = dids[agent];
        require(record.active, "DID not active");

        uint256 slashAmount = (record.stakedAmount * basisPoints) / 10000;
        record.stakedAmount -= slashAmount;
        workToken.slash(address(this), slashAmount, reason);
    }

    function setDelegate(address identity, address delegate, uint256 validity) external {
        require(msg.sender == identity, "Not identity owner");
        delegates[identity] = delegate;
        emit DelegateChanged(identity, delegate, validity);
    }

    function setAttribute(bytes32 name, bytes calldata value, uint256 validity) external {
        require(dids[msg.sender].active, "DID not active");
        emit AttributeChanged(msg.sender, name, value, validity);
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
}
