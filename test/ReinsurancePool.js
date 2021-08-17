const truffleAssert = require("truffle-assertions");
const BigNumber = require("bignumber.js");
const { assert } = require("chai");
const Reverter = require("./helpers/reverter");

const ReinsurancePool = artifacts.require("ReinsurancePool");
const ContractsRegistry = artifacts.require("ContractsRegistry");
const BMIMock = artifacts.require("BMIMock");
const STBLMock = artifacts.require("STBLMock");
const STKBMIToken = artifacts.require("STKBMIToken");
const BMIStaking = artifacts.require("BMIStaking");

function toBN(number) {
  return new BigNumber(number);
}

contract("ReinsurancePool", async (accounts) => {
  const reverter = new Reverter(web3);

  let reinsurancePool;
  let bmiToken;
  let stkBmiToken;
  let stblToken;
  let bmiStaking;

  const OWNER_USER = accounts[0];
  const OTHER_USER = accounts[1];
  const CLAIM_VOTING_ADDRESS = accounts[2];

  const NOTHING = accounts[9];

  before("setup", async () => {
    const contractsRegistry = await ContractsRegistry.new();
    bmiToken = await BMIMock.new(OWNER_USER);
    stblToken = await STBLMock.new("stbl", "stbl", 6);
    const _stkBmiToken = await STKBMIToken.new();
    const _bmiStaking = await BMIStaking.new();
    const _reinsurancePool = await ReinsurancePool.new();

    await contractsRegistry.__ContractsRegistry_init();

    await contractsRegistry.addContract(await contractsRegistry.LEGACY_BMI_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_COVER_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.LIQUIDITY_MINING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.LIQUIDITY_MINING_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.VBMI_NAME(), NOTHING);

    await contractsRegistry.addContract(await contractsRegistry.BMI_NAME(), bmiToken.address);
    await contractsRegistry.addContract(await contractsRegistry.USDT_NAME(), stblToken.address);
    await contractsRegistry.addContract(await contractsRegistry.CLAIM_VOTING_NAME(), CLAIM_VOTING_ADDRESS);

    await contractsRegistry.addProxyContract(await contractsRegistry.STKBMI_NAME(), _stkBmiToken.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.BMI_STAKING_NAME(), _bmiStaking.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.REINSURANCE_POOL_NAME(), _reinsurancePool.address);

    stkBmiToken = await STKBMIToken.at(await contractsRegistry.getSTKBMIContract());
    bmiStaking = await BMIStaking.at(await contractsRegistry.getBMIStakingContract());
    reinsurancePool = await ReinsurancePool.at(await contractsRegistry.getReinsurancePoolContract());

    await bmiStaking.__BMIStaking_init("0");
    await stkBmiToken.__STKBMIToken_init();
    await reinsurancePool.__ReinsurancePool_init();

    await contractsRegistry.injectDependencies(await contractsRegistry.BMI_STAKING_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.STKBMI_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.REINSURANCE_POOL_NAME());

    await reverter.snapshot();
  });

  afterEach("revert", reverter.revert);

  describe("withdrawBMITo", async () => {
    it("not claim voting address could not call", async () => {
      await truffleAssert.reverts(
        reinsurancePool.withdrawBMITo(OTHER_USER, "1"),
        "ReinsurancePool: Caller is not a ClaimVoting contract"
      );
    });

    it("should actually transfer tokens", async () => {
      await bmiToken.transfer(reinsurancePool.address, web3.utils.toWei("100"));

      await reinsurancePool.withdrawBMITo(OTHER_USER, web3.utils.toWei("50"), { from: CLAIM_VOTING_ADDRESS });
      assert.equal(await bmiToken.balanceOf(reinsurancePool.address), web3.utils.toWei("50"));
      assert.equal(await bmiToken.balanceOf(OTHER_USER), web3.utils.toWei("50"));
    });
  });

  describe("withdrawSTBLTo", async () => {
    it("not claim voting address could not call", async () => {
      await truffleAssert.reverts(
        reinsurancePool.withdrawSTBLTo(OTHER_USER, "1"),
        "ReinsurancePool: Caller is not a ClaimVoting contract"
      );
    });

    it("should actually transfer tokens", async () => {
      await stblToken.transfer(reinsurancePool.address, web3.utils.toWei("100", "mwei"));

      await reinsurancePool.withdrawSTBLTo(OTHER_USER, web3.utils.toWei("50"), { from: CLAIM_VOTING_ADDRESS });

      assert.equal(
        toBN(await stblToken.balanceOf(reinsurancePool.address)).toString(),
        toBN(web3.utils.toWei("50", "mwei")).toString()
      );
      assert.equal(
        toBN(await stblToken.balanceOf(OTHER_USER)).toString(),
        toBN(web3.utils.toWei("50", "mwei")).toString()
      );
    });
  });

  describe("recoverERC20", async () => {
    beforeEach("setup", async () => {
      const balance = await bmiToken.balanceOf(OWNER_USER);
      await bmiToken.transfer(reinsurancePool.address, balance);
    });

    it("not owner could not call", async () => {
      await truffleAssert.reverts(
        reinsurancePool.recoverERC20(bmiToken.address, "1", { from: OTHER_USER }),
        "Ownable: caller is not the owner"
      );
    });

    it("should actually recover tokens", async () => {
      await reinsurancePool.recoverERC20(bmiToken.address, web3.utils.toWei("100"));

      assert.equal(await bmiToken.balanceOf(OWNER_USER), web3.utils.toWei("100"));
    });

    it("should emit event", async () => {
      const tx = await reinsurancePool.recoverERC20(bmiToken.address, web3.utils.toWei("100"));

      const event = tx.logs.find((x) => x.event == "Recovered").args;
      assert.equal(event.tokenAddress, bmiToken.address);
      assert.equal(event.tokenAmount, web3.utils.toWei("100"));
    });
  });
});
