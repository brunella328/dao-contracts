// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title GenesisLobster
 * @notice First 100 Lobster Agents NFT. Fully on-chain metadata.
 *         Holders receive 5% fee discount in TaskMarket.
 *         Minted by TaskMarket on first successful task completion.
 */
contract GenesisLobster is ERC721, AccessControl {
    using Strings for uint256;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 public constant MAX_SUPPLY = 100;
    uint256 public constant FEE_DISCOUNT_BPS = 500; // 5%

    uint256 public totalMinted;

    struct LobsterData {
        uint256 taskId;
        uint256 mintedAt;
        uint256 serial;
    }

    mapping(uint256 => LobsterData) private _lobsterData;
    mapping(address => bool) private _hasMinted;

    event LobsterMinted(address indexed agent, uint256 indexed tokenId, uint256 indexed taskId);

    constructor(address admin) ERC721("Genesis Lobster", "LOBSTER") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function safeMint(address to, uint256 taskId) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        require(totalMinted < MAX_SUPPLY, "Max supply reached");
        require(!_hasMinted[to], "Agent already has Genesis Lobster");

        totalMinted++;
        tokenId = totalMinted;
        _hasMinted[to] = true;

        _lobsterData[tokenId] = LobsterData({
            taskId: taskId,
            mintedAt: block.timestamp,
            serial: tokenId
        });

        _safeMint(to, tokenId);
        emit LobsterMinted(to, tokenId, taskId);
    }

    function hasDiscount(address agent) external view returns (bool) {
        return balanceOf(agent) > 0;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        LobsterData memory data = _lobsterData[tokenId];

        string memory json = string(abi.encodePacked(
            '{"name":"Genesis Lobster #', data.serial.toString(),
            '","description":"First 100 Lobster Agents of AI Collaboration Community DAO"',
            ',"attributes":[',
            '{"trait_type":"Serial","value":', data.serial.toString(), '},',
            '{"trait_type":"TaskId","value":', data.taskId.toString(), '},',
            '{"trait_type":"MintedAt","value":', data.mintedAt.toString(), '},',
            '{"trait_type":"FeeDiscount","value":"5%"}',
            ']}'
        ));

        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, AccessControl) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
