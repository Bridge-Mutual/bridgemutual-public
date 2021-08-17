const { logTransaction } = require("./helpers/logger.js");

const Proxy = artifacts.require("TransparentUpgradeableProxy");
const ContractsRegistry = artifacts.require("ContractsRegistry");

const PolicyBookRegistry = artifacts.require("PolicyBookRegistry");
const PolicyRegistry = artifacts.require("PolicyRegistry");
const ClaimingRegistry = artifacts.require("ClaimingRegistry");
const LiquidityRegistry = artifacts.require("LiquidityRegistry");

module.exports = async (deployer) => {
  const contractsRegistry = await ContractsRegistry.at((await Proxy.deployed()).address);

  await deployer.deploy(PolicyBookRegistry);
  const policyBookRegistry = await PolicyBookRegistry.deployed();

  await deployer.deploy(PolicyRegistry);
  const policyRegistry = await PolicyRegistry.deployed();

  await deployer.deploy(ClaimingRegistry);
  const claimingRegistry = await ClaimingRegistry.deployed();

  await deployer.deploy(LiquidityRegistry);
  const liquidityRegistry = await LiquidityRegistry.deployed();

  logTransaction(
    await contractsRegistry.addProxyContract(
      await contractsRegistry.POLICY_BOOK_REGISTRY_NAME(),
      policyBookRegistry.address
    ),
    "AddProxy PolicyBookRegistry"
  );
  logTransaction(
    await contractsRegistry.addProxyContract(await contractsRegistry.POLICY_REGISTRY_NAME(), policyRegistry.address),
    "AddProxy PolicyRegistry"
  );
  logTransaction(
    await contractsRegistry.addProxyContract(
      await contractsRegistry.CLAIMING_REGISTRY_NAME(),
      claimingRegistry.address
    ),
    "AddProxy ClaimingRegistry"
  );
  logTransaction(
    await contractsRegistry.addProxyContract(
      await contractsRegistry.LIQUIDITY_REGISTRY_NAME(),
      liquidityRegistry.address
    ),
    "AddProxy LiquidityRegistry"
  );
};
