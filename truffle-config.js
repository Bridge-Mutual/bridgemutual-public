/* eslint-disable linebreak-style */
/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * truffleframework.com/docs/advanced/configuration
 *
 * To deploy via Infura you'll need a wallet provider (like @truffle/hdwallet-provider)
 * to sign your transactions before they're sent to a remote public node. Infura accounts
 * are available for free at: infura.io/register.
 *
 * You'll also need a mnemonic - the twelve word phrase the wallet uses to generate
 * public/private key pairs. If you're publishing your code to GitHub make sure you load this
 * phrase from a file you've .gitignored so it doesn't accidentally become public.
 *
 */

const HDWalletProvider = require("@truffle/hdwallet-provider");
const dotenv = require("dotenv");
dotenv.config();

module.exports = {
  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */

  networks: {
    development: {
      host: "127.0.0.1", // Localhost (default: none)
      port: 8545, // Standard Ethereum port (default: none)
      network_id: "*", // Any network (default: none)
      gasLimit: 10000000, // <-- Use this high gas value
      gasPrice: 50000000000,
      disableConfirmationListener: true,
    },
    development_websockets: {
      host: "127.0.0.1", // Localhost (default: none)
      port: 8545, // Standard Ethereum port (default: none)
      network_id: "*", // Any network (default: none)
      gasLimit: 10000000, // <-- Use this high gas value
      gasPrice: 50000000000,
      websockets: true,
    },
    rinkeby: {
      provider: () =>
        new HDWalletProvider([process.env.PRIVATE_KEY], `wss://rinkeby.infura.io/ws/v3/${process.env.PROJECT_ID}`),
      network_id: 4, // Rinkeby's id
      gas: 7000000,
      gasPrice: 30000000000, // 30 gwei
      skipDryRun: true, // Skip dry run before migrations? (default: false for public nets )
    },
    ropsten: {
      provider: () =>
        new HDWalletProvider([process.env.PRIVATE_KEY], `wss://ropsten.infura.io/ws/v3/${process.env.PROJECT_ID}`),
      network_id: 3, // Ropsten's id
      gas: 7000000, // Ropsten has a lower block limit than mainnet
      gasPrice: 30000000000, // 30 gwei
      skipDryRun: true, // Skip dry run before migrations? (default: false for public nets )
    },
    mainnet: {
      provider: () =>
        new HDWalletProvider([process.env.PRIVATE_KEY], `wss://mainnet.infura.io/ws/v3/${process.env.PROJECT_ID}`),
      network_id: 1,
      gas: 8000000,
      gasPrice: 50000000000,
      skipDryRun: true,
    },
    bsc_test: {
      provider: () =>
        new HDWalletProvider([process.env.PRIVATE_KEY], "https://data-seed-prebsc-1-s3.binance.org:8545/"),
      network_id: 97,
      gas: 8000000,
      gasPrice: 10000000000,
      timeout: 10000,
    },
    bsc_mainnet: {
      provider: () => new HDWalletProvider([process.env.PRIVATE_KEY], "https://bsc-dataseed.binance.org/"),
      network_id: 56,
      gas: 8000000,
    },
    polygon_testnet: {
      provider: () => new HDWalletProvider([process.env.PRIVATE_KEY], "https://matic-mumbai.chainstacklabs.com"),
      network_id: 80001,
      timeoutBlocks: 200,
      skipDryRun: true,
      disableConfirmationListener: true,
    },
    polygon_mainnet: {
      provider: () =>
        new HDWalletProvider(
          [process.env.PRIVATE_KEY],
          `wss://late-patient-river.matic.quiknode.pro/${process.env.QUICKNODE_PROJECT_ID}/`
        ),
      network_id: 137,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
  },

  // Set default mocha options here, use special reporters etc.
  // mocha: {
  //   color: true,
  //   timeout: 5000000,
  //   reporter: 'eth-gas-reporter',
  //   reporterOptions: {
  //     showTimeSpent: true,
  //     noColors: false,
  //     currency: 'USD',
  //     coinmarketcap: `${process.env.COIN_MARKET_CAP_KEY}`,
  //   },
  // },

  plugins: ["truffle-plugin-verify", "solidity-coverage"],

  api_keys: {
    etherscan: process.env.ETHERSCAN_KEY,
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.7.4", // Fetch exact version from solc-bin (default: truffle's version)
      docker: false, // Use "0.5.1" you've installed locally with docker (default: false)
      settings: {
        // See the solidity docs for advice about optimization and evmVersion
        optimizer: {
          enabled: true,
          runs: 200,
        },
        evmVersion: "istanbul",
      },
    },
  },
};
