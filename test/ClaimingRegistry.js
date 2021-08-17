const STBLMock = artifacts.require("STBLMock");
const ContractsRegistry = artifacts.require("ContractsRegistry");
const PolicyBookRegistry = artifacts.require("PolicyBookRegistry");
const ClaimingRegistryMock = artifacts.require("ClaimingRegistryMock");
const PolicyBookMock = artifacts.require("PolicyBookMock");
const PolicyBookFabric = artifacts.require("PolicyBookFabric");
const PolicyRegistryMock = artifacts.require("PolicyRegistryMock");
const PolicyBook = artifacts.require("PolicyBook");
const PolicyBookAdmin = artifacts.require("PolicyBookAdmin");
const PolicyQuote = artifacts.require("PolicyQuote");
const RewardsGenerator = artifacts.require("RewardsGenerator");
const LiquidityRegistry = artifacts.require("LiquidityRegistry");
const LiquidityMining = artifacts.require("LiquidityMining");

const BigNumber = require("bignumber.js");
const { assert } = require("chai");
const setCurrentTime = require("./helpers/ganacheTimeTraveler");
const truffleAssert = require("truffle-assertions");

const ClaimStatus = {
  CAN_CLAIM: 0,
  UNCLAIMABLE: 1,
  PENDING: 2,
  AWAITING_CALCULATION: 3,
  REJECTED_CAN_APPEAL: 4,
  REJECTED: 5,
  ACCEPTED: 6,
};

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

contract("ClaimingRegistry", async (accounts) => {
  let stblMock;
  let claimingRegistryMock;
  let policyRegistryMock;

  const USER1 = accounts[0];
  const USER2 = accounts[1];
  const INSURED1 = accounts[2];
  const INSURED2 = accounts[3];
  const CLAIM_VOTING = accounts[6];
  const NOTHING = accounts[9];

  let policyBook1;
  let policyBook2;

  beforeEach("setup", async () => {
    const contractsRegistry = await ContractsRegistry.new();
    const policyBookImpl = await PolicyBookMock.new();
    const _rewardsGenerator = await RewardsGenerator.new();
    const _policyBookAdmin = await PolicyBookAdmin.new();
    const _policyQuote = await PolicyQuote.new();
    const _claimingRegistryMock = await ClaimingRegistryMock.new();
    const _policyRegistryMock = await PolicyRegistryMock.new();
    const _liquidityRegistry = await LiquidityRegistry.new();
    const _policyBookRegistry = await PolicyBookRegistry.new();
    const _policyBookFabric = await PolicyBookFabric.new();
    const _liquidityMining = await LiquidityMining.new();
    stblMock = await STBLMock.new("stblMock", "stblMock", 6);

    await contractsRegistry.__ContractsRegistry_init();

    await contractsRegistry.addContract(await contractsRegistry.PRICE_FEED_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.REINSURANCE_POOL_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_COVER_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_UTILITY_NFT_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.LEGACY_REWARDS_GENERATOR_NAME(), NOTHING);

    await contractsRegistry.addContract(await contractsRegistry.CLAIM_VOTING_NAME(), CLAIM_VOTING);
    await contractsRegistry.addContract(await contractsRegistry.USDT_NAME(), stblMock.address);

    await contractsRegistry.addProxyContract(
      await contractsRegistry.REWARDS_GENERATOR_NAME(),
      _rewardsGenerator.address
    );
    await contractsRegistry.addProxyContract(
      await contractsRegistry.POLICY_BOOK_ADMIN_NAME(),
      _policyBookAdmin.address
    );
    await contractsRegistry.addProxyContract(await contractsRegistry.POLICY_QUOTE_NAME(), _policyQuote.address);
    await contractsRegistry.addProxyContract(
      await contractsRegistry.POLICY_BOOK_REGISTRY_NAME(),
      _policyBookRegistry.address
    );
    await contractsRegistry.addProxyContract(
      await contractsRegistry.POLICY_BOOK_FABRIC_NAME(),
      _policyBookFabric.address
    );
    await contractsRegistry.addProxyContract(
      await contractsRegistry.CLAIMING_REGISTRY_NAME(),
      _claimingRegistryMock.address
    );
    await contractsRegistry.addProxyContract(
      await contractsRegistry.POLICY_REGISTRY_NAME(),
      _policyRegistryMock.address
    );
    await contractsRegistry.addProxyContract(
      await contractsRegistry.LIQUIDITY_REGISTRY_NAME(),
      _liquidityRegistry.address
    );
    await contractsRegistry.addProxyContract(await contractsRegistry.LIQUIDITY_MINING_NAME(), _liquidityMining.address);

    const rewardsGenerator = await RewardsGenerator.at(await contractsRegistry.getRewardsGeneratorContract());
    const policyBookFabric = await PolicyBookFabric.at(await contractsRegistry.getPolicyBookFabricContract());
    const policyBookAdmin = await PolicyBookAdmin.at(await contractsRegistry.getPolicyBookAdminContract());
    const liquidityMining = await LiquidityMining.at(await contractsRegistry.getLiquidityMiningContract());
    policyRegistryMock = await PolicyRegistryMock.at(await contractsRegistry.getPolicyRegistryContract());
    claimingRegistryMock = await ClaimingRegistryMock.at(await contractsRegistry.getClaimingRegistryContract());

    await rewardsGenerator.__RewardsGenerator_init();
    await claimingRegistryMock.__ClaimingRegistry_init();
    await policyBookAdmin.__PolicyBookAdmin_init(policyBookImpl.address);
    await liquidityMining.__LiquidityMining_init();

    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.REWARDS_GENERATOR_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.CLAIMING_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_FABRIC_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_MINING_NAME());

    const initialDeposit = wei("1000");

    await stblMock.approve(policyBookFabric.address, wei("2000"));

    await setCurrentTime(1);

    policyBook1 = (await policyBookFabric.create(INSURED1, ContractType.STABLECOIN, "mock1", "1", initialDeposit))
      .logs[0].args.at;

    await setCurrentTime(1);

    policyBook2 = (await policyBookFabric.create(INSURED2, ContractType.STABLECOIN, "mock2", "1", initialDeposit))
      .logs[0].args.at;

    await policyRegistryMock.setPolicyEndTime(USER1, policyBook1, toBN(365).times(24).times(60).times(60));
    await policyRegistryMock.setPolicyEndTime(USER1, policyBook2, toBN(365).times(24).times(60).times(60));
    await policyRegistryMock.setPolicyEndTime(USER2, policyBook1, toBN(365).times(24).times(60).times(60));
    await policyRegistryMock.setPolicyEndTime(USER2, policyBook2, toBN(365).times(24).times(60).times(60));
  });

  describe("submitClaim()", async () => {
    it("should submit new claim", async () => {
      let claimsCount = await claimingRegistryMock.countPolicyClaimerClaims(USER1);

      assert.equal(claimsCount, 0);

      await setCurrentTime(1);

      const res = await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, false, { from: CLAIM_VOTING });
      const id = res.logs[0].args.claimIndex;

      console.log("SubmitClaim gas used: " + res.receipt.gasUsed);

      assert.equal(id, 1);

      claimsCount = await claimingRegistryMock.countPolicyClaimerClaims(USER1);

      assert.equal(claimsCount, 1);

      assert.equal(await claimingRegistryMock.claimExists(id), true);
      assert.equal(await claimingRegistryMock.hasClaim(USER1, policyBook1), true);
      assert.equal(await claimingRegistryMock.isClaimAnonymouslyVotable(id), true);
      assert.equal(await claimingRegistryMock.isClaimExposablyVotable(id), false);
      assert.equal(await claimingRegistryMock.isClaimPending(id), true);
      assert.equal(await claimingRegistryMock.countPendingClaims(), 1);
      assert.equal(await claimingRegistryMock.countClaims(), 1);
      assert.equal(await claimingRegistryMock.claimStatus(id), ClaimStatus.PENDING);

      await setCurrentTime(toBN(await claimingRegistryMock.anonymousVotingDuration(id)).plus(10));

      assert.equal(await claimingRegistryMock.isClaimAnonymouslyVotable(id), false);
      assert.equal(await claimingRegistryMock.isClaimExposablyVotable(id), true);
    });

    it("shouldn't submit second identical claim", async () => {
      await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, false, { from: CLAIM_VOTING });

      await truffleAssert.reverts(
        claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, false, { from: CLAIM_VOTING }),
        "ClaimingRegistry: The claimer can't submit this claim"
      );
    });

    it("should submit two claims", async () => {
      let claimsCount = await claimingRegistryMock.countPolicyClaimerClaims(USER1);

      assert.equal(claimsCount, 0);

      await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, false, { from: CLAIM_VOTING });
      await claimingRegistryMock.submitClaim(USER1, policyBook2, "", 0, false, { from: CLAIM_VOTING });

      claimsCount = await claimingRegistryMock.countPolicyClaimerClaims(USER1);

      assert.equal(claimsCount, 2);
    });

    it("should submit claims for different users", async () => {
      await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, false, { from: CLAIM_VOTING });
      await claimingRegistryMock.submitClaim(USER2, policyBook2, "", 0, false, { from: CLAIM_VOTING });

      let claimsCount = await claimingRegistryMock.countPolicyClaimerClaims(USER1);

      assert.equal(claimsCount, 1);

      claimsCount = await claimingRegistryMock.countPolicyClaimerClaims(USER2);

      assert.equal(claimsCount, 1);
    });

    it("should make claim AWAITING_CALCULATION", async () => {
      await setCurrentTime(1);

      const id = (await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, false, { from: CLAIM_VOTING }))
        .logs[0].args.claimIndex;
      assert.equal(await claimingRegistryMock.claimStatus(id), ClaimStatus.PENDING);

      await setCurrentTime(toBN(await claimingRegistryMock.votingDuration(id)).plus(10));

      assert.equal(await claimingRegistryMock.claimStatus(id), ClaimStatus.AWAITING_CALCULATION);
    });

    it("shouldn't submit appeal at first", async () => {
      await truffleAssert.reverts(
        claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, true, { from: CLAIM_VOTING }),
        "ClaimingRegistry: The claimer can't submit this claim"
      );
    });

    it("shouldn't submit appeal on PENDING claim", async () => {
      await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, false, { from: CLAIM_VOTING });

      await truffleAssert.reverts(
        claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, true, { from: CLAIM_VOTING }),
        "ClaimingRegistry: The claimer can't submit this claim"
      );
    });

    it("shouldn't submit appeal on ACCEPTED claim", async () => {
      await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, false, { from: CLAIM_VOTING });
      await claimingRegistryMock.updateStatus(USER1, policyBook1, ClaimStatus.ACCEPTED);

      await truffleAssert.reverts(
        claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, true, { from: CLAIM_VOTING }),
        "ClaimingRegistry: The claimer can't submit this claim"
      );
    });

    it("shouldn't submit appeal on AWAITING_CALCULATION claim", async () => {
      await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, false, { from: CLAIM_VOTING });
      await claimingRegistryMock.updateStatus(USER1, policyBook1, ClaimStatus.AWAITING_CALCULATION);

      await truffleAssert.reverts(
        claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, true, { from: CLAIM_VOTING }),
        "ClaimingRegistry: The claimer can't submit this claim"
      );
    });

    it("should submit appeal on REJECTED_CAN_APPEAL claim", async () => {
      await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, false, { from: CLAIM_VOTING });
      await claimingRegistryMock.updateStatus(USER1, policyBook1, ClaimStatus.REJECTED_CAN_APPEAL);

      assert.equal(await claimingRegistryMock.claimStatus(1), ClaimStatus.REJECTED_CAN_APPEAL);

      await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, true, { from: CLAIM_VOTING });

      assert.equal(await claimingRegistryMock.claimStatus(2), ClaimStatus.PENDING);
      assert.equal(await claimingRegistryMock.isClaimAppeal(2), true);

      assert.equal(await claimingRegistryMock.claimStatus(1), ClaimStatus.REJECTED);
    });

    it("shouldn't submit appeal on appeal", async () => {
      await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, false, { from: CLAIM_VOTING });
      await claimingRegistryMock.updateStatus(USER1, policyBook1, ClaimStatus.REJECTED_CAN_APPEAL);

      await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, true, { from: CLAIM_VOTING });

      await truffleAssert.reverts(
        claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, true, { from: CLAIM_VOTING }),
        "ClaimingRegistry: The claimer can't submit this claim"
      );
    });

    it("shouldn't submit claim on PENDING appeal", async () => {
      await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, false, { from: CLAIM_VOTING });
      await claimingRegistryMock.updateStatus(USER1, policyBook1, ClaimStatus.REJECTED_CAN_APPEAL);

      await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, true, { from: CLAIM_VOTING });

      await truffleAssert.reverts(
        claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, false, { from: CLAIM_VOTING }),
        "ClaimingRegistry: The claimer can't submit this claim"
      );
    });

    it("should be able to submit claim on REJECTED appeal", async () => {
      await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, false, { from: CLAIM_VOTING });
      await claimingRegistryMock.updateStatus(USER1, policyBook1, ClaimStatus.REJECTED_CAN_APPEAL);

      await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, true, { from: CLAIM_VOTING });
      await claimingRegistryMock.updateStatus(USER1, policyBook1, ClaimStatus.REJECTED);

      await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, false, { from: CLAIM_VOTING });

      assert.equal(await claimingRegistryMock.claimStatus(3), ClaimStatus.PENDING);
      assert.equal(await claimingRegistryMock.isClaimAppeal(3), false);
    });

    it("shouldn't be able to submit claim on ACCEPTED appeal", async () => {
      await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, false, { from: CLAIM_VOTING });
      await claimingRegistryMock.updateStatus(USER1, policyBook1, ClaimStatus.REJECTED_CAN_APPEAL);

      await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, true, { from: CLAIM_VOTING });
      await claimingRegistryMock.updateStatus(USER1, policyBook1, ClaimStatus.ACCEPTED);

      await truffleAssert.reverts(
        claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, false, { from: CLAIM_VOTING }),
        "ClaimingRegistry: The claimer can't submit this claim"
      );
    });
  });

  describe("acceptClaim()", async () => {
    const epochsNumber = toBN(5);
    const coverTokensAmount = wei("1000");
    const stblAmount = wei("10000");
    const liquidityAmount = wei("5000");

    it("should not accept not AWAITING_CALCULATION claim", async () => {
      const id = (await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, false, { from: CLAIM_VOTING }))
        .logs[0].args.claimIndex;

      await truffleAssert.reverts(
        claimingRegistryMock.acceptClaim(id, { from: CLAIM_VOTING }),
        "ClaimingRegistry: The claim is not awaiting"
      );
    });

    it("should accept the claim", async () => {
      await policyRegistryMock.setPolicyEndTime(USER1, policyBook1, 0);

      await stblMock.approve(policyBook1, stblAmount);

      const policyBook = await PolicyBook.at(policyBook1);

      await policyBook.addLiquidity(liquidityAmount);
      await policyBook.buyPolicy(epochsNumber, coverTokensAmount);

      await setCurrentTime(1);

      const id = (
        await claimingRegistryMock.submitClaim(USER1, policyBook1, "", coverTokensAmount, false, { from: CLAIM_VOTING })
      ).logs[0].args.claimIndex;

      await setCurrentTime(toBN(await claimingRegistryMock.votingDuration(id)).plus(10));

      const res = await claimingRegistryMock.acceptClaim(id, { from: CLAIM_VOTING });

      console.log("AcceptClaim gas used: " + res.receipt.gasUsed);

      assert.equal(await claimingRegistryMock.countPendingClaims(), 0);
      assert.equal(await claimingRegistryMock.isClaimPending(id), false);

      assert.equal(await claimingRegistryMock.claimStatus(id), ClaimStatus.ACCEPTED);

      assert.equal(res.logs.length, 1);
      assert.equal(res.logs[0].event, "ClaimAccepted");
    });
  });

  describe("rejectClaim()", async () => {
    it("should not reject not AWAITING_CALCULATION claim", async () => {
      const id = (await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, false, { from: CLAIM_VOTING }))
        .logs[0].args.claimIndex;

      await truffleAssert.reverts(
        claimingRegistryMock.rejectClaim(id, { from: CLAIM_VOTING }),
        "ClaimingRegistry: The claim is not awaiting"
      );
    });

    it("should reject the claim", async () => {
      await setCurrentTime(1);

      const id = (await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, false, { from: CLAIM_VOTING }))
        .logs[0].args.claimIndex;

      await setCurrentTime(toBN(await claimingRegistryMock.votingDuration(id)).plus(10));

      const res = await claimingRegistryMock.rejectClaim(id, { from: CLAIM_VOTING });

      console.log("RejectClaim gas used: " + res.receipt.gasUsed);

      assert.equal(await claimingRegistryMock.countPendingClaims(), 0);
      assert.equal(await claimingRegistryMock.isClaimPending(id), false);

      assert.equal(await claimingRegistryMock.claimStatus(id), ClaimStatus.REJECTED_CAN_APPEAL);

      assert.equal(res.logs.length, 1);
      assert.equal(res.logs[0].event, "ClaimRejected");
    });
  });

  describe("claimInfo()", async () => {
    it("should fail due to unexisting index", async () => {
      await truffleAssert.reverts(claimingRegistryMock.claimInfo(1), "ClaimingRegistry: This claim doesn't exist");
    });

    it("should return valid claim info", async () => {
      await setCurrentTime(1);

      const id = (
        await claimingRegistryMock.submitClaim(USER1, policyBook1, "placeholder", 0, false, { from: CLAIM_VOTING })
      ).logs[0].args.claimIndex;

      await setCurrentTime(toBN(await claimingRegistryMock.votingDuration(id)).plus(10));

      const claim = await claimingRegistryMock.claimInfo(id);

      assert.equal(claim[0], USER1);
      assert.equal(claim[1], policyBook1);
      assert.equal(claim[2], "placeholder");
      assert.equal(claim[3], 1);
      assert.equal(claim[4], false);
      assert.equal(claim[5], 0);
      assert.equal(claim[6], ClaimStatus.AWAITING_CALCULATION);
      assert.equal(claim[7], 0);
    });

    it("shouldn't be public", async () => {
      await setCurrentTime(1);

      const id = (await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, false, { from: CLAIM_VOTING }))
        .logs[0].args.claimIndex;

      await setCurrentTime(toBN(await claimingRegistryMock.votingDuration(id)).plus(10));

      assert.equal(await claimingRegistryMock.canClaimBeCalculatedByAnyone(id), false);
    });

    it("should be public", async () => {
      await setCurrentTime(1);

      const id = (await claimingRegistryMock.submitClaim(USER1, policyBook1, "", 0, false, { from: CLAIM_VOTING }))
        .logs[0].args.claimIndex;

      await setCurrentTime(toBN(await claimingRegistryMock.anyoneCanCalculateClaimResultAfter(id)).plus(10));

      assert.equal(await claimingRegistryMock.canClaimBeCalculatedByAnyone(id), true);
    });
  });
});
