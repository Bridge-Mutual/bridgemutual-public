const ContractsRegistry = artifacts.require("ContractsRegistry");
const BMIStaking = artifacts.require("BMIStaking");
const BMIMock = artifacts.require("BMIMock");
const StkBMIToken = artifacts.require("STKBMIToken");
const LiquidityMiningMock = artifacts.require("LiquidityMiningMock");
const VBMI = artifacts.require("VBMI");

const Reverter = require("./helpers/reverter");
const { expectEvent, expectRevert, time, BN } = require("@openzeppelin/test-helpers");
const BigNumber = require("bignumber.js");

const { expect, assert } = require("chai");
const { sign2612 } = require("./helpers/signatures");

const wei = web3.utils.toWei;

function toBN(number) {
  return new BigNumber(number);
}

contract("BMIStaking", async (accounts) => {
  const reverter = new Reverter(web3);

  const OWNER = accounts[0];
  const USER1 = accounts[1];
  const USER2 = accounts[2];
  const USER3 = accounts[3];
  const USER4 = accounts[4];
  const NOTHING = accounts[5];

  const APY_PRECISION = toBN(10 ** 5);

  let bmiStaking;
  let bmiMock;
  let stkBMIToken;
  let liquidityMiningMock;
  let vBMI;

  const USER1PrivateKey = "c4ce20adf2b728fe3005be128fb850397ec352d1ea876e3035e46d547343404f";

  before("setup", async () => {
    const contractsRegistry = await ContractsRegistry.new();
    bmiMock = await BMIMock.new(OWNER);
    const _bmiStaking = await BMIStaking.new();
    const _stkBMIToken = await StkBMIToken.new();
    const _liquidityMiningMock = await LiquidityMiningMock.new();
    const _vBMI = await VBMI.new();

    await contractsRegistry.__ContractsRegistry_init();

    await contractsRegistry.addContract(await contractsRegistry.BMI_COVER_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.LIQUIDITY_MINING_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_UTILITY_NFT_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.POLICY_BOOK_REGISTRY_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.LEGACY_BMI_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.CLAIM_VOTING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.REINSURANCE_POOL_NAME(), NOTHING);

    await contractsRegistry.addContract(await contractsRegistry.BMI_NAME(), bmiMock.address);

    await contractsRegistry.addProxyContract(await contractsRegistry.BMI_STAKING_NAME(), _bmiStaking.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.STKBMI_NAME(), _stkBMIToken.address);
    await contractsRegistry.addProxyContract(
      await contractsRegistry.LIQUIDITY_MINING_NAME(),
      _liquidityMiningMock.address
    );
    await contractsRegistry.addProxyContract(await contractsRegistry.VBMI_NAME(), _vBMI.address);

    bmiStaking = await BMIStaking.at(await contractsRegistry.getBMIStakingContract());
    stkBMIToken = await StkBMIToken.at(await contractsRegistry.getSTKBMIContract());
    liquidityMiningMock = await LiquidityMiningMock.at(await contractsRegistry.getLiquidityMiningContract());
    vBMI = await VBMI.at(await contractsRegistry.getVBMIContract());

    await bmiStaking.__BMIStaking_init(wei("10"));
    await stkBMIToken.__STKBMIToken_init();
    await vBMI.__VBMI_init();
    await liquidityMiningMock.__LiquidityMining_init();

    await contractsRegistry.injectDependencies(await contractsRegistry.BMI_STAKING_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.STKBMI_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_MINING_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.VBMI_NAME());

    const liqTiming = await time.latest();

    await liquidityMiningMock.setStartTime(liqTiming);

    await bmiMock.transfer(bmiStaking.address, wei("100000"));

    await bmiMock.transfer(USER1, wei("100000"));
    await bmiMock.transfer(USER2, wei("100000"));
    await bmiMock.transfer(USER3, wei("100000"));
    await bmiMock.transfer(USER4, wei("100000"));

    await reverter.snapshot();
  });

  afterEach("revert", reverter.revert);

  describe("basic init", () => {
    describe("constructor", () => {
      it("should set reward per block", async () => {
        expect(await bmiStaking.rewardPerBlock()).to.be.a.bignumber.equal(wei("10"));
      });

      it("should set lastUpdateBlock", async () => {
        expect(await bmiStaking.lastUpdateBlock()).to.be.a.bignumber.above("0");
      });
    });
  });

  describe("Functions", () => {
    describe("stake", () => {
      beforeEach(async () => {
        await bmiMock.approve(bmiStaking.address, wei("1000"), { from: USER1 });
        await bmiMock.approve(bmiStaking.address, wei("1000"), { from: USER2 });
        await bmiMock.approve(bmiStaking.address, wei("1000"), { from: USER3 });
        await bmiMock.approve(bmiStaking.address, wei("1000"), { from: USER4 });
      });

      it("should revert if stake 0 tokens", async () => {
        await expectRevert(bmiStaking.stake("0", { from: OWNER }), "BMIStaking: can't stake 0 tokens");
      });

      it("should revert if sender is not Staking", async () => {
        await expectRevert(bmiStaking.addToPool(5, { from: USER1 }), "BMIStaking: Not a staking contract");
      });

      it("should revert if sender is not Staking", async () => {
        await expectRevert(bmiStaking.stakeFor(USER4, 5, { from: USER1 }), "BMIStaking: Not a staking contract");
      });

      it("should revert if transfer fail, not enough allowance ", async () => {
        await expectRevert(bmiStaking.stake(wei("10"), { from: OWNER }), "ERC20: transfer amount exceeds allowance");
      });

      describe("should transfer BMI tokens", () => {
        it("should transfer BMI tokens", async () => {
          expect(await bmiMock.balanceOf(USER1)).to.be.a.bignumber.equal(wei("100000"));
          expect(await bmiMock.balanceOf(bmiStaking.address)).to.be.a.bignumber.equal(wei("100000"));

          await bmiStaking.stake(wei("100"), { from: USER1 });
          expect(await bmiMock.balanceOf(USER1)).to.be.a.bignumber.equal(wei("99900"));
          expect(await bmiMock.balanceOf(bmiStaking.address)).to.be.a.bignumber.equal(wei("100100"));
        });

        it("should catch event Transfer", async () => {
          await bmiStaking.stake(wei("100"), { from: USER1 });

          const logs = await bmiMock.getPastEvents("Transfer", { toBlock: "latest" }).then((events) => {
            return events[0].args;
          });
          expect(await logs["from"]).to.be.equal(USER1);
          expect(await logs["to"]).to.be.equal(bmiStaking.address);
          expect(await logs["value"]).to.be.a.bignumber.equal(wei("100"));
        });
      });

      describe("should mint correct amount of sktBMI tokens:", () => {
        it("for first stake", async () => {
          expect(await stkBMIToken.balanceOf(USER1)).to.be.a.bignumber.equal("0");

          await bmiStaking.stake(wei("10"), { from: USER1 });
          expect(await stkBMIToken.balanceOf(USER1)).to.be.a.bignumber.equal(wei("10"));
        });

        it("for next stakes", async () => {
          expect(await stkBMIToken.balanceOf(USER1)).to.be.a.bignumber.equal("0");

          await bmiStaking.stake(wei("100"), { from: USER1 });
          expect(await bmiStaking.totalPool()).to.be.a.bignumber.equal(wei("100"));
          // rewardPool = 0, cuz we start adding a reward after the first stake
          expect(await stkBMIToken.balanceOf(USER1)).to.be.a.bignumber.equal(wei("100"));

          await bmiStaking.stake(wei("100"), { from: USER2 });
          expect(await bmiStaking.totalPool()).to.be.a.bignumber.equal(wei("210"));
          expect(await stkBMIToken.balanceOf(USER2)).to.be.a.bignumber.closeTo(
            wei("90.9090909090909"),
            wei("0.000000000001")
          );

          await bmiStaking.stake(wei("200"), { from: USER3 });
          expect(await bmiStaking.totalPool()).to.be.a.bignumber.equal(wei("420"));
          expect(await stkBMIToken.balanceOf(USER3)).to.be.a.bignumber.closeTo(
            wei("173.5537190082640"),
            wei("0.000000000001")
          );

          await bmiStaking.stake(wei("100"), { from: USER4 });
          expect(await bmiStaking.totalPool()).to.be.a.bignumber.equal(wei("530"));
          expect(await stkBMIToken.balanceOf(USER4)).to.be.a.bignumber.closeTo(
            wei("84.7587930040361"),
            wei("0.000000000001")
          );
        });
      });

      it("should increase totalPool", async () => {
        expect(await bmiStaking.totalPool()).to.be.a.bignumber.equal(wei("0"));
        await bmiStaking.stake(wei("100"), { from: USER1 });
        expect(await bmiStaking.totalPool()).to.be.a.bignumber.equal(wei("100"));
      });

      it("should update lastUpdateBlock", async () => {
        await bmiStaking.stake(wei("100"), { from: USER1 });
        const latestBlock = await time.latestBlock();
        expect(await bmiStaking.lastUpdateBlock()).to.be.a.bignumber.equal(latestBlock);
        await bmiStaking.stake(wei("100"), { from: USER1 });
        expect(await bmiStaking.lastUpdateBlock()).to.be.a.bignumber.equal(new BN(latestBlock).add(new BN(1)));
      });

      it("should catch event", async () => {
        const { logs } = await bmiStaking.stake(wei("10"), { from: USER1 });

        expectEvent.inLogs(logs, "StakedBMI", {
          stakedBMI: wei("10"),
          mintedStkBMI: wei("10"),
          recipient: USER1,
        });
      });
    });

    describe("stakeWithPermit", async () => {
      const amountToStake = toBN(1000);

      it("should correct stake without approve", async () => {
        const buffer = Buffer.from(USER1PrivateKey, "hex");
        const contractData = { name: "MBMI", verifyingContract: bmiMock.address };
        const transactionData = {
          owner: USER1,
          spender: bmiStaking.address,
          value: amountToStake,
        };

        const { v, r, s } = sign2612(contractData, transactionData, buffer);

        const txReceipt = await bmiStaking.stakeWithPermit(amountToStake, v, r, s, { from: USER1 });

        assert.equal(toBN(await bmiStaking.totalPool()).toString(), amountToStake.toString());

        assert.equal(txReceipt.logs.length, 1);
        assert.equal(txReceipt.logs[0].event, "StakedBMI");
        assert.equal(txReceipt.logs[0].args.stakedBMI, amountToStake.toString());
        assert.equal(txReceipt.logs[0].args.mintedStkBMI, amountToStake.toString());
        assert.equal(txReceipt.logs[0].args.recipient, USER1);
      });
    });

    describe("withdraw", () => {
      beforeEach(async () => {
        await bmiMock.approve(bmiStaking.address, wei("1000"), { from: USER1 });
        await bmiMock.approve(bmiStaking.address, wei("1000"), { from: USER2 });
        await bmiMock.approve(bmiStaking.address, wei("1000"), { from: USER3 });
        await bmiMock.approve(bmiStaking.address, wei("1000"), { from: USER4 });

        await bmiStaking.stake(wei("100"), { from: USER1 });
        await bmiStaking.stake(wei("100"), { from: USER2 });
        await bmiStaking.stake(wei("200"), { from: USER3 });
        await bmiStaking.stake(wei("100"), { from: USER4 });
      });

      it("should revert if user tries to unlock 0 stkBMI tokens", async () => {
        await expectRevert(bmiStaking.unlockTokensToWithdraw(0, { from: USER1 }), "BMIStaking: can't unlock 0 tokens");
      });

      it("should revert if user has not enough stkBMI tokens to unlock", async () => {
        await time.increase(time.duration.weeks(13)); // before 90 days
        await expectRevert(
          bmiStaking.unlockTokensToWithdraw(wei("2000"), { from: USER1 }),
          "BMIStaking: not enough BMI to unlock"
        );
      });

      it("should setup correctly unlock info", async () => {
        await time.increase(time.duration.weeks(13)); // before 90 days
        await bmiStaking.unlockTokensToWithdraw(wei("100"), { from: USER1 });
        let withdrawalInfo = await bmiStaking.getWithdrawalInfo(USER1);

        const latest = await time.latest();

        assert.equal(withdrawalInfo._unlockPeriod.toString(), latest.add(time.duration.days(8)).toString());

        assert.equal(withdrawalInfo._amountBMIRequested.toString(), wei("100").toString());

        const timeToWithdraw = await bmiStaking.whenCanWithdrawBMIReward(USER1);
        assert.equal(timeToWithdraw.toString(), withdrawalInfo._unlockPeriod.toString());

        assert.equal(withdrawalInfo._availableFor.toString(), "0"); // not available

        await time.increase(time.duration.days(8));
        withdrawalInfo = await bmiStaking.getWithdrawalInfo(USER1);

        const endTime = withdrawalInfo._availableFor.toNumber();
        const _48hs = withdrawalInfo._unlockPeriod.toNumber() + 48 * 60 * 60;

        assert.isTrue(endTime === _48hs);

        await time.increase(time.duration.days(9));
        withdrawalInfo = await bmiStaking.getWithdrawalInfo(USER1); // expired

        assert.equal(withdrawalInfo._unlockPeriod.toString(), "0"); // not available anymore
      });

      it("should revert if user try to withdraw without unlock or before correct time", async () => {
        const isBMIRewardUnlocked = await bmiStaking.isBMIRewardUnlocked();
        assert.isFalse(isBMIRewardUnlocked);

        await expectRevert(bmiStaking.withdraw(), "BMIStaking: unlock not started/exp");

        await time.increase(time.duration.weeks(13)); // before 90 days

        await expectRevert(bmiStaking.withdraw(), "BMIStaking: unlock not started/exp");

        await bmiStaking.unlockTokensToWithdraw(wei("100"), { from: USER1 });

        await expectRevert(bmiStaking.withdraw({ from: USER1 }), "BMIStaking: cooldown not reached");

        await time.increase(time.duration.days(7)); // before 8 days

        await expectRevert(bmiStaking.withdraw({ from: USER1 }), "BMIStaking: cooldown not reached");

        await time.increase(time.duration.days(4)); // expired 48hs

        await expectRevert(bmiStaking.withdraw({ from: USER1 }), "BMIStaking: unlock not started/exp");
      });

      it("should revert if not enough BMI tokens to send", async () => {
        await bmiStaking.revokeUnusedRewardPool();
        await bmiStaking.stake(wei("100"), { from: USER1 });

        await time.increase(time.duration.weeks(13)); // 90 days to unlock
        await bmiStaking.unlockTokensToWithdraw(wei("200"), { from: USER1 });
        await bmiStaking.unlockTokensToWithdraw(wei("100"), { from: USER2 });
        await bmiStaking.unlockTokensToWithdraw(wei("200"), { from: USER3 });
        await bmiStaking.unlockTokensToWithdraw(wei("100"), { from: USER4 });

        await time.increase(time.duration.days(9)); // 9 days to be to withdraw

        await bmiStaking.withdraw({ from: USER2 });
        await bmiStaking.withdraw({ from: USER3 });
        await bmiStaking.withdraw({ from: USER4 });
        await time.advanceBlock();

        await bmiStaking.withdraw({ from: USER1 });

        await bmiStaking.unlockTokensToWithdraw(wei("41"), { from: USER1 });
        await time.increase(time.duration.days(9)); // 9 days to be to withdraw

        await expectRevert(bmiStaking.withdraw({ from: USER1 }), "BMIStaking: !enough BMI tokens");
      });

      it("should burn correct amount of sktBMI tokens", async () => {
        expect(await stkBMIToken.totalSupply()).to.be.a.bignumber.closeTo(
          wei("449.221602921392"),
          wei("0.000000000001")
        );

        await time.increase(time.duration.weeks(13)); // 90 days to unlock
        await bmiStaking.unlockTokensToWithdraw(wei("50"), { from: USER1 });
        await bmiStaking.unlockTokensToWithdraw(wei("10"), { from: USER2 });
        await bmiStaking.unlockTokensToWithdraw(wei("70"), { from: USER3 });
        await bmiStaking.unlockTokensToWithdraw(wei("4"), { from: USER4 });
        await time.increase(time.duration.days(9)); // 9 days to be to withdraw

        await bmiStaking.withdraw({ from: USER1 });

        expect(await stkBMIToken.balanceOf(USER1)).to.be.a.bignumber.closeTo(
          wei("62.564866423217374592"),
          wei("0.000000000001")
        );

        expect(await stkBMIToken.totalSupply()).to.be.a.bignumber.closeTo(
          wei("411.786469344608879490"),
          wei("0.000000000001")
        );

        await bmiStaking.withdraw({ from: USER2 });

        expect(await stkBMIToken.balanceOf(USER2)).to.be.a.bignumber.closeTo(
          wei("83.555761099365750528"),
          wei("0.000000000001")
        );

        expect(await stkBMIToken.totalSupply()).to.be.a.bignumber.closeTo(
          wei("404.433139534883720928"),
          wei("0.000000000001")
        );

        await bmiStaking.withdraw({ from: USER3 });

        expect(await stkBMIToken.balanceOf(USER3)).to.be.a.bignumber.closeTo(
          wei("122.999576566403997693"),
          wei("0.000000000001")
        );
        expect(await stkBMIToken.totalSupply()).to.be.a.bignumber.closeTo(
          wei("353.878997093023255812"),
          wei("0.000000000001")
        );

        await bmiStaking.withdraw({ from: USER4 });
        expect(await stkBMIToken.balanceOf(USER4)).to.be.a.bignumber.closeTo(
          wei("81.927761027291946953"),
          wei("0.000000000001")
        );
        expect(await stkBMIToken.totalSupply()).to.be.a.bignumber.closeTo(
          wei("351.047965116279069766"),
          wei("0.000000000001")
        );
      });

      describe("should transfer BMI tokens", () => {
        it("should transfer BMI tokens", async () => {
          expect(await bmiMock.balanceOf(USER1)).to.be.a.bignumber.equal(wei("99900"));
          expect(await bmiMock.balanceOf(bmiStaking.address)).to.be.a.bignumber.equal(wei("100500"));

          await time.increase(time.duration.weeks(13)); // 90 days to unlock
          await bmiStaking.unlockTokensToWithdraw(await stkBMIToken.balanceOf(USER1), { from: USER1 });
          await time.increase(time.duration.days(9)); // 9 days to be to withdraw

          await bmiStaking.withdraw({ from: USER1 });

          expect(await bmiMock.balanceOf(USER1)).to.be.a.bignumber.equal(wei("100000"));
          expect(await bmiMock.balanceOf(bmiStaking.address)).to.be.a.bignumber.closeTo(
            wei("100400.000000000000"),
            wei("0.000000000001")
          );
        });

        it("should catch event Transfer", async () => {
          await time.increase(time.duration.weeks(13)); // 90 days to unlock
          await bmiStaking.unlockTokensToWithdraw(await stkBMIToken.balanceOf(USER1), { from: USER1 });
          await time.increase(time.duration.days(9)); // 9 days to be to withdraw

          await bmiStaking.withdraw({ from: USER1 });

          const logs = await bmiMock.getPastEvents("Transfer", { toBlock: "latest" }).then((events) => {
            return events[0].args;
          });
          expect(await logs["from"]).to.be.equal(bmiStaking.address);
          expect(await logs["to"]).to.be.equal(USER1);
          expect(await logs["value"]).to.be.a.bignumber.closeTo(wei("100.000000000000"), wei("0.000000000001"));
        });
      });

      it("should decrease totalPool", async () => {
        expect(await bmiStaking.totalPool()).to.be.a.bignumber.equal(wei("530"));

        await time.increase(time.duration.weeks(13)); // 90 days to unlock
        await bmiStaking.unlockTokensToWithdraw(await stkBMIToken.balanceOf(USER1), { from: USER1 });
        await time.increase(time.duration.days(9)); // 9 days to be to withdraw

        await bmiStaking.withdraw({ from: USER1 });
        expect(await bmiStaking.totalPool()).to.be.a.bignumber.closeTo(
          wei("470"), // +10 reward from block
          wei("0.000000000003")
        );
      });

      it("should update lastUpdateBlock", async () => {
        // await bmiStaking.stake(wei("100"), { from: USER1 });
        const latestBlock = await time.latestBlock();
        expect(await bmiStaking.lastUpdateBlock()).to.be.a.bignumber.equal(latestBlock);

        await time.increase(time.duration.weeks(13)); // 60 days to unlock
        await bmiStaking.unlockTokensToWithdraw(await stkBMIToken.balanceOf(USER1), { from: USER1 });
        await time.increase(time.duration.days(9)); // 9 days to be to withdraw

        await bmiStaking.withdraw({ from: USER1 });
        expect(await bmiStaking.lastUpdateBlock()).to.be.a.bignumber.equal(new BN(latestBlock).add(new BN(4)));
      });

      it("should catch event BMIWithdrawn", async () => {
        await time.increase(time.duration.weeks(13)); // 60 days to unlock
        await bmiStaking.unlockTokensToWithdraw(wei("10"), { from: USER1 });
        await time.increase(time.duration.days(9)); // 9 days to be to withdraw

        await bmiStaking.withdraw({ from: USER1 });

        const logs = await bmiStaking.getPastEvents("BMIWithdrawn", { toBlock: "latest" }).then((events) => {
          return events[0].args;
        });

        expect(await logs["amountBMI"]).to.be.a.bignumber.closeTo(wei("10"), wei("0.000000000001"));

        expect(await logs["burnedStkBMI"]).to.be.a.bignumber.equal("7881080753006868506");
        expect(await logs["recipient"]).to.be.equal(USER1);
      });
    });

    describe("stakingReward", () => {
      beforeEach(async () => {
        await bmiMock.approve(bmiStaking.address, wei("1000"), { from: USER1 });
        await bmiMock.approve(bmiStaking.address, wei("1000"), { from: USER2 });
        await bmiMock.approve(bmiStaking.address, wei("1000"), { from: USER3 });
        await bmiMock.approve(bmiStaking.address, wei("1000"), { from: USER4 });

        await bmiStaking.stake(wei("100"), { from: USER1 });
        await bmiStaking.stake(wei("100"), { from: USER2 });
        await bmiStaking.stake(wei("200"), { from: USER3 });
        await bmiStaking.stake(wei("100"), { from: USER4 });
      });
      describe("should return correct amount of BMI tokens", () => {
        it("when lastUpdateBlock == last mined block", async () => {
          await time.advanceBlock();
          expect(await bmiStaking.stakingReward(wei("10"))).to.be.a.bignumber.closeTo(
            wei("12.0207932229496"),
            wei("0.000000000001")
          );
        });

        it("when lastUpdateBlock < last mined block", async () => {
          await time.advanceBlock();
          await time.advanceBlock();
          await time.advanceBlock();

          expect(await bmiStaking.stakingReward(wei("10"))).to.be.a.bignumber.closeTo(
            wei("12.46600778676"),
            wei("0.00000000001")
          );
        });
      });
    });

    describe("getStakedBMI", () => {
      beforeEach(async () => {
        await bmiMock.approve(bmiStaking.address, wei("1000"), { from: USER1 });
        await bmiMock.approve(bmiStaking.address, wei("1000"), { from: USER2 });
        await bmiMock.approve(bmiStaking.address, wei("1000"), { from: USER3 });
        await bmiMock.approve(bmiStaking.address, wei("1000"), { from: USER4 });

        await bmiStaking.stake(wei("100"), { from: USER1 });
        await bmiStaking.stake(wei("100"), { from: USER2 });
        await bmiStaking.stake(wei("200"), { from: USER3 });
        await bmiStaking.stake(wei("100"), { from: USER4 });
      });

      describe("VBMI lock", async () => {
        it("should return correct amount after VBMI lock", async () => {
          await time.advanceBlock();

          expect(await bmiStaking.getStakedBMI(USER1)).to.be.a.bignumber.closeTo(
            wei("120.207932229496"),
            wei("0.000000000001")
          );

          await stkBMIToken.approve(vBMI.address, await stkBMIToken.balanceOf(USER1), { from: USER1 });
          await vBMI.lockStkBMI(await stkBMIToken.balanceOf(USER1), { from: USER1 });

          expect(await bmiStaking.getStakedBMI(USER1)).to.be.a.bignumber.closeTo(
            wei("124.6600778676"),
            wei("0.0000000001")
          );
        });
      });

      describe("should return correct amount of BMI tokens", () => {
        it("should return 0 if user has no stake", async () => {
          expect(await bmiStaking.getStakedBMI(OWNER)).to.be.a.bignumber.equal(wei("0"));
        });

        it("when lastUpdateBlock == last mined block", async () => {
          await time.advanceBlock();
          expect(await bmiStaking.getStakedBMI(USER1)).to.be.a.bignumber.closeTo(
            wei("120.207932229496"),
            wei("0.000000000001")
          );
        });

        it("when lastUpdateBlock < last mined block", async () => {
          await time.advanceBlock();
          await time.advanceBlock();
          await time.advanceBlock();

          expect(await bmiStaking.getStakedBMI(USER1)).to.be.a.bignumber.closeTo(
            wei("124.6600778676"),
            wei("0.0000000001")
          );
        });
      });
    });

    describe("setRewardPerBlock", () => {
      it("should revet if sender not owner", async () => {
        await expectRevert(
          bmiStaking.setRewardPerBlock(wei("50"), { from: USER1 }),
          "Ownable: caller is not the owner"
        );
      });

      it("should set reward per block", async () => {
        expect(await bmiStaking.rewardPerBlock()).to.be.a.bignumber.equal(wei("10"));
        await bmiStaking.setRewardPerBlock(wei("12"));
        expect(await bmiStaking.rewardPerBlock()).to.be.a.bignumber.equal(wei("12"));
      });
    });

    describe("revokeRewardPool", async () => {
      it("should succesfully revoke and decrease a reward", async () => {
        await bmiMock.approve(bmiStaking.address, wei("100"), { from: USER1 });
        await bmiStaking.stake(wei("100"), { from: USER1 });

        const stakingBalance = toBN(await bmiMock.balanceOf(bmiStaking.address));
        const userBalance = toBN(await bmiMock.balanceOf(OWNER));

        await time.advanceBlock();

        assert.equal(toBN(await bmiStaking.getStakedBMI(USER1)).toString(), toBN(wei("110")).toString());

        await bmiStaking.revokeRewardPool(wei("20"));

        assert.equal(toBN(await bmiMock.balanceOf(bmiStaking.address)).toString(), stakingBalance.minus(wei("20")));
        assert.equal(toBN(await bmiMock.balanceOf(OWNER)).toString(), userBalance.plus(wei("20")));
        assert.equal(toBN(await bmiStaking.getStakedBMI(USER1)).toString(), toBN(wei("100")).toString());
      });
    });

    describe("revokeUnusedRewardPool", () => {
      beforeEach(async () => {
        await bmiMock.approve(bmiStaking.address, wei("100"), { from: USER1 });
        await bmiStaking.stake(wei("100"), { from: USER1 });
      });

      it("should revet if sender not owner", async () => {
        await expectRevert(bmiStaking.revokeUnusedRewardPool({ from: USER1 }), "Ownable: caller is not the owner");
      });

      it("should revert if not enough funds to revoke", async () => {
        await bmiStaking.setRewardPerBlock(wei("100000"));
        await time.advanceBlock();

        await expectRevert(bmiStaking.revokeUnusedRewardPool(), "BMIStaking: No unused tokens revoke");
      });

      it("should revoke unused tokens from reward poll", async () => {
        expect(await bmiMock.balanceOf(bmiStaking.address)).to.be.a.bignumber.equal(wei("100100"));
        expect(await bmiMock.balanceOf(OWNER)).to.be.a.bignumber.equal(wei("159500000"));

        await bmiStaking.revokeUnusedRewardPool();
        expect(await bmiMock.balanceOf(bmiStaking.address)).to.be.a.bignumber.equal(wei("110"));
        expect(await bmiMock.balanceOf(OWNER)).to.be.a.bignumber.equal(wei("159599990"));
      });

      it("should cath event UnusedRewardPoolRevoked", async () => {
        await bmiStaking.revokeUnusedRewardPool();

        const logs = await bmiStaking.getPastEvents("UnusedRewardPoolRevoked", { toBlock: "latest" }).then((events) => {
          return events[0].args;
        });
        expect(await logs["recipient"]).to.be.equal(OWNER);
        expect(await logs["amount"]).to.be.a.bignumber.equal(wei("99990"));
      });
    });
  });

  describe("integrations", () => {
    beforeEach(async () => {
      await bmiMock.approve(bmiStaking.address, wei("1000"), { from: USER1 });
      await bmiMock.approve(bmiStaking.address, wei("1000"), { from: USER2 });
      await bmiMock.approve(bmiStaking.address, wei("1000"), { from: USER3 });
      await bmiMock.approve(bmiStaking.address, wei("1000"), { from: USER4 });
    });

    it("make a few stake, wait 60 days, then unstake all", async () => {
      await bmiStaking.stake(wei("100"), { from: USER1 });
      await bmiStaking.stake(wei("100"), { from: USER2 });
      await bmiStaking.stake(wei("200"), { from: USER3 });
      await bmiStaking.stake(wei("100"), { from: USER4 });
      expect(await stkBMIToken.totalSupply()).to.be.a.bignumber.closeTo(wei("449.221602921392"), wei("0.000000000001"));
      expect(await bmiStaking.totalPool()).to.be.a.bignumber.equal(wei("530"));

      await time.increase(time.duration.weeks(13)); // 90 days to unlock
      await bmiStaking.unlockTokensToWithdraw(await stkBMIToken.balanceOf(USER1), { from: USER1 });
      await bmiStaking.unlockTokensToWithdraw(await stkBMIToken.balanceOf(USER2), { from: USER2 });
      await bmiStaking.unlockTokensToWithdraw(await stkBMIToken.balanceOf(USER3), { from: USER3 });
      await bmiStaking.unlockTokensToWithdraw(await stkBMIToken.balanceOf(USER4), { from: USER4 });
      await time.increase(time.duration.days(9)); // 9 days to be to withdraw

      await bmiStaking.withdraw({ from: USER1 });
      await bmiStaking.withdraw({ from: USER2 });
      await bmiStaking.withdraw({ from: USER3 });
      await bmiStaking.withdraw({ from: USER4 });

      expect(await stkBMIToken.totalSupply()).to.be.a.bignumber.equal("124722104053117704468");
      expect(await bmiStaking.totalPool()).to.be.a.bignumber.equal("180778397078608495102");
    });

    it("make a few stake and unstake", async () => {
      expect(await bmiStaking.totalPool()).to.be.a.bignumber.equal(wei("0"));

      await bmiStaking.stake(wei("100"), { from: USER1 });
      // stkBMI TS - 100
      expect(await bmiStaking.totalPool()).to.be.a.bignumber.equal(wei("100"));
      expect(await stkBMIToken.totalSupply()).to.be.a.bignumber.equal(wei("100"));
      expect(await stkBMIToken.balanceOf(USER1)).to.be.a.bignumber.equal(wei("100"));
      expect(await bmiMock.balanceOf(USER1)).to.be.a.bignumber.equal(wei("99900"));

      await bmiStaking.stake(wei("100"), { from: USER2 });
      // stkBMI TS - 190.909090909090
      expect(await bmiStaking.totalPool()).to.be.a.bignumber.equal(wei("210"));
      expect(await stkBMIToken.totalSupply()).to.be.a.bignumber.closeTo(wei("190.909090909090"), wei("0.000000000001"));
      expect(await stkBMIToken.balanceOf(USER2)).to.be.a.bignumber.closeTo(
        wei("90.909090909090"),
        wei("0.000000000001")
      );
      expect(await bmiMock.balanceOf(USER2)).to.be.a.bignumber.equal(wei("99900"));

      await bmiStaking.stake(wei("200"), { from: USER3 });
      // stkBMI TS - 364.462809917355
      expect(await bmiStaking.totalPool()).to.be.a.bignumber.equal(wei("420"));
      expect(await stkBMIToken.totalSupply()).to.be.a.bignumber.closeTo(wei("364.462809917355"), wei("0.000000000001"));
      expect(await stkBMIToken.balanceOf(USER3)).to.be.a.bignumber.closeTo(
        wei("173.553719008264"),
        wei("0.000000000001")
      );
      expect(await bmiMock.balanceOf(USER3)).to.be.a.bignumber.equal(wei("99800"));

      await time.increase(time.duration.weeks(13)); // 90 days to unlock
      await bmiStaking.unlockTokensToWithdraw(await stkBMIToken.balanceOf(USER2), { from: USER2 });
      await time.increase(time.duration.days(9)); // 9 days to be to withdraw

      await bmiStaking.withdraw({ from: USER2 });
      // stkBMI TS - 273.5537190082640, BMI +107.256235827664
      expect(await bmiStaking.totalPool()).to.be.a.bignumber.closeTo(wei("369.090909090909"), wei("0.000000000001"));
      expect(await stkBMIToken.totalSupply()).to.be.a.bignumber.closeTo(wei("292.434586613530"), wei("0.000000000001"));
      expect(await stkBMIToken.balanceOf(USER2)).to.be.a.bignumber.equal("18880867605265736779");
      expect(await bmiMock.balanceOf(USER2)).to.be.a.bignumber.closeTo(
        wei("99990.909090909090"),
        wei("0.000000000001")
      );

      await bmiStaking.stake(wei("50"), { from: USER1 });
      // stkBMI TS - 314.659480928206, stkBMI 141.105761919941
      expect(await bmiStaking.totalPool()).to.be.a.bignumber.closeTo(wei("429.090909090909"), wei("0.000000000001"));
      expect(await stkBMIToken.totalSupply()).to.be.a.bignumber.closeTo(
        wei("331.0050956392955"),
        wei("0.000000000001")
      );
      expect(await stkBMIToken.balanceOf(USER1)).to.be.a.bignumber.closeTo(
        wei("138.570509025765"),
        wei("0.000000000001")
      );
      expect(await bmiMock.balanceOf(USER1)).to.be.a.bignumber.equal(wei("99850"));

      await bmiStaking.stake(wei("50"), { from: USER4 });
      // stkBMI TS - 354.718612305036, stkBMI 40.059131376829
      expect(await bmiStaking.totalPool()).to.be.a.bignumber.closeTo(wei("489.090909090909"), wei("0.000000000001"));
      expect(await stkBMIToken.totalSupply()).to.be.a.bignumber.closeTo(wei("368.697187275240"), wei("0.000000000001"));
      expect(await stkBMIToken.balanceOf(USER4)).to.be.a.bignumber.closeTo(
        wei("37.692091635944"),
        wei("0.000000000001")
      );
      expect(await bmiMock.balanceOf(USER4)).to.be.a.bignumber.equal(wei("99950"));

      await bmiStaking.unlockTokensToWithdraw(wei("50"), { from: USER3 });
      await time.increase(time.duration.days(9)); // 9 days to be to withdraw

      await bmiStaking.withdraw({ from: USER3 });
      // stkBMI TS - 304.718612305036, stkBMI 123.5537190082640, BMI + 63.817311591054
      expect(await bmiStaking.totalPool()).to.be.a.bignumber.closeTo(wei("469.090909090909"), wei("0.000000000001"));
      expect(await stkBMIToken.totalSupply()).to.be.a.bignumber.closeTo(wei("333.183447695313"), wei("0.000000000001"));
      expect(await stkBMIToken.balanceOf(USER3)).to.be.a.bignumber.closeTo(
        wei("138.039979428337"),
        wei("0.000000000001")
      );
      expect(await bmiMock.balanceOf(USER3)).to.be.a.bignumber.closeTo(
        wei("99850.000000000000"),
        wei("0.000000000001")
      );
    });

    it("should be able to transfer stkBMI tokens and unstake it", async () => {
      await bmiStaking.stake(wei("100"), { from: USER1 });
      await bmiStaking.stake(wei("100"), { from: USER2 });

      expect(await stkBMIToken.balanceOf(USER3)).to.be.a.bignumber.equal("0");
      expect(await stkBMIToken.balanceOf(USER2)).to.be.a.bignumber.closeTo(
        wei("90.909090909090"),
        wei("0.000000000001")
      );

      await stkBMIToken.transfer(USER3, wei("50"), { from: USER2 });
      expect(await stkBMIToken.balanceOf(USER3)).to.be.a.bignumber.equal(wei("50"));
      expect(await stkBMIToken.balanceOf(USER2)).to.be.a.bignumber.closeTo(
        wei("40.909090909090"),
        wei("0.000000000001")
      );

      expect(await bmiMock.balanceOf(USER3)).to.be.a.bignumber.equal(wei("100000"));

      await time.increase(time.duration.weeks(13)); // 90 days to unlock
      await bmiStaking.unlockTokensToWithdraw(wei("30"), { from: USER3 });
      await time.increase(time.duration.days(9)); // 9 days to be to withdraw

      await bmiStaking.withdraw({ from: USER3 });
      expect(await stkBMIToken.balanceOf(USER3)).to.be.a.bignumber.equal(wei("27.972027972027972029"));
      expect(await bmiMock.balanceOf(USER3)).to.be.a.bignumber.closeTo(
        wei("100030.000000000000"),
        wei("0.000000000001")
      );
    });
  });

  describe("APY", async () => {
    it("should calculate correct APY", async () => {
      await bmiStaking.setRewardPerBlock(wei("100"));

      assert.equal(
        toBN(await bmiStaking.getAPY())
          .idiv(APY_PRECISION)
          .toString(),
        "23542500000"
      );
    });

    it("should calculate correct APY without rewards", async () => {
      await bmiStaking.setRewardPerBlock(0);

      assert.equal(toBN(await bmiStaking.getAPY()).toString(), "0");
    });
  });
});
