const ContractsRegistry = artifacts.require("ContractsRegistry");
const LiquidityMiningStakingMock = artifacts.require("LiquidityMiningStakingMock");
const BMIMock = artifacts.require("BMIMock");
const LPTokenMock = artifacts.require("LPTokenMock");
const BMIStaking = artifacts.require("BMIStaking");
const StkBMIToken = artifacts.require("STKBMIToken");
const LiquidityMiningMock = artifacts.require("LiquidityMiningMock");

const Reverter = require("./helpers/reverter");
const truffleAssert = require("truffle-assertions");
const BigNumber = require("bignumber.js");

const setCurrentTime = require("./helpers/ganacheTimeTraveler");
const advanceBlockAtTime = require("./helpers/ganacheTimeTraveler");

function toBN(number) {
  return new BigNumber(number);
}

contract("LiquidityMiningStaking", async (accounts) => {
  const reverter = new Reverter(web3);

  const OWNER = accounts[0];
  const FIRST_ADDRESS = accounts[1];
  const SECOND_ADDRESS = accounts[2];
  const THIRD_ADDRESS = accounts[3];

  const LEGACY_STAKING = accounts[8];

  const NOTHING = accounts[9];

  const APY_PRECISION = toBN(10 ** 5);

  let staking;
  let stakingToken;
  let rewardToken;
  let rewardStaking;
  let rewardStakingToken;
  let liquidityMiningMock;

  const mintAndApproveStaked = async (address, amount) => {
    await stakingToken.mintArbitrary(address, amount);
    await stakingToken.approve(staking.address, amount, { from: address });
  };

  before("setup", async () => {
    const contractsRegistry = await ContractsRegistry.new();
    stakingToken = await LPTokenMock.new("", "");
    rewardToken = await BMIMock.new(NOTHING);
    const _rewardStaking = await BMIStaking.new();
    const _rewardStakingToken = await StkBMIToken.new();
    const _stakingMock = await LiquidityMiningStakingMock.new();
    const _liquidityMiningMock = await LiquidityMiningMock.new();

    await contractsRegistry.__ContractsRegistry_init();

    await contractsRegistry.addContract(await contractsRegistry.LEGACY_BMI_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_COVER_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_UTILITY_NFT_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.POLICY_BOOK_REGISTRY_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.VBMI_NAME(), NOTHING);

    await contractsRegistry.addContract(await contractsRegistry.LEGACY_LIQUIDITY_MINING_STAKING_NAME(), LEGACY_STAKING);
    await contractsRegistry.addContract(await contractsRegistry.UNISWAP_BMI_TO_ETH_PAIR_NAME(), stakingToken.address);
    await contractsRegistry.addContract(await contractsRegistry.BMI_NAME(), rewardToken.address);

    await contractsRegistry.addProxyContract(await contractsRegistry.BMI_STAKING_NAME(), _rewardStaking.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.STKBMI_NAME(), _rewardStakingToken.address);
    await contractsRegistry.addProxyContract(
      await contractsRegistry.LIQUIDITY_MINING_STAKING_NAME(),
      _stakingMock.address
    );
    await contractsRegistry.addProxyContract(
      await contractsRegistry.LIQUIDITY_MINING_NAME(),
      _liquidityMiningMock.address
    );

    rewardStaking = await BMIStaking.at(await contractsRegistry.getBMIStakingContract());
    rewardStakingToken = await StkBMIToken.at(await contractsRegistry.getSTKBMIContract());
    staking = await LiquidityMiningStakingMock.at(await contractsRegistry.getLiquidityMiningStakingContract());
    liquidityMiningMock = await LiquidityMiningMock.at(await contractsRegistry.getLiquidityMiningContract());

    await rewardStaking.__BMIStaking_init("0");
    await rewardStakingToken.__STKBMIToken_init();
    await staking.__LiquidityMiningStaking_init();
    await liquidityMiningMock.__LiquidityMining_init();

    await contractsRegistry.injectDependencies(await contractsRegistry.BMI_STAKING_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.STKBMI_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_MINING_STAKING_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_MINING_NAME());

    const stakingTokensAmount = web3.utils.toWei("100");

    await liquidityMiningMock.setStartTime(1);

    await setCurrentTime(200 * 24 * 60 * 60);

    await rewardToken.mintArbitrary(staking.address, web3.utils.toWei("10000"));
    await mintAndApproveStaked(FIRST_ADDRESS, stakingTokensAmount);
    await mintAndApproveStaked(SECOND_ADDRESS, stakingTokensAmount);
    await mintAndApproveStaked(THIRD_ADDRESS, stakingTokensAmount);

    await reverter.snapshot();
  });

  afterEach("revert", reverter.revert);

  const getTransactionBlock = (tx) => tx.receipt.blockNumber;
  const getCurrentBlock = async () => (await web3.eth.getBlock("latest")).number;
  const advanceBlocks = async (amount) => {
    for (let i = 0; i < amount; i++) {
      await advanceBlockAtTime(1);
    }
  };

  describe("setRewards", async () => {
    it("should revert if not owner", async () => {
      await truffleAssert.reverts(
        staking.setRewards(web3.utils.toWei("100"), await getCurrentBlock(), 100, { from: FIRST_ADDRESS }),
        "Ownable: caller is not the owner."
      );
    });

    it("should not allow to set more tokens than contract have", async () => {
      const fromBlock = (await getCurrentBlock()) + 2;
      await truffleAssert.reverts(
        staking.setRewards(web3.utils.toWei("101"), fromBlock, 100),
        "LMS: Not enough tokens for the rewards"
      );
    });

    it("should update reward per token before", async () => {
      await staking.setRewards(web3.utils.toWei("10"), await getCurrentBlock(), 100);
      await staking.stake(web3.utils.toWei("100"), { from: FIRST_ADDRESS });
      const tx = await staking.setRewards(web3.utils.toWei("100"), await getCurrentBlock(), 100);

      assert.equal((await staking.rewardPerTokenStored()).toString(), web3.utils.toWei("0.1"));
      assert.equal(await staking.lastUpdateBlock(), getTransactionBlock(tx));
    });

    it("should validly calculate tokens locked in a case of a change in the middle", async () => {
      const fromBlock = await getCurrentBlock();
      await staking.setRewards(web3.utils.toWei("100"), fromBlock, 100);
      assert.equal((await staking.rewardTokensLocked()).toString(), web3.utils.toWei("9800"));

      await advanceBlocks(5);
      await staking.setRewards(web3.utils.toWei("50"), fromBlock, 100);
      assert.equal((await staking.rewardTokensLocked()).toString(), web3.utils.toWei("5200"));
    });

    it("should validly calculate tokens locked with change from before to after", async () => {
      const fromBlock = (await getCurrentBlock()) + 2;
      await staking.setRewards(web3.utils.toWei("100"), fromBlock + 20, 100);
      assert.equal((await staking.rewardTokensLocked()).toString(), web3.utils.toWei("10000"));

      await advanceBlocks(5);
      await staking.setRewards(web3.utils.toWei("50"), fromBlock - 5, 3);
      assert.equal((await staking.rewardTokensLocked()).toString(), web3.utils.toWei("0"));
    });

    it("should validly calculate tokens locked with change from after to before", async () => {
      await advanceBlocks(5);
      const fromBlock = (await getCurrentBlock()) + 2;
      await staking.setRewards(web3.utils.toWei("100"), fromBlock - 5, 3);
      assert.equal((await staking.rewardTokensLocked()).toString(), web3.utils.toWei("0"));

      await advanceBlocks(5);
      await staking.setRewards(web3.utils.toWei("50"), fromBlock + 20, 100);
      assert.equal((await staking.rewardTokensLocked()).toString(), web3.utils.toWei("5000"));
    });

    it("should change the underlying fields as expected", async () => {
      const fromBlock = await getCurrentBlock();
      await staking.setRewards(web3.utils.toWei("100"), fromBlock, 100);

      assert.equal((await staking.rewardPerBlock()).toString(), web3.utils.toWei("100").toString());
      assert.equal((await staking.firstBlockWithReward()).toString(), fromBlock);
      assert.equal((await staking.lastBlockWithReward()).toString(), fromBlock + 99);
    });

    it("should emit expected event", async () => {
      const fromBlock = await getCurrentBlock();
      const tx = await staking.setRewards(web3.utils.toWei("100"), fromBlock, 100);

      const event = tx.logs.find((x) => x.event == "RewardsSet").args;
      assert.equal(event.rewardPerBlock.toString(), web3.utils.toWei("100").toString());
      assert.equal(event.firstBlockWithReward.toString(), fromBlock);
      assert.equal(event.lastBlockWithReward.toString(), fromBlock + 99);
    });
  });

  describe("stake", async () => {
    beforeEach("setup", async () => {
      await staking.setRewards(web3.utils.toWei("100"), await getCurrentBlock(), 100);
    });

    it("should update user rewards before", async () => {
      await staking.stake(web3.utils.toWei("50"), { from: FIRST_ADDRESS });
      const tx = await staking.stake(web3.utils.toWei("50"), { from: FIRST_ADDRESS });

      const currentBlock = getTransactionBlock(tx);
      assert.equal((await staking.rewards(FIRST_ADDRESS)).toString(), web3.utils.toWei("80"));
      assert.equal((await staking.userRewardPerTokenPaid(FIRST_ADDRESS)).toString(), web3.utils.toWei("2"));
      assert.equal((await staking.rewardPerTokenStored()).toString(), web3.utils.toWei("2"));
      assert.equal(await staking.lastUpdateBlock(), currentBlock);
    });

    it("should not be able to stake zero", async () => {
      await truffleAssert.reverts(staking.stake(0, { from: FIRST_ADDRESS }), "LMS: Amount should be greater than 0");
    });

    it("should not be able stake more than have", async () => {
      await truffleAssert.reverts(
        staking.stake(web3.utils.toWei("101"), { from: FIRST_ADDRESS }),
        "ERC20: transfer amount exceeds balance"
      );
    });

    it("should accurately change contract state", async () => {
      await staking.stake(web3.utils.toWei("70"), { from: FIRST_ADDRESS });
      await staking.stake(web3.utils.toWei("30"), { from: SECOND_ADDRESS });

      assert.equal((await staking.totalStaked()).toString(), web3.utils.toWei("100"));
      assert.equal((await staking.staked(FIRST_ADDRESS)).toString(), web3.utils.toWei("70"));
      assert.equal((await staking.staked(SECOND_ADDRESS)).toString(), web3.utils.toWei("30"));
    });

    it("should trasfer staked tokens", async () => {
      await staking.stake(web3.utils.toWei("70"), { from: FIRST_ADDRESS });

      assert.equal((await stakingToken.balanceOf(FIRST_ADDRESS)).toString(), web3.utils.toWei("30"));
      assert.equal((await stakingToken.balanceOf(staking.address)).toString(), web3.utils.toWei("70"));
    });

    it("should emit valid event", async () => {
      const tx = await staking.stake(web3.utils.toWei("70"), { from: FIRST_ADDRESS });

      const event = tx.logs.find((x) => x.event == "Staked").args;
      assert.equal(event.user, FIRST_ADDRESS);
      assert.equal(event.amount.toString(), web3.utils.toWei("70"));
    });

    it("should stake from legacy staking", async () => {
      await staking.stake(web3.utils.toWei("100"), { from: SECOND_ADDRESS });

      await advanceBlocks(10);

      await stakingToken.transfer(staking.address, web3.utils.toWei("70"), { from: FIRST_ADDRESS });
      await staking.stakeFor(FIRST_ADDRESS, web3.utils.toWei("70"), { from: LEGACY_STAKING });

      assert.equal((await stakingToken.balanceOf(FIRST_ADDRESS)).toString(), web3.utils.toWei("30"));
      assert.equal((await stakingToken.balanceOf(staking.address)).toString(), web3.utils.toWei("170"));
      assert.equal((await staking.staked(FIRST_ADDRESS)).toString(), web3.utils.toWei("70"));

      await advanceBlocks(10);

      assert.closeTo(
        toBN(await staking.earned(FIRST_ADDRESS)).toNumber(),
        toBN(web3.utils.toWei("411.7647058823529")).toNumber(),
        toBN(web3.utils.toWei("0.00000000001")).toNumber()
      );
    });
  });

  describe("widthdraw", async () => {
    beforeEach("setup", async () => {
      await staking.setRewards(web3.utils.toWei("100"), await getCurrentBlock(), 100);
      await staking.stake(web3.utils.toWei("50"), { from: FIRST_ADDRESS });
      await staking.stake(web3.utils.toWei("50"), { from: SECOND_ADDRESS });
    });

    it("should update rewards before", async () => {
      const tx = await staking.withdraw(web3.utils.toWei("50"), { from: SECOND_ADDRESS });

      const currentBlock = getTransactionBlock(tx);
      assert.equal((await staking.rewards(SECOND_ADDRESS)).toString(), web3.utils.toWei("40"));
      assert.equal((await staking.userRewardPerTokenPaid(SECOND_ADDRESS)).toString(), web3.utils.toWei("3"));
      assert.equal((await staking.rewardPerTokenStored()).toString(), web3.utils.toWei("3"));
      assert.equal(await staking.lastUpdateBlock(), currentBlock);
    });

    it("should not be able to withdraw zero", async () => {
      await truffleAssert.reverts(staking.withdraw(0, { from: FIRST_ADDRESS }), "LMS: Amount should be greater than 0");
    });

    it("should not be able withdraw more than have", async () => {
      await truffleAssert.reverts(
        staking.withdraw(web3.utils.toWei("51"), { from: FIRST_ADDRESS }),
        "LMS: Insufficient staked amount"
      );
    });

    it("should accurately change contract state", async () => {
      await staking.withdraw(web3.utils.toWei("20"), { from: FIRST_ADDRESS });

      assert.equal((await staking.totalStaked()).toString(), web3.utils.toWei("80"));
      assert.equal((await staking.staked(FIRST_ADDRESS)).toString(), web3.utils.toWei("30"));
    });

    it("should trasfer staked tokens", async () => {
      await staking.withdraw(web3.utils.toWei("20"), { from: FIRST_ADDRESS });

      assert.equal((await stakingToken.balanceOf(FIRST_ADDRESS)).toString(), web3.utils.toWei("70"));
      assert.equal((await stakingToken.balanceOf(staking.address)).toString(), web3.utils.toWei("80"));
    });

    it("should emit valid event", async () => {
      const tx = await staking.withdraw(web3.utils.toWei("20"), { from: FIRST_ADDRESS });

      const event = tx.logs.find((x) => x.event == "Withdrawn").args;
      assert.equal(event.user, FIRST_ADDRESS);
      assert.equal(event.amount.toString(), web3.utils.toWei("20"));
    });
  });

  describe("getReward", async () => {
    beforeEach("setup", async () => {
      await staking.setRewards(web3.utils.toWei("100"), (await getCurrentBlock()) + 2, 100);
      await staking.stake(web3.utils.toWei("50"), { from: FIRST_ADDRESS });
    });

    it("should update rewards before", async () => {
      const tx = await staking.getReward({ from: FIRST_ADDRESS });

      const currentBlock = getTransactionBlock(tx);
      assert.equal((await staking.userRewardPerTokenPaid(FIRST_ADDRESS)).toString(), web3.utils.toWei("2"));
      assert.equal((await staking.rewardPerTokenStored()).toString(), web3.utils.toWei("2"));
      assert.equal(await staking.lastUpdateBlock(), currentBlock);
    });

    it("should clear saved reward", async () => {
      await staking.getReward({ from: FIRST_ADDRESS });

      assert.equal((await staking.rewards(FIRST_ADDRESS)).toString(), 0);
    });

    it("should transfer tokens and lower tokens locked", async () => {
      await staking.getReward({ from: FIRST_ADDRESS });

      assert.equal((await rewardToken.balanceOf(FIRST_ADDRESS)).toString(), web3.utils.toWei("80"));
      assert.equal((await rewardToken.balanceOf(staking.address)).toString(), web3.utils.toWei("9900"));
      assert.equal((await staking.rewardTokensLocked()).toString(), web3.utils.toWei("9900"));
    });

    it("should emit event", async () => {
      const tx = await staking.getReward({ from: FIRST_ADDRESS });

      const event = tx.logs.find((x) => x.event == "RewardPaid").args;
      assert.equal(event.user, FIRST_ADDRESS);
      assert.equal(event.reward.toString(), web3.utils.toWei("80"));
    });
  });

  describe("restake", async () => {
    beforeEach("setup", async () => {
      await staking.setRewards(web3.utils.toWei("100"), (await getCurrentBlock()) + 2, 100);
      await staking.stake(web3.utils.toWei("50"), { from: FIRST_ADDRESS });
    });

    it("should update rewards before", async () => {
      const tx = await staking.restake({ from: FIRST_ADDRESS });

      const currentBlock = getTransactionBlock(tx);
      assert.equal((await staking.userRewardPerTokenPaid(FIRST_ADDRESS)).toString(), web3.utils.toWei("2"));
      assert.equal((await staking.rewardPerTokenStored()).toString(), web3.utils.toWei("2"));
      assert.equal(await staking.lastUpdateBlock(), currentBlock);
    });

    it("should clear saved reward", async () => {
      await staking.restake({ from: FIRST_ADDRESS });

      assert.equal((await staking.rewards(FIRST_ADDRESS)).toString(), 0);
    });

    it("should receive staking tokens and lower tokens locked", async () => {
      await staking.restake({ from: FIRST_ADDRESS });

      assert.equal((await rewardToken.balanceOf(FIRST_ADDRESS)).toString(), 0);
      assert.equal((await rewardStakingToken.balanceOf(staking.address)).toString(), 0);
      assert.equal((await rewardStakingToken.balanceOf(FIRST_ADDRESS)).toString(), web3.utils.toWei("100"));
      assert.equal((await rewardToken.balanceOf(staking.address)).toString(), web3.utils.toWei("9900"));
      assert.equal((await staking.rewardTokensLocked()).toString(), web3.utils.toWei("9900"));
    });

    it("should emit event", async () => {
      const tx = await staking.restake({ from: FIRST_ADDRESS });

      const event = tx.logs.find((x) => x.event == "RewardRestaked").args;
      assert.equal(event.user, FIRST_ADDRESS);
      assert.equal(event.reward.toString(), web3.utils.toWei("100"));
    });
  });

  describe("exit", async () => {
    beforeEach("setup", async () => {
      await staking.setRewards(web3.utils.toWei("100"), await getCurrentBlock(), 100);
      await staking.stake(web3.utils.toWei("50"), { from: FIRST_ADDRESS });
    });

    it("should withdraw staking tokens", async () => {
      await staking.exit({ from: FIRST_ADDRESS });

      assert.equal((await stakingToken.balanceOf(FIRST_ADDRESS)).toString(), web3.utils.toWei("100"));
    });

    it("should withdraw reward tokens", async () => {
      await staking.exit({ from: FIRST_ADDRESS });

      assert.equal((await rewardToken.balanceOf(FIRST_ADDRESS)).toString(), web3.utils.toWei("80"));
    });
  });

  describe("recoverNonLockedRewardTokens", async () => {
    beforeEach("setup", async () => {
      await staking.setRewards(web3.utils.toWei("50"), await getCurrentBlock(), 100);
      await staking.stake(web3.utils.toWei("50"), { from: FIRST_ADDRESS });
    });

    it("should recover reward tokens", async () => {
      const lockedAmount = await staking.rewardTokensLocked();
      const expectedRecover = (await rewardToken.balanceOf(staking.address)).sub(lockedAmount);
      const balanceBefore = await rewardToken.balanceOf(OWNER);
      await staking.recoverNonLockedRewardTokens();

      assert.equal((await rewardToken.balanceOf(OWNER)).toString(), balanceBefore.add(expectedRecover));
      assert.equal((await rewardToken.balanceOf(staking.address)).toString(), lockedAmount);
    });

    it("should emit valid event", async () => {
      const lockedAmount = await staking.rewardTokensLocked();
      const expectedRecover = (await rewardToken.balanceOf(staking.address)).sub(lockedAmount);
      const tx = await staking.recoverNonLockedRewardTokens();

      const event = tx.logs.find((x) => x.event == "RewardTokensRecovered").args;
      assert.equal(event.amount.toString(), expectedRecover);
    });
  });

  describe("earned calculation", async () => {
    it("before start block is zero", async () => {
      await staking.setRewards(web3.utils.toWei("100"), (await getCurrentBlock()) + 50, 100);
      await staking.stake(web3.utils.toWei("50"), { from: FIRST_ADDRESS });
      await advanceBlocks(5);

      assert.equal((await staking.earned(FIRST_ADDRESS)).toString(), 0);
    });

    it("start in the middle of calculation", async () => {
      await staking.setRewards(web3.utils.toWei("100"), (await getCurrentBlock()) + 5, 100);
      await staking.stake(web3.utils.toWei("50"), { from: FIRST_ADDRESS });
      await advanceBlocks(4);
      await setCurrentTime(1);

      assert.equal((await staking.earned(FIRST_ADDRESS)).toString(), web3.utils.toWei("200"));
      assert.equal((await staking.earnedSlashed(FIRST_ADDRESS)).toString(), web3.utils.toWei("20"));
    });

    it("end in the middle of calculation", async () => {
      await advanceBlocks(5);
      await staking.setRewards(web3.utils.toWei("100"), (await getCurrentBlock()) - 5, 10);
      await staking.stake(web3.utils.toWei("50"), { from: FIRST_ADDRESS });
      await advanceBlocks(4);
      await setCurrentTime(100 * 24 * 60 * 60 + 10);

      assert.equal((await staking.earned(FIRST_ADDRESS)).toString(), web3.utils.toWei("200"));
      assert.equal((await staking.earnedSlashed(FIRST_ADDRESS)).toString(), web3.utils.toWei("160"));
    });

    it("after end block is zero", async () => {
      await advanceBlocks(11);
      await staking.setRewards(web3.utils.toWei("100"), (await getCurrentBlock()) - 11, 10);
      await staking.stake(web3.utils.toWei("50"), { from: FIRST_ADDRESS });
      await advanceBlocks(5);

      assert.equal((await staking.earned(FIRST_ADDRESS)).toString(), 0);
    });

    it("with small stakes", async () => {
      await staking.setRewards(web3.utils.toWei("100"), await getCurrentBlock(), 100);
      await staking.stake(1, { from: FIRST_ADDRESS });
      await staking.stake(2, { from: SECOND_ADDRESS });
      await staking.stake(7, { from: THIRD_ADDRESS });
      await advanceBlocks(5);

      assert.equal((await staking.earned(THIRD_ADDRESS)).toString(), web3.utils.toWei("350"));
    });

    it("with large stakes", async () => {
      await staking.setRewards(web3.utils.toWei("100"), await getCurrentBlock(), 100);

      await mintAndApproveStaked(FIRST_ADDRESS, web3.utils.toWei("1000"));
      await mintAndApproveStaked(SECOND_ADDRESS, web3.utils.toWei("2000"));
      await mintAndApproveStaked(THIRD_ADDRESS, web3.utils.toWei("7000"));

      await staking.stake(web3.utils.toWei("1000"), { from: FIRST_ADDRESS });
      await staking.stake(web3.utils.toWei("2000"), { from: SECOND_ADDRESS });
      await staking.stake(web3.utils.toWei("7000"), { from: THIRD_ADDRESS });
      await advanceBlocks(5);

      assert.equal((await staking.earned(THIRD_ADDRESS)).toString(), web3.utils.toWei("350"));
    });
  });

  describe("reward complex calculation cases", async () => {
    const assertEarnedRoundedDownEqual = async (address, expected) => {
      const earnedTokens = web3.utils.fromWei(await staking.earned(address));
      assert.equal(Math.floor(earnedTokens.toString()), expected);
    };

    // Case taken from a document
    it("should accurately accrue rewards in a long run", async () => {
      await staking.setRewards(web3.utils.toWei("100"), await getCurrentBlock(), 100);
      await staking.stake(web3.utils.toWei("10"), { from: FIRST_ADDRESS });
      await advanceBlocks(1);
      await staking.stake(web3.utils.toWei("20"), { from: SECOND_ADDRESS });
      await advanceBlocks(4);
      await staking.stake(web3.utils.toWei("10"), { from: THIRD_ADDRESS });
      await advanceBlocks(3);
      await staking.stake(web3.utils.toWei("10"), { from: FIRST_ADDRESS });
      await staking.stake(web3.utils.toWei("30"), { from: SECOND_ADDRESS });
      await advanceBlocks(3);
      await staking.withdraw(web3.utils.toWei("10"), { from: FIRST_ADDRESS });
      await advanceBlocks(2);
      await staking.withdraw(web3.utils.toWei("50"), { from: SECOND_ADDRESS });
      await advanceBlocks(2);
      await staking.withdraw(web3.utils.toWei("10"), { from: FIRST_ADDRESS });
      await advanceBlocks(2);

      await assertEarnedRoundedDownEqual(FIRST_ADDRESS, "799");
      await assertEarnedRoundedDownEqual(SECOND_ADDRESS, "1037");
      await assertEarnedRoundedDownEqual(THIRD_ADDRESS, "562");
    });

    it("should accurately accrue rewards in a case of rewards reset", async () => {
      await rewardToken.mintArbitrary(staking.address, web3.utils.toWei("20000"));

      await staking.setRewards(web3.utils.toWei("100"), await getCurrentBlock(), 100);
      await staking.stake(web3.utils.toWei("10"), { from: FIRST_ADDRESS });
      await advanceBlocks(1);
      await staking.stake(web3.utils.toWei("20"), { from: SECOND_ADDRESS });
      await advanceBlocks(4);
      await staking.stake(web3.utils.toWei("10"), { from: THIRD_ADDRESS });
      await advanceBlocks(2);
      await staking.setRewards(web3.utils.toWei("200"), await getCurrentBlock(), 100);
      await advanceBlocks(2);
      await staking.withdraw(web3.utils.toWei("20"), { from: SECOND_ADDRESS });
      await advanceBlocks(2);

      await assertEarnedRoundedDownEqual(FIRST_ADDRESS, "791");
      await assertEarnedRoundedDownEqual(SECOND_ADDRESS, "783");
      await assertEarnedRoundedDownEqual(THIRD_ADDRESS, "425");
    });
  });

  describe("APY", async () => {
    it("should calculate correct APY", async () => {
      await staking.setRewards(web3.utils.toWei("100"), await getCurrentBlock(), 100);

      await stakingToken.setReserves(web3.utils.toWei("500000"), web3.utils.toWei("250000"));

      assert.equal(
        toBN(await staking.getAPY())
          .idiv(APY_PRECISION)
          .toString(),
        "23549562750"
      );
    });

    it("should calculate correct APY without reserve", async () => {
      await staking.setRewards(web3.utils.toWei("100"), await getCurrentBlock(), 100);

      assert.equal(toBN(await staking.getAPY()).toString(), "0");
    });

    it("should calculate correct APY without rewards", async () => {
      assert.equal(toBN(await staking.getAPY()).toString(), "0");
    });
  });
});
