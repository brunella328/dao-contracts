// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../identity/DIDRegistry.sol";

/**
 * @title VotingPoints
 * @notice Manages QV voting point allocation per DID per epoch.
 *         Each valid DID receives 100 points per epoch.
 *         Casting N votes on a proposal costs N² points.
 *         Points reset at the start of each new epoch.
 */
contract VotingPoints is AccessControl {
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");

    uint256 public constant POINTS_PER_EPOCH = 100;
    uint256 public epochDuration;
    uint256 public epochStart;

    DIDRegistry public immutable didRegistry;

    // epoch => did => pointsSpent
    mapping(uint256 => mapping(address => uint256)) public pointsSpent;

    event PointsSpent(address indexed did, uint256 epoch, uint256 votes, uint256 cost);
    event EpochAdvanced(uint256 newEpoch, uint256 startTime);

    constructor(address didRegistry_, uint256 epochDuration_, address admin) {
        didRegistry = DIDRegistry(didRegistry_);
        epochDuration = epochDuration_;
        epochStart = block.timestamp;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function currentEpoch() public view returns (uint256) {
        return (block.timestamp - epochStart) / epochDuration;
    }

    function pointsAvailable(address did) public view returns (uint256) {
        require(didRegistry.isValid(did), "Invalid DID");
        uint256 epoch = currentEpoch();
        uint256 spent = pointsSpent[epoch][did];
        return spent >= POINTS_PER_EPOCH ? 0 : POINTS_PER_EPOCH - spent;
    }

    function spendPoints(address did, uint256 votes)
        external
        onlyRole(GOVERNOR_ROLE)
        returns (uint256 cost)
    {
        require(didRegistry.isValid(did), "Invalid DID");
        require(votes > 0, "Votes must be positive");

        cost = votes * votes;
        uint256 epoch = currentEpoch();
        uint256 available = POINTS_PER_EPOCH - pointsSpent[epoch][did];
        require(cost <= available, "Insufficient voting points");

        pointsSpent[epoch][did] += cost;
        emit PointsSpent(did, epoch, votes, cost);
    }
}
