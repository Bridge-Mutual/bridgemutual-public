const PolicyBookMock = artifacts.require("PolicyBookMock");
const PolicyQuote = artifacts.require("PolicyQuote");
const ContractsRegistry = artifacts.require("ContractsRegistry");
const STBLMock = artifacts.require("STBLMock");

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

contract("PolicyQuote", async (accounts) => {
  const reverter = new Reverter(web3);

  let policyQuote;
  let policyBookMock;

  /*
   * QUOTE_SCENARIO_A:
   * quote for a policy book that has the following setup
   * * Utilization ratio > 51
   * * Quote is for a yearly
   * * Policybook is not whitelisted (Considerated Moderate Risk)
   */
  const QUOTE_SCENARIO_A = toBN(wei("159375")).idiv(10);

  /*
   * QUOTE_SCENARIO_B:
   * quote for a policy book that has the following setup
   * * Utilization ratio > 51
   * * Quote is for a yearly
   * * Policybook is whitelisted (Considerated Safe Risk)
   */
  const QUOTE_SCENARIO_B = toBN(wei("6375"));

  const SECONDS_IN_YEAR = 365 * 24 * 60 * 60;
  const MINIMUM_INSURANCE_COST = toBN(wei("10"));

  const NOTHING = accounts[9];

  before("setup", async () => {
    const contractsRegistry = await ContractsRegistry.new();
    const stbl = await STBLMock.new("stbl", "stbl", 6);
    const _policyQuote = await PolicyQuote.new();

    await contractsRegistry.__ContractsRegistry_init();

    await contractsRegistry.addContract(await contractsRegistry.LIQUIDITY_MINING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_COVER_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.POLICY_BOOK_REGISTRY_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.POLICY_BOOK_FABRIC_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.POLICY_REGISTRY_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.CLAIM_VOTING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.CLAIMING_REGISTRY_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.LIQUIDITY_REGISTRY_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.PRICE_FEED_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.REINSURANCE_POOL_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.REWARDS_GENERATOR_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.POLICY_BOOK_ADMIN_NAME(), NOTHING);

    await contractsRegistry.addContract(await contractsRegistry.USDT_NAME(), stbl.address);

    await contractsRegistry.addProxyContract(await contractsRegistry.POLICY_QUOTE_NAME(), _policyQuote.address);

    policyQuote = await PolicyQuote.at(await contractsRegistry.getPolicyQuoteContract());

    policyBookMock = await PolicyBookMock.new();
    await policyBookMock.__PolicyBookMock_init(accounts[9], ContractType.CONTRACT);

    await policyBookMock.setDependencies(contractsRegistry.address);

    await reverter.snapshot();
  });

  afterEach("revert", reverter.revert);

  describe("getQuote", async () => {
    let seconds;
    let myMoney;
    let total;
    let bought;

    it("calculating annual cost where UR = 51% < RISKY, (doc example 1)", async () => {
      seconds = SECONDS_IN_YEAR;
      myMoney = wei("100000"); // 100k
      total = wei("10000000"); // 10mil
      bought = wei("5000000"); // 5mil

      await policyBookMock.setTotalLiquidity(total);
      await policyBookMock.setTotalCoverTokens(bought);

      const calculatedRiskyPrice = toBN(await policyQuote.getQuote(seconds, myMoney, policyBookMock.address));
      await policyBookMock.setWhitelistedStatus(true);
      const calculatedSafePrice = toBN(await policyQuote.getQuote(seconds, myMoney, policyBookMock.address));

      assert.equal(calculatedRiskyPrice.toString(), QUOTE_SCENARIO_A.toString(), "UR < RISKY case is incorrect");
      assert.equal(
        calculatedSafePrice.toString(),
        QUOTE_SCENARIO_B.toString(),
        "Safe asset UR < RISKY case is incorrect"
      );
    });

    it("calculating annual cost where UR = 90% > RISKY, (doc example 2)", async () => {
      seconds = SECONDS_IN_YEAR;
      myMoney = wei("4000000"); // 4mil
      total = wei("10000000"); // 10mil
      bought = wei("5000000"); // 5mil

      await policyBookMock.setTotalLiquidity(total);
      await policyBookMock.setTotalCoverTokens(bought);

      const calculatedRiskyPrice = toBN(await policyQuote.getQuote(seconds, myMoney, policyBookMock.address));
      await policyBookMock.setWhitelistedStatus(true);
      const calculatedSafePrice = toBN(await policyQuote.getQuote(seconds, myMoney, policyBookMock.address));

      assert.equal(calculatedRiskyPrice.toString(), toBN(wei("2500000")).toString(), "UR > RISKY case is incorrect");
      assert.equal(
        calculatedSafePrice.toString(),
        toBN(wei("1200000")).toString(),
        "Safe asset UR < RISKY case is incorrect"
      );
    });

    it("calculating annual cost where UR = 3% < RISKY", async () => {
      seconds = SECONDS_IN_YEAR;
      myMoney = wei("100000"); // 100k
      total = wei("10000000"); // 10mil
      bought = wei("200000"); // 200k

      await policyBookMock.setTotalLiquidity(total);
      await policyBookMock.setTotalCoverTokens(bought);

      const calculatedRiskyPrice = toBN(await policyQuote.getQuote(seconds, myMoney, policyBookMock.address));
      await policyBookMock.setWhitelistedStatus(true);
      const calculatedSafePrice = toBN(await policyQuote.getQuote(seconds, myMoney, policyBookMock.address));

      assert.equal(calculatedRiskyPrice.toString(), toBN(wei("2000")), "UR < RISKY case is incorrect");
      assert.equal(calculatedSafePrice.toString(), toBN(wei("2000")), "Safe asset UR < RISKY case is incorrect");
    });

    it("calculating 100 days cost where UR = 51% < RISKY", async () => {
      seconds = 100 * 24 * 60 * 60;
      myMoney = wei("100000"); // 100k
      total = wei("10000000"); // 10mil
      bought = wei("5000000"); // 5mil

      await policyBookMock.setTotalLiquidity(total);
      await policyBookMock.setTotalCoverTokens(bought);

      const calculatedRiskyPrice = toBN(await policyQuote.getQuote(seconds, myMoney, policyBookMock.address));
      await policyBookMock.setWhitelistedStatus(true);
      const calculatedSafePrice = toBN(await policyQuote.getQuote(seconds, myMoney, policyBookMock.address));

      const riskyExpectedPrice = QUOTE_SCENARIO_A.times(seconds).idiv(SECONDS_IN_YEAR);
      const safeExpectedPrice = QUOTE_SCENARIO_B.times(seconds).idiv(SECONDS_IN_YEAR);

      assert.equal(calculatedRiskyPrice.toString(), riskyExpectedPrice.toString(), "UR < RISKY case is incorrect");
      assert.equal(
        calculatedSafePrice.toString(),
        safeExpectedPrice.toString(),
        "Safe asset UR < RISKY case is incorrect"
      );
    });

    it("calculating 3 day cost where UR = 51% < RISKY", async () => {
      seconds = 3 * 24 * 60 * 60;
      myMoney = wei("100000"); // 100k
      total = wei("10000000"); // 10mil
      bought = wei("5000000"); // 5mil

      await policyBookMock.setTotalLiquidity(total);
      await policyBookMock.setTotalCoverTokens(bought);

      const calculatedRiskyPrice = toBN(await policyQuote.getQuote(seconds, myMoney, policyBookMock.address));
      await policyBookMock.setWhitelistedStatus(true);
      const calculatedSafePrice = toBN(await policyQuote.getQuote(seconds, myMoney, policyBookMock.address));

      const riskyExpectedPrice = QUOTE_SCENARIO_A.times(seconds).idiv(SECONDS_IN_YEAR);
      const safeExpectedPrice = QUOTE_SCENARIO_B.times(seconds).idiv(SECONDS_IN_YEAR);

      assert.equal(calculatedRiskyPrice.toString(), riskyExpectedPrice.toString(), "UR < RISKY case is incorrect");
      assert.equal(
        calculatedSafePrice.toString(),
        safeExpectedPrice.toString(),
        "Safe asset UR < RISKY case is incorrect"
      );
    });

    it("calculating 99 days cost where UR = 51% < RISKY", async () => {
      seconds = 99 * 24 * 60 * 60;
      myMoney = wei("100000"); // 100k
      total = wei("10000000"); // 10mil
      bought = wei("5000000"); // 5mil

      await policyBookMock.setTotalLiquidity(total);
      await policyBookMock.setTotalCoverTokens(bought);

      const calculatedRiskyPrice = toBN(await policyQuote.getQuote(seconds, myMoney, policyBookMock.address));
      await policyBookMock.setWhitelistedStatus(true);
      const calculatedSafePrice = toBN(await policyQuote.getQuote(seconds, myMoney, policyBookMock.address));

      const riskyExpectedPrice = QUOTE_SCENARIO_A.times(seconds).idiv(SECONDS_IN_YEAR);
      const safeExpectedPrice = QUOTE_SCENARIO_B.times(seconds).idiv(SECONDS_IN_YEAR);

      assert.equal(calculatedRiskyPrice.toString(), riskyExpectedPrice.toString(), "UR < RISKY case is incorrect");
      assert.equal(
        calculatedSafePrice.toString(),
        safeExpectedPrice.toString(),
        "Safe asset UR < RISKY case is incorrect"
      );
    });

    it("calculating 0 seconds cost", async () => {
      seconds = 0;
      myMoney = wei("100000"); // 100k
      total = wei("10000000"); // 10mil
      bought = wei("5000000"); // 5mil

      await policyBookMock.setTotalLiquidity(total);
      await policyBookMock.setTotalCoverTokens(bought);

      await truffleAssert.reverts(
        policyQuote.getQuote(seconds, myMoney, policyBookMock.address),
        "PolicyQuote: Invalid duration"
      );
    });

    it("calculating 10 years cost", async () => {
      seconds = 10 * 365 * 24 * 60 * 60;
      myMoney = wei("100000"); // 100k
      total = wei("10000000"); // 10mil
      bought = wei("5000000"); // 5mil

      await policyBookMock.setTotalLiquidity(total);
      await policyBookMock.setTotalCoverTokens(bought);

      await truffleAssert.reverts(
        policyQuote.getQuote(seconds, myMoney, policyBookMock.address),
        "PolicyQuote: Invalid duration"
      );
    });

    it("calculating annual cost, forcing minimal percentage threshold", async () => {
      seconds = SECONDS_IN_YEAR;
      myMoney = wei("10000");
      total = wei("10000000"); // 10mil
      bought = 0;

      await policyBookMock.setTotalLiquidity(total);
      await policyBookMock.setTotalCoverTokens(bought);

      const calculatedRiskyPrice = toBN(await policyQuote.getQuote(seconds, myMoney, policyBookMock.address));
      await policyBookMock.setWhitelistedStatus(true);
      const calculatedSafePrice = toBN(await policyQuote.getQuote(seconds, myMoney, policyBookMock.address));

      const riskyExpectedPrice = toBN(wei("200"));

      assert.equal(calculatedRiskyPrice.toString(), riskyExpectedPrice.toString(), "Less than minimal");
      assert.equal(
        calculatedRiskyPrice.toString(),
        calculatedSafePrice.toString(),
        "Unexpected cost difference between asset classes"
      );
    });

    it("calculating annual cost, forcing minimal cost threshold", async () => {
      seconds = 10;
      myMoney = wei("10");
      total = wei("10000000"); // 10mil
      bought = 0;

      await policyBookMock.setTotalLiquidity(total);
      await policyBookMock.setTotalCoverTokens(bought);

      const calculatedRiskyPrice = toBN(await policyQuote.getQuote(seconds, myMoney, policyBookMock.address));
      await policyBookMock.setWhitelistedStatus(true);
      const calculatedSafePrice = toBN(await policyQuote.getQuote(seconds, myMoney, policyBookMock.address));

      assert.equal(calculatedRiskyPrice.toString(), MINIMUM_INSURANCE_COST.toString());
      assert.equal(calculatedSafePrice.toString(), MINIMUM_INSURANCE_COST.toString());
    });

    it("calculating 1 year cost where UR = 51% < RISKY + really big money", async () => {
      seconds = toBN(365).times(24).times(60).times(60); // 10 years
      myMoney = wei(toBN(10).pow(12).toString()); // 1tril
      total = wei(toBN(10).pow(14).toString()); // 100tril
      bought = wei(toBN(10).pow(13).times(5).toString()); // 50tril

      await policyBookMock.setTotalLiquidity(total);
      await policyBookMock.setTotalCoverTokens(bought);

      const calculatedRiskyPrice = toBN(await policyQuote.getQuote(seconds, myMoney, policyBookMock.address));
      const riskyExpectedPrice = toBN(wei("159375000000"));

      assert.equal(calculatedRiskyPrice.toString(), riskyExpectedPrice.toString(), "UR < RISKY case is incorrect");

      await policyBookMock.setWhitelistedStatus(true);

      const calculatedSafePrice = toBN(await policyQuote.getQuote(seconds, myMoney, policyBookMock.address));
      const safeExpectedPrice = toBN(wei("63750000000"));

      assert.equal(
        calculatedSafePrice.toString(),
        safeExpectedPrice.toString(),
        "Safe asset UR < RISKY case is incorrect"
      );
    });

    it("edge case: calculating annual cost where UR = 100% > RISKY", async () => {
      seconds = SECONDS_IN_YEAR;
      myMoney = wei("500000"); // 500k
      total = wei("1000000"); // 1mil
      bought = wei("500000"); // 500k

      await policyBookMock.setTotalLiquidity(total);
      await policyBookMock.setTotalCoverTokens(bought);

      const calculatedRiskyPrice = toBN(await policyQuote.getQuote(seconds, myMoney, policyBookMock.address));
      await policyBookMock.setWhitelistedStatus(true);
      const calculatedSafePrice = toBN(await policyQuote.getQuote(seconds, myMoney, policyBookMock.address));

      assert.equal(calculatedRiskyPrice.toString(), toBN(wei("500000")).toString(), "UR > RISKY case is incorrect");
      assert.equal(calculatedSafePrice.toString(), toBN(wei("250000")).toString(), "UR > RISKY case is incorrect");
    });

    it("require more tokens than there exists (should revert)", async () => {
      seconds = SECONDS_IN_YEAR;
      myMoney = wei("600000"); // 600k
      total = wei("1000000"); // 1mil
      bought = wei("500000"); // 500k

      await policyBookMock.setTotalLiquidity(total);
      await policyBookMock.setTotalCoverTokens(bought);

      await truffleAssert.reverts(
        policyQuote.getQuote(seconds, myMoney, policyBookMock.address),
        "PolicyQuote: Requiring more than there exists"
      );
    });

    it("pool is empty (should revert)", async () => {
      seconds = SECONDS_IN_YEAR;
      myMoney = wei("1"); // 0
      total = 0; // 0
      bought = 0; // 0

      await policyBookMock.setTotalLiquidity(total);
      await policyBookMock.setTotalCoverTokens(bought);

      await truffleAssert.reverts(
        policyQuote.getQuote(seconds, myMoney, policyBookMock.address),
        "PolicyQuote: Requiring more than there exists"
      );
    });

    it("forcing overflow (should revert)", async () => {
      seconds = SECONDS_IN_YEAR;
      myMoney = toBN(4).times(toBN(10).pow(toBN(76)));
      total = toBN(10).times(toBN(10).pow(toBN(76)));
      bought = toBN(5).times(toBN(10).pow(toBN(76)));

      await policyBookMock.setTotalLiquidity(total);
      await policyBookMock.setTotalCoverTokens(bought);

      await truffleAssert.reverts(
        policyQuote.getQuote(seconds, myMoney, policyBookMock.address),
        "SafeMath: multiplication overflow"
      );
    });
  });
});
