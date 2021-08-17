const { logTransaction } = require("./helpers/logger.js");

const Proxy = artifacts.require("TransparentUpgradeableProxy");
const ContractsRegistry = artifacts.require("ContractsRegistry");

const PolicyBookImpl = artifacts.require("PolicyBook");
const PolicyBookAdmin = artifacts.require("PolicyBookAdmin");
const PolicyBookFabric = artifacts.require("PolicyBookFabric");
const PolicyQuote = artifacts.require("PolicyQuote");

module.exports = async (deployer) => {
  const contractsRegistry = await ContractsRegistry.at((await Proxy.deployed()).address);

  await deployer.deploy(PolicyBookFabric);
  const policyBookFabric = await PolicyBookFabric.deployed();

  await deployer.deploy(PolicyBookAdmin);
  const policyBookAdmin = await PolicyBookAdmin.deployed();

  await deployer.deploy(PolicyQuote);
  const policyQuote = await PolicyQuote.deployed();

  await deployer.deploy(PolicyBookImpl); // used in the next migration

  logTransaction(
    await contractsRegistry.addProxyContract(
      await contractsRegistry.POLICY_BOOK_FABRIC_NAME(),
      policyBookFabric.address
    ),
    "AddProxy PolicyBookFabric"
  );
  logTransaction(
    await contractsRegistry.addProxyContract(await contractsRegistry.POLICY_QUOTE_NAME(), policyQuote.address),
    "AddProxy PolicyQuote"
  );
  logTransaction(
    await contractsRegistry.addProxyContract(await contractsRegistry.POLICY_BOOK_ADMIN_NAME(), policyBookAdmin.address),
    "AddProxy PolicyBookAdmin"
  );
};
