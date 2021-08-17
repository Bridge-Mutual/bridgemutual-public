const { logTransaction } = require("./helpers/logger.js");

const Proxy = artifacts.require("TransparentUpgradeableProxy");
const ContractsRegistry = artifacts.require("ContractsRegistry");
const BMIStaking = artifacts.require("BMIStaking");

// TODO validate finality of data below
const legacyBmiStakingAddress = "0xd4A3a0b872a90FfAd288F624Ea7e162CaAf3DDa3";

module.exports = async (deployer) => {
  const contractsRegistry = await ContractsRegistry.at((await Proxy.deployed()).address);

  await deployer.deploy(BMIStaking);
  const bmiStaking = await BMIStaking.deployed();

  logTransaction(
    await contractsRegistry.addContract(await contractsRegistry.LEGACY_BMI_STAKING_NAME(), legacyBmiStakingAddress),
    "Add LegacyBMIStaking"
  );

  logTransaction(
    await contractsRegistry.addProxyContract(await contractsRegistry.BMI_STAKING_NAME(), bmiStaking.address),
    "AddProxy BMIStaking"
  );
};
