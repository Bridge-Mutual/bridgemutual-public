const ReputationSystem = artifacts.require("ReputationSystem");
const ContractsRegistry = artifacts.require("ContractsRegistry");

const { assert } = require("chai");
const BigNumber = require("bignumber.js");

function toBN(number) {
  return new BigNumber(number);
}

function randomAddress() {
  return web3.utils.randomHex(20);
}

contract("ReputationSystem", async (accounts) => {
  let reputationSystem;

  const USER1 = accounts[0];
  const CLAIM_VOTING = accounts[6];

  const PRECISION = toBN(10 ** 25);

  beforeEach("setup", async () => {
    const contractsRegistry = await ContractsRegistry.new();
    const _reputationSystem = await ReputationSystem.new();

    await contractsRegistry.__ContractsRegistry_init();

    await contractsRegistry.addContract(await contractsRegistry.CLAIM_VOTING_NAME(), CLAIM_VOTING);

    await contractsRegistry.addProxyContract(
      await contractsRegistry.REPUTATION_SYSTEM_NAME(),
      _reputationSystem.address
    );

    reputationSystem = await ReputationSystem.at(await contractsRegistry.getReputationSystemContract());

    await reputationSystem.__ReputationSystem_init([]);

    await contractsRegistry.injectDependencies(await contractsRegistry.REPUTATION_SYSTEM_NAME());
  });

  describe("getters", async () => {
    it("should check all new user getters", async () => {
      assert.equal(toBN(await reputationSystem.reputation(USER1)).toString(), PRECISION.toString());

      assert.equal(await reputationSystem.isTrustedVoter(USER1), false);

      assert.equal(await reputationSystem.hasVotedOnce(USER1), false);
    });
  });

  describe("calculateMajorityReputation()", async () => {
    it("should set new majority reputation (edge case)", async () => {
      assert.equal(toBN(await reputationSystem.reputation(USER1)).toString(), PRECISION.toString());

      const newRep = await reputationSystem.getNewReputation(USER1, PRECISION.times(50), { from: CLAIM_VOTING });
      const res = await reputationSystem.setNewReputation(USER1, newRep, { from: CLAIM_VOTING });
      console.log("SetNewReputation gas used: " + res.receipt.gasUsed);

      assert.equal(await reputationSystem.hasVotedOnce(USER1), true);
      assert.equal(
        toBN(await reputationSystem.reputation(USER1)).toString(),
        PRECISION.plus(PRECISION.times(0.025)).toString()
      );
    });

    it("should set new majority reputation (doc case 1)", async () => {
      const newRep = await reputationSystem.getNewReputation(USER1, PRECISION.times(55), { from: CLAIM_VOTING });
      await reputationSystem.setNewReputation(USER1, newRep, { from: CLAIM_VOTING });

      assert.equal(
        toBN(await reputationSystem.reputation(USER1)).toString(),
        PRECISION.plus(PRECISION.times(0.0275)).toString()
      );
    });

    it("should set new majority reputation (doc case 2)", async () => {
      const newRep = await reputationSystem.getNewReputation(USER1, PRECISION.times(70), { from: CLAIM_VOTING });
      await reputationSystem.setNewReputation(USER1, newRep, { from: CLAIM_VOTING });

      assert.equal(
        toBN(await reputationSystem.reputation(USER1)).toString(),
        PRECISION.plus(PRECISION.times(0.035)).toString()
      );
    });

    it("should set new majority reputation (doc case 3)", async () => {
      const newRep = await reputationSystem.getNewReputation(USER1, PRECISION.times(99), { from: CLAIM_VOTING });
      await reputationSystem.setNewReputation(USER1, newRep, { from: CLAIM_VOTING });

      assert.equal(
        toBN(await reputationSystem.reputation(USER1)).toString(),
        PRECISION.plus(PRECISION.times(0.0495)).toString()
      );
    });

    it("should set new majority reputation (edge case)", async () => {
      const newRep = await reputationSystem.getNewReputation(USER1, PRECISION.times(100), { from: CLAIM_VOTING });
      await reputationSystem.setNewReputation(USER1, newRep, { from: CLAIM_VOTING });

      assert.equal(
        toBN(await reputationSystem.reputation(USER1)).toString(),
        PRECISION.plus(PRECISION.times(0.05)).toString()
      );
    });
  });

  describe("calculateMinorityReputation()", async () => {
    it("should set new minority reputation (doc case 1)", async () => {
      assert.equal(toBN(await reputationSystem.reputation(USER1)).toString(), PRECISION.toString());

      const newRep = await reputationSystem.getNewReputation(USER1, PRECISION.times(45), { from: CLAIM_VOTING });
      await reputationSystem.setNewReputation(USER1, newRep, { from: CLAIM_VOTING });

      assert.equal(await reputationSystem.hasVotedOnce(USER1), true);
      assert.equal(
        toBN(await reputationSystem.reputation(USER1)).toString(),
        PRECISION.minus(PRECISION.times(0.005)).toString()
      );
    });

    it("should set new minority reputation (doc case 2)", async () => {
      const newRep = await reputationSystem.getNewReputation(USER1, PRECISION.times(30), { from: CLAIM_VOTING });
      await reputationSystem.setNewReputation(USER1, newRep, { from: CLAIM_VOTING });

      assert.equal(
        toBN(await reputationSystem.reputation(USER1)).toString(),
        PRECISION.minus(PRECISION.times(0.08)).toString()
      );
    });

    it("should set new minority reputation (doc case 3)", async () => {
      const newRep = await reputationSystem.getNewReputation(USER1, PRECISION, { from: CLAIM_VOTING });
      await reputationSystem.setNewReputation(USER1, newRep, { from: CLAIM_VOTING });

      assert.equal(
        toBN(await reputationSystem.reputation(USER1)).toString(),
        PRECISION.minus(PRECISION.times(0.4802)).toString()
      );
    });

    it("should set new minority reputation (edge case)", async () => {
      const newRep = await reputationSystem.getNewReputation(USER1, 0, { from: CLAIM_VOTING });
      await reputationSystem.setNewReputation(USER1, newRep, { from: CLAIM_VOTING });

      assert.equal(
        toBN(await reputationSystem.reputation(USER1)).toString(),
        PRECISION.minus(PRECISION.times(0.5)).toString()
      );
    });
  });

  describe("trusted voter reputation threshold", async () => {
    it("threshold should stay the same", async () => {
      assert.equal(
        toBN(await reputationSystem.getTrustedVoterReputationThreshold()).toString(),
        PRECISION.times(2).toString()
      );

      const addr1 = randomAddress();

      await reputationSystem.setNewReputation(addr1, PRECISION, { from: CLAIM_VOTING });

      assert.equal(
        toBN(await reputationSystem.getTrustedVoterReputationThreshold()).toString(),
        PRECISION.times(2).toString()
      );

      await reputationSystem.setNewReputation(addr1, PRECISION.times(3), { from: CLAIM_VOTING });

      assert.equal(
        toBN(await reputationSystem.getTrustedVoterReputationThreshold()).toString(),
        PRECISION.times(2).toString()
      );
    });

    it("threshold should equal 3", async () => {
      let addr;

      for (let i = 0; i < 10; i++) {
        addr = randomAddress();

        await reputationSystem.setNewReputation(addr, PRECISION.times(3), { from: CLAIM_VOTING });
      }

      assert.equal(
        toBN(await reputationSystem.getTrustedVoterReputationThreshold()).toString(),
        PRECISION.times(3).toString()
      );
      assert.equal(await reputationSystem.isTrustedVoter(addr), true);
    });

    it("threshold should equal 3", async () => {
      let addr1;

      for (let i = 0; i < 4; i++) {
        const addr = randomAddress();

        await reputationSystem.setNewReputation(addr, PRECISION.times(3), { from: CLAIM_VOTING });
      }

      for (let i = 0; i < 5; i++) {
        addr1 = randomAddress();

        await reputationSystem.setNewReputation(addr1, PRECISION.times(2.9), { from: CLAIM_VOTING });
      }

      assert.equal(
        toBN(await reputationSystem.getTrustedVoterReputationThreshold()).toString(),
        PRECISION.times(3).toString()
      );
      assert.equal(await reputationSystem.isTrustedVoter(addr1), false);
    });

    it("threshold should equal 2.9", async () => {
      for (let i = 0; i < 2; i++) {
        const addr = randomAddress();

        await reputationSystem.setNewReputation(addr, PRECISION.times(3), { from: CLAIM_VOTING });
      }

      for (let i = 0; i < 7; i++) {
        const addr = randomAddress();

        await reputationSystem.setNewReputation(addr, PRECISION.times(2.9), { from: CLAIM_VOTING });
      }

      for (let i = 0; i < 50; i++) {
        const addr = randomAddress();

        await reputationSystem.setNewReputation(addr, PRECISION.times(2), { from: CLAIM_VOTING });
      }

      assert.equal(
        toBN(await reputationSystem.getTrustedVoterReputationThreshold()).toString(),
        PRECISION.times(2.9).toString()
      );
    });

    it("threshold should equal 2.5", async () => {
      for (let i = 0; i < 3; i++) {
        const addr = randomAddress();

        await reputationSystem.setNewReputation(addr, PRECISION.times(3), { from: CLAIM_VOTING });
      }

      for (let i = 0; i < 5; i++) {
        const addr = randomAddress();

        await reputationSystem.setNewReputation(addr, PRECISION.times(2.9), { from: CLAIM_VOTING });
      }

      for (let i = 0; i < 80; i++) {
        const addr = randomAddress();

        await reputationSystem.setNewReputation(addr, PRECISION.times(2.4), { from: CLAIM_VOTING });
      }

      assert.equal(
        toBN(await reputationSystem.getTrustedVoterReputationThreshold()).toString(),
        PRECISION.times(2.5).toString()
      );
    });

    it("threshold should equal 2", async () => {
      for (let i = 0; i < 20; i++) {
        const addr = randomAddress();

        await reputationSystem.setNewReputation(addr, PRECISION.times(2), { from: CLAIM_VOTING });
      }

      assert.equal(
        toBN(await reputationSystem.getTrustedVoterReputationThreshold()).toString(),
        PRECISION.times(2).toString()
      );
    });
  });
});
