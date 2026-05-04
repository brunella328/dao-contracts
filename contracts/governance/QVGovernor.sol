// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import "../identity/DIDRegistry.sol";
import "./VotingPoints.sol";

/**
 * @title QVGovernor
 * @notice Quadratic Voting Governor. Extends OZ Governor with:
 *         - DID-gated voting (each DID gets equal initial points per epoch)
 *         - N² point cost per N votes cast
 *         - GOV token threshold for proposals
 *         - TimelockController for 72h execution delay
 */
contract QVGovernor is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorTimelockControl
{
    DIDRegistry public immutable didRegistry;
    VotingPoints public immutable votingPoints;

    constructor(
        IVotes govToken,
        TimelockController timelock,
        DIDRegistry didRegistry_,
        VotingPoints votingPoints_,
        uint256 proposalThreshold_,
        uint256 votingDelay_,
        uint256 votingPeriod_
    )
        Governor("QVGovernor")
        GovernorSettings(votingDelay_, votingPeriod_, proposalThreshold_)
        GovernorVotes(govToken)
        GovernorTimelockControl(timelock)
    {
        didRegistry = didRegistry_;
        votingPoints = votingPoints_;
    }

    function quorum(uint256) public pure override returns (uint256) {
        return 10; // Minimum 10 participating DIDs
    }

    // Cast vote with QV: caller specifies number of votes; cost = votes²
    function castVoteWithQV(uint256 proposalId, uint8 support, uint256 votes) external returns (uint256) {
        require(didRegistry.isValid(msg.sender), "Must have valid DID to vote");
        votingPoints.spendPoints(msg.sender, votes);
        return _castVote(proposalId, msg.sender, support, "", abi.encode(votes));
    }

    // Required overrides
    function votingDelay() public view override(IGovernor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }

    function votingPeriod() public view override(IGovernor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }

    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.proposalThreshold();
    }

    function state(uint256 proposalId)
        public view override(Governor, GovernorTimelockControl) returns (ProposalState)
    { return super.state(proposalId); }

    function propose(
        address[] memory targets, uint256[] memory values,
        bytes[] memory calldatas, string memory description
    ) public override(Governor, IGovernor) returns (uint256) {
        return super.propose(targets, values, calldatas, description);
    }

    function _execute(
        uint256 proposalId, address[] memory targets, uint256[] memory values,
        bytes[] memory calldatas, bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets, uint256[] memory values,
        bytes[] memory calldatas, bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) {
        return super._executor();
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(Governor, GovernorTimelockControl) returns (bool)
    { return super.supportsInterface(interfaceId); }
}
