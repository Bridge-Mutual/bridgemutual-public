const { logTransaction } = require("./helpers/logger.js");

const Proxy = artifacts.require("TransparentUpgradeableProxy");
const ContractsRegistry = artifacts.require("ContractsRegistry");

const BMICoverStaking = artifacts.require("BMICoverStaking");
const RewardsGenerator = artifacts.require("RewardsGenerator");

// TODO validate finality of data below
const legacyRewardsGeneratorAddress = "0xf491ec77eba69e0eae9cb23db3557f8706c0f40d";

module.exports = async (deployer) => {
  const contractsRegistry = await ContractsRegistry.at((await Proxy.deployed()).address);

  await deployer.deploy(BMICoverStaking);
  const bmiCoverStaking = await BMICoverStaking.deployed();

  await deployer.deploy(RewardsGenerator);
  const rewardsGenerator = await RewardsGenerator.deployed();

  logTransaction(
    await contractsRegistry.addContract(
      await contractsRegistry.LEGACY_REWARDS_GENERATOR_NAME(),
      legacyRewardsGeneratorAddress
    ),
    "Add LegacyRewardsGenerator"
  );

  logTransaction(
    await contractsRegistry.addProxyContract(await contractsRegistry.BMI_COVER_STAKING_NAME(), bmiCoverStaking.address),
    "AddProxy BMICoverStaking"
  );
  logTransaction(
    await contractsRegistry.addProxyContract(
      await contractsRegistry.REWARDS_GENERATOR_NAME(),
      rewardsGenerator.address
    ),
    "AddProxy RewardsGenerator"
  );
};
