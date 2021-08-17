const { logTransaction } = require("./helpers/logger.js");

const Proxy = artifacts.require("TransparentUpgradeableProxy");
const ContractsRegistry = artifacts.require("ContractsRegistry");

const ClaimVoting = artifacts.require("ClaimVoting");
const ReputationSystem = artifacts.require("ReputationSystem");
const ReinsurancePool = artifacts.require("ReinsurancePool");
const VBMI = artifacts.require("VBMI");

module.exports = async (deployer) => {
  const contractsRegistry = await ContractsRegistry.at((await Proxy.deployed()).address);

  await deployer.deploy(ClaimVoting);
  const claimVoting = await ClaimVoting.deployed();

  await deployer.deploy(ReputationSystem);
  const reputationSystem = await ReputationSystem.deployed();

  await deployer.deploy(ReinsurancePool);
  const reinsurancePool = await ReinsurancePool.deployed();

  await deployer.deploy(VBMI);
  const vBMIToken = await VBMI.deployed();

  logTransaction(
    await contractsRegistry.addProxyContract(await contractsRegistry.CLAIM_VOTING_NAME(), claimVoting.address),
    "AddProxy ClaimVoting"
  );
  logTransaction(
    await contractsRegistry.addProxyContract(
      await contractsRegistry.REPUTATION_SYSTEM_NAME(),
      reputationSystem.address
    ),
    "AddProxy ReputationSystem"
  );
  logTransaction(
    await contractsRegistry.addProxyContract(await contractsRegistry.REINSURANCE_POOL_NAME(), reinsurancePool.address),
    "AddProxy ReinsurancePool"
  );
  logTransaction(
    await contractsRegistry.addProxyContract(await contractsRegistry.VBMI_NAME(), vBMIToken.address),
    "AddProxy VBMI"
  );
};
