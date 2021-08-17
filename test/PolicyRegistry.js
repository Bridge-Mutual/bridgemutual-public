const PolicyRegistry = artifacts.require("PolicyRegistry");
const PolicyBookRegistry = artifacts.require("PolicyBookRegistry");
const ContractsRegistry = artifacts.require("ContractsRegistry");
const ClaimingRegistry = artifacts.require("ClaimingRegistry");

const Reverter = require("./helpers/reverter");
const BigNumber = require("bignumber.js");
const truffleAssert = require("truffle-assertions");
const setCurrentTime = require("./helpers/ganacheTimeTraveler");
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

function toBN(number) {
  return new BigNumber(number);
}

const wei = web3.utils.toWei;

contract("PolicyRegistry", async (accounts) => {
  const reverter = new Reverter(web3);

  const USER1 = accounts[1];
  const USER2 = accounts[2];
  const insuranceContract = accounts[3];
  const PBF = accounts[4];
  const BOOK1 = accounts[5];
  const BOOK2 = accounts[6];
  const BOOK3 = accounts[7];
  const NOTHING = accounts[9];

  const oneWeek = toBN(7).times(24).times(60).times(60);

  let policyRegistry;
  let policyBookRegistry;

  before("setup", async () => {
    const contractsRegistry = await ContractsRegistry.new();
    const _policyBookRegistry = await PolicyBookRegistry.new();
    const _policyRegistry = await PolicyRegistry.new();
    const _claimingRegistry = await ClaimingRegistry.new();

    await contractsRegistry.__ContractsRegistry_init();

    await contractsRegistry.addContract(await contractsRegistry.POLICY_BOOK_ADMIN_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.CLAIM_VOTING_NAME(), NOTHING);

    await contractsRegistry.addContract(await contractsRegistry.POLICY_BOOK_FABRIC_NAME(), PBF);

    await contractsRegistry.addProxyContract(
      await contractsRegistry.CLAIMING_REGISTRY_NAME(),
      _claimingRegistry.address
    );
    await contractsRegistry.addProxyContract(
      await contractsRegistry.POLICY_BOOK_REGISTRY_NAME(),
      _policyBookRegistry.address
    );
    await contractsRegistry.addProxyContract(await contractsRegistry.POLICY_REGISTRY_NAME(), _policyRegistry.address);

    const claimingRegistry = await ClaimingRegistry.at(await contractsRegistry.getClaimingRegistryContract());
    policyBookRegistry = await PolicyBookRegistry.at(await contractsRegistry.getPolicyBookRegistryContract());
    policyRegistry = await PolicyRegistry.at(await contractsRegistry.getPolicyRegistryContract());

    await claimingRegistry.__ClaimingRegistry_init();

    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.CLAIMING_REGISTRY_NAME());

    await reverter.snapshot();
  });

  afterEach("revert", reverter.revert);

  describe("isPolicyActive", async () => {
    const durationSeconds = toBN(1000000);
    const premium = toBN(wei("5000"));
    const coverAmount = toBN(wei("100000"));

    beforeEach("setup state", async () => {
      await policyBookRegistry.add(BOOK1, ContractType.CONTRACT, BOOK1, { from: PBF });
      await policyBookRegistry.add(BOOK2, ContractType.CONTRACT, BOOK2, { from: PBF });

      await setCurrentTime(1);
      await policyRegistry.addPolicy(USER1, coverAmount, premium, durationSeconds, { from: BOOK1 });
    });

    it("should return true if user have active policy", async () => {
      assert.equal(await policyRegistry.isPolicyActive(USER1, BOOK1), true);
    });

    it("should return false if user policy expires", async () => {
      await setCurrentTime(durationSeconds.plus(oneWeek).plus(10));
      assert.equal(await policyRegistry.isPolicyActive(USER1, BOOK1), false);
    });

    it("should return false if user do not have a policy", async () => {
      assert.equal(await policyRegistry.isPolicyActive(USER1, BOOK2), false);
    });
  });

  describe("isPolicyExist", async () => {
    const durationSeconds = toBN(1000000);
    const premium = toBN(wei("5000"));
    const coverAmount = toBN(wei("100000"));

    beforeEach("setup state", async () => {
      await policyBookRegistry.add(BOOK1, ContractType.CONTRACT, BOOK1, { from: PBF });
      await policyBookRegistry.add(BOOK2, ContractType.CONTRACT, BOOK2, { from: PBF });

      await setCurrentTime(1);
      await policyRegistry.addPolicy(USER1, coverAmount, premium, durationSeconds, { from: BOOK1 });
    });

    it("should return true if user have a policy", async () => {
      assert.equal(await policyRegistry.policyExists(USER1, BOOK1), true);
    });

    it("should return false if user do not have a policy", async () => {
      assert.equal(await policyRegistry.policyExists(USER1, BOOK2), false);
    });
  });

  describe("getPoliciesInfo", async () => {
    const durationSeconds = toBN(10000);
    const premium = toBN(wei("5000"));
    const coverAmount = toBN(wei("100000"));

    beforeEach("setup state", async () => {
      await policyBookRegistry.add(BOOK1, ContractType.CONTRACT, BOOK1, { from: PBF });
      await policyBookRegistry.add(BOOK2, ContractType.CONTRACT, BOOK2, { from: PBF });
      await policyBookRegistry.add(BOOK3, ContractType.CONTRACT, BOOK3, { from: PBF });

      await setCurrentTime(1);
      await policyRegistry.addPolicy(USER1, coverAmount, premium, durationSeconds, { from: BOOK1 });
      await policyRegistry.addPolicy(USER1, coverAmount, premium, durationSeconds.times(2), { from: BOOK2 });
      await policyRegistry.addPolicy(USER1, coverAmount, premium, durationSeconds.times(3), { from: BOOK3 });

      const policies = (await policyRegistry.getPoliciesInfo(USER1, true, 0, 10))[1];
      assert.deepEqual(policies, [BOOK1, BOOK2, BOOK3]);

      assert.equal(toBN(await policyRegistry.getPoliciesLength(USER1)).toString(), 3);
    });

    it("should return the correct list of active policies", async () => {
      let size = await policyRegistry.getPoliciesLength(USER1);
      let resultArr = await policyRegistry.getPoliciesInfo(USER1, true, 0, size);

      assert.equal(resultArr[0], 3);
      assert.deepEqual(resultArr[1], [BOOK1, BOOK2, BOOK3]);

      await setCurrentTime(durationSeconds.times(2).plus(oneWeek).plus(10));

      size = await policyRegistry.getPoliciesLength(USER1);
      resultArr = await policyRegistry.getPoliciesInfo(USER1, true, 0, size);

      assert.equal(resultArr[0], 1);
      assert.equal(resultArr[1][0], BOOK3);
      assert.equal(resultArr[3][0], ClaimStatus.CAN_CLAIM);
    });

    it("should return the correct list of inactive policies", async () => {
      let size = await policyRegistry.getPoliciesLength(USER1);
      let resultArr = await policyRegistry.getPoliciesInfo(USER1, false, 0, size);

      assert.equal(resultArr[0], 0);

      await setCurrentTime(durationSeconds.times(2).plus(oneWeek).plus(10));

      size = await policyRegistry.getPoliciesLength(USER1);
      resultArr = await policyRegistry.getPoliciesInfo(USER1, false, 0, size);

      assert.equal(resultArr[0], 2);
      assert.equal(resultArr[1][0], BOOK1);
      assert.equal(resultArr[1][1], BOOK2);

      await setCurrentTime(durationSeconds.times(3).plus(oneWeek).plus(10));

      size = await policyRegistry.getPoliciesLength(USER1);
      resultArr = await policyRegistry.getPoliciesInfo(USER1, false, 0, size);

      assert.equal(resultArr[0], 3);
      assert.deepEqual(resultArr[1], [BOOK1, BOOK2, BOOK3]);
    });

    it("should return an empty list if the user does not have a policy", async () => {
      let size = await policyRegistry.getPoliciesLength(USER2);
      let result = await policyRegistry.getPoliciesInfo(USER2, true, 0, size);
      assert.equal(result[0], 0);

      size = await policyRegistry.getPoliciesLength(USER2);
      result = await policyRegistry.getPoliciesInfo(USER2, false, 0, size);
      assert.equal(result[0], 0);
    });
  });

  describe("addPolicy", async () => {
    const durationSeconds = toBN(1000000);
    const premium = toBN(wei("5000"));
    const coverAmount = toBN(wei("100000"));

    beforeEach("setup state", async () => {
      await policyBookRegistry.add(insuranceContract, ContractType.CONTRACT, BOOK1, { from: PBF });
    });

    it("should emit correct event", async () => {
      await setCurrentTime(1);
      const result = await policyRegistry.addPolicy(USER1, coverAmount, premium, durationSeconds, { from: BOOK1 });

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, "PolicyAdded");
      assert.equal(result.logs[0].args._userAddr, USER1);
      assert.equal(result.logs[0].args._policyBook, BOOK1);
      assert.equal(toBN(result.logs[0].args._coverAmount).toString(), coverAmount.toString());
    });

    it("should set correct values", async () => {
      await setCurrentTime(1);
      await policyRegistry.addPolicy(USER1, coverAmount, premium, durationSeconds, { from: BOOK1 });

      const resultArr = await policyRegistry.getPoliciesInfo(USER1, true, 0, 10);
      assert.deepEqual(resultArr[1], [BOOK1]);

      const policyInfo = resultArr[2][0];

      assert.equal(toBN(policyInfo.coverAmount).toString(), coverAmount.toString());
      assert.equal(toBN(policyInfo.premium).toString(), premium.toString());
      assert.equal(toBN(policyInfo.startTime).toString(), 1);
      assert.equal(toBN(policyInfo.endTime).toString(), durationSeconds.plus(1).toString());
    });

    it("should correct add several policies", async () => {
      await setCurrentTime(1);
      await policyRegistry.addPolicy(USER1, coverAmount, premium, durationSeconds, { from: BOOK1 });

      const insuranceContract2 = accounts[7];
      await policyBookRegistry.add(insuranceContract2, ContractType.CONTRACT, BOOK2, { from: PBF });

      await setCurrentTime(10);
      await policyRegistry.addPolicy(USER1, coverAmount, premium, durationSeconds, { from: BOOK2 });

      const policies = (await policyRegistry.getPoliciesInfo(USER1, true, 0, 10))[1];
      assert.deepEqual(policies, [BOOK1, BOOK2]);
    });

    it("should get exception, policy already exists", async () => {
      await policyRegistry.addPolicy(USER1, coverAmount, premium, durationSeconds, { from: BOOK1 });

      const reason = "The policy already exists";
      await truffleAssert.reverts(
        policyRegistry.addPolicy(USER1, coverAmount, premium, durationSeconds, { from: BOOK1 }),
        reason
      );
    });
  });

  describe("removePolicy", async () => {
    const durationSeconds = toBN(1000000);
    const premium = toBN(wei("5000"));
    const coverAmount = toBN(wei("100000"));

    beforeEach("setup state", async () => {
      await policyBookRegistry.add(BOOK1, ContractType.CONTRACT, BOOK1, { from: PBF });
      await policyBookRegistry.add(BOOK2, ContractType.CONTRACT, BOOK2, { from: PBF });
      await policyBookRegistry.add(BOOK3, ContractType.CONTRACT, BOOK3, { from: PBF });

      await setCurrentTime(1);
      await policyRegistry.addPolicy(USER1, coverAmount, premium, durationSeconds, { from: BOOK1 });
      await policyRegistry.addPolicy(USER1, coverAmount, premium, durationSeconds, { from: BOOK2 });
      await policyRegistry.addPolicy(USER1, coverAmount, premium, durationSeconds, { from: BOOK3 });

      const policies = (await policyRegistry.getPoliciesInfo(USER1, true, 0, 10))[1];

      assert.deepEqual(policies, [BOOK1, BOOK2, BOOK3]);
      assert.equal(toBN(await policyRegistry.getPoliciesLength(USER1)).toString(), 3);
    });

    it("should correctly remove last element in the list", async () => {
      await policyRegistry.removePolicy(USER1, { from: BOOK3 });
      assert.equal(toBN(await policyRegistry.getPoliciesLength(USER1)).toString(), 2);
    });

    it("should emit correct event", async () => {
      const result = await policyRegistry.removePolicy(USER1, { from: BOOK3 });
      assert.equal(toBN(await policyRegistry.getPoliciesLength(USER1)).toString(), 2);

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, "PolicyRemoved");
      assert.equal(result.logs[0].args._userAddr, USER1);
      assert.equal(result.logs[0].args._policyBook, BOOK3);
    });

    it("should correctly remove an item from the center of the list ", async () => {
      await policyRegistry.removePolicy(USER1, { from: BOOK1 });
      assert.equal(toBN(await policyRegistry.getPoliciesLength(USER1)).toString(), 2);

      const policies = (await policyRegistry.getPoliciesInfo(USER1, true, 0, 10))[1];
      assert.deepEqual(policies, [BOOK3, BOOK2]);
    });

    it("should get exception, policy already exists", async () => {
      const BOOK4 = accounts[8];
      await policyBookRegistry.add(BOOK4, ContractType.CONTRACT, BOOK4, { from: PBF });

      const reason = "This policy is not on the list";
      await truffleAssert.reverts(policyRegistry.removePolicy(USER1, { from: BOOK4 }), reason);
    });
  });
});
