// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./WorkToken.sol";

/**
 * @title WorkBridge
 * @notice USDC ↔ WORK 1:1 bridge with Circuit Breaker protection.
 *         deposit: USDC in → WORK minted (always available)
 *         redeem:  WORK burned → USDC out (paused when reserve < MIN_RESERVE_RATIO)
 */
contract WorkBridge is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    IERC20 public immutable usdc;
    WorkToken public immutable workToken;

    uint256 public minReserveRatioBps = 1000; // 10% in BPS
    bool public redeemPaused;
    uint256 public bridgeMinted; // tracks only WORK minted by this bridge

    event Deposited(address indexed user, uint256 amount);
    event Redeemed(address indexed user, uint256 amount);
    event RedeemPausedChanged(bool paused);
    event MinReserveRatioChanged(uint256 newRatioBps);

    constructor(address usdc_, address workToken_, address admin) {
        usdc = IERC20(usdc_);
        workToken = WorkToken(workToken_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be positive");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        workToken.mint(msg.sender, amount);
        bridgeMinted += amount;
        emit Deposited(msg.sender, amount);
    }

    function redeem(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be positive");
        require(!redeemPaused, "Redemption paused");
        _checkCircuitBreaker(amount);
        workToken.burn(msg.sender, amount);
        bridgeMinted -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit Redeemed(msg.sender, amount);
    }

    function reserveRatioBps() public view returns (uint256) {
        if (bridgeMinted == 0) return type(uint256).max;
        return (usdc.balanceOf(address(this)) * 10000) / bridgeMinted;
    }

    function _checkCircuitBreaker(uint256 redeemAmount) internal view {
        uint256 usdcBalance = usdc.balanceOf(address(this));
        require(usdcBalance >= redeemAmount, "Insufficient USDC in bridge");
        if (bridgeMinted <= redeemAmount) return; // full redemption always allowed
        uint256 mintedAfter = bridgeMinted - redeemAmount;
        uint256 balanceAfter = usdcBalance - redeemAmount;
        require(
            balanceAfter * 10000 / mintedAfter >= minReserveRatioBps,
            "Circuit breaker: reserve ratio too low"
        );
    }

    // Admin can withdraw USDC (e.g. to deploy to yield) — reduces reserve ratio
    function withdrawUSDC(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        usdc.safeTransfer(msg.sender, amount);
    }

    function setMinReserveRatioBps(uint256 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bps <= 10000, "Invalid BPS");
        minReserveRatioBps = bps;
        emit MinReserveRatioChanged(bps);
    }

    function setRedeemPaused(bool paused) external onlyRole(PAUSER_ROLE) {
        redeemPaused = paused;
        emit RedeemPausedChanged(paused);
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
}
