const { logTransaction } = require("./helpers/logger.js");

const Proxy = artifacts.require("TransparentUpgradeableProxy");
const ContractsRegistry = artifacts.require("ContractsRegistry");

// TODO validate finality of data below
const proxyAdmin = "0x56fEB55FFD9365D42D0a5321a3a029C4640Bd8DC";

module.exports = async (deployer, network, accounts) => {
  await deployer.deploy(ContractsRegistry);
  const contractsRegistry = await ContractsRegistry.deployed();

  await deployer.deploy(Proxy, contractsRegistry.address, proxyAdmin, []);
  const proxy = await Proxy.deployed();

  logTransaction(
    await (await ContractsRegistry.at(proxy.address)).__ContractsRegistry_init(),
    "Init ContractsRegistry"
  );
};
