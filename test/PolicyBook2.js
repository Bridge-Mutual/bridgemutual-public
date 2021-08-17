const PolicyBookMock = artifacts.require("PolicyBookMock");
const PolicyQuote = artifacts.require("PolicyQuote");
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
const LiquidityRegistry = artifacts.require("LiquidityRegistry");
const PolicyBookRegistry = artifacts.require("PolicyBookRegistry");
const ReinsurancePool = artifacts.require("ReinsurancePool");
const PolicyBookAdmin = artifacts.require("PolicyBookAdmin");
const RewardsGeneratorMock = artifacts.require("RewardsGeneratorMock");

const Reverter = require("./helpers/reverter");
const BigNumber = require("bignumber.js");
const truffleAssert = require("truffle-assertions");
const setCurrentTime = require("./helpers/ganacheTimeTraveler");
const { assert } = require("chai");
const { sign2612 } = require("./helpers/signatures");

const ContractType = {
  CONTRACT: 0,
  STABLECOIN: 1,
  SERVICE: 2,
  EXCHANGE: 3,
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

contract("PolicyBook2", async (accounts) => {
  const reverter = new Reverter(web3);

  let contractsRegistry;
  let policyBook;
  let liquidityMining;
  let stbl;
  let bmi;

  const insuranceContract = accounts[0];
  const USER1 = accounts[1];
  const user1PrivateKey = "c4ce20adf2b728fe3005be128fb850397ec352d1ea876e3035e46d547343404f";
  const USER2 = accounts[2];

  const withdrawalPeriod = toBN(691200); // 8 days
  const withdrawalExpirePeriod = toBN(172800);

  const NOTHING = accounts[9];

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
    const _rewardsGenerator = await RewardsGeneratorMock.new();
    const _policyQuote = await PolicyQuote.new();
    const _reinsurancePool = await ReinsurancePool.new();
    const _policyRegistry = await PolicyRegistry.new();
    const _liquidityMining = await LiquidityMining.new();
    const _claimingRegistry = await ClaimingRegistry.new();
    const _liquidityRegistry = await LiquidityRegistry.new();

    await contractsRegistry.__ContractsRegistry_init();

    await contractsRegistry.addContract(await contractsRegistry.BMI_UTILITY_NFT_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.CLAIM_VOTING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_COVER_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.LEGACY_REWARDS_GENERATOR_NAME(), NOTHING);

    await contractsRegistry.addContract(await contractsRegistry.WETH_NAME(), weth.address);
    await contractsRegistry.addContract(await contractsRegistry.USDT_NAME(), stbl.address);
    await contractsRegistry.addContract(await contractsRegistry.BMI_NAME(), bmi.address);
    await contractsRegistry.addContract(await contractsRegistry.UNISWAP_ROUTER_NAME(), uniswapRouterMock.address);

    await contractsRegistry.addProxyContract(
      await contractsRegistry.REWARDS_GENERATOR_NAME(),
      _rewardsGenerator.address
    );
    await contractsRegistry.addProxyContract(
      await contractsRegistry.POLICY_BOOK_ADMIN_NAME(),
      _policyBookAdmin.address
    );
    await contractsRegistry.addProxyContract(await contractsRegistry.PRICE_FEED_NAME(), _priceFeed.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.REINSURANCE_POOL_NAME(), _reinsurancePool.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.LIQUIDITY_MINING_NAME(), _liquidityMining.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.POLICY_REGISTRY_NAME(), _policyRegistry.address);
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
    await contractsRegistry.addProxyContract(
      await contractsRegistry.LIQUIDITY_REGISTRY_NAME(),
      _liquidityRegistry.address
    );

    const policyBookFabric = await PolicyBookFabric.at(await contractsRegistry.getPolicyBookFabricContract());
    const reinsurancePool = await ReinsurancePool.at(await contractsRegistry.getReinsurancePoolContract());
    const claimingRegistry = await ClaimingRegistry.at(await contractsRegistry.getClaimingRegistryContract());
    const rewardsGeneratorMock = await RewardsGeneratorMock.at(await contractsRegistry.getRewardsGeneratorContract());
    const policyBookAdmin = await PolicyBookAdmin.at(await contractsRegistry.getPolicyBookAdminContract());
    liquidityMining = await LiquidityMining.at(await contractsRegistry.getLiquidityMiningContract());

    await policyBookAdmin.__PolicyBookAdmin_init(policyBookImpl.address);
    await claimingRegistry.__ClaimingRegistry_init();
    await reinsurancePool.__ReinsurancePool_init();
    await rewardsGeneratorMock.__RewardsGenerator_init();
    await liquidityMining.__LiquidityMining_init();

    await contractsRegistry.injectDependencies(await contractsRegistry.PRICE_FEED_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.CLAIMING_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.REWARDS_GENERATOR_NAME());
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
      await policyBookFabric.create(insuranceContract, ContractType.CONTRACT, "placeholder", "TEST", initialDeposit)
    ).logs[0].args.at;

    policyBook = await PolicyBookMock.at(policyBookAddr);

    await setCurrentTime(1);

    await liquidityMining.startLiquidityMining();

    await reverter.snapshot();
  });

  afterEach("revert", reverter.revert);

  describe("getWithdrawalStatus", async () => {
    const stblAmount = toBN(wei("100000", "mwei"));
    const liquidityAmount = toBN(wei("10000"));
    const coverTokensAmount = toBN(wei("8000"));
    const amountToWithdraw = toBN(wei("1000"));
    const epochsNumber = 5;

    beforeEach("setup", async () => {
      await stbl.transfer(USER1, stblAmount);
      await stbl.approve(policyBook.address, stblAmount, { from: USER1 });

      await policyBook.approve(policyBook.address, liquidityAmount.plus(amountToWithdraw), { from: USER1 });

      await policyBook.addLiquidity(liquidityAmount, { from: USER1 });
    });

    it("should return NONE status if announce does not exists", async () => {
      assert.equal(toBN(await policyBook.getWithdrawalStatus(USER1)).toString(), WithdrawalStatus.NONE);
    });

    it("should return PENDING status if withdrawal period not expired", async () => {
      await setCurrentTime(1);
      await policyBook.requestWithdrawal(amountToWithdraw, { from: USER1 });

      assert.equal(toBN(await policyBook.getWithdrawalStatus(USER1)).toString(), WithdrawalStatus.PENDING);
    });

    it("should return READY status if withdrawal is possible", async () => {
      await setCurrentTime(1);
      await policyBook.requestWithdrawal(amountToWithdraw, { from: USER1 });

      await setCurrentTime(withdrawalPeriod.plus(10));

      assert.equal(toBN(await policyBook.getWithdrawalStatus(USER1)).toString(), WithdrawalStatus.READY);
    });

    it("should return READY status if withdrawal allowed after period", async () => {
      await setCurrentTime(1);
      await policyBook.requestWithdrawal(amountToWithdraw.times(5), { from: USER1 });
      await policyBook.buyPolicy(epochsNumber, coverTokensAmount, { from: USER1 });

      await setCurrentTime(withdrawalPeriod.plus(10));

      await policyBook.withdrawLiquidity({ from: USER1 });

      assert.isTrue(toBN((await policyBook.withdrawalsInfo(USER1)).withdrawalAmount).gt(0));

      await setCurrentTime(withdrawalPeriod.plus(withdrawalExpirePeriod).plus(10));

      assert.equal(toBN(await policyBook.getWithdrawalStatus(USER1)).toString(), WithdrawalStatus.READY);
    });

    it("should return EXPIRED status if withdrawal not possible, withdrawal expire period expired", async () => {
      await setCurrentTime(1);
      await policyBook.requestWithdrawal(amountToWithdraw, { from: USER1 });

      await setCurrentTime(withdrawalPeriod.plus(withdrawalExpirePeriod).plus(10));

      assert.equal(toBN(await policyBook.getWithdrawalStatus(USER1)).toString(), WithdrawalStatus.EXPIRED);
    });
  });

  describe("requestWithdrawal", async () => {
    const stblAmount = toBN(wei("100000", "mwei"));
    const liquidityAmount = toBN(wei("10000"));
    const amountToWithdraw = toBN(wei("1000"));

    beforeEach("setup", async () => {
      await stbl.transfer(USER1, stblAmount);
      await stbl.approve(policyBook.address, stblAmount, { from: USER1 });

      await stbl.transfer(USER2, stblAmount);
      await stbl.approve(policyBook.address, stblAmount, { from: USER2 });

      await policyBook.approve(policyBook.address, liquidityAmount.plus(amountToWithdraw), { from: USER1 });

      await policyBook.addLiquidity(liquidityAmount, { from: USER1 });
      await setCurrentTime(1);
    });

    it("should correctly announce withdrawal", async () => {
      const txReceipt = await policyBook.requestWithdrawal(amountToWithdraw, { from: USER1 });

      assert.equal(
        toBN(await policyBook.balanceOf(USER1)).toString(),
        liquidityAmount.minus(amountToWithdraw).toString()
      );
      assert.equal(toBN(await policyBook.balanceOf(policyBook.address)).toString(), amountToWithdraw.toString());

      assert.equal(txReceipt.logs.length, 3);
      assert.equal(txReceipt.logs[2].event, "WithdrawalRequested");
      assert.equal(txReceipt.logs[2].args._liquidityHolder, USER1);
      assert.equal(toBN(txReceipt.logs[2].args._tokensToWithdraw).toString(), amountToWithdraw.toString());
      assert.equal(toBN(txReceipt.logs[2].args._readyToWithdrawDate).toString(), withdrawalPeriod.plus(1).toString());

      assert.equal(toBN(await policyBook.getWithdrawalStatus(USER1)).toString(), WithdrawalStatus.PENDING);

      const withdrawalInfo = await policyBook.withdrawalsInfo(USER1);

      assert.equal(toBN(withdrawalInfo.withdrawalAmount).toString(), amountToWithdraw.toString());
      assert.equal(toBN(withdrawalInfo.readyToWithdrawDate).toString(), withdrawalPeriod.plus(1).toString());
    });

    it("should announce withdrawal if withdrawal status EXPIRED and previous request less than new", async () => {
      await policyBook.requestWithdrawal(amountToWithdraw, { from: USER1 });

      assert.equal(
        toBN(await policyBook.balanceOf(USER1)).toString(),
        liquidityAmount.minus(amountToWithdraw).toString()
      );
      assert.equal(toBN(await policyBook.balanceOf(policyBook.address)).toString(), amountToWithdraw.toString());

      const expiryDate = withdrawalPeriod.plus(withdrawalExpirePeriod).plus(10);
      await setCurrentTime(expiryDate);

      assert.equal(toBN(await policyBook.getWithdrawalStatus(USER1)).toString(), WithdrawalStatus.EXPIRED);
      const txReceipt = await policyBook.requestWithdrawal(amountToWithdraw.times(2), { from: USER1 });

      assert.equal(
        toBN(await policyBook.balanceOf(USER1)).toString(),
        liquidityAmount.minus(amountToWithdraw.times(2)).toString()
      );
      assert.equal(
        toBN(await policyBook.balanceOf(policyBook.address)).toString(),
        amountToWithdraw.times(2).toString()
      );

      assert.equal(txReceipt.logs.length, 4);
      assert.equal(txReceipt.logs[3].event, "WithdrawalRequested");
      assert.equal(txReceipt.logs[3].args._liquidityHolder, USER1);
      assert.equal(toBN(txReceipt.logs[3].args._tokensToWithdraw).toString(), amountToWithdraw.times(2).toString());
      assert.equal(
        toBN(txReceipt.logs[3].args._readyToWithdrawDate).toString(),
        withdrawalPeriod.plus(expiryDate).toString()
      );

      assert.equal(toBN(await policyBook.getWithdrawalStatus(USER1)).toString(), WithdrawalStatus.PENDING);

      const withdrawalInfo = await policyBook.withdrawalsInfo(USER1);

      assert.equal(toBN(withdrawalInfo.withdrawalAmount).toString(), amountToWithdraw.times(2).toString());
      assert.equal(toBN(withdrawalInfo.readyToWithdrawDate).toString(), withdrawalPeriod.plus(expiryDate).toString());
    });

    it("should announce withdrawal if withdrawal status EXPIRED and previous request greater than new", async () => {
      await policyBook.requestWithdrawal(amountToWithdraw, { from: USER1 });

      assert.equal(
        toBN(await policyBook.balanceOf(USER1)).toString(),
        liquidityAmount.minus(amountToWithdraw).toString()
      );
      assert.equal(toBN(await policyBook.balanceOf(policyBook.address)).toString(), amountToWithdraw.toString());

      const expiryDate = withdrawalPeriod.plus(withdrawalExpirePeriod).plus(10);
      await setCurrentTime(expiryDate);

      assert.equal(toBN(await policyBook.getWithdrawalStatus(USER1)).toString(), WithdrawalStatus.EXPIRED);
      await policyBook.requestWithdrawal(amountToWithdraw.div(2), { from: USER1 });

      assert.equal(
        toBN(await policyBook.balanceOf(USER1)).toString(),
        liquidityAmount.minus(amountToWithdraw.div(2)).toString()
      );
      assert.equal(toBN(await policyBook.balanceOf(policyBook.address)).toString(), amountToWithdraw.div(2).toString());

      assert.equal(toBN(await policyBook.getWithdrawalStatus(USER1)).toString(), WithdrawalStatus.PENDING);

      const withdrawalInfo = await policyBook.withdrawalsInfo(USER1);
      assert.equal(toBN(withdrawalInfo.withdrawalAmount).toString(), amountToWithdraw.div(2).toString());
      assert.equal(toBN(withdrawalInfo.readyToWithdrawDate).toString(), withdrawalPeriod.plus(expiryDate).toString());
    });

    it("should correctly requestWithdrawal multiple times", async () => {
      await policyBook.requestWithdrawal(amountToWithdraw, { from: USER1 });

      assert.equal(
        toBN(await policyBook.balanceOf(USER1)).toString(),
        liquidityAmount.minus(amountToWithdraw).toString()
      );
      assert.equal(toBN(await policyBook.balanceOf(policyBook.address)).toString(), amountToWithdraw.toString());

      await setCurrentTime(withdrawalPeriod.plus(10));

      assert.equal(toBN(await policyBook.getWithdrawalStatus(USER1)).toString(), WithdrawalStatus.READY);

      await policyBook.requestWithdrawal(amountToWithdraw.div(2), { from: USER1 });

      assert.equal(
        toBN(await policyBook.balanceOf(USER1)).toString(),
        liquidityAmount.minus(amountToWithdraw.div(2)).toString()
      );
      assert.equal(toBN(await policyBook.balanceOf(policyBook.address)).toString(), amountToWithdraw.div(2).toString());

      assert.equal(toBN(await policyBook.getWithdrawalStatus(USER1)).toString(), WithdrawalStatus.PENDING);

      await policyBook.requestWithdrawal(amountToWithdraw.times(2), { from: USER1 });

      assert.equal(
        toBN(await policyBook.balanceOf(USER1)).toString(),
        liquidityAmount.minus(amountToWithdraw.times(2)).toString()
      );
      assert.equal(
        toBN(await policyBook.balanceOf(policyBook.address)).toString(),
        amountToWithdraw.times(2).toString()
      );
    });

    it("should get exception, amount to be announced is greater than the available amount", async () => {
      await policyBook.addLiquidity(liquidityAmount, { from: USER2 });

      const reason = "PB: Wrong announced amount";
      await truffleAssert.reverts(policyBook.requestWithdrawal(liquidityAmount.plus(1), { from: USER1 }), reason);
    });

    it("should get exception, amount to be announced is greater than the deposited amount and LME hasn't finished yet", async () => {
      await liquidityMining.createTeam("someTeam", { from: USER1 });

      await liquidityMining.investSTBL(liquidityAmount.div(2), policyBook.address, { from: USER1 });
      assert.equal(
        toBN(await policyBook.totalLiquidity()).toString(),
        liquidityAmount.times(3).div(2).plus(wei("1000")).toString()
      );

      const reason = "PB: Wrong announced amount";
      await truffleAssert.reverts(policyBook.requestWithdrawal(liquidityAmount.plus(1), { from: USER1 }), reason);
    });
  });

  describe("requestWithdrawalWithPermit", async () => {
    const stblAmount = toBN(wei("100000", "mwei"));
    const liquidityAmount = toBN(wei("10000"));
    const amountToWithdraw = toBN(wei("1000"));

    it("should correctly request withdrawal without approve", async () => {
      await stbl.transfer(USER1, stblAmount);
      await stbl.approve(policyBook.address, liquidityAmount, { from: USER1 });

      await policyBook.addLiquidity(liquidityAmount, { from: USER1 });
      await setCurrentTime(1);

      const buffer = Buffer.from(user1PrivateKey, "hex");
      const contractData = { name: "bmiTESTCover", verifyingContract: policyBook.address };
      const transactionData = {
        owner: USER1,
        spender: policyBook.address,
        value: amountToWithdraw,
      };

      const { v, r, s } = sign2612(contractData, transactionData, buffer);

      const txReceipt = await policyBook.requestWithdrawalWithPermit(amountToWithdraw, v, r, s, { from: USER1 });

      assert.equal(
        toBN(await policyBook.balanceOf(USER1)).toString(),
        liquidityAmount.minus(amountToWithdraw).toString()
      );
      assert.equal(toBN(await policyBook.balanceOf(policyBook.address)).toString(), amountToWithdraw.toString());

      assert.equal(txReceipt.logs.length, 4);
      assert.equal(txReceipt.logs[3].event, "WithdrawalRequested");
      assert.equal(txReceipt.logs[3].args._liquidityHolder, USER1);
      assert.equal(toBN(txReceipt.logs[3].args._tokensToWithdraw).toString(), amountToWithdraw.toString());
      assert.equal(toBN(txReceipt.logs[3].args._readyToWithdrawDate).toString(), withdrawalPeriod.plus(1).toString());
    });
  });

  describe("unlockTokens", async () => {
    const stblAmount = toBN(wei("1000000", "mwei"));
    const liquidityAmount = toBN(wei("1000"));
    const amountToRequest = toBN(wei("800"));

    beforeEach("setup", async () => {
      await stbl.transfer(USER1, stblAmount);
      await stbl.approve(policyBook.address, stblAmount, { from: USER1 });

      await setCurrentTime(1);

      await policyBook.addLiquidity(liquidityAmount, { from: USER1 });

      await policyBook.approve(policyBook.address, liquidityAmount.plus(amountToRequest), { from: USER1 });

      assert.equal(toBN(await policyBook.balanceOf(USER1)).toString(), liquidityAmount);
    });

    it("should successfully unlock tokens", async () => {
      await policyBook.requestWithdrawal(amountToRequest, { from: USER1 });

      assert.equal(
        toBN(await policyBook.balanceOf(USER1)).toString(),
        liquidityAmount.minus(amountToRequest).toString()
      );
      assert.equal(
        toBN((await policyBook.withdrawalsInfo(USER1)).withdrawalAmount).toString(),
        amountToRequest.toString()
      );
      assert.equal(toBN(await policyBook.balanceOf(policyBook.address)).toString(), amountToRequest.toString());

      await policyBook.unlockTokens({ from: USER1 });

      assert.equal(toBN(await policyBook.balanceOf(USER1)).toString(), liquidityAmount.toString());
      assert.equal(toBN((await policyBook.withdrawalsInfo(USER1)).withdrawalAmount).toString(), 0);
    });

    it("should get exception if withdrawal amount equal zero", async () => {
      await truffleAssert.reverts(policyBook.unlockTokens({ from: USER1 }), "PB: Amount is zero");
    });
  });

  describe("endEpoch", async () => {
    it("should calculate correct end epoch time", async () => {
      await setCurrentTime(24 * 60 * 60);

      const secsInWeek = 7 * 24 * 60 * 60;

      assert.equal(
        toBN(await policyBook.secondsToEndCurrentEpoch()).toString(),
        toBN(secsInWeek)
          .minus(24 * 60 * 60)
          .plus(1)
          .toString()
      );
    });
  });

  describe("staking modifier", async () => {
    const POLICY_BOOK_FABRIC = accounts[8];
    const POLICY_BOOK_ADMIN = accounts[7];

    let policyBookMock;
    let rewardsGenerator;

    beforeEach("setup", async () => {
      policyBookMock = await PolicyBookMock.new();

      const _policyBookRegistry = await PolicyBookRegistry.new();
      const _rewardsGenerator = await RewardsGeneratorMock.new();

      await contractsRegistry.addContract(await contractsRegistry.POLICY_BOOK_FABRIC_NAME(), POLICY_BOOK_FABRIC);
      await contractsRegistry.addContract(await contractsRegistry.POLICY_BOOK_ADMIN_NAME(), POLICY_BOOK_ADMIN);

      await contractsRegistry.addProxyContract(
        await contractsRegistry.POLICY_BOOK_REGISTRY_NAME(),
        _policyBookRegistry.address
      );
      await contractsRegistry.addProxyContract(
        await contractsRegistry.REWARDS_GENERATOR_NAME(),
        _rewardsGenerator.address
      );

      rewardsGenerator = await RewardsGeneratorMock.at(await contractsRegistry.getRewardsGeneratorContract());
      const policyBookRegistry = await PolicyBookRegistry.at(await contractsRegistry.getPolicyBookRegistryContract());

      await rewardsGenerator.__RewardsGenerator_init();
      await policyBookMock.__PolicyBookMock_init(NOTHING, ContractType.CONTRACT);

      await contractsRegistry.injectDependencies(await contractsRegistry.REWARDS_GENERATOR_NAME());
      await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_REGISTRY_NAME());
      await policyBookMock.setDependencies(contractsRegistry.address);

      await policyBookRegistry.add(NOTHING, ContractType.CONTRACT, policyBookMock.address, {
        from: POLICY_BOOK_FABRIC,
      });

      await policyBookMock.whitelist(true, { from: POLICY_BOOK_ADMIN });
    });

    it("should calculate correct rewards multiplier (1)", async () => {
      await policyBookMock.setTotalCoverTokens(wei("5000000"));
      await policyBookMock.setTotalLiquidity(wei("10000000"));

      await policyBookMock.forceUpdateBMICoverStakingRewardMultiplier();

      assert.equal(
        toBN((await rewardsGenerator.getPolicyBookReward(policyBookMock.address)).rewardMultiplier).toString(),
        "100000"
      );
    });

    it("should calculate correct rewards multiplier (2)", async () => {
      await policyBookMock.setTotalCoverTokens(wei("9000000"));
      await policyBookMock.setTotalLiquidity(wei("10000000"));

      await policyBookMock.forceUpdateBMICoverStakingRewardMultiplier();

      assert.equal(
        toBN((await rewardsGenerator.getPolicyBookReward(policyBookMock.address)).rewardMultiplier).toString(),
        "150000"
      );
    });

    it("should calculate correct rewards multiplier (3)", async () => {
      await policyBookMock.setTotalCoverTokens(wei("600000"));
      await policyBookMock.setTotalLiquidity(wei("10000000"));

      await policyBookMock.forceUpdateBMICoverStakingRewardMultiplier();

      assert.equal(
        toBN((await rewardsGenerator.getPolicyBookReward(policyBookMock.address)).rewardMultiplier).toString(),
        "23500"
      );
    });

    it("should calculate correct rewards multiplier (4)", async () => {
      await policyBookMock.whitelist(false, { from: POLICY_BOOK_ADMIN });

      await policyBookMock.setTotalCoverTokens(wei("600000"));
      await policyBookMock.setTotalLiquidity(wei("10000000"));

      await policyBookMock.forceUpdateBMICoverStakingRewardMultiplier();

      assert.equal(
        toBN((await rewardsGenerator.getPolicyBookReward(policyBookMock.address)).rewardMultiplier).toString(),
        "0"
      );

      await policyBookMock.whitelist(true, { from: POLICY_BOOK_ADMIN });

      assert.equal(
        toBN((await rewardsGenerator.getPolicyBookReward(policyBookMock.address)).rewardMultiplier).toString(),
        "23500"
      );

      await policyBookMock.whitelist(false, { from: POLICY_BOOK_ADMIN });

      assert.equal(
        toBN((await rewardsGenerator.getPolicyBookReward(policyBookMock.address)).rewardMultiplier).toString(),
        "0"
      );
    });
  });
});
