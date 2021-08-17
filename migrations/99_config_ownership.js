const { logTransaction } = require("./helpers/logger.js");

const Proxy = artifacts.require("TransparentUpgradeableProxy");
const ContractsRegistry = artifacts.require("ContractsRegistry");

const BMICoverStaking = artifacts.require("BMICoverStaking");
const RewardsGenerator = artifacts.require("RewardsGenerator");

const BMIStaking = artifacts.require("BMIStaking");

const BMIUtilityNFT = artifacts.require("BMIUtilityNFT");
const LiquidityMining = artifacts.require("LiquidityMining");

const LiquidityMiningStaking = artifacts.require("LiquidityMiningStaking");

const ReinsurancePool = artifacts.require("ReinsurancePool");

const PolicyBookAdmin = artifacts.require("PolicyBookAdmin");

// TODO validate finality of data below
const ownerAddress = "0xc97773E1Df2cC54e51a005DFF7cBBb6480aE2767"; // Mike's address

module.exports = async (deployer, network, accounts) => {
  const contractsRegistry = await ContractsRegistry.at((await Proxy.deployed()).address);

  if (["mainnet", "bsc_mainnet", "polygon_mainnet"].includes(network)) {
    const bmiCoverStaking = await BMICoverStaking.at(await contractsRegistry.getBMICoverStakingContract());
    const rewardsGenerator = await RewardsGenerator.at(await contractsRegistry.getRewardsGeneratorContract());

    const bmiStaking = await BMIStaking.at(await contractsRegistry.getBMIStakingContract());

    const bmiUtilityNFT = await BMIUtilityNFT.at(await contractsRegistry.getBMIUtilityNFTContract());
    const liquidityMining = await LiquidityMining.at(await contractsRegistry.getLiquidityMiningContract());

    const liquidityMiningStaking = await LiquidityMiningStaking.at(
      await contractsRegistry.getLiquidityMiningStakingContract()
    );

    const reinsurancePool = await ReinsurancePool.at(await contractsRegistry.getReinsurancePoolContract());

    const policyBookAdmin = await PolicyBookAdmin.at(await contractsRegistry.getPolicyBookAdminContract());

    ////////////////////////////////////////////////////////////

    console.log();

    logTransaction(await bmiCoverStaking.transferOwnership(ownerAddress), "Ownership BMICoverStaking");
    logTransaction(await rewardsGenerator.transferOwnership(ownerAddress), "Ownership RewardsGenerator");

    logTransaction(await bmiStaking.transferOwnership(ownerAddress), "Ownership BMIStaking");

    logTransaction(await bmiUtilityNFT.transferOwnership(ownerAddress), "Ownership BMIUtilityNFT");
    logTransaction(await liquidityMining.transferOwnership(ownerAddress), "Ownership LiquidityMining");

    logTransaction(await liquidityMiningStaking.transferOwnership(ownerAddress), "Ownership LiquidityMiningStaking");

    logTransaction(await reinsurancePool.transferOwnership(ownerAddress), "Ownership ReinsurancePool");

    logTransaction(await policyBookAdmin.transferOwnership(ownerAddress), "Ownership PolicyBookAdmin");

    ////////////////////////////////////////////////////////////

    console.log();

    logTransaction(
      await contractsRegistry.grantRole(await contractsRegistry.REGISTRY_ADMIN_ROLE(), ownerAddress),
      "Granting admin role of ContractsRegistry"
    );

    logTransaction(
      await contractsRegistry.renounceRole(await contractsRegistry.REGISTRY_ADMIN_ROLE(), accounts[0]),
      "Renouncing deployer's admin role of ContractsRegistry"
    );
  }
};
