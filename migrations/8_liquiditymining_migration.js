const { logTransaction } = require("./helpers/logger.js");

const Proxy = artifacts.require("TransparentUpgradeableProxy");
const ContractsRegistry = artifacts.require("ContractsRegistry");

const LiquidityMining = artifacts.require("LiquidityMining");
const BMIUtilityNFT = artifacts.require("BMIUtilityNFT");

module.exports = async (deployer) => {
  const contractsRegistry = await ContractsRegistry.at((await Proxy.deployed()).address);

  await deployer.deploy(BMIUtilityNFT);
  const bmiUtilityNFT = await BMIUtilityNFT.deployed();

  await deployer.deploy(LiquidityMining);
  const liquidityMining = await LiquidityMining.deployed();

  logTransaction(
    await contractsRegistry.addProxyContract(await contractsRegistry.BMI_UTILITY_NFT_NAME(), bmiUtilityNFT.address),
    "Add BMIUtilityNFT"
  );
  logTransaction(
    await contractsRegistry.addProxyContract(await contractsRegistry.LIQUIDITY_MINING_NAME(), liquidityMining.address),
    "AddProxy LiquidityMining"
  );
};
