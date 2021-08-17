const { logTransaction } = require("./helpers/logger.js");

const Proxy = artifacts.require("TransparentUpgradeableProxy");
const ContractsRegistry = artifacts.require("ContractsRegistry");

const STKBMIToken = artifacts.require("STKBMIToken");

// TODO validate finality of data below
const bmiAddress = "0x725c263e32c72ddc3a19bea12c5a0479a81ee688";
const usdtAddress = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const wethAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const bmiToEthUniswapPairAddress = "0xa9bd7eef0c7affbdbdae92105712e9ff8b06ed49";

module.exports = async (deployer, network, accounts) => {
  const contractsRegistry = await ContractsRegistry.at((await Proxy.deployed()).address);

  await deployer.deploy(STKBMIToken);
  const stkBMIToken = await STKBMIToken.deployed();

  logTransaction(await contractsRegistry.addContract(await contractsRegistry.WETH_NAME(), wethAddress), "Add WETH");
  logTransaction(await contractsRegistry.addContract(await contractsRegistry.USDT_NAME(), usdtAddress), "Add USDT");
  logTransaction(await contractsRegistry.addContract(await contractsRegistry.BMI_NAME(), bmiAddress), "Add BMI");
  logTransaction(
    await contractsRegistry.addContract(
      await contractsRegistry.UNISWAP_BMI_TO_ETH_PAIR_NAME(),
      bmiToEthUniswapPairAddress
    ),
    "Add UniswapBMIToETHPair"
  );

  logTransaction(
    await contractsRegistry.addProxyContract(await contractsRegistry.STKBMI_NAME(), stkBMIToken.address),
    "AddProxy STKBMI"
  );
};
