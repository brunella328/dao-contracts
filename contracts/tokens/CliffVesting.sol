// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/finance/VestingWallet.sol";

/**
 * @title CliffVesting
 * @notice OZ VestingWallet with an initial cliff period.
 *         Tokens cannot be released until cliffEnd is reached.
 *         After cliff, linear vesting continues for the remaining duration.
 *
 *         Example (team, TGE = t0):
 *           cliffDuration  = 365 days  (1 year lock)
 *           vestingDuration = 3 * 365 days (3 year linear after cliff)
 *           total lock = 4 years
 */
contract CliffVesting is VestingWallet {
    uint64 public immutable cliffEnd;

    constructor(
        address beneficiary,
        uint64 startTimestamp,
        uint64 cliffDuration,
        uint64 vestingDuration
    )
        VestingWallet(beneficiary, startTimestamp + cliffDuration, vestingDuration)
    {
        cliffEnd = startTimestamp + cliffDuration;
    }

    function release(address token) public override {
        require(block.timestamp >= cliffEnd, "Cliff not reached");
        super.release(token);
    }

    function release() public override {
        require(block.timestamp >= cliffEnd, "Cliff not reached");
        super.release();
    }
}
