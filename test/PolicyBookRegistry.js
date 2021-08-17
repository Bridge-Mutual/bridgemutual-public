const PolicyBookRegistry = artifacts.require("PolicyBookRegistry");
const PolicyBookFabric = artifacts.require("PolicyBookFabric");
const ContractsRegistry = artifacts.require("ContractsRegistry");
const PolicyBook = artifacts.require("PolicyBook");
const STBLMock = artifacts.require("STBLMock");
const BMICoverStaking = artifacts.require("BMICoverStaking");
const RewardsGenerator = artifacts.require("RewardsGenerator");
const PolicyBookAdmin = artifacts.require("PolicyBookAdmin");
const PolicyQuote = artifacts.require("PolicyQuote");
const ClaimingRegistry = artifacts.require("ClaimingRegistry");
const PolicyRegistry = artifacts.require("PolicyRegistry");
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

contract("PolicyBookRegistry", async (accounts) => {
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  const reverter = new Reverter(web3);

  let policyBookRegistry;
  let stbl;
  let policyBookFabric;

  const NON_FABRIC = accounts[3];
  const NOTHING = accounts[9];

  const initialDeposit = wei("1000");

  before("setup", async () => {
    const contractsRegistry = await ContractsRegistry.new();
    stbl = await STBLMock.new("stbl", "stbl", 6);
    const policyBookImpl = await PolicyBook.new();
    const _bmiCoverStaking = await BMICoverStaking.new();
    const _rewardsGenerator = await RewardsGenerator.new();
    const _policyBookRegistry = await PolicyBookRegistry.new();
    const _policyBookFabric = await PolicyBookFabric.new();
    const _policyBookAdmin = await PolicyBookAdmin.new();
    const _policyQuote = await PolicyQuote.new();
    const _policyRegistry = await PolicyRegistry.new();
    const _claimingRegistry = await ClaimingRegistry.new();
    const _liquidityRegistry = await LiquidityRegistry.new();
    const _liquidityMining = await LiquidityMining.new();

    await contractsRegistry.__ContractsRegistry_init();

    await contractsRegistry.addContract(await contractsRegistry.PRICE_FEED_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.LIQUIDITY_MINING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.CLAIM_VOTING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.REINSURANCE_POOL_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_UTILITY_NFT_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.LEGACY_REWARDS_GENERATOR_NAME(), NOTHING);

    await contractsRegistry.addContract(await contractsRegistry.USDT_NAME(), stbl.address);

    await contractsRegistry.addProxyContract(
      await contractsRegistry.CLAIMING_REGISTRY_NAME(),
      _claimingRegistry.address
    );
    await contractsRegistry.addProxyContract(await contractsRegistry.POLICY_REGISTRY_NAME(), _policyRegistry.address);
    await contractsRegistry.addProxyContract(
      await contractsRegistry.BMI_COVER_STAKING_NAME(),
      _bmiCoverStaking.address
    );
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
    await contractsRegistry.addProxyContract(await contractsRegistry.POLICY_QUOTE_NAME(), _policyQuote.address);
    await contractsRegistry.addProxyContract(
      await contractsRegistry.LIQUIDITY_REGISTRY_NAME(),
      _liquidityRegistry.address
    );
    await contractsRegistry.addProxyContract(await contractsRegistry.LIQUIDITY_MINING_NAME(), _liquidityMining.address);

    const policyBookAdmin = await PolicyBookAdmin.at(await contractsRegistry.getPolicyBookAdminContract());
    const bmiCoverStaking = await BMICoverStaking.at(await contractsRegistry.getBMICoverStakingContract());
    const rewardsGenerator = await RewardsGenerator.at(await contractsRegistry.getRewardsGeneratorContract());
    const claimingRegistry = await ClaimingRegistry.at(await contractsRegistry.getClaimingRegistryContract());
    const liquidityMining = await LiquidityMining.at(await contractsRegistry.getLiquidityMiningContract());
    policyBookFabric = await PolicyBookFabric.at(await contractsRegistry.getPolicyBookFabricContract());
    policyBookRegistry = await PolicyBookRegistry.at(await contractsRegistry.getPolicyBookRegistryContract());

    await policyBookAdmin.__PolicyBookAdmin_init(policyBookImpl.address);
    await bmiCoverStaking.__BMICoverStaking_init();
    await claimingRegistry.__ClaimingRegistry_init();
    await rewardsGenerator.__RewardsGenerator_init();
    await liquidityMining.__LiquidityMining_init();

    await contractsRegistry.injectDependencies(await contractsRegistry.BMI_COVER_STAKING_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_FABRIC_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.REWARDS_GENERATOR_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.CLAIMING_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_MINING_NAME());

    await stbl.approve(policyBookFabric.address, initialDeposit);

    await reverter.snapshot();
  });

  afterEach("revert", reverter.revert);

  describe("add", async () => {
    const CONTRACT = accounts[3];
    const BOOK1 = accounts[4];

    it("should not allow not fabric to add", async () => {
      await truffleAssert.reverts(
        policyBookRegistry.add(CONTRACT, ContractType.CONTRACT, BOOK1, { from: NON_FABRIC }),
        "PolicyBookRegistry: Not a PolicyBookFabric"
      );
    });

    it("should not allow to add duplicate by the same address", async () => {
      await policyBookFabric.create(CONTRACT, ContractType.CONTRACT, "TestBook", "TB", initialDeposit);
      await truffleAssert.reverts(
        policyBookFabric.create(CONTRACT, ContractType.CONTRACT, "TestBook", "TB", initialDeposit),
        "PolicyBookRegistry: PolicyBook for the contract is already created"
      );
    });

    it("should increase count of books", async () => {
      assert.equal(await policyBookRegistry.count(), 0);
      await policyBookFabric.create(CONTRACT, ContractType.CONTRACT, "TestBook", "TB", initialDeposit);
      assert.equal(await policyBookRegistry.count(), 1);
      assert.equal(await policyBookRegistry.countByType(ContractType.CONTRACT), 1);
    });

    it("should save policy book by address", async () => {
      assert.equal(await policyBookRegistry.policyBookFor(CONTRACT), zeroAddress);
      const policyBookAddr = (
        await policyBookFabric.create(CONTRACT, ContractType.CONTRACT, "TestBook", "TB", initialDeposit)
      ).logs[0].args.at;
      assert.equal(await policyBookRegistry.policyBookFor(CONTRACT), policyBookAddr);
    });

    it("should save policy book", async () => {
      assert.deepEqual(await policyBookRegistry.list(0, 10), []);
      const policyBookAddr = (
        await policyBookFabric.create(CONTRACT, ContractType.CONTRACT, "TestBook", "TB", initialDeposit)
      ).logs[0].args.at;
      assert.deepEqual(await policyBookRegistry.list(0, 10), [policyBookAddr]);
      assert.deepEqual(await policyBookRegistry.listByType(ContractType.CONTRACT, 0, 10), [policyBookAddr]);
    });
  });

  describe("buyPolicyBatch", async () => {
    const CONTRACT1 = accounts[3];
    const CONTRACT2 = accounts[4];

    it("should buy policy batch", async () => {
      const policyBookAddr1 = (
        await policyBookFabric.create(CONTRACT1, ContractType.CONTRACT, "TestBook", "TB1", initialDeposit)
      ).logs[0].args.at;

      await stbl.approve(policyBookFabric.address, initialDeposit);

      const policyBookAddr2 = (
        await policyBookFabric.create(CONTRACT2, ContractType.CONTRACT, "TestBook", "TB2", initialDeposit)
      ).logs[0].args.at;

      const policyBook1 = await PolicyBook.at(policyBookAddr1);
      const policyBook2 = await PolicyBook.at(policyBookAddr2);

      await stbl.approve(policyBookAddr1, wei("5000"));
      await stbl.approve(policyBookAddr2, wei("5000"));

      await policyBook1.addLiquidity(wei("1000"));
      await policyBook2.addLiquidity(wei("999"));

      await policyBookRegistry.buyPolicyBatch([policyBookAddr1, policyBookAddr2], [5, 6], [wei("1000"), wei("999")]);

      const info1 = await policyBook1.userStats(accounts[0]);
      const info2 = await policyBook2.userStats(accounts[0]);

      assert.equal(toBN(info1.coverTokens).toString(), toBN(wei("1000")).toString());
      assert.equal(toBN(info2.coverTokens).toString(), toBN(wei("999")).toString());
    });
  });

  describe("listWithStats", async () => {
    const CONTRACT = accounts[3];

    it("should return correct values", async () => {
      await stbl.approve(policyBookFabric.address, toBN(initialDeposit).times(2));

      await policyBookFabric.create(CONTRACT, ContractType.CONTRACT, "TestBook", "TB", toBN(initialDeposit).times(2));
      const result = await policyBookRegistry.listWithStats(0, 1);

      assert.equal(result[0][0], await policyBookRegistry.policyBookFor(CONTRACT));
      assert.equal(result[1][0][0], "bmiTBCover");
      assert.equal(result[1][0][1], CONTRACT);
      assert.equal(result[1][0][2], ContractType.CONTRACT);
      assert.equal(toBN(result[1][0][3]).toString(), toBN(wei("2000")).toString());
      assert.equal(toBN(result[1][0][4]).toString(), toBN(wei("2000")).toString());
      assert.equal(result[1][0][5], 0);
      assert.equal(result[1][0][6], 0);
      assert.equal(toBN(result[1][0][7]).toString(), toBN(wei("15.625")).toString());
      assert.equal(toBN(result[1][0][8]).toString(), toBN(wei("1")).toString());
      assert.equal(result[1][0][9], false);
    });
  });

  describe("listWithStatsByType", async () => {
    const CONTRACT = accounts[3];

    it("should return correct values", async () => {
      await policyBookFabric.create(CONTRACT, ContractType.CONTRACT, "TestBook", "TB", initialDeposit);
      const result = await policyBookRegistry.listWithStatsByType(ContractType.CONTRACT, 0, 1);

      assert.equal(result[0][0], await policyBookRegistry.policyBookFor(CONTRACT));
      assert.equal(result[1][0][0], "bmiTBCover");
      assert.equal(result[1][0][1], CONTRACT);
      assert.equal(result[1][0][2], ContractType.CONTRACT);
      assert.equal(toBN(result[1][0][3]).toString(), toBN(wei("1000")).toString());
      assert.equal(toBN(result[1][0][4]).toString(), toBN(wei("1000")).toString());
      assert.equal(result[1][0][5], 0);
      assert.equal(result[1][0][6], 0);
      assert.equal(toBN(result[1][0][7]).toString(), toBN(wei("100")).toString());
      assert.equal(toBN(result[1][0][8]).toString(), toBN(wei("1")).toString());
      assert.equal(result[1][0][9], false);
    });
  });

  describe("getBooks", async () => {
    const contracts = accounts.slice(3, 6);
    const bookAddresses = [];

    beforeEach("setup", async () => {
      for (let i = 0; i < 3; i++) {
        await stbl.approve(policyBookFabric.address, initialDeposit);

        const policyBookAddr = (
          await policyBookFabric.create(contracts[i], ContractType.CONTRACT, "TestBook", "TB", initialDeposit)
        ).logs[0].args.at;

        bookAddresses.push(policyBookAddr);
      }
    });

    it("should return valid if inside range", async () => {
      const result1 = await policyBookRegistry.list(0, 3);
      const result2 = await policyBookRegistry.listByType(ContractType.CONTRACT, 0, 3);
      const result3 = await policyBookRegistry.listByType(ContractType.STABLECOIN, 0, 3);

      assert.deepEqual(result1, bookAddresses);
      assert.deepEqual(result1, result2);
      assert.deepEqual(result3, []);
    });

    it("should return valid longer than range", async () => {
      const result1 = await policyBookRegistry.list(1, 3);
      const result2 = await policyBookRegistry.listByType(ContractType.CONTRACT, 1, 3);
      const result3 = await policyBookRegistry.listByType(ContractType.STABLECOIN, 1, 3);

      assert.deepEqual(result1, bookAddresses.slice(1, 3));
      assert.deepEqual(result1, result2);
      assert.deepEqual(result3, []);
    });

    it("should return valid longer than range", async () => {
      const result1 = await policyBookRegistry.list(3, 10);
      const result2 = await policyBookRegistry.listByType(ContractType.CONTRACT, 3, 10);
      const result3 = await policyBookRegistry.listByType(ContractType.STABLECOIN, 3, 10);

      assert.deepEqual(result1, []);
      assert.deepEqual(result1, result2);
      assert.deepEqual(result3, []);
    });
  });
});
