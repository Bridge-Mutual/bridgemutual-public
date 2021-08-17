const PolicyBookMock = artifacts.require("PolicyBookMock");
const PolicyQuoteMock = artifacts.require("PolicyQuoteMock");
const PolicyBookFabric = artifacts.require("PolicyBookFabric");
const STBLMock = artifacts.require("STBLMock");
const BMIMock = artifacts.require("BMIMock");
const WETHMock = artifacts.require("WETHMock");
const UniswapRouterMock = artifacts.require("UniswapRouterMock");
const PriceFeed = artifacts.require("PriceFeed");
const ContractsRegistry = artifacts.require("ContractsRegistry");
const LiquidityMining = artifacts.require("LiquidityMining");
const PolicyRegistry = artifacts.require("PolicyRegistry");
const ClaimingRegistry = artifacts.require("ClaimingRegistry");
const PolicyBookRegistry = artifacts.require("PolicyBookRegistry");
const PolicyBookAdmin = artifacts.require("PolicyBookAdmin");
const RewardsGenerator = artifacts.require("RewardsGenerator");
const LiquidityRegistry = artifacts.require("LiquidityRegistry");

const Reverter = require("./helpers/reverter");
const setCurrentTime = require("./helpers/ganacheTimeTraveler");
const { assert } = require("chai");

const ContractType = {
  CONTRACT: 0,
  STABLECOIN: 1,
  SERVICE: 2,
  EXCHANGE: 3,
};

const BN = web3.utils.BN;
const wei = web3.utils.toWei;

function toBN(value) {
  if (typeof value === "number") value = value.toString();
  return new BN(value);
}

function toWeiBN(value) {
  if (typeof value === "number") value = value.toString();
  return new BN(wei(value));
}

function toMWeiBN(value) {
  if (typeof value === "number") value = value.toString();
  return new BN(wei(value, "mwei"));
}

const secondsInADay = 60 * 60 * 24;
const nonProtocolMultiplier = 0.8;

contract("PolicyBookPremiumDistribution", async (accounts) => {
  const reverter = new Reverter(web3);

  let policyBook;
  let stbl;
  let policyQuote;

  const insuranceContract = accounts[0];
  const USER1 = accounts[1];
  const USER2 = accounts[2];
  const USER3 = accounts[3];
  const NOTHING = accounts[9];

  const liquidityAmount = toWeiBN("300000");

  before("setup", async () => {
    const contractsRegistry = await ContractsRegistry.new();
    const policyBookImpl = await PolicyBookMock.new();
    const weth = await WETHMock.new("weth", "weth");
    const uniswapRouterMock = await UniswapRouterMock.new();
    const bmi = await BMIMock.new(USER1);
    stbl = await STBLMock.new("stbl", "stbl", 6);
    const _policyBookAdmin = await PolicyBookAdmin.new();
    const _priceFeed = await PriceFeed.new();
    const _policyBookRegistry = await PolicyBookRegistry.new();
    const _policyBookFabric = await PolicyBookFabric.new();
    const _rewardsGenerator = await RewardsGenerator.new();
    const _policyQuote = await PolicyQuoteMock.new();
    const _policyRegistry = await PolicyRegistry.new();
    const _liquidityMining = await LiquidityMining.new();
    const _claimingRegistry = await ClaimingRegistry.new();
    const _liquidityRegistry = await LiquidityRegistry.new();

    await contractsRegistry.__ContractsRegistry_init();

    await contractsRegistry.addContract(await contractsRegistry.BMI_UTILITY_NFT_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.CLAIM_VOTING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_COVER_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.REINSURANCE_POOL_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.LEGACY_REWARDS_GENERATOR_NAME(), NOTHING);

    await contractsRegistry.addContract(await contractsRegistry.WETH_NAME(), weth.address);
    await contractsRegistry.addContract(await contractsRegistry.USDT_NAME(), stbl.address);
    await contractsRegistry.addContract(await contractsRegistry.BMI_NAME(), bmi.address);
    await contractsRegistry.addContract(await contractsRegistry.UNISWAP_ROUTER_NAME(), uniswapRouterMock.address);

    await contractsRegistry.addProxyContract(
      await contractsRegistry.POLICY_BOOK_ADMIN_NAME(),
      _policyBookAdmin.address
    );
    await contractsRegistry.addProxyContract(
      await contractsRegistry.REWARDS_GENERATOR_NAME(),
      _rewardsGenerator.address
    );
    await contractsRegistry.addProxyContract(await contractsRegistry.PRICE_FEED_NAME(), _priceFeed.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.LIQUIDITY_MINING_NAME(), _liquidityMining.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.POLICY_REGISTRY_NAME(), _policyRegistry.address);
    await contractsRegistry.addProxyContract(
      await contractsRegistry.LIQUIDITY_REGISTRY_NAME(),
      _liquidityRegistry.address
    );
    await contractsRegistry.addProxyContract(
      await contractsRegistry.POLICY_BOOK_REGISTRY_NAME(),
      _policyBookRegistry.address
    );
    await contractsRegistry.addProxyContract(
      await contractsRegistry.POLICY_BOOK_FABRIC_NAME(),
      _policyBookFabric.address
    );
    await contractsRegistry.addProxyContract(await contractsRegistry.POLICY_QUOTE_NAME(), _policyQuote.address);
    await contractsRegistry.addProxyContract(
      await contractsRegistry.CLAIMING_REGISTRY_NAME(),
      _claimingRegistry.address
    );

    const policyBookFabric = await PolicyBookFabric.at(await contractsRegistry.getPolicyBookFabricContract());
    const claimingRegistry = await ClaimingRegistry.at(await contractsRegistry.getClaimingRegistryContract());
    const rewardsGenerator = await RewardsGenerator.at(await contractsRegistry.getRewardsGeneratorContract());
    const policyBookAdmin = await PolicyBookAdmin.at(await contractsRegistry.getPolicyBookAdminContract());
    policyQuote = await PolicyQuoteMock.at(await contractsRegistry.getPolicyQuoteContract());

    await claimingRegistry.__ClaimingRegistry_init();
    await rewardsGenerator.__RewardsGenerator_init();
    await policyBookAdmin.__PolicyBookAdmin_init(policyBookImpl.address);

    await contractsRegistry.injectDependencies(await contractsRegistry.PRICE_FEED_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.REWARDS_GENERATOR_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_FABRIC_NAME());

    const initialDeposit = wei("1000");

    await stbl.approve(policyBookFabric.address, initialDeposit);

    await setDay(1);

    const policyBookAddr = (
      await policyBookFabric.create(
        insuranceContract,
        ContractType.CONTRACT,
        "placeholder",
        "placeholder",
        initialDeposit
      )
    ).logs[0].args.at;

    policyBook = await PolicyBookMock.at(policyBookAddr);

    await stbl.mintArbitrary(USER1, toMWeiBN("200000"));
    await stbl.approve(policyBook.address, toMWeiBN("200000"), { from: USER1 });

    await stbl.mintArbitrary(USER2, toMWeiBN("200000"));
    await stbl.approve(policyBook.address, toMWeiBN("200000"), { from: USER2 });

    await stbl.mintArbitrary(USER3, toMWeiBN("200000"));
    await stbl.approve(policyBook.address, toMWeiBN("200000"), { from: USER3 });

    await policyBook.addLiquidity(liquidityAmount.div(toBN(3)), { from: USER1 });
    await policyBook.addLiquidity(liquidityAmount.div(toBN(3)), { from: USER2 });
    await policyBook.addLiquidity(liquidityAmount.div(toBN(3)), { from: USER3 });

    await reverter.snapshot();
  });

  afterEach("revert", reverter.revert);

  const setDay = async (day) => await setCurrentTime(secondsInADay * day);

  const approximatelyEqual = (bn1, bn2, precision = toBN("100000")) => {
    const difference = bn1.sub(bn2).abs();
    assert.isTrue(
      difference.lt(precision),
      `${web3.utils.fromWei(bn1).toString()} is not approximately equal to ${web3.utils.fromWei(bn2).toString()}`
    );
  };

  const compareLiquidity = async (additional) => {
    approximatelyEqual(
      await policyBook.totalLiquidity(),
      liquidityAmount.add(toWeiBN("1000")).add(toWeiBN(additional))
    );
  };

  const triggerDistribution = async () => {
    return await policyBook.triggerPremiumsDistribution();
  };

  describe("calculations", async () => {
    it("should correctly distribute with a large gap in calculation", async () => {
      await setDay(1);

      const tokenAmount = 400;
      await policyQuote.setQuote(toWeiBN(tokenAmount / 4));
      await policyBook.buyPolicy(5, toWeiBN("1000"), { from: USER1 });
      await policyQuote.setQuote(toWeiBN((tokenAmount / 4) * 3));
      await policyBook.buyPolicy(20, toWeiBN("2000"), { from: USER2 });

      await setDay(301);
      await triggerDistribution(); // 90 days
      await triggerDistribution(); // 90 days

      await compareLiquidity(tokenAmount * nonProtocolMultiplier);
      assert.equal(toBN(await policyBook.lastPremiumDistributionEpoch()).toString(), "183");
    });

    it("should correctly distribute larger than max and then distribute zeros", async () => {
      await setDay(1);

      const tokenAmount = 400;
      await policyQuote.setQuote(toWeiBN(tokenAmount / 4));
      await policyBook.buyPolicy(5, toWeiBN("1000"), { from: USER1 });
      await policyQuote.setQuote(toWeiBN((tokenAmount / 4) * 3));
      await policyBook.buyPolicy(20, toWeiBN("2000"), { from: USER2 });

      await setDay(201);
      await triggerDistribution(); // 90 days
      await triggerDistribution(); // 90 days

      await compareLiquidity(tokenAmount * nonProtocolMultiplier);

      await setDay(401);
      await triggerDistribution();

      await compareLiquidity(tokenAmount * nonProtocolMultiplier);
    });

    it("should not distribute on the same day", async () => {
      await setDay(1);

      const tokenAmount = 400;
      await policyQuote.setQuote(toWeiBN(tokenAmount / 4));
      await policyBook.buyPolicy(5, toWeiBN("1000"), { from: USER1 });
      await policyQuote.setQuote(toWeiBN((tokenAmount / 4) * 3));
      await policyBook.buyPolicy(20, toWeiBN("2000"), { from: USER2 });

      await triggerDistribution();

      await compareLiquidity(0);
    });

    it("should distribute correct amount on the next day", async () => {
      await setDay(1);

      await policyQuote.setQuote(toWeiBN("252"));
      await policyBook.buyPolicy(4, toWeiBN("1000"), { from: USER1 });
      await policyQuote.setQuote(toWeiBN("210"));
      await policyBook.buyPolicy(1, toWeiBN("2000"), { from: USER2 });

      await setDay(2);
      await triggerDistribution();

      await compareLiquidity(16 * nonProtocolMultiplier);
    });

    it("should distribute correct amount on the last days", async () => {
      await setDay(1);

      const tokenAmount = 140;
      await policyQuote.setQuote(toWeiBN(tokenAmount));
      await policyBook.buyPolicy(1, toWeiBN("2000"), { from: USER2 });

      await setDay(21);
      await triggerDistribution();
      await compareLiquidity(((tokenAmount * 20) / 21) * nonProtocolMultiplier);
      await setDay(22);
      await triggerDistribution();
      await compareLiquidity(tokenAmount * nonProtocolMultiplier);
      await setDay(23);
      await triggerDistribution();
      await compareLiquidity(tokenAmount * nonProtocolMultiplier);
    });

    it("should not distribute in the same day twice", async () => {
      await setDay(1);

      const tokenAmount = 140;
      await policyQuote.setQuote(toWeiBN(tokenAmount));
      await policyBook.buyPolicy(1, toWeiBN("2000"), { from: USER2 });

      await setDay(2);
      await triggerDistribution();
      await compareLiquidity((tokenAmount / 21) * nonProtocolMultiplier);
      await triggerDistribution();
      await compareLiquidity((tokenAmount / 21) * nonProtocolMultiplier);
    });
  });

  describe("triggers", async () => {
    const tokenAmount = 140;

    beforeEach(async () => {
      await setDay(1);

      await policyQuote.setQuote(toWeiBN(tokenAmount));
      await policyBook.buyPolicy(1, toWeiBN("2000"), { from: USER1 });
    });

    it("buy policy distributes premiums", async () => {
      await setDay(2);
      await policyBook.buyPolicy(1, toWeiBN("2000"), { from: USER2 });

      await compareLiquidity((tokenAmount / 21) * nonProtocolMultiplier);
    });

    it("add liquidity distributes premiums", async () => {
      await setDay(2);
      await policyBook.addLiquidity(toWeiBN("10"), { from: USER1 });

      await compareLiquidity((tokenAmount / 21) * nonProtocolMultiplier + 10);
    });

    it("request withdrawal distributes premiums", async () => {
      await setDay(2);
      await policyBook.approve(policyBook.address, toBN("10"), { from: USER1 });
      await policyBook.requestWithdrawal(toBN("10"), { from: USER1 });

      await compareLiquidity((tokenAmount / 21) * nonProtocolMultiplier);
    });

    it("withdraw liquidity distributes premiums", async () => {
      await policyBook.approve(policyBook.address, toBN("10"), { from: USER1 });
      await policyBook.requestWithdrawal(toBN("10"), { from: USER1 });
      await setDay(10);
      await policyBook.withdrawLiquidity({ from: USER1 });

      await compareLiquidity(tokenAmount * nonProtocolMultiplier * (9 / 21));
    });
  });
});
