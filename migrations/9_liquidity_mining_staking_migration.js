const { logTransaction } = require("./helpers/logger.js");

const Proxy = artifacts.require("TransparentUpgradeableProxy");
const ContractsRegistry = artifacts.require("ContractsRegistry");
const LiquidityMiningStaking = artifacts.require("LiquidityMiningStaking");

// TODO validate finality of data below
const legacyLiquidityMiningStakingAddress = "0xeE4c79dfFB0123e7A04021B2a934b9B34fab52a4";

module.exports = async (deployer) => {
  const contractsRegistry = await ContractsRegistry.at((await Proxy.deployed()).address);

  await deployer.deploy(LiquidityMiningStaking);
  await LiquidityMiningStaking.deployed();

  logTransaction(
    await contractsRegistry.addContract(
      await contractsRegistry.LEGACY_LIQUIDITY_MINING_STAKING_NAME(),
      legacyLiquidityMiningStakingAddress
    ),
    "Add LegacyLiquidityMiningStaking"
  );

  logTransaction(
    await contractsRegistry.addProxyContract(
      await contractsRegistry.LIQUIDITY_MINING_STAKING_NAME(),
      LiquidityMiningStaking.address
    ),
    "AddProxy LiquidityMiningStaking"
  );
};
