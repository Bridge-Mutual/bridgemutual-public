const PolicyBookMock = artifacts.require("PolicyBookMock");
const PolicyQuote = artifacts.require("PolicyQuote");
const PolicyBookFabric = artifacts.require("PolicyBookFabric");
const STBLMock = artifacts.require("STBLMock");
const BMIMock = artifacts.require("BMIMock");
const WETHMock = artifacts.require("WETHMock");
const UniswapRouterMock = artifacts.require("UniswapRouterMock");
const PriceFeed = artifacts.require("PriceFeed");
const ContractsRegistry = artifacts.require("ContractsRegistry");
const BMICoverStaking = artifacts.require("BMICoverStaking");
const LiquidityMining = artifacts.require("LiquidityMining");
const PolicyRegistry = artifacts.require("PolicyRegistry");
const ClaimingRegistry = artifacts.require("ClaimingRegistry");
const LiquidityRegistry = artifacts.require("LiquidityRegistry");
const PolicyBookRegistry = artifacts.require("PolicyBookRegistry");
const RewardsGenerator = artifacts.require("RewardsGenerator");
const ClaimVoting = artifacts.require("ClaimVoting");
const ReinsurancePool = artifacts.require("ReinsurancePool");
const PolicyBookAdmin = artifacts.require("PolicyBookAdmin");

const Reverter = require("./helpers/reverter");
const BigNumber = require("bignumber.js");
const truffleAssert = require("truffle-assertions");
const Wallet = require("ethereumjs-wallet").default;
const setCurrentTime = require("./helpers/ganacheTimeTraveler");
const { sign2612 } = require("./helpers/signatures");
const { MAX_UINT256 } = require("./helpers/constants");
const { assert } = require("chai");

const ContractType = {
  CONTRACT: 0,
  STABLECOIN: 1,
  SERVICE: 2,
  EXCHANGE: 3,
};

const ClaimStatus = {
  CAN_CLAIM: 0,
  UNCLAIMABLE: 1,
  PENDING: 2,
  AWAITING_CALCULATION: 3,
  REJECTED_CAN_APPEAL: 4,
  REJECTED: 5,
  ACCEPTED: 6,
};

const WithdrawalStatus = {
  NONE: 0,
  PENDING: 1,
  READY: 2,
  EXPIRED: 3,
};

function toBN(number) {
  return new BigNumber(number);
}

const wei = web3.utils.toWei;

contract("PolicyBook1", async (accounts) => {
  const reverter = new Reverter(web3);

  let contractsRegistry;
  let policyBook;
  let bmiCoverStaking;
  let liquidityMining;
  let stbl;
  let bmi;
  let rewardsGenerator;
  let claimVoting;
  let claimingRegistry;
  let policyRegistry;
  let reinsurancePool;
  let policyQuote;

  const epochPeriod = toBN(604800); // 7 days
  const insuranceContract = accounts[0];
  const USER1 = accounts[1];
  const USER2 = accounts[2];
  const USER3 = accounts[3];
  const USER4 = accounts[4];

  const PERCENTAGE_100 = toBN(10).pow(27);
  const APY_PRECISION = toBN(10 ** 5);
  const withdrawalPeriod = toBN(691200); // 8 days

  const NOTHING = accounts[9];

  const getBMIXAmount = async (STBLAmount) => {
    return toBN(await policyBook.convertSTBLToBMIX(STBLAmount));
  };

  const getSTBLAmount = async (bmiXAmount) => {
    return toBN(await policyBook.convertBMIXToSTBL(bmiXAmount));
  };

  before("setup", async () => {
    contractsRegistry = await ContractsRegistry.new();
    const policyBookImpl = await PolicyBookMock.new();
    const weth = await WETHMock.new("weth", "weth");
    const uniswapRouterMock = await UniswapRouterMock.new();
    bmi = await BMIMock.new(USER1);
    stbl = await STBLMock.new("stbl", "stbl", 6);
    const _policyBookAdmin = await PolicyBookAdmin.new();
    const _priceFeed = await PriceFeed.new();
    const _policyBookRegistry = await PolicyBookRegistry.new();
    const _policyBookFabric = await PolicyBookFabric.new();
    const _policyQuote = await PolicyQuote.new();
    const _reinsurancePool = await ReinsurancePool.new();
    const _policyRegistry = await PolicyRegistry.new();
    const _rewardsGenerator = await RewardsGenerator.new();
    const _bmiCoverStaking = await BMICoverStaking.new();
    const _liquidityMining = await LiquidityMining.new();
    const _claimingRegistry = await ClaimingRegistry.new();
    const _liquidityRegistry = await LiquidityRegistry.new();
    const _claimVoting = await ClaimVoting.new();

    await contractsRegistry.__ContractsRegistry_init();

    await contractsRegistry.addContract(await contractsRegistry.VBMI_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_UTILITY_NFT_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.REPUTATION_SYSTEM_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.LEGACY_REWARDS_GENERATOR_NAME(), NOTHING);

    await contractsRegistry.addContract(await contractsRegistry.WETH_NAME(), weth.address);
    await contractsRegistry.addContract(await contractsRegistry.USDT_NAME(), stbl.address);
    await contractsRegistry.addContract(await contractsRegistry.BMI_NAME(), bmi.address);
    await contractsRegistry.addContract(await contractsRegistry.UNISWAP_ROUTER_NAME(), uniswapRouterMock.address);

    await contractsRegistry.addProxyContract(
      await contractsRegistry.POLICY_BOOK_ADMIN_NAME(),
      _policyBookAdmin.address
    );
    await contractsRegistry.addProxyContract(await contractsRegistry.PRICE_FEED_NAME(), _priceFeed.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.CLAIM_VOTING_NAME(), _claimVoting.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.REINSURANCE_POOL_NAME(), _reinsurancePool.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.LIQUIDITY_MINING_NAME(), _liquidityMining.address);
    await contractsRegistry.addProxyContract(
      await contractsRegistry.BMI_COVER_STAKING_NAME(),
      _bmiCoverStaking.address
    );
    await contractsRegistry.addProxyContract(await contractsRegistry.POLICY_REGISTRY_NAME(), _policyRegistry.address);
    await contractsRegistry.addProxyContract(
      await contractsRegistry.CLAIMING_REGISTRY_NAME(),
      _claimingRegistry.address
    );
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
    await contractsRegistry.addProxyContract(
      await contractsRegistry.REWARDS_GENERATOR_NAME(),
      _rewardsGenerator.address
    );
    await contractsRegistry.addProxyContract(await contractsRegistry.POLICY_QUOTE_NAME(), _policyQuote.address);

    const policyBookFabric = await PolicyBookFabric.at(await contractsRegistry.getPolicyBookFabricContract());
    const policyBookAdmin = await PolicyBookAdmin.at(await contractsRegistry.getPolicyBookAdminContract());
    policyQuote = await PolicyQuote.at(await contractsRegistry.getPolicyQuoteContract());
    policyRegistry = await PolicyRegistry.at(await contractsRegistry.getPolicyRegistryContract());
    claimingRegistry = await ClaimingRegistry.at(await contractsRegistry.getClaimingRegistryContract());
    claimVoting = await ClaimVoting.at(await contractsRegistry.getClaimVotingContract());
    reinsurancePool = await ReinsurancePool.at(await contractsRegistry.getReinsurancePoolContract());
    liquidityMining = await LiquidityMining.at(await contractsRegistry.getLiquidityMiningContract());
    bmiCoverStaking = await BMICoverStaking.at(await contractsRegistry.getBMICoverStakingContract());
    rewardsGenerator = await RewardsGenerator.at(await contractsRegistry.getRewardsGeneratorContract());

    await policyBookAdmin.__PolicyBookAdmin_init(policyBookImpl.address);
    await claimingRegistry.__ClaimingRegistry_init();
    await claimVoting.__ClaimVoting_init();
    await reinsurancePool.__ReinsurancePool_init();
    await bmiCoverStaking.__BMICoverStaking_init();
    await rewardsGenerator.__RewardsGenerator_init();
    await liquidityMining.__LiquidityMining_init();

    await contractsRegistry.injectDependencies(await contractsRegistry.PRICE_FEED_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.CLAIMING_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.REWARDS_GENERATOR_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.CLAIM_VOTING_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.BMI_COVER_STAKING_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.REINSURANCE_POOL_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_FABRIC_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_ADMIN_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_MINING_NAME());

    await uniswapRouterMock.setReserve(stbl.address, wei(toBN(10 ** 3).toString()));
    await uniswapRouterMock.setReserve(weth.address, wei(toBN(10 ** 15).toString()));
    await uniswapRouterMock.setReserve(bmi.address, wei(toBN(10 ** 15).toString()));

    const initialDeposit = wei("1000");

    await stbl.approve(policyBookFabric.address, initialDeposit);

    await setCurrentTime(1);

    const policyBookAddr = (
      await policyBookFabric.create(
        insuranceContract,
        ContractType.CONTRACT,
        "test description",
        "TEST",
        initialDeposit
      )
    ).logs[0].args.at;

    policyBook = await PolicyBookMock.at(policyBookAddr);

    await setCurrentTime(1);

    await liquidityMining.startLiquidityMining();

    await policyBookAdmin.whitelist(policyBookAddr, true);

    await reverter.snapshot();
  });

  afterEach("revert", reverter.revert);

  describe("creation checks", async () => {
    it("should have expected token name", async () => {
      assert.equal(await policyBook.name(), "test description");
    });

    it("should have expected token symbol", async () => {
      assert.equal(await policyBook.symbol(), "bmiTESTCover");
    });
  });

  describe("submitClaim", async () => {
    const epochsNumber = toBN(5);
    const coverTokensAmount = toBN(wei("1000"));
    const stblAmount = toBN(wei("10000", "mwei"));
    const liquidityAmount = toBN(wei("5000"));

    it("should revert due to no coverage", async () => {
      await truffleAssert.reverts(policyBook.submitClaimAndInitializeVoting(""), "CV: Claimer has no coverage");
    });

    it("should submit new claim", async () => {
      await stbl.transfer(USER1, stblAmount);
      await stbl.approve(policyBook.address, stblAmount, { from: USER1 });

      assert.equal(await policyRegistry.getPoliciesLength(USER1), 0);

      await policyBook.addLiquidity(liquidityAmount, { from: USER1 });
      await policyBook.buyPolicy(epochsNumber, coverTokensAmount, { from: USER1 });

      assert.equal(await policyRegistry.getPoliciesLength(USER1), 1);

      const toApproveOnePercent = await policyBook.getClaimApprovalAmount(USER1);

      assert.equal(toBN(toApproveOnePercent).toString(), coverTokensAmount.idiv(100).toString());

      await bmi.approve(claimVoting.address, toApproveOnePercent, { from: USER1 });
      await policyBook.submitClaimAndInitializeVoting("", { from: USER1 });

      const claimsCount = await claimingRegistry.countPolicyClaimerClaims(USER1);

      assert.equal(claimsCount, 1);

      const claims = await claimVoting.myClaims(0, claimsCount, { from: USER1 });

      assert.equal(claims[0][0], 1);
      assert.equal(claims[0][1], policyBook.address);
      assert.equal(claims[0][2], "");
      assert.equal(claims[0][3], false);
      assert.equal(toBN(claims[0][4]).toString(), coverTokensAmount.toString());
      assert.equal(claims[0][5], ClaimStatus.PENDING);
      assert.equal(claims[0][6], 0);
    });

    it("shouldn't allow two identical claims", async () => {
      await stbl.transfer(USER1, stblAmount);
      await stbl.approve(policyBook.address, stblAmount, { from: USER1 });

      await stbl.transfer(USER2, stblAmount);
      await stbl.approve(policyBook.address, stblAmount, { from: USER2 });

      await policyBook.addLiquidity(liquidityAmount, { from: USER1 });
      await policyBook.buyPolicy(epochsNumber, coverTokensAmount, { from: USER1 });

      await policyBook.buyPolicy(epochsNumber, coverTokensAmount, { from: USER2 });

      const toApproveOnePercent = await policyBook.getClaimApprovalAmount(USER1);
      await bmi.approve(claimVoting.address, toApproveOnePercent, { from: USER1 });

      await policyBook.submitClaimAndInitializeVoting("", { from: USER1 });
      await truffleAssert.reverts(
        policyBook.submitClaimAndInitializeVoting("", { from: USER1 }),
        "ClaimingRegistry: The claimer can't submit this claim"
      );

      const claimsCount = await claimingRegistry.countPolicyClaimerClaims(USER1);

      assert.equal(claimsCount, 1);

      const claims = await claimVoting.myClaims(0, claimsCount, { from: USER1 });

      assert.equal(claims[0][0], 1);
      assert.equal(claims[0][1], policyBook.address);
      assert.equal(claims[0][2], "");
      assert.equal(claims[0][3], false);
      assert.equal(toBN(claims[0][4]).toString(), coverTokensAmount.toString());
      assert.equal(claims[0][5], ClaimStatus.PENDING);
      assert.equal(claims[0][6], 0);
    });
  });

  describe("getSTBLToBMIXRatio", async () => {
    let policyBookMock;
    let liquidityAmount;
    let totalSupply;

    beforeEach("setup", async () => {
      policyBookMock = await PolicyBookMock.new();
      await policyBookMock.__PolicyBookMock_init(accounts[9], ContractType.CONTRACT);

      await policyBookMock.setDependencies(contractsRegistry.address);
    });

    it("shold return current rate if total supply = 0", async () => {
      assert.equal(toBN(await policyBookMock.getSTBLToBMIXRatio()).toString(), PERCENTAGE_100.toString());
    });

    it("shold return current rate if total supply = total liquidity", async () => {
      liquidityAmount = toBN(wei("1000"));
      totalSupply = liquidityAmount;

      await policyBookMock.setTotalLiquidity(liquidityAmount, { from: USER1 });
      await policyBookMock.mint(totalSupply, { from: USER1 });

      assert.equal(toBN(await policyBookMock.getSTBLToBMIXRatio()).toString(), PERCENTAGE_100.toString());
    });

    it("shold return current rate if total supply < total liquidity", async () => {
      liquidityAmount = toBN(wei("1000"));
      totalSupply = toBN(wei("200"));

      await policyBookMock.setTotalLiquidity(liquidityAmount, { from: USER1 });
      await policyBookMock.mint(totalSupply, { from: USER1 });

      assert.equal(toBN(await policyBookMock.getSTBLToBMIXRatio()).toString(), PERCENTAGE_100.times(5).toString());
    });

    it("shold return current rate if total supply > total liquidity", async () => {
      liquidityAmount = toBN(wei("1000"));
      totalSupply = toBN(wei("2000"));

      await policyBookMock.setTotalLiquidity(liquidityAmount, { from: USER1 });
      await policyBookMock.mint(totalSupply, { from: USER1 });

      assert.equal(
        toBN(await policyBookMock.getSTBLToBMIXRatio()).toString(),
        PERCENTAGE_100.times(5).div(10).toString()
      );
    });

    it("shold return current rate after several changes", async () => {
      liquidityAmount = toBN(wei("1000"));
      totalSupply = toBN(wei("2000"));

      await policyBookMock.setTotalLiquidity(liquidityAmount, { from: USER1 });
      await policyBookMock.mint(totalSupply, { from: USER1 });

      assert.equal(
        toBN(await policyBookMock.getSTBLToBMIXRatio()).toString(),
        PERCENTAGE_100.times(5).div(10).toString()
      );

      liquidityAmount = toBN(wei("3000"));
      await policyBookMock.setTotalLiquidity(liquidityAmount, { from: USER1 });

      assert.equal(
        toBN(await policyBookMock.getSTBLToBMIXRatio()).toString(),
        PERCENTAGE_100.times(15).div(10).toString()
      );

      liquidityAmount = toBN(wei("1"));
      await policyBookMock.setTotalLiquidity(liquidityAmount, { from: USER1 });

      assert.equal(
        toBN(await policyBookMock.getSTBLToBMIXRatio()).toString(),
        PERCENTAGE_100.times(5).div(10000).toString()
      );

      liquidityAmount = toBN(wei("2000"));
      await policyBookMock.setTotalLiquidity(liquidityAmount, { from: USER1 });

      assert.equal(toBN(await policyBookMock.getSTBLToBMIXRatio()).toString(), PERCENTAGE_100.toString());
    });
  });

  describe("buyPolicy", async () => {
    const stblAmount = toBN(wei("100000", "mwei"));
    const liquidityAmount = toBN(wei("50000"));
    const coverTokensAmount = toBN(wei("1000"));

    let priceTotal;
    let price;
    let protocolPrice;

    beforeEach("setup", async () => {
      const userArr = [USER1, USER2, USER3, USER4];

      for (let i = 0; i < 4; i++) {
        await stbl.transfer(userArr[i], stblAmount);
        await stbl.approve(policyBook.address, stblAmount, { from: userArr[i] });
      }

      await setCurrentTime(5);
      await policyBook.addLiquidity(liquidityAmount, { from: USER1 });

      assert.equal(toBN(await policyBook.totalLiquidity()).toString(), liquidityAmount.plus(wei("1000")).toString());
      assert.equal(
        toBN(await stbl.balanceOf(policyBook.address)).toString(),
        liquidityAmount
          .plus(wei("1000"))
          .idiv(10 ** 12)
          .toString()
      );
      assert.equal(
        toBN(await stbl.balanceOf(USER1)).toString(),
        stblAmount.minus(liquidityAmount.idiv(10 ** 12)).toString()
      );

      priceTotal = toBN(
        await policyQuote.getQuote(epochPeriod.times(5).minus(5), coverTokensAmount, policyBook.address)
      );
      protocolPrice = priceTotal.times(0.2).dp(0, BigNumber.ROUND_FLOOR);
      price = priceTotal.minus(protocolPrice);
    });

    it("should correctly buy policy", async () => {
      const epochsNumber = toBN(5);
      const virtualEpochs = toBN(2);

      assert.equal(await policyBook.lastDistributionEpoch(), 1);
      await policyBook.buyPolicy(epochsNumber, coverTokensAmount, { from: USER2 });

      assert.equal(toBN(await policyBook.totalCoverTokens()).toString(), coverTokensAmount.toString());
      assert.equal(
        toBN(await policyBook.epochAmounts(epochsNumber.plus(virtualEpochs))).toString(),
        coverTokensAmount.toString()
      );

      assert.equal(
        toBN(await stbl.balanceOf(policyBook.address)).toString(),
        liquidityAmount
          .plus(wei("1000"))
          .plus(price)
          .idiv(10 ** 12)
          .toString()
      );
      assert.equal(
        toBN(await stbl.balanceOf(reinsurancePool.address)).toString(),
        protocolPrice.idiv(10 ** 12).toString()
      );

      assert.equal(
        toBN(await stbl.balanceOf(USER2)).toString(),
        stblAmount.minus(priceTotal.idiv(10 ** 12)).toString()
      );
    });

    it("should correctly update epochs info and total cover tokens", async () => {
      const epochsNumbers = [1, 3, 2, 1];
      const virtualEpochs = toBN(2);
      const usersAmounts = [
        liquidityAmount.div(2),
        liquidityAmount.div(2),
        coverTokensAmount.times(10),
        coverTokensAmount,
      ];

      assert.equal(await policyBook.lastDistributionEpoch(), 1);
      await policyBook.buyPolicy(epochsNumbers[0], usersAmounts[0], { from: USER1 });
      await policyBook.buyPolicy(epochsNumbers[1], usersAmounts[1], { from: USER2 });

      let currentTotalCoverTokens = usersAmounts[0].plus(usersAmounts[1]);

      assert.equal(toBN(await policyBook.totalCoverTokens()).toString(), currentTotalCoverTokens.toString());
      assert.equal(
        toBN(await policyBook.epochAmounts(virtualEpochs.plus(epochsNumbers[0]))).toString(),
        usersAmounts[0].toString()
      );
      assert.equal(
        toBN(await policyBook.epochAmounts(virtualEpochs.plus(epochsNumbers[1]))).toString(),
        usersAmounts[1].toString()
      );

      await setCurrentTime(epochPeriod.times(3).plus(10));

      await policyBook.buyPolicy(epochsNumbers[2], usersAmounts[2], { from: USER3 });

      assert.equal(await policyBook.lastDistributionEpoch(), 4);

      currentTotalCoverTokens = usersAmounts[1].plus(usersAmounts[2]);

      assert.equal(toBN(await policyBook.totalCoverTokens()).toString(), currentTotalCoverTokens.toString());
      assert.equal(await policyBook.epochAmounts(virtualEpochs.plus(epochsNumbers[0])), 0);
      assert.equal(
        toBN(await policyBook.epochAmounts(virtualEpochs.plus(epochsNumbers[1]))).toString(),
        usersAmounts[1].toString()
      );
      assert.equal(
        toBN(await policyBook.epochAmounts(virtualEpochs.plus(3).plus(epochsNumbers[2]))).toString(),
        usersAmounts[2].toString()
      );

      await setCurrentTime(epochPeriod.times(12).plus(10));

      await policyBook.buyPolicy(epochsNumbers[3], usersAmounts[3], { from: USER4 });

      assert.equal(await policyBook.lastDistributionEpoch(), 13);

      assert.equal(toBN(await policyBook.totalCoverTokens()).toString(), coverTokensAmount.toString());
      assert.equal(await policyBook.epochAmounts(virtualEpochs.plus(epochsNumbers[0])), 0);
      assert.equal(await policyBook.epochAmounts(virtualEpochs.plus(epochsNumbers[1])), 0);
      assert.equal(
        toBN(await policyBook.epochAmounts(toBN(await policyBook.lastDistributionEpoch()).plus(2))).toString(),
        coverTokensAmount.toString()
      );
    });

    it("should successfully buy policy if previous policy expire", async () => {
      const epochsNumber = toBN(5);
      await policyBook.buyPolicy(epochsNumber, coverTokensAmount, { from: USER2 });

      assert.equal(toBN(await policyBook.totalCoverTokens()).toString(), coverTokensAmount.toString());

      let policyInfo = await policyRegistry.policyInfos(USER2, policyBook.address);
      assert.equal(toBN(policyInfo.coverAmount).toString(), coverTokensAmount.toString());

      await setCurrentTime(epochsNumber.plus(3).times(epochPeriod).plus(10));

      await policyBook.buyPolicy(epochsNumber, coverTokensAmount.times(2), { from: USER2 });

      assert.equal(toBN(await policyBook.totalCoverTokens()).toString(), coverTokensAmount.times(2).toString());

      policyInfo = await policyRegistry.policyInfos(USER2, policyBook.address);
      assert.equal(toBN(policyInfo.coverAmount).toString(), coverTokensAmount.times(2).toString());
    });

    it("should get exception, policy holder already exists", async () => {
      const epochsNumber = toBN(5);
      await policyBook.buyPolicy(epochsNumber, coverTokensAmount, { from: USER2 });

      const reason = "PB: The holder already exists";
      await truffleAssert.reverts(policyBook.buyPolicy(epochsNumber, coverTokensAmount, { from: USER2 }), reason);
    });

    it("should get exception, not enough available liquidity", async () => {
      const epochsNumber = toBN(5);
      const reason = "PB: Not enough liquidity";

      await truffleAssert.reverts(
        policyBook.buyPolicy(epochsNumber, liquidityAmount.plus(wei("1001")), { from: USER2 }),
        reason
      );
    });

    it("should get exception, cover tokens amount must be greater than zero", async () => {
      const epochsNumber = toBN(5);
      const reason = "PB: Wrong cover";

      await truffleAssert.reverts(policyBook.buyPolicy(epochsNumber, 0, { from: USER2 }), reason);
    });

    it("should get exception, epochs number must be greater than zero", async () => {
      const reason = "PB: Wrong epoch duration";

      await truffleAssert.reverts(policyBook.buyPolicy(0, coverTokensAmount, { from: USER2 }), reason);
    });
  });

  describe("addLiquidity", async () => {
    const stblAmount = toBN(wei("10000", "mwei"));
    const amount = toBN(wei("1000"));

    let liquidityAmount;
    let totalSupply;
    let policyBookMock;

    beforeEach("setup", async () => {
      const _policyBookRegistry = await PolicyBookRegistry.new();
      const _rewardsGenerator = await RewardsGenerator.new();

      policyBookMock = await PolicyBookMock.new();

      await contractsRegistry.addContract(await contractsRegistry.POLICY_BOOK_FABRIC_NAME(), accounts[8]);

      await contractsRegistry.addProxyContract(
        await contractsRegistry.POLICY_BOOK_REGISTRY_NAME(),
        _policyBookRegistry.address
      );
      await contractsRegistry.addProxyContract(
        await contractsRegistry.REWARDS_GENERATOR_NAME(),
        _rewardsGenerator.address
      );

      const policyBookRegistry = await PolicyBookRegistry.at(await contractsRegistry.getPolicyBookRegistryContract());
      const rewardsGenerator = await RewardsGenerator.at(await contractsRegistry.getRewardsGeneratorContract());

      await rewardsGenerator.__RewardsGenerator_init();

      await setCurrentTime(1);

      await policyBookMock.__PolicyBookMock_init(accounts[9], ContractType.CONTRACT);

      await contractsRegistry.injectDependencies(await contractsRegistry.REWARDS_GENERATOR_NAME());
      await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_REGISTRY_NAME());
      await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_REGISTRY_NAME());
      await policyBookMock.setDependencies(contractsRegistry.address);

      await policyBookRegistry.add(accounts[9], ContractType.CONTRACT, policyBookMock.address, { from: accounts[8] });

      await stbl.transfer(USER1, stblAmount);
      await stbl.approve(policyBookMock.address, stblAmount, { from: USER1 });
    });

    it("should not allow deposit of small value", async () => {
      await setCurrentTime(1);
      await truffleAssert.reverts(policyBookMock.addLiquidity(1000, { from: USER1 }), "PB: Liquidity amount is zero");
    });

    it("should set correct values", async () => {
      await setCurrentTime(1);
      await policyBookMock.addLiquidity(amount, { from: USER1 });

      assert.equal(toBN(await policyBookMock.totalLiquidity()).toString(), amount.toString());
      assert.equal(toBN(await policyBookMock.balanceOf(USER1)).toString(), amount.toString());
      assert.equal(toBN(await stbl.balanceOf(policyBookMock.address)).toString(), amount.idiv(10 ** 12).toString());
      assert.equal(toBN(await stbl.balanceOf(USER1)).toString(), stblAmount.minus(amount.idiv(10 ** 12)).toString());
    });

    it("should update the values correctly", async () => {
      await setCurrentTime(1);
      await policyBookMock.addLiquidity(amount, { from: USER1 });

      assert.equal(toBN(await policyBookMock.totalLiquidity()).toString(), amount.toString());
      assert.equal(toBN(await policyBookMock.balanceOf(USER1)).toString(), amount.toString());
      assert.equal(toBN(await stbl.balanceOf(policyBookMock.address)).toString(), amount.idiv(10 ** 12).toString());
      assert.equal(toBN(await stbl.balanceOf(USER1)).toString(), stblAmount.minus(amount.idiv(10 ** 12)).toString());

      await setCurrentTime(100);
      await policyBookMock.addLiquidity(amount, { from: USER1 });

      assert.equal(toBN(await policyBookMock.totalLiquidity()).toString(), amount.times(2).toString());
      assert.equal(toBN(await policyBookMock.balanceOf(USER1)).toString(), amount.times(2).toString());
      assert.equal(
        toBN(await stbl.balanceOf(policyBookMock.address)).toString(),
        amount
          .times(2)
          .idiv(10 ** 12)
          .toString()
      );
      assert.equal(
        toBN(await stbl.balanceOf(USER1)).toString(),
        stblAmount.minus(amount.times(2).idiv(10 ** 12)).toString()
      );
    });

    it("should mint correct BMIX amount if total supply < total liquidity", async () => {
      liquidityAmount = toBN(wei("1000"));
      totalSupply = toBN(wei("200"));

      await policyBookMock.setTotalLiquidity(liquidityAmount, { from: USER2 });
      await policyBookMock.mint(totalSupply, { from: USER2 });

      assert.equal(toBN(await policyBookMock.getSTBLToBMIXRatio()).toString(), PERCENTAGE_100.times(5).toString());

      await policyBookMock.addLiquidity(amount, { from: USER1 });
      const expectedBMIXAmount = amount.div(5);

      assert.equal(toBN(await policyBookMock.totalLiquidity()).toString(), amount.plus(liquidityAmount).toString());
      assert.equal(toBN(await policyBookMock.balanceOf(USER1)).toString(), expectedBMIXAmount.toString());
    });

    it("should mint correct BMIX amount if total supply > total liquidity", async () => {
      liquidityAmount = toBN(wei("4000"));
      totalSupply = toBN(wei("10000"));

      await policyBookMock.setTotalLiquidity(liquidityAmount, { from: USER2 });
      await policyBookMock.mint(totalSupply, { from: USER2 });

      await policyBookMock.addLiquidity(amount, { from: USER1 });
      const expectedBMIXAmount = toBN(wei("2500"));

      assert.equal(toBN(await policyBookMock.totalLiquidity()).toString(), amount.plus(liquidityAmount).toString());
      assert.equal(toBN(await policyBookMock.balanceOf(USER1)).toString(), expectedBMIXAmount.toString());
    });
  });

  describe("addLiquidityAndStake", async () => {
    const stblAmount = toBN(wei("10000"));
    const amount = toBN(wei("1000"));

    beforeEach("setup", async () => {
      await stbl.transfer(USER1, stblAmount.idiv(10 ** 12));
      await stbl.approve(policyBook.address, stblAmount.idiv(10 ** 12), { from: USER1 });

      await policyBook.approve(bmiCoverStaking.address, stblAmount, { from: USER1 });
    });

    it("should correctly provide liquidity and make a stake (1)", async () => {
      await setCurrentTime(1);
      await policyBook.addLiquidityAndStake(amount, amount, { from: USER1 });

      assert.equal(toBN(await policyBook.totalLiquidity()).toString(), amount.plus(wei("1000")).toString());
      assert.equal(
        toBN(await stbl.balanceOf(USER1)).toString(),
        stblAmount
          .minus(amount)
          .idiv(10 ** 12)
          .toString()
      );

      assert.equal(toBN((await bmiCoverStaking.stakingInfoByToken(1)).stakedBMIXAmount).toString(), amount.toString());
      assert.equal(await bmiCoverStaking.balanceOf(USER1), 1);
      assert.equal(await bmiCoverStaking.ownerOf(1), USER1);
    });

    it("should correctly provide liquidity and make a stake (2)", async () => {
      await stbl.transfer(USER2, stblAmount.idiv(10 ** 12));
      await stbl.approve(policyBook.address, stblAmount.idiv(10 ** 12), { from: USER2 });

      await setCurrentTime(1);

      await policyBook.addLiquidity(stblAmount.idiv(2), { from: USER2 });

      const price = toBN((await policyBook.getPolicyPrice(10, stblAmount.idiv(2))).totalPrice)
        .times(80)
        .idiv(100);

      await policyBook.buyPolicy(10, stblAmount.idiv(2), { from: USER2 });

      await setCurrentTime(12 * 7 * 24 * 60 * 60 + 10);

      await policyBook.addLiquidityAndStake(amount, amount, { from: USER1 });

      assert.closeTo(
        toBN(await policyBook.totalLiquidity()).toNumber(),
        amount.plus(stblAmount.idiv(2)).plus(price).plus(wei("1000")).toNumber(),
        100
      );
      assert.equal(
        toBN(await stbl.balanceOf(USER1)).toString(),
        stblAmount
          .minus(amount)
          .idiv(10 ** 12)
          .toString()
      );
      assert.closeTo(
        toBN(await stbl.balanceOf(policyBook.address)).toNumber(),
        toBN(await policyBook.totalLiquidity())
          .idiv(10 ** 12)
          .toNumber(),
        100
      );

      assert.equal(await bmiCoverStaking.balanceOf(USER1), 1);
      assert.equal(await bmiCoverStaking.ownerOf(1), USER1);
    });

    it("should correctly provide liquidity and make a stake not for the full amount", async () => {
      const stakeAmount = toBN(wei("500"));

      await setCurrentTime(1);

      await policyBook.addLiquidityAndStake(amount, stakeAmount, { from: USER1 });

      assert.equal(toBN(await policyBook.totalLiquidity()).toString(), amount.plus(wei("1000")).toString());
      assert.equal(
        toBN(await stbl.balanceOf(USER1)).toString(),
        stblAmount
          .minus(amount)
          .idiv(10 ** 12)
          .toString()
      );
      assert.equal(
        toBN(await stbl.balanceOf(policyBook.address)).toString(),
        amount
          .plus(wei("1000"))
          .idiv(10 ** 12)
          .toString()
      );

      assert.equal(await bmiCoverStaking.balanceOf(USER1), 1);
      assert.equal(await bmiCoverStaking.ownerOf(1), USER1);
    });

    it("should get exception, PB: Wrong staking amount", async () => {
      const reason = "PB: Wrong staking amount";

      await truffleAssert.reverts(policyBook.addLiquidityAndStake(amount, amount.plus(1), { from: USER1 }), reason);
    });
  });

  describe("withdrawLiquidity", async () => {
    const stblAmount = toBN(wei("100000", "mwei"));
    const liquidityAmount = toBN(wei("10000"));
    const coverTokensAmount = toBN(wei("3000"));
    const amountToWithdraw = toBN(wei("1000"));
    const epochsNumber = toBN(5);

    let price;

    beforeEach("setup", async () => {
      await stbl.transfer(USER1, stblAmount);
      await stbl.approve(policyBook.address, stblAmount, { from: USER1 });

      await stbl.transfer(USER2, stblAmount);
      await stbl.approve(policyBook.address, stblAmount, { from: USER2 });

      await liquidityMining.createTeam("someTeam", { from: USER1 });
      await liquidityMining.joinTheTeam(USER1, { from: USER2 });

      await setCurrentTime(1);

      await policyBook.addLiquidity(liquidityAmount, { from: USER1 });
    });

    it("should successfully withdraw tokens without queue", async () => {
      assert.equal(toBN(await policyBook.totalLiquidity()).toString(), liquidityAmount.plus(wei("1000")).toString());

      const priceTotal = toBN(
        await policyQuote.getQuote(epochPeriod.times(epochsNumber), coverTokensAmount, policyBook.address)
      );

      const protocolPrice = priceTotal.times(20).idiv(100);
      price = priceTotal.minus(protocolPrice);

      await policyBook.buyPolicy(epochsNumber, coverTokensAmount, { from: USER2 });
      assert.equal(toBN(await policyBook.totalCoverTokens()).toString(), coverTokensAmount.toString());

      assert.equal(
        toBN(await stbl.balanceOf(policyBook.address)).toString(),
        liquidityAmount
          .plus(wei("1000"))
          .plus(price)
          .idiv(10 ** 12)
          .toString()
      );
      assert.equal(
        toBN(await stbl.balanceOf(USER1)).toString(),
        stblAmount.minus(liquidityAmount.idiv(10 ** 12)).toString()
      );

      await policyBook.approve(policyBook.address, amountToWithdraw, { from: USER1 });
      await policyBook.requestWithdrawal(amountToWithdraw, { from: USER1 });

      await setCurrentTime(withdrawalPeriod.plus(10));

      const disAmount = price
        .idiv(epochPeriod.times(epochsNumber.plus(2)).idiv(24 * 60 * 60))
        .times(withdrawalPeriod.plus(10).idiv(24 * 60 * 60));

      await policyBook.triggerPremiumsDistribution();

      assert.equal(toBN(await policyBook.getWithdrawalStatus(USER1)).toString(), WithdrawalStatus.READY);

      const expectedWithdrawalAmount = await getSTBLAmount(amountToWithdraw);

      await policyBook.withdrawLiquidity({ from: USER1 });

      assert.equal(
        toBN(await policyBook.totalLiquidity()).toString(),
        liquidityAmount.minus(expectedWithdrawalAmount).plus(wei("1000")).plus(disAmount).toString()
      );
      assert.equal(
        toBN(await policyBook.balanceOf(USER1)).toString(),
        liquidityAmount.minus(amountToWithdraw).toString()
      );

      assert.equal(
        toBN(await stbl.balanceOf(policyBook.address)).toString(),
        liquidityAmount
          .minus(expectedWithdrawalAmount)
          .plus(wei("1000"))
          .plus(price)
          .idiv(10 ** 12)
          .plus(1)
          .toString()
      );
      assert.equal(
        toBN(await stbl.balanceOf(USER1)).toString(),
        stblAmount
          .minus(liquidityAmount.idiv(10 ** 12))
          .plus(expectedWithdrawalAmount.idiv(10 ** 12))
          .toString()
      );
    });

    it("should successfully withdraw tokens if 2 weeks expired", async () => {
      await liquidityMining.investSTBL(liquidityAmount.div(2), policyBook.address, { from: USER1 });

      const totalLiquidity = toBN(wei("15000"));

      assert.equal(toBN(await policyBook.totalLiquidity()).toString(), totalLiquidity.plus(wei("1000")).toString());

      const neededTime = toBN(await liquidityMining.getEndLMTime());
      await setCurrentTime(neededTime);

      const amountToWithdraw = liquidityAmount.plus(wei("1000"));

      await policyBook.approve(policyBook.address, amountToWithdraw, { from: USER1 });
      await policyBook.requestWithdrawal(amountToWithdraw, { from: USER1 });

      await setCurrentTime(withdrawalPeriod.plus(neededTime).plus(10));

      assert.equal(toBN(await policyBook.getWithdrawalStatus(USER1)).toString(), WithdrawalStatus.READY);

      await policyBook.withdrawLiquidity({ from: USER1 });

      assert.equal(
        toBN(await policyBook.totalLiquidity()).toString(),
        totalLiquidity.minus(amountToWithdraw).plus(wei("1000")).toString()
      );

      assert.equal(
        toBN(await policyBook.balanceOf(USER1)).toString(),
        totalLiquidity.minus(amountToWithdraw).toString()
      );

      assert.equal(
        toBN(await stbl.balanceOf(USER1)).toString(),
        stblAmount.minus(totalLiquidity.minus(amountToWithdraw).idiv(10 ** 12)).toString()
      );
    });

    it("should successfully withdraw part of the requested amount", async () => {
      await policyBook.approve(policyBook.address, amountToWithdraw.times(6), { from: USER1 });
      await policyBook.requestWithdrawal(amountToWithdraw.times(6), { from: USER1 });

      const currentCoverTokens = coverTokensAmount.times(2);

      await policyBook.buyPolicy(epochsNumber, currentCoverTokens, { from: USER2 });
      assert.equal(toBN(await policyBook.totalCoverTokens()).toString(), currentCoverTokens.toString());

      await setCurrentTime(withdrawalPeriod.plus(10));

      assert.equal(toBN(await policyBook.getWithdrawalStatus(USER1)).toString(), WithdrawalStatus.READY);

      await policyBook.triggerPremiumsDistribution();

      const availableAmount = toBN(await policyBook.totalLiquidity()).minus(await policyBook.totalCoverTokens());
      const balanceBeforeWithdrawal = toBN(await stbl.balanceOf(USER1));

      await policyBook.withdrawLiquidity({ from: USER1 });

      const balanceAfterWithdrawal = toBN(await stbl.balanceOf(USER1));

      assert.equal(
        toBN((await policyBook.withdrawalsInfo(USER1)).withdrawalAmount).toString(),
        amountToWithdraw
          .times(6)
          .minus(await getBMIXAmount(availableAmount))
          .toString()
      );
      assert.equal(
        balanceAfterWithdrawal.minus(balanceBeforeWithdrawal).toString(),
        availableAmount
          .minus(1)
          .idiv(10 ** 12)
          .toString()
      );
    });

    it("should successfully withdraw multiple times", async () => {
      await policyBook.approve(policyBook.address, amountToWithdraw.times(6), { from: USER1 });
      await policyBook.requestWithdrawal(amountToWithdraw.times(6), { from: USER1 });

      const currentCoverTokens = coverTokensAmount.times(2);

      await policyBook.buyPolicy(epochsNumber, currentCoverTokens, { from: USER2 });
      assert.equal(toBN(await policyBook.totalCoverTokens()).toString(), currentCoverTokens.toString());

      await setCurrentTime(withdrawalPeriod.plus(10));

      assert.equal(toBN(await policyBook.getWithdrawalStatus(USER1)).toString(), WithdrawalStatus.READY);

      await policyBook.triggerPremiumsDistribution();

      await policyBook.withdrawLiquidity({ from: USER1 });

      await policyBook.addLiquidity(liquidityAmount, { from: USER2 });

      await policyBook.withdrawLiquidity({ from: USER1 });

      assert.equal(toBN((await policyBook.withdrawalsInfo(USER1)).withdrawalAmount).toString(), 0);
    });

    it("should get exception if user do not have ready requested withdrawal", async () => {
      await policyBook.approve(policyBook.address, amountToWithdraw, { from: USER1 });
      await policyBook.requestWithdrawal(amountToWithdraw, { from: USER1 });

      await setCurrentTime(withdrawalPeriod.minus(1000));

      const reason = "PB: Withdrawal is not ready";
      await truffleAssert.reverts(policyBook.withdrawLiquidity({ from: USER1 }), reason);
    });
  });

  describe("extreme premium case", async () => {
    it("should not revert", async () => {
      await setCurrentTime(1);

      await stbl.approve(policyBook.address, wei("1000", "mwei"));
      await policyBook.addLiquidity(wei("1000"));

      for (let i = 1; i < 5; i++) {
        await stbl.transfer(accounts[i], wei("1000", "mwei"));
        await stbl.approve(policyBook.address, wei("1000", "mwei"), { from: accounts[i] });

        await policyBook.buyPolicy(1, toBN(wei("100")).times(i), { from: accounts[i] });

        await policyBook.getAPY();

        await setCurrentTime(epochPeriod.times(i));
      }
    });
  });

  describe("APY", async () => {
    const epochs = 13;
    const cover = toBN(wei("1000"));

    it("should calculate correct APY without premium", async () => {
      assert.equal(toBN(await policyBook.getAPY()).toString(), "0");
    });

    it("should calculate correct APY", async () => {
      const priceTotal = toBN((await policyBook.getPolicyPrice(epochs, cover, { from: USER1 })).totalPrice);

      await stbl.transfer(USER1, priceTotal.idiv(10 ** 12));

      await stbl.approve(policyBook.address, priceTotal.idiv(10 ** 12), { from: USER1 });
      await policyBook.buyPolicy(epochs, cover, { from: USER1 });

      const expectedAPY = priceTotal
        .times(80)
        .idiv(100)
        .idiv(epochPeriod.times(epochs + 2).idiv(24 * 60 * 60))
        .times(365)
        .times(100)
        .idiv(toBN(await policyBook.totalSupply()).plus(await policyBook.convertSTBLToBMIX(wei("1"))));

      assert.equal(
        toBN(await policyBook.getAPY())
          .idiv(APY_PRECISION)
          .toString(),
        expectedAPY.toString()
      );
    });
  });

  describe("permit", async () => {
    it("should change allowance through permit", async () => {
      const wallet = Wallet.generate();
      const walletAddress = wallet.getAddressString();
      const amount = toBN(10).pow(25);
      const contractData = { name: "bmiTESTCover", verifyingContract: policyBook.address };
      const transactionData = {
        owner: walletAddress,
        spender: USER1,
        value: amount,
      };
      const { v, r, s } = sign2612(contractData, transactionData, wallet.getPrivateKey());

      await policyBook.permit(walletAddress, USER1, amount.toString(10), MAX_UINT256.toString(10), v, r, s, {
        from: USER1,
      });
      assert.equal(toBN(await policyBook.allowance(walletAddress, USER1)).toString(), amount.toString());
    });
  });
});
