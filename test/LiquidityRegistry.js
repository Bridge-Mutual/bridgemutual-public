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
const setCurrentTime = require("./helpers/ganacheTimeTraveler");
const { assert } = require("chai");

function toBN(number) {
  return new BigNumber(number);
}

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
  IN_QUEUE: 4,
};

const wei = web3.utils.toWei;

contract("LiquidityRegistry", async (accounts) => {
  const reverter = new Reverter(web3);

  let contractsRegistry;
  let policyBook;
  let bmiCoverStaking;
  let stbl;
  let bmi;
  let liquidityRegistry;
  let policyBookFabric;
  let policyBookAdmin;

  const insuranceContract = accounts[0];
  const USER1 = accounts[1];
  const USER2 = accounts[2];

  const oneToken = toBN(wei("1"));
  const withdrawalPeriod = toBN(691200); // 8 days
  const readyToWithdrawPeriod = toBN(172800); // 2 days

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

    policyBookFabric = await PolicyBookFabric.at(await contractsRegistry.getPolicyBookFabricContract());
    policyBookAdmin = await PolicyBookAdmin.at(await contractsRegistry.getPolicyBookAdminContract());
    bmiCoverStaking = await BMICoverStaking.at(await contractsRegistry.getBMICoverStakingContract());
    liquidityRegistry = await LiquidityRegistry.at(await contractsRegistry.getLiquidityRegistryContract());

    const claimingRegistry = await ClaimingRegistry.at(await contractsRegistry.getClaimingRegistryContract());
    const claimVoting = await ClaimVoting.at(await contractsRegistry.getClaimVotingContract());
    const reinsurancePool = await ReinsurancePool.at(await contractsRegistry.getReinsurancePoolContract());
    const rewardsGenerator = await RewardsGenerator.at(await contractsRegistry.getRewardsGeneratorContract());

    await policyBookAdmin.__PolicyBookAdmin_init(policyBookImpl.address);
    await claimingRegistry.__ClaimingRegistry_init();
    await claimVoting.__ClaimVoting_init();
    await reinsurancePool.__ReinsurancePool_init();
    await bmiCoverStaking.__BMICoverStaking_init();
    await rewardsGenerator.__RewardsGenerator_init();

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

    await policyBookAdmin.whitelist(policyBookAddr, true);

    await rewardsGenerator.setRewardPerBlock(wei("100"));

    await reverter.snapshot();
  });

  afterEach("revert", reverter.revert);

  async function createPolicyBooks(numberOfPolicyBooks, isWhitelist) {
    const policyBooks = [];

    for (let i = 0; i < numberOfPolicyBooks; i++) {
      const initialDeposit = toBN(wei("1000"));

      await stbl.approve(policyBookFabric.address, initialDeposit.idiv(10 ** 12));

      await setCurrentTime(1);

      const policyBookAddr = (
        await policyBookFabric.create(
          accounts[i + 1],
          ContractType.CONTRACT,
          "test description" + i,
          "TEST" + i,
          initialDeposit
        )
      ).logs[0].args.at;

      policyBooks.push(await PolicyBookMock.at(policyBookAddr));

      await policyBookAdmin.whitelist(policyBookAddr, isWhitelist);
    }

    return policyBooks;
  }

  describe("tryToAddPolicyBook", async () => {
    const stblAmount = oneToken.times(100).idiv(10 ** 12);
    const liquidityAmount = oneToken.times(10);

    beforeEach("setup", async () => {
      await stbl.transfer(USER1, stblAmount);
      await stbl.approve(policyBook.address, stblAmount, { from: USER1 });
    });

    it("should correctly add policy book address when the user add liquidity", async () => {
      await policyBook.addLiquidity(liquidityAmount, { from: USER1 });

      assert.deepEqual(await liquidityRegistry.getPolicyBooksArr(USER1), [policyBook.address]);
    });

    it("should correctly add policy books addresses when the user add liquidity in different policy books", async () => {
      const numberOfPolicyBooks = 3;
      const policyBooks = await createPolicyBooks(numberOfPolicyBooks, true);
      const policyBooksAddresses = [];

      for (let i = 0; i < numberOfPolicyBooks; i++) {
        await stbl.approve(policyBooks[i].address, stblAmount, { from: USER1 });
        await policyBooks[i].addLiquidity(liquidityAmount, { from: USER1 });
        policyBooksAddresses.push(policyBooks[i].address);
      }

      assert.deepEqual(await liquidityRegistry.getPolicyBooksArr(USER1), policyBooksAddresses);
    });

    it("should correctly update liqudity registry after transfer nft", async () => {
      await policyBook.addLiquidity(liquidityAmount, { from: USER1 });

      assert.deepEqual(await liquidityRegistry.getPolicyBooksArr(USER1), [policyBook.address]);
      assert.deepEqual(await liquidityRegistry.getPolicyBooksArr(USER2), []);

      await policyBook.approve(bmiCoverStaking.address, liquidityAmount, { from: USER1 });

      await bmiCoverStaking.stakeBMIX(liquidityAmount, policyBook.address, { from: USER1 });

      assert.equal(await bmiCoverStaking.totalStaked(USER1), liquidityAmount.toString());
      assert.equal(await bmiCoverStaking.totalStaked(USER2), 0);

      await bmiCoverStaking.safeTransferFrom(USER1, USER2, 1, 1, [], { from: USER1 });

      assert.equal(await bmiCoverStaking.totalStaked(USER1), 0);
      assert.equal(toBN(await bmiCoverStaking.totalStaked(USER2)).toString(), liquidityAmount.toString());

      assert.deepEqual(await liquidityRegistry.getPolicyBooksArr(USER1), []);
      assert.deepEqual(await liquidityRegistry.getPolicyBooksArr(USER2), [policyBook.address]);
    });
  });

  describe("tryToRemovePolicyBook", async () => {
    const stblAmount = oneToken.times(10000).idiv(10 ** 12);
    const liquidityAmount = oneToken.times(1000);

    beforeEach("setup", async () => {
      await stbl.transfer(USER1, stblAmount);
      await stbl.approve(policyBook.address, stblAmount, { from: USER1 });

      await stbl.transfer(USER2, stblAmount);
      await stbl.approve(policyBook.address, stblAmount, { from: USER2 });
    });

    it("should correctly remove policy book address when the user withdraw liquidity", async () => {
      await setCurrentTime(1);
      await policyBook.approve(policyBook.address, liquidityAmount.plus(liquidityAmount), { from: USER1 });
      await policyBook.addLiquidity(liquidityAmount, { from: USER1 });

      await policyBook.requestWithdrawal(liquidityAmount, { from: USER1 });

      assert.deepEqual(await liquidityRegistry.getPolicyBooksArr(USER1), [policyBook.address]);

      await setCurrentTime(withdrawalPeriod.plus(10));

      await policyBook.withdrawLiquidity({ from: USER1 });

      assert.equal(await bmiCoverStaking.totalStaked(USER1), 0);
      assert.equal(await policyBook.balanceOf(USER1), 0);
      assert.equal(await policyBook.getWithdrawalStatus(USER1), WithdrawalStatus.NONE);
      assert.isTrue(toBN((await policyBook.withdrawalsInfo(USER1)).withdrawalAmount).eq(0));

      assert.deepEqual(await liquidityRegistry.getPolicyBooksArr(USER1), []);
    });

    it("should not remove policy book address if user have staking", async () => {
      const stakeAmount = oneToken.times(4);

      await setCurrentTime(1);
      await policyBook.approve(policyBook.address, liquidityAmount, { from: USER1 });
      await policyBook.approve(bmiCoverStaking.address, stakeAmount, { from: USER1 });

      await policyBook.addLiquidityAndStake(liquidityAmount, stakeAmount, { from: USER1 });

      await policyBook.requestWithdrawal(liquidityAmount.minus(stakeAmount), { from: USER1 });

      await setCurrentTime(withdrawalPeriod.plus(10));

      await policyBook.withdrawLiquidity({ from: USER1 });

      assert.equal(await bmiCoverStaking.totalStaked(USER1), stakeAmount.toString());
      assert.equal(await policyBook.balanceOf(USER1), 0);

      assert.deepEqual(await liquidityRegistry.getPolicyBooksArr(USER1), [policyBook.address]);
    });

    it("should not remove policy book address if user have pending withdrawal", async () => {
      await setCurrentTime(1);

      await policyBook.approve(policyBook.address, liquidityAmount, { from: USER1 });
      await policyBook.addLiquidity(liquidityAmount, { from: USER1 });

      await policyBook.requestWithdrawal(liquidityAmount, { from: USER1 });

      const epochsNumber = 5;
      const coverTokensAmount = oneToken.times(1005);
      await policyBook.buyPolicy(epochsNumber, coverTokensAmount, { from: USER1 });

      await setCurrentTime(withdrawalPeriod.plus(10));

      await policyBook.withdrawLiquidity({ from: USER1 });

      assert.isTrue(toBN((await policyBook.withdrawalsInfo(USER1)).withdrawalAmount).gt(0));

      assert.deepEqual(await liquidityRegistry.getPolicyBooksArr(USER1), [policyBook.address]);
    });
  });

  describe("getLiquidityInfos", async () => {
    const stblAmount = oneToken.times(100).idiv(10 ** 12);
    const liquidityAmount = oneToken.times(10);
    const requestAmount = oneToken.times(4);
    const policyBooksCount = 3;

    let stakeAmount = oneToken.times(3);
    let policyBooks;
    let policyBooksAddresses;

    before("setup", async () => {
      await stbl.transfer(USER1, stblAmount);
      await stbl.approve(policyBook.address, stblAmount, { from: USER1 });

      policyBooks = await createPolicyBooks(policyBooksCount, true);
      policyBooksAddresses = [];

      for (let i = 0; i < policyBooksCount; i++) {
        await stbl.approve(policyBooks[i].address, stblAmount, { from: USER1 });
        await policyBooks[i].approve(bmiCoverStaking.address, liquidityAmount, { from: USER1 });

        await policyBooks[i].addLiquidityAndStake(liquidityAmount, stakeAmount, { from: USER1 });
        policyBooksAddresses.push(policyBooks[i].address);
      }
    });

    it("should return correct infos if policy book not whitelisted", async () => {
      await setCurrentTime(1);

      await policyBookAdmin.whitelist(policyBooksAddresses[0], false);

      await setCurrentTime(10);

      for (let i = 0; i < 2; i++) {
        await policyBooks[i].approve(policyBooks[i].address, requestAmount, { from: USER1 });
        await policyBooks[i].requestWithdrawal(requestAmount, { from: USER1 });
      }

      const result = await liquidityRegistry.getLiquidityInfos(USER1, 0, 5);

      assert.equal(result.length, 3);

      const firstInfo = result[0];

      assert.equal(toBN(firstInfo.lockedAmount).toString(), requestAmount.toString());
      assert.equal(
        toBN(firstInfo.availableAmount).toString(),
        liquidityAmount.minus(requestAmount).minus(stakeAmount).toString()
      );
      assert.equal(
        toBN(firstInfo.bmiXRatio).toString(),
        toBN(await policyBooks[0].convertBMIXToSTBL(toBN(wei("1")))).toString()
      );

      const secondInfo = result[1];

      assert.equal(toBN(secondInfo.lockedAmount).toString(), requestAmount.toString());
      assert.equal(
        toBN(secondInfo.availableAmount).toString(),
        liquidityAmount.minus(requestAmount).minus(stakeAmount).toString()
      );
    });
  });

  describe("getWithdrawalRequests", async () => {
    const stblAmount = oneToken.times(10000).idiv(10 ** 12);
    const liquidityAmount = oneToken.times(1000);
    const requestAmount = oneToken.times(400);
    const policyBooksCount = 3;

    let policyBooks;
    let policyBooksAddresses;

    beforeEach("setup", async () => {
      await stbl.transfer(USER1, stblAmount);
      await stbl.approve(policyBook.address, stblAmount, { from: USER1 });

      policyBooks = await createPolicyBooks(policyBooksCount, true);
      policyBooksAddresses = [];

      for (let i = 0; i < policyBooksCount; i++) {
        await stbl.approve(policyBooks[i].address, stblAmount, { from: USER1 });

        await policyBooks[i].approve(policyBooks[i].address, liquidityAmount.plus(requestAmount.times(2)), {
          from: USER1,
        });
        await policyBooks[i].addLiquidity(liquidityAmount, { from: USER1 });

        policyBooksAddresses.push(policyBooks[i].address);
      }
    });

    it("should return correct values", async () => {
      await setCurrentTime(10);

      await policyBooks[0].requestWithdrawal(requestAmount, { from: USER1 });
      await policyBooks[2].requestWithdrawal(requestAmount.times(2), { from: USER1 });

      const resultArr = await liquidityRegistry.getWithdrawalRequests(USER1, 0, 5);

      const arrLength = resultArr[0];
      const requestsArr = resultArr[1];

      assert.equal(arrLength, 2);

      const firstInfo = requestsArr[0];

      assert.equal(firstInfo.policyBookAddr, policyBooksAddresses[0]);
      assert.equal(toBN(firstInfo.requestAmount).toString(), requestAmount.toString());
      assert.equal(toBN(firstInfo.requestSTBLAmount).toString(), requestAmount.toString());
      assert.equal(toBN(firstInfo.availableLiquidity).toString(), liquidityAmount.plus(wei("1000")).toString());
      assert.equal(toBN(firstInfo.readyToWithdrawDate).toString(), withdrawalPeriod.plus(10).toString());
      assert.equal(toBN(firstInfo.endWithdrawDate).toString(), 0);

      const secondInfo = requestsArr[1];

      assert.equal(secondInfo.policyBookAddr, policyBooksAddresses[2]);
      assert.equal(toBN(secondInfo.requestAmount).toString(), requestAmount.times(2).toString());
      assert.equal(toBN(secondInfo.requestSTBLAmount).toString(), requestAmount.times(2).toString());
      assert.equal(toBN(secondInfo.availableLiquidity).toString(), liquidityAmount.plus(wei("1000")).toString());
    });

    it("should return correct end withdraw date if withdraw possible", async () => {
      await setCurrentTime(10);

      await policyBooks[0].requestWithdrawal(requestAmount, { from: USER1 });

      await setCurrentTime(withdrawalPeriod.plus(100));

      const resultArr = await liquidityRegistry.getWithdrawalRequests(USER1, 0, 5);

      const arrLength = resultArr[0];
      const requestsArr = resultArr[1];

      assert.equal(arrLength, 1);

      const firstInfo = requestsArr[0];

      assert.equal(firstInfo.policyBookAddr, policyBooksAddresses[0]);
      assert.equal(toBN(firstInfo.readyToWithdrawDate).toString(), withdrawalPeriod.plus(10).toString());
      assert.equal(
        toBN(firstInfo.endWithdrawDate).toString(),
        withdrawalPeriod.plus(readyToWithdrawPeriod).plus(10).toString()
      );
    });

    it("should return correct array if user have allowed withdraw", async () => {
      await setCurrentTime(10);

      await policyBooks[0].requestWithdrawal(requestAmount, { from: USER1 });
      await policyBooks[1].requestWithdrawal(requestAmount, { from: USER1 });

      const epochsNumber = 5;
      const coverTokensAmount = oneToken.times(1800);

      await policyBooks[1].buyPolicy(epochsNumber, coverTokensAmount, { from: USER1 });

      await setCurrentTime(withdrawalPeriod.plus(100));

      await policyBooks[1].withdrawLiquidity({ from: USER1 });

      assert.equal(await policyBooks[1].getWithdrawalStatus(USER1), WithdrawalStatus.READY);

      const resultArr = await liquidityRegistry.getWithdrawalRequests(USER1, 0, 5);

      const arrLength = resultArr[0];
      const requestsArr = resultArr[1];

      assert.equal(arrLength, 1);

      const firstInfo = requestsArr[0];

      assert.equal(firstInfo.policyBookAddr, policyBooksAddresses[0]);
    });
  });

  describe("getWithdrawalSet", async () => {
    const stblAmount = oneToken.times(10000).idiv(10 ** 12);
    const liquidityAmount = oneToken.times(1000);
    const requestAmount = oneToken.times(400);
    const coverTokensAmount = oneToken.times(1800);
    const epochsNumber = 5;
    const policyBooksCount = 3;

    let policyBooks;
    let policyBooksAddresses;

    beforeEach("setup", async () => {
      await stbl.transfer(USER1, stblAmount);
      await stbl.approve(policyBook.address, stblAmount, { from: USER1 });

      policyBooks = await createPolicyBooks(policyBooksCount, true);
      policyBooksAddresses = [];

      for (let i = 0; i < policyBooksCount; i++) {
        await stbl.approve(policyBooks[i].address, stblAmount, { from: USER1 });

        await policyBooks[i].approve(policyBooks[i].address, liquidityAmount.plus(requestAmount), { from: USER1 });
        await policyBooks[i].addLiquidity(liquidityAmount, { from: USER1 });

        policyBooksAddresses.push(policyBooks[i].address);
      }
    });

    it("should return correct values", async () => {
      await setCurrentTime(10);

      await policyBooks[0].requestWithdrawal(requestAmount, { from: USER1 });
      await policyBooks[2].requestWithdrawal(requestAmount.times(2), { from: USER1 });

      await policyBooks[0].buyPolicy(epochsNumber, coverTokensAmount, { from: USER1 });
      await policyBooks[2].buyPolicy(epochsNumber, coverTokensAmount, { from: USER1 });

      await setCurrentTime(withdrawalPeriod.plus(100));

      const withdrawal1Amount = BigNumber.min(
        requestAmount,
        toBN(await policyBooks[0].getAvailableBMIXWithdrawableAmount(USER1))
      );

      const withdrawal2Amount = BigNumber.min(
        requestAmount.times(2),
        toBN(await policyBooks[2].getAvailableBMIXWithdrawableAmount(USER1))
      );

      await policyBooks[0].withdrawLiquidity({ from: USER1 });
      await policyBooks[2].withdrawLiquidity({ from: USER1 });

      await policyBooks[0].addLiquidity(liquidityAmount, { from: USER1 });
      await policyBooks[2].addLiquidity(liquidityAmount, { from: USER1 });

      const resultArr = await liquidityRegistry.getWithdrawalSet(USER1, 0, 5);

      const arrLength = resultArr[0];
      const requestsArr = resultArr[1];

      assert.equal(arrLength, 2);

      const firstInfo = requestsArr[0];

      assert.equal(firstInfo.policyBookAddr, policyBooksAddresses[0]);
      assert.equal(toBN(firstInfo.requestAmount).toString(), requestAmount.minus(withdrawal1Amount).toString());
      assert.equal(toBN(firstInfo.availableSTBLAmount).toString(), liquidityAmount.plus(1).toString());

      const secondInfo = requestsArr[1];

      assert.equal(secondInfo.policyBookAddr, policyBooksAddresses[2]);
      assert.closeTo(
        toBN(secondInfo.requestAmount).toNumber(),
        requestAmount.times(2).minus(withdrawal2Amount).toNumber(),
        toBN(wei("0.0000001")).toNumber()
      );
      assert.equal(toBN(secondInfo.availableSTBLAmount).toString(), liquidityAmount.plus(1).toString());
    });

    it("should return correct values if only one user in withdrawal set", async () => {
      await setCurrentTime(10);

      await policyBooks[0].requestWithdrawal(requestAmount, { from: USER1 });
      await policyBooks[1].requestWithdrawal(requestAmount, { from: USER1 });
      await policyBooks[2].requestWithdrawal(requestAmount, { from: USER1 });

      await policyBooks[0].buyPolicy(epochsNumber, coverTokensAmount, { from: USER1 });

      await setCurrentTime(withdrawalPeriod.plus(100));

      const withdrawal1Amount = BigNumber.min(
        requestAmount,
        toBN(await policyBooks[0].getAvailableBMIXWithdrawableAmount(USER1))
      );

      await setCurrentTime(withdrawalPeriod.plus(100));

      await policyBooks[0].withdrawLiquidity({ from: USER1 });
      await policyBooks[2].withdrawLiquidity({ from: USER1 });

      await policyBooks[0].addLiquidity(liquidityAmount, { from: USER1 });

      const resultArr = await liquidityRegistry.getWithdrawalSet(USER1, 0, 5);

      const arrLength = resultArr[0];
      const requestsArr = resultArr[1];

      assert.equal(arrLength, 1);

      const firstInfo = requestsArr[0];

      assert.equal(firstInfo.policyBookAddr, policyBooksAddresses[0]);
      assert.equal(toBN(firstInfo.requestAmount).toString(), requestAmount.minus(withdrawal1Amount).toString());
      assert.equal(toBN(firstInfo.availableSTBLAmount).toString(), liquidityAmount.plus(1).toString());
    });
  });
});
