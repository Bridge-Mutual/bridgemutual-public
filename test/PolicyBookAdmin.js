const PolicyBookRegistry = artifacts.require("PolicyBookRegistry");
const PolicyBookFabric = artifacts.require("PolicyBookFabric");
const ContractsRegistry = artifacts.require("ContractsRegistry");
const PolicyBook = artifacts.require("PolicyBook");
const PolicyBookMock = artifacts.require("PolicyBookMock");
const STBLMock = artifacts.require("STBLMock");
const PolicyBookAdmin = artifacts.require("PolicyBookAdmin");
const RewardsGenerator = artifacts.require("RewardsGenerator");
const LiquidityRegistry = artifacts.require("LiquidityRegistry");
const LiquidityMining = artifacts.require("LiquidityMining");

const Reverter = require("./helpers/reverter");
const BigNumber = require("bignumber.js");
const truffleAssert = require("truffle-assertions");
const { assert } = require("chai");

const ContractType = {
  CONTRACT: 0,
  STABLECOIN: 1,
  SERVICE: 2,
  EXCHANGE: 3,
};

function toBN(number) {
  return new BigNumber(number);
}

const wei = web3.utils.toWei;

contract("PolicyBookAdmin", async (accounts) => {
  const reverter = new Reverter(web3);

  let policyBookRegistry;
  let stbl;
  let policyBookFabric;
  let policyBookAdmin;

  const USER1 = accounts[1];
  const NOTHING = accounts[3];
  const insuranceContract = accounts[5];

  before("setup", async () => {
    const contractsRegistry = await ContractsRegistry.new();
    stbl = await STBLMock.new("stbl", "stbl", 6);
    const policyBookImpl = await PolicyBook.new();
    const _policyBookRegistry = await PolicyBookRegistry.new();
    const _policyBookFabric = await PolicyBookFabric.new();
    const _policyBookAdmin = await PolicyBookAdmin.new();
    const _rewardsGenerator = await RewardsGenerator.new();
    const _liquidityRegistry = await LiquidityRegistry.new();
    const _liquidityMining = await LiquidityMining.new();

    await contractsRegistry.__ContractsRegistry_init();

    await contractsRegistry.addContract(await contractsRegistry.PRICE_FEED_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_COVER_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.POLICY_REGISTRY_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.CLAIMING_REGISTRY_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_UTILITY_NFT_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.CLAIM_VOTING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.REINSURANCE_POOL_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.POLICY_QUOTE_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.LEGACY_REWARDS_GENERATOR_NAME(), NOTHING);

    await contractsRegistry.addContract(await contractsRegistry.USDT_NAME(), stbl.address);

    await contractsRegistry.addProxyContract(
      await contractsRegistry.REWARDS_GENERATOR_NAME(),
      _rewardsGenerator.address
    );
    await contractsRegistry.addProxyContract(
      await contractsRegistry.POLICY_BOOK_REGISTRY_NAME(),
      _policyBookRegistry.address
    );
    await contractsRegistry.addProxyContract(
      await contractsRegistry.POLICY_BOOK_FABRIC_NAME(),
      _policyBookFabric.address
    );
    await contractsRegistry.addProxyContract(
      await contractsRegistry.POLICY_BOOK_ADMIN_NAME(),
      _policyBookAdmin.address
    );
    await contractsRegistry.addContract(await contractsRegistry.LIQUIDITY_REGISTRY_NAME(), _liquidityRegistry.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.LIQUIDITY_MINING_NAME(), _liquidityMining.address);

    policyBookFabric = await PolicyBookFabric.at(await contractsRegistry.getPolicyBookFabricContract());
    policyBookRegistry = await PolicyBookRegistry.at(await contractsRegistry.getPolicyBookRegistryContract());
    policyBookAdmin = await PolicyBookAdmin.at(await contractsRegistry.getPolicyBookAdminContract());
    const rewardsGenerator = await RewardsGenerator.at(await contractsRegistry.getRewardsGeneratorContract());
    const liquidityMining = await LiquidityMining.at(await contractsRegistry.getLiquidityMiningContract());

    await policyBookAdmin.__PolicyBookAdmin_init(policyBookImpl.address);
    await rewardsGenerator.__RewardsGenerator_init();
    await liquidityMining.__LiquidityMining_init();

    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.REWARDS_GENERATOR_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_FABRIC_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_ADMIN_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_MINING_NAME());

    await reverter.snapshot();
  });

  afterEach("revert", reverter.revert);

  describe("upgradePolicies", async () => {
    const stblAmount = toBN(wei("100000", "mwei"));
    const amount = toBN(wei("1000"));
    let policyBook;

    beforeEach("setup", async () => {
      const initialDeposit = wei("1000");

      await stbl.approve(policyBookFabric.address, initialDeposit);

      await policyBookFabric.create(insuranceContract, ContractType.CONTRACT, "TestBook", "TB", initialDeposit);
      policyBook = await PolicyBook.at(await policyBookRegistry.policyBookFor(insuranceContract));

      await stbl.transfer(USER1, stblAmount);
      await stbl.approve(policyBook.address, stblAmount, { from: USER1 });

      await policyBook.addLiquidity(amount, { from: USER1 });

      assert.equal(toBN(await policyBook.totalLiquidity()).toString(), amount.plus(wei("1000")).toString());
      assert.equal(toBN(await policyBook.balanceOf(USER1)).toString(), amount.toString());
    });

    it("should correctly upgrade implementation", async () => {
      const secondImpl = await PolicyBookMock.new();

      await policyBookAdmin.upgradePolicyBooks(secondImpl.address, 0, await policyBookRegistry.count());

      assert.equal(
        policyBook.address,
        (await PolicyBook.at(await policyBookRegistry.policyBookFor(insuranceContract))).address
      );

      policyBook = await PolicyBookMock.at(policyBook.address);

      await policyBook.setTotalLiquidity(stblAmount);
      assert.equal(toBN(await policyBook.totalLiquidity()).toString(), stblAmount.toString());

      assert.equal(await policyBookAdmin.getImplementationOfPolicyBook.call(policyBook.address), secondImpl.address);
      assert.equal(await policyBookAdmin.getCurrentPolicyBooksImplementation(), secondImpl.address);
    });

    it("should upgrade and call correctly", async () => {
      const secondImpl = await PolicyBookMock.new();

      await policyBookAdmin.upgradePolicyBooksAndCall(
        secondImpl.address,
        0,
        await policyBookRegistry.count(),
        "callOnUpgrade()"
      );

      policyBook = await PolicyBookMock.at(policyBook.address);

      assert.equal(toBN(await policyBook.dummy()).toString(), "1337");
    });

    it("should get exception, trying to set invalid contract address", async () => {
      await truffleAssert.reverts(
        policyBookAdmin.upgradePolicyBooks(NOTHING, 0, await policyBookRegistry.count()),
        "PolicyBookAdmin: Invalid address"
      );
    });

    it("should get exception, trying to call new methods without upgrade", async () => {
      policyBook = await PolicyBookMock.at(policyBook.address);

      await truffleAssert.reverts(policyBook.setTotalLiquidity(stblAmount));
    });
  });

  describe("whitelist", async () => {
    const initialDeposit = wei("1000");

    let policyBook;

    beforeEach("setup", async () => {
      await stbl.approve(policyBookFabric.address, initialDeposit);
    });

    it("should whitelist", async () => {
      await policyBookFabric.create(insuranceContract, ContractType.CONTRACT, "TestBook", "TB", initialDeposit);
      policyBook = await PolicyBook.at(await policyBookRegistry.policyBookFor(insuranceContract));

      assert.equal(await policyBook.whitelisted(), false);

      await policyBookAdmin.whitelist(policyBook.address, true);

      assert.equal(await policyBook.whitelisted(), true);

      let res = await policyBookRegistry.listWhitelisted(0, await policyBookRegistry.countWhitelisted());

      assert.equal(res.length, 1);
      assert.equal(res[0], policyBook.address);

      res = await policyBookRegistry.listByTypeWhitelisted(
        ContractType.CONTRACT,
        0,
        await policyBookRegistry.countByTypeWhitelisted(ContractType.CONTRACT)
      );

      assert.equal(res.length, 1);
      assert.equal(res[0], policyBook.address);
    });

    it("should whitelist and then blacklist", async () => {
      await policyBookFabric.create(insuranceContract, ContractType.CONTRACT, "TestBook", "TB", initialDeposit);
      policyBook = await PolicyBook.at(await policyBookRegistry.policyBookFor(insuranceContract));

      await policyBookAdmin.whitelist(policyBook.address, true);
      await policyBookAdmin.whitelist(policyBook.address, false);

      assert.equal(await policyBook.whitelisted(), false);

      let res = await policyBookRegistry.listWhitelisted(0, await policyBookRegistry.countWhitelisted());

      assert.equal(res.length, 0);

      res = await policyBookRegistry.listByTypeWhitelisted(
        ContractType.CONTRACT,
        0,
        await policyBookRegistry.countByTypeWhitelisted(ContractType.CONTRACT)
      );

      assert.equal(res.length, 0);
    });

    it("should whitelist batch", async () => {
      await policyBookFabric.create(insuranceContract, ContractType.CONTRACT, "TestBook", "TB", initialDeposit);
      policyBook = await PolicyBook.at(await policyBookRegistry.policyBookFor(insuranceContract));

      assert.equal(await policyBook.whitelisted(), false);

      await policyBookAdmin.whitelistBatch([policyBook.address], [true]);

      assert.equal(await policyBook.whitelisted(), true);
    });

    it("should emit a WhitelistedContact event", async () => {
      await policyBookFabric.create(insuranceContract, ContractType.CONTRACT, "TestBook", "TB", initialDeposit);
      policyBook = await PolicyBook.at(await policyBookRegistry.policyBookFor(insuranceContract));

      assert.equal(await policyBook.whitelisted(), false);

      const result = await policyBookAdmin.whitelist(policyBook.address, true);

      assert.equal(await policyBook.whitelisted(), true);

      assert.equal(result.logs[0].event, "PolicyBookWhitelisted");
      assert.equal(result.logs[0].args[0], policyBook.address);
      assert.equal(result.logs[0].args[1], true);
    });
  });
});
