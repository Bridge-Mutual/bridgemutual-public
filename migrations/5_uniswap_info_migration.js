const { logTransaction } = require("./helpers/logger.js");

const Proxy = artifacts.require("TransparentUpgradeableProxy");
const ContractsRegistry = artifacts.require("ContractsRegistry");

const PriceFeed = artifacts.require("PriceFeed");

// TODO validate finality of data below
const uniswapRouterV2Address = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

module.exports = async (deployer) => {
  const contractsRegistry = await ContractsRegistry.at((await Proxy.deployed()).address);

  await deployer.deploy(PriceFeed);
  const priceFeed = await PriceFeed.deployed();

  logTransaction(
    await contractsRegistry.addContract(await contractsRegistry.UNISWAP_ROUTER_NAME(), uniswapRouterV2Address),
    "Add UniswapRouter"
  );

  logTransaction(
    await contractsRegistry.addProxyContract(await contractsRegistry.PRICE_FEED_NAME(), priceFeed.address),
    "AddProxy PriceFeed"
  );
};
