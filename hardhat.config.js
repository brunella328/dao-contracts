require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-network-helpers");
require("dotenv").config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x" + "0".repeat(64);

module.exports = {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    hardhat: {},
    qanTestnet: {
      url: process.env.QAN_TESTNET_RPC || "https://rpc-testnet.qanplatform.com/",
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
    qanMainnet: {
      // chainId: TBD — update when QANplatform announces MainNet chainId
      url: process.env.QAN_MAINNET_RPC || "https://rpc.qanplatform.com/",
      accounts: [DEPLOYER_PRIVATE_KEY],
      gasPrice: "auto",
    },
  },
  etherscan: {
    // QAN Explorer API key (if supported) — update when available
    apiKey: {
      qanTestnet: process.env.QAN_EXPLORER_API_KEY || "",
      qanMainnet: process.env.QAN_EXPLORER_API_KEY || "",
    },
    customChains: [
      {
        network: "qanTestnet",
        chainId: 78887, // QAN TestNet chainId
        urls: {
          apiURL: "https://explorer-testnet.qanplatform.com/api",
          browserURL: "https://explorer-testnet.qanplatform.com",
        },
      },
      {
        network: "qanMainnet",
        chainId: 0, // TBD — update when announced
        urls: {
          apiURL: "https://explorer.qanplatform.com/api",
          browserURL: "https://explorer.qanplatform.com",
        },
      },
    ],
  },
};
