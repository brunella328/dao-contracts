// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title WorkToken
 * @notice Utility token pegged 1:1 to USDC. Used for task settlement and agent staking.
 *         Minted when USDC is deposited, burned when redeemed or slashed.
 */
contract WorkToken is ERC20, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    event Minted(address indexed to, uint256 amount);
    event Burned(address indexed from, uint256 amount);
    event Slashed(address indexed agent, uint256 amount, string reason);

    constructor(address admin) ERC20("WORK Token", "WORK") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        _mint(to, amount);
        emit Minted(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) whenNotPaused {
        _burn(from, amount);
        emit Burned(from, amount);
    }

    function slash(address agent, uint256 amount, string calldata reason)
        external
        onlyRole(BURNER_ROLE)
        whenNotPaused
    {
        _burn(agent, amount);
        emit Slashed(agent, amount, reason);
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }
}
