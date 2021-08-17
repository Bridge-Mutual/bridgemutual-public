const PolicyBookFabric = artifacts.require("PolicyBookFabric");
const PolicyBook = artifacts.require("PolicyBook");
const PolicyBookRegistry = artifacts.require("PolicyBookRegistry");
const STBLMock = artifacts.require("STBLMock");
const ContractsRegistry = artifacts.require("ContractsRegistry");
const PolicyBookAdmin = artifacts.require("PolicyBookAdmin");
const LiquidityRegistry = artifacts.require("LiquidityRegistry");
const BMICoverStaking = artifacts.require("BMICoverStaking");
const LiquidityMiningMock = artifacts.require("LiquidityMiningMock");
const RewardsGenerator = artifacts.require("RewardsGenerator");

const Reverter = require("./helpers/reverter");
const setCurrentTime = require("./helpers/ganacheTimeTraveler");
const truffleAssert = require("truffle-assertions");
const BigNumber = require("bignumber.js");
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

contract("PolicyBookFabric", async (accounts) => {
  const reverter = new Reverter(web3);

  let policyBookRegistry;
  let policyBookFabric;
  let stbl;
  let liquidityMiningMock;

  const CONTRACT1 = accounts[0];
  const CONTRACT2 = accounts[1];
  const CONTRACT3 = accounts[2];

  const NOTHING = accounts[9];

  const LIQUIDITY_MINING_DURATION = toBN(60 * 60 * 24 * 7 * 2); // 2 weeks

  before("setup", async () => {
    const contractsRegistry = await ContractsRegistry.new();
    const policyBookImpl = await PolicyBook.new();
    stbl = await STBLMock.new("stbl", "stbl", 6);
    const _policyBookRegistry = await PolicyBookRegistry.new();
    const _policyBookFabric = await PolicyBookFabric.new();
    const _policyBookAdmin = await PolicyBookAdmin.new();
    const _liquidityRegistry = await LiquidityRegistry.new();
    const _bmiCoverStaking = await BMICoverStaking.new();
    const _liquidityMiningMock = await LiquidityMiningMock.new();
    const _rewardsGenerator = await RewardsGenerator.new();

    await contractsRegistry.__ContractsRegistry_init();

    await contractsRegistry.addContract(await contractsRegistry.PRICE_FEED_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.POLICY_REGISTRY_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.CLAIM_VOTING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.REINSURANCE_POOL_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.CLAIMING_REGISTRY_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.POLICY_QUOTE_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_UTILITY_NFT_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.LEGACY_REWARDS_GENERATOR_NAME(), NOTHING);

    await contractsRegistry.addContract(await contractsRegistry.USDT_NAME(), stbl.address);

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
    await contractsRegistry.addProxyContract(
      await contractsRegistry.LIQUIDITY_REGISTRY_NAME(),
      _liquidityRegistry.address
    );
    await contractsRegistry.addProxyContract(
      await contractsRegistry.BMI_COVER_STAKING_NAME(),
      _bmiCoverStaking.address
    );
    await contractsRegistry.addProxyContract(
      await contractsRegistry.LIQUIDITY_MINING_NAME(),
      _liquidityMiningMock.address
    );
    await contractsRegistry.addProxyContract(
      await contractsRegistry.REWARDS_GENERATOR_NAME(),
      _rewardsGenerator.address
    );

    policyBookFabric = await PolicyBookFabric.at(await contractsRegistry.getPolicyBookFabricContract());
    policyBookRegistry = await PolicyBookRegistry.at(await contractsRegistry.getPolicyBookRegistryContract());
    liquidityMiningMock = await LiquidityMiningMock.at(await contractsRegistry.getLiquidityMiningContract());
    const policyBookAdmin = await PolicyBookAdmin.at(await contractsRegistry.getPolicyBookAdminContract());
    const bmiCoverStaking = await BMICoverStaking.at(await contractsRegistry.getBMICoverStakingContract());
    const rewardsGenerator = await RewardsGenerator.at(await contractsRegistry.getRewardsGeneratorContract());

    await policyBookAdmin.__PolicyBookAdmin_init(policyBookImpl.address);
    await bmiCoverStaking.__BMICoverStaking_init();
    await liquidityMiningMock.__LiquidityMining_init();
    await rewardsGenerator.__RewardsGenerator_init();

    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_FABRIC_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_ADMIN_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.BMI_COVER_STAKING_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_MINING_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.REWARDS_GENERATOR_NAME());

    await reverter.snapshot();
  });

  afterEach("revert", reverter.revert);

  describe("create", async () => {
    const initialDeposit = wei("1000");

    beforeEach("setup", async () => {
      await setCurrentTime(1);

      await liquidityMiningMock.startLiquidityMining();

      await setCurrentTime(LIQUIDITY_MINING_DURATION.plus(100));

      await stbl.approve(policyBookFabric.address, initialDeposit);
    });

    it("should instantiate contract at saved address", async () => {
      await policyBookFabric.create(CONTRACT1, ContractType.STABLECOIN, "Test description", "TEST", initialDeposit);
      const address = await policyBookRegistry.policyBookFor(CONTRACT1);
      const book = await PolicyBook.at(address);

      assert.equal(await book.insuranceContractAddress(), CONTRACT1);
      assert.equal(await book.contractType(), ContractType.STABLECOIN);
      assert.equal(await book.name(), "Test description");
      assert.equal(await book.symbol(), "bmiTESTCover");
    });

    it("should emit created event", async () => {
      const result = await policyBookFabric.create(
        CONTRACT1,
        ContractType.STABLECOIN,
        "placeholder",
        "placeholder",
        initialDeposit
      );
      const address = await policyBookRegistry.policyBookFor(CONTRACT1);

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, "Created");
      assert.equal(result.logs[0].args.insured, CONTRACT1);
      assert.equal(result.logs[0].args.contractType, ContractType.STABLECOIN);
      assert.equal(result.logs[0].args.at, address);
    });

    it("should not allow to create dublicate by the same address", async () => {
      await policyBookFabric.create(CONTRACT1, ContractType.STABLECOIN, "placeholder", "placeholder", initialDeposit);
      await truffleAssert.reverts(
        policyBookFabric.create(CONTRACT1, ContractType.STABLECOIN, "placeholder", "placeholder", initialDeposit),
        "PolicyBook for the contract is already created"
      );
    });

    it("should add policy to registry", async () => {
      const result = await policyBookFabric.create(CONTRACT1, 1, "placeholder", "placeholder", initialDeposit);
      const bookAddress = result.logs[0].args.at;

      assert.equal(await policyBookRegistry.policyBookFor(CONTRACT1), bookAddress);
    });

    it("should increase count of books", async () => {
      assert.equal(await policyBookRegistry.count(), 0);

      await policyBookFabric.create(CONTRACT1, ContractType.STABLECOIN, "placeholder", "placeholder", initialDeposit);

      assert.equal(await policyBookRegistry.count(), 1);
    });

    it("should not allow to create with initial liquidity < 1000 STBL", async () => {
      await truffleAssert.reverts(
        policyBookFabric.create(CONTRACT1, ContractType.STABLECOIN, "placeholder", "placeholder", wei("10")),
        "PBF: Too small deposit"
      );
    });

    it("should create with initial liquidity = 9999 STBL", async () => {
      await stbl.approve(policyBookFabric.address, wei("9999"));

      const result = await policyBookFabric.create(
        CONTRACT1,
        ContractType.STABLECOIN,
        "placeholder",
        "placeholder",
        wei("9999")
      );
      const policyBook = await PolicyBook.at(result.logs[0].args.at);

      assert.equal(toBN(await policyBook.totalLiquidity()).toString(), toBN(wei("9999")).toString());
    });

    it("should get exception, Project description is too long", async () => {
      const longDesc = "a".repeat(201);
      const reason = "PBF: Project description is too long";

      await truffleAssert.reverts(
        policyBookFabric.create(CONTRACT1, 1, longDesc, "placeholder", initialDeposit),
        reason
      );
    });

    it("should allow to create with Project descriptions within length", async () => {
      const shortDesc = "";
      const maxLenghtDesc = "a".repeat(200);

      const reason = "PBF: Project description is too long";

      await truffleAssert.passes(
        policyBookFabric.create(CONTRACT1, 1, shortDesc, "placeholder", initialDeposit),
        reason
      );
      await stbl.approve(policyBookFabric.address, initialDeposit);
      await truffleAssert.passes(
        policyBookFabric.create(CONTRACT2, 1, maxLenghtDesc, "placeholder", initialDeposit),
        reason
      );
    });

    it("should get exception, Project Symbol is too long, or short", async () => {
      const shortSymbol = "";
      const maxLenghtSymbol = "a".repeat(30);
      const longSymbol = "a".repeat(31);

      const reason = "PBF: Project symbol is too long/short";
      await truffleAssert.reverts(
        policyBookFabric.create(CONTRACT1, 1, "placeholder", shortSymbol, initialDeposit),
        reason
      );
      await truffleAssert.reverts(
        policyBookFabric.create(CONTRACT1, 1, "placeholder", longSymbol, initialDeposit),
        reason
      );
      await truffleAssert.passes(
        policyBookFabric.create(CONTRACT1, 1, "placeholder", maxLenghtSymbol, initialDeposit),
        reason
      );
    });
  });

  describe("create with LME", async () => {
    it("should create PolicyBook before LME for free", async () => {
      await truffleAssert.passes(
        policyBookFabric.create(CONTRACT1, 1, "placeholder", "placeholder", 0),
        "Should create with 0 deposit when LME has not started"
      );
    });

    it("should fail to create during LME", async () => {
      await setCurrentTime(1);

      await liquidityMiningMock.startLiquidityMining();

      await stbl.approve(policyBookFabric.address, wei("1000"));

      await truffleAssert.reverts(
        policyBookFabric.create(CONTRACT1, ContractType.STABLECOIN, "", "placeholder", wei("1000")),
        "PBF: Creation is blocked during LME"
      );
    });

    it("should create after LME", async () => {
      await setCurrentTime(1);

      await liquidityMiningMock.startLiquidityMining();

      await setCurrentTime(LIQUIDITY_MINING_DURATION.plus(100));

      await stbl.approve(policyBookFabric.address, wei("1000"));

      await policyBookFabric.create(CONTRACT1, ContractType.STABLECOIN, "", "placeholder", wei("1000"));
    });
  });

  describe("getBooks", async () => {
    let bookAddrArr;

    beforeEach("setup", async () => {
      const initialDeposit = wei("1000");

      await stbl.approve(policyBookFabric.address, toBN(initialDeposit).times(3));

      await setCurrentTime(1);

      await liquidityMiningMock.startLiquidityMining();

      await setCurrentTime(LIQUIDITY_MINING_DURATION.plus(100));

      const book1 = await policyBookFabric.create(
        CONTRACT1,
        ContractType.SERVICE,
        "placeholder",
        "placeholder",
        initialDeposit
      );
      const book2 = await policyBookFabric.create(
        CONTRACT2,
        ContractType.STABLECOIN,
        "placeholder",
        "placeholder",
        initialDeposit
      );
      const book3 = await policyBookFabric.create(
        CONTRACT3,
        ContractType.CONTRACT,
        "placeholder",
        "placeholder",
        initialDeposit
      );

      assert.equal(await policyBookRegistry.count(), 3);
      bookAddrArr = [book1.logs[0].args.at, book2.logs[0].args.at, book3.logs[0].args.at];
    });

    it("should return valid if inside range", async () => {
      const result = await policyBookRegistry.list(0, 3);
      assert.deepEqual(result, bookAddrArr);
    });

    it("should return valid longer than range", async () => {
      const result = await policyBookRegistry.list(1, 3);
      assert.deepEqual(result, bookAddrArr.slice(1, 3));
    });

    it("should return valid outside of range", async () => {
      const result = await policyBookRegistry.list(3, 10);
      assert.deepEqual(result, []);
    });
  });
});
