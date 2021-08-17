const PolicyBook = artifacts.require("PolicyBook");
const PolicyBookFabric = artifacts.require("PolicyBookFabric");
const STBLMock = artifacts.require("STBLMock");
const BMIMock = artifacts.require("BMIMock");
const WETHMock = artifacts.require("WETHMock");
const UniswapRouterMock = artifacts.require("UniswapRouterMock");
const PriceFeed = artifacts.require("PriceFeed");
const ContractsRegistry = artifacts.require("ContractsRegistry");
const ClaimingRegistry = artifacts.require("ClaimingRegistry");
const LiquidityRegistry = artifacts.require("LiquidityRegistry");
const PolicyBookRegistry = artifacts.require("PolicyBookRegistry");
const ClaimVotingMock = artifacts.require("ClaimVotingMock");
const ReinsurancePool = artifacts.require("ReinsurancePool");
const VBMI = artifacts.require("VBMI");
const ReputationSystemMock = artifacts.require("ReputationSystemMock");
const PolicyRegistry = artifacts.require("PolicyRegistry");
const PolicyBookAdmin = artifacts.require("PolicyBookAdmin");
const PolicyQuote = artifacts.require("PolicyQuote");
const STKBMITokenMock = artifacts.require("STKBMITokenMock");
const RewardsGenerator = artifacts.require("RewardsGenerator");
const LiquidityMining = artifacts.require("LiquidityMining");

const BigNumber = require("bignumber.js");
const truffleAssert = require("truffle-assertions");
const setCurrentTime = require("./helpers/ganacheTimeTraveler");
const { assert } = require("chai");
const ethUtil = require("ethereumjs-util");
const ethSigUtil = require("eth-sig-util");

const aesjs = require("aes-js");
const wei = web3.utils.toWei;

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

const VoteStatus = {
  ANONYMOUS_PENDING: 0,
  AWAITING_EXPOSURE: 1,
  EXPIRED: 2,
  EXPOSED_PENDING: 3,
  AWAITING_CALCULATION: 4,
  MINORITY: 5,
  MAJORITY: 6,
};

function toBN(number) {
  return new BigNumber(number);
}

const signClaimVoting = (domain, message, privateKey) => {
  const data = msgParams(domain, message);

  const signature = ethSigUtil.signTypedMessage(privateKey, { data });
  return signature;
};

// Chain id here is 1337 because it is needed to be able
// to generate same signature using metamask and compare
// with it in the tests. On Prod it must be chainId = 1.
// verifyingContract is equal to ClaimVoting address
// Here it uses privateKey to sign, but when using Metamask, it doesn't
// requires Private Key. MM never sends user private key.
// Here it uses Private Key only for tests purposes.
const msgParams = (domain, message) => {
  const { name, version = "1", chainId = 1337, verifyingContract } = domain;
  const { claimIndex } = message;

  const EIP712Domain = [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ];

  const Claim = [{ name: "UniqueClaimIndex", type: "uint256" }];

  const data = {
    primaryType: "Claim",
    types: { EIP712Domain, Claim },
    domain: { name, version, chainId, verifyingContract },
    message: { UniqueClaimIndex: claimIndex },
  };

  return data;
};

contract("ClaimVoting", async (accounts) => {
  let policyBook;
  let policyBook2;
  let stbl;
  let bmi;
  let stkBMI;
  let claimVoting;
  let claimingRegistry;
  let reinsurancePool;
  let vBMI;
  let reputationSystemMock;
  let policyRegistry;

  const USER1 = accounts[0];
  const USER2 = accounts[1];
  const USER3 = accounts[2];

  const USER2_PRIVATE_KEY = "c4ce20adf2b728fe3005be128fb850397ec352d1ea876e3035e46d547343404f";
  const USER3_PRIVATE_KEY = "cddc8640db3142faef4ff7f91390237bc6615bb8a3908d891b927af6da3e3cf8";

  const VERIFYING_CONTRACT = "0x4b871567e49ec71bdb5b9b9567a456063390b43d"; // a random address
  const CONTRACT_DATA = { name: "ClaimVoting", verifyingContract: VERIFYING_CONTRACT };

  const insuranceContract = accounts[7];
  const insuranceContract2 = accounts[8];
  const NOTHING = accounts[9];

  const SECONDS_IN_DAY = toBN(24 * 60 * 60);

  const PRECISION = toBN(10 ** 25);
  const PERCENTAGE_100 = toBN(10 ** 25).times(100);

  BigNumber.config({ DECIMAL_PLACES: 25 });
  BigNumber.set({ DECIMAL_PLACES: 25 });

  beforeEach("setup", async () => {
    const policyBookImpl = await PolicyBook.new();
    const contractsRegistry = await ContractsRegistry.new();
    const weth = await WETHMock.new("weth", "weth");
    bmi = await BMIMock.new(USER1);
    stbl = await STBLMock.new("stbl", "stbl", 6);
    const uniswapRouterMock = await UniswapRouterMock.new();
    const _policyBookAdmin = await PolicyBookAdmin.new();
    const _policyRegistry = await PolicyRegistry.new();
    const _priceFeed = await PriceFeed.new();
    const _reinsurancePool = await ReinsurancePool.new();
    const _vBMI = await VBMI.new();
    const _reputationSystemMock = await ReputationSystemMock.new();
    const _stkBMI = await STKBMITokenMock.new();
    const _claimingRegistry = await ClaimingRegistry.new();
    const _liquidityRegistry = await LiquidityRegistry.new();
    const _claimVoting = await ClaimVotingMock.new();
    const _policyQuote = await PolicyQuote.new();
    const _policyBookRegistry = await PolicyBookRegistry.new();
    const _policyBookFabric = await PolicyBookFabric.new();
    const _rewardsGenerator = await RewardsGenerator.new();
    const _liquidityMining = await LiquidityMining.new();

    await contractsRegistry.__ContractsRegistry_init();

    await contractsRegistry.addContract(await contractsRegistry.BMI_COVER_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_UTILITY_NFT_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.LEGACY_REWARDS_GENERATOR_NAME(), NOTHING);

    await contractsRegistry.addContract(await contractsRegistry.WETH_NAME(), weth.address);
    await contractsRegistry.addContract(await contractsRegistry.USDT_NAME(), stbl.address);
    await contractsRegistry.addContract(await contractsRegistry.BMI_NAME(), bmi.address);
    await contractsRegistry.addContract(await contractsRegistry.UNISWAP_ROUTER_NAME(), uniswapRouterMock.address);

    await contractsRegistry.addProxyContract(
      await contractsRegistry.POLICY_BOOK_ADMIN_NAME(),
      _policyBookAdmin.address
    );
    await contractsRegistry.addProxyContract(await contractsRegistry.STKBMI_NAME(), _stkBMI.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.POLICY_REGISTRY_NAME(), _policyRegistry.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.VBMI_NAME(), _vBMI.address);
    await contractsRegistry.addProxyContract(
      await contractsRegistry.REPUTATION_SYSTEM_NAME(),
      _reputationSystemMock.address
    );
    await contractsRegistry.addProxyContract(await contractsRegistry.CLAIM_VOTING_NAME(), _claimVoting.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.REINSURANCE_POOL_NAME(), _reinsurancePool.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.PRICE_FEED_NAME(), _priceFeed.address);
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
    await contractsRegistry.addProxyContract(await contractsRegistry.POLICY_QUOTE_NAME(), _policyQuote.address);
    await contractsRegistry.addProxyContract(
      await contractsRegistry.REWARDS_GENERATOR_NAME(),
      _rewardsGenerator.address
    );
    await contractsRegistry.addProxyContract(await contractsRegistry.LIQUIDITY_MINING_NAME(), _liquidityMining.address);

    const rewardsGenerator = await RewardsGenerator.at(await contractsRegistry.getRewardsGeneratorContract());
    const policyBookFabric = await PolicyBookFabric.at(await contractsRegistry.getPolicyBookFabricContract());
    const policyBookAdmin = await PolicyBookAdmin.at(await contractsRegistry.getPolicyBookAdminContract());
    const liquidityMining = await LiquidityMining.at(await contractsRegistry.getLiquidityMiningContract());
    policyRegistry = await PolicyRegistry.at(await contractsRegistry.getPolicyRegistryContract());
    claimingRegistry = await ClaimingRegistry.at(await contractsRegistry.getClaimingRegistryContract());
    stkBMI = await STKBMITokenMock.at(await contractsRegistry.getSTKBMIContract());
    vBMI = await VBMI.at(await contractsRegistry.getVBMIContract());
    reputationSystemMock = await ReputationSystemMock.at(await contractsRegistry.getReputationSystemContract());
    claimVoting = await ClaimVotingMock.at(await contractsRegistry.getClaimVotingContract());
    reinsurancePool = await ReinsurancePool.at(await contractsRegistry.getReinsurancePoolContract());

    await rewardsGenerator.__RewardsGenerator_init();
    await claimingRegistry.__ClaimingRegistry_init();
    await stkBMI.__STKBMIToken_init();
    await vBMI.__VBMI_init();
    await reputationSystemMock.__ReputationSystem_init([]);
    await claimVoting.__ClaimVoting_init();
    await reinsurancePool.__ReinsurancePool_init();
    await policyBookAdmin.__PolicyBookAdmin_init(policyBookImpl.address);
    await liquidityMining.__LiquidityMining_init();

    await contractsRegistry.injectDependencies(await contractsRegistry.PRICE_FEED_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.CLAIMING_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.REWARDS_GENERATOR_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.STKBMI_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.CLAIM_VOTING_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.REPUTATION_SYSTEM_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.REINSURANCE_POOL_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.VBMI_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_FABRIC_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_ADMIN_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_MINING_NAME());

    await uniswapRouterMock.setReserve(stbl.address, wei(toBN(10 ** 3).toString()));
    await uniswapRouterMock.setReserve(weth.address, wei(toBN(10 ** 15).toString()));
    await uniswapRouterMock.setReserve(bmi.address, wei(toBN(10 ** 15).toString()));

    const initialDeposit = wei("1000");

    await stbl.approve(policyBookFabric.address, initialDeposit);

    await setCurrentTime(1);

    const policyBookAddr1 = (
      await policyBookFabric.create(
        insuranceContract,
        ContractType.CONTRACT,
        "placeholder",
        "placeholder",
        initialDeposit
      )
    ).logs[0].args.at;

    await stbl.approve(policyBookFabric.address, initialDeposit);

    await setCurrentTime(1);

    const policyBookAddr2 = (
      await policyBookFabric.create(
        insuranceContract2,
        ContractType.EXCHANGE,
        "placeholder",
        "placeholder",
        initialDeposit
      )
    ).logs[0].args.at;

    policyBook = await PolicyBook.at(policyBookAddr1);
    policyBook2 = await PolicyBook.at(policyBookAddr2);
  });

  describe("initializeVoting()", async () => {
    const epochsNumber = 5;
    const coverTokensAmount = wei("1000");
    const stblAmount = wei("10000");
    const liquidityAmount = wei("5000");

    it("should initialize new claim", async () => {
      await stbl.approve(policyBook.address, stblAmount);
      await policyBook.addLiquidity(liquidityAmount);
      await policyBook.buyPolicy(epochsNumber, coverTokensAmount);

      const toApproveOnePercent = await policyBook.getClaimApprovalAmount(USER1);

      await bmi.approve(claimVoting.address, toApproveOnePercent);

      await setCurrentTime(2);

      const res = await policyBook.submitClaimAndInitializeVoting("placeholder");

      console.log("InitializeClaim gas used: " + res.receipt.gasUsed);

      const claimsCount = await claimingRegistry.countClaims();

      assert.equal(claimsCount, 1);

      const coverage = toBN((await policyBook.userStats(USER1))[0]);
      const userProtocol = BigNumber.min(
        toBN((await policyBook.userStats(USER1))[3])
          .times(20)
          .idiv(100),
        coverage.idiv(100)
      );

      assert.equal(toBN(await bmi.balanceOf(claimVoting.address)).toString(), coverage.idiv(100).toString());

      const claims = await claimVoting.allClaims(0, claimsCount);

      assert.equal(claims[0][0][0], 1);
      assert.equal(claims[0][0][1], USER1);
      assert.equal(claims[0][0][2], policyBook.address);
      assert.equal(claims[0][0][3], "placeholder");
      assert.equal(claims[0][0][4], false);
      assert.equal(toBN(claims[0][0][5]).toString(), coverage.toString());
      assert.equal(claims[0][0][6], 2); // time bug
      assert.equal(claims[0][1], ClaimStatus.PENDING);
      assert.equal(claims[0][2], 0);
      assert.equal(claims[0][3], 0);

      const claimResult = await claimVoting.getVotingResult(1);

      assert.equal(toBN(claimResult[0]).toString(), coverage.toString());
      assert.equal(toBN(claimResult[1]).toString(), coverage.idiv(100).toString());
      assert.equal(toBN(claimResult[2]).toString(), userProtocol.toString());

      assert.equal(claimResult[3], 0);
      assert.equal(claimResult[4], 0);
      assert.equal(claimResult[5], 0);
      assert.equal(claimResult[6], 0);
      assert.equal(claimResult[7], 0);
    });

    it("should test all getters", async () => {
      await stbl.approve(policyBook.address, stblAmount);
      await policyBook.addLiquidity(liquidityAmount);
      await policyBook.buyPolicy(epochsNumber, coverTokensAmount);

      const toApproveOnePercent = await policyBook.getClaimApprovalAmount(USER1);

      await bmi.approve(claimVoting.address, toApproveOnePercent);

      await setCurrentTime(2);

      await policyBook.submitClaimAndInitializeVoting("placeholder");

      await setCurrentTime(10);

      const claimsCount = await claimingRegistry.countPendingClaims();
      const coverage = toBN((await policyBook.userStats(USER1))[0]);

      let claims = await claimVoting.whatCanIVoteFor(0, claimsCount, { from: USER2 });

      assert.equal(await claimVoting.canWithdraw(USER1), true);

      assert.equal(claims[0], 1);
      assert.equal(claims[1][0][0], 1);
      assert.equal(claims[1][0][1], USER1);
      assert.equal(claims[1][0][2], policyBook.address);
      assert.equal(claims[1][0][3], "placeholder");
      assert.equal(claims[1][0][4], false);
      assert.equal(toBN(claims[1][0][5]).toString(), coverage.toString());
      assert.equal(
        toBN(claims[1][0][6]).toString(),
        toBN(await claimingRegistry.anonymousVotingDuration(1))
          .minus(8)
          .toString()
      );

      claims = await claimVoting.whatCanIVoteFor(0, claimsCount);

      assert.equal(claims[0], 0);

      let myClaimsCount = await claimingRegistry.countPolicyClaimerClaims(USER1);

      assert.equal(myClaimsCount, 1);

      const myClaims = await claimVoting.myClaims(0, myClaimsCount);

      assert.equal(myClaims[0][0], 1);
      assert.equal(myClaims[0][1], policyBook.address);
      assert.equal(myClaims[0][2], "placeholder");
      assert.equal(myClaims[0][3], false);
      assert.equal(toBN(myClaims[0][4]).toString(), coverage.toString());
      assert.equal(myClaims[0][5], ClaimStatus.PENDING);
      assert.equal(myClaims[0][6], 0);
      assert.equal(myClaims[0][7], 0);

      myClaimsCount = await claimingRegistry.countPolicyClaimerClaims(USER2);

      assert.equal(myClaimsCount, 0);
    });
  });

  describe("anonymous voting", async () => {
    const epochsNumber = 5;
    const coverTokensAmount = wei("10000");
    const stblAmount = wei("100000");
    const liquidityAmount = wei("50000");

    const coverTokensAmount2 = wei("999");
    const stblAmount2 = wei("11111");
    const liquidityAmount2 = wei("4765");

    async function init(coverTokensAmount, stblAmount, liquidityAmount) {
      await stbl.approve(policyBook.address, stblAmount);
      await policyBook.addLiquidity(liquidityAmount);

      await setCurrentTime(1);

      await policyBook.buyPolicy(epochsNumber, coverTokensAmount); // here my fail due to truffle bug

      const toApproveOnePercent = await policyBook.getClaimApprovalAmount(USER1);

      await setCurrentTime(2);

      await bmi.approve(claimVoting.address, toApproveOnePercent);
      await policyBook.submitClaimAndInitializeVoting("");

      await setCurrentTime(10);
    }

    async function initVoting() {
      await init(coverTokensAmount, stblAmount, liquidityAmount);
    }

    async function initVoting2() {
      await init(coverTokensAmount2, stblAmount2, liquidityAmount2);
    }

    async function getAnonymousEncrypted(claimIndex, suggestedAmount, userPrivateKey) {
      const buffer = Buffer.from(userPrivateKey, "hex");
      const claim = {
        claimIndex: claimIndex,
      };

      const signatureOfClaim = signClaimVoting(CONTRACT_DATA, claim, buffer);

      const generatedPrivateKey = new Uint8Array(
        aesjs.utils.hex.toBytes(web3.utils.soliditySha3(signatureOfClaim).replace("0x", ""))
      );

      const aesCtr = new aesjs.ModeOfOperation.ctr(generatedPrivateKey);

      const BYTES = 32;
      let suggestedAmountStr = suggestedAmount.toString();

      while (suggestedAmountStr.length < BYTES) {
        suggestedAmountStr += String.fromCharCode("a".charCodeAt(0) + Math.round(Math.random() * 5));
      }

      const encryptedSuggestedAmount = aesjs.utils.hex.fromBytes(
        aesCtr.encrypt(aesjs.utils.hex.toBytes(suggestedAmountStr))
      );

      const hashedSignatureOfClaim = web3.utils.soliditySha3(signatureOfClaim);
      const finalHash = web3.utils.soliditySha3(hashedSignatureOfClaim, encryptedSuggestedAmount, suggestedAmount);

      return [finalHash, encryptedSuggestedAmount];
    }

    async function getAnonymousDecrypted(claimIndex, encryptedSuggestedAmount, userPrivateKey) {
      const buffer = Buffer.from(userPrivateKey, "hex");
      const claim = {
        claimIndex: claimIndex,
      };

      const signatureOfClaim = signClaimVoting(CONTRACT_DATA, claim, buffer);

      const generatedPrivateKey = new Uint8Array(
        aesjs.utils.hex.toBytes(web3.utils.soliditySha3(signatureOfClaim).replace("0x", ""))
      );

      const aesCtr = new aesjs.ModeOfOperation.ctr(generatedPrivateKey);
      const suggestedAmountStr = aesjs.utils.hex.fromBytes(
        aesCtr.decrypt(aesjs.utils.hex.toBytes(encryptedSuggestedAmount))
      );

      const hashedSignatureOfClaim = web3.utils.soliditySha3(signatureOfClaim);

      let suggestedAmount = "";
      let i = 0;

      while (suggestedAmountStr[i] >= "0" && suggestedAmountStr[i] <= "9") {
        suggestedAmount += suggestedAmountStr[i++];
      }

      return [hashedSignatureOfClaim, suggestedAmount];
    }

    it("should successfully vote", async () => {
      await initVoting();

      const claimIndex = 1;
      const suggestedClaimAmount = coverTokensAmount;

      // different users must have differents hashes
      const [finalHashUser3, encryptedSuggestedAmountUser3] = await getAnonymousEncrypted(
        claimIndex,
        suggestedClaimAmount,
        USER3_PRIVATE_KEY
      );
      const [finalHashUser2, encryptedSuggestedAmountUser2] = await getAnonymousEncrypted(
        claimIndex,
        suggestedClaimAmount,
        USER2_PRIVATE_KEY
      );

      assert.notEqual(finalHashUser3, finalHashUser2);
      assert.notEqual(encryptedSuggestedAmountUser3, encryptedSuggestedAmountUser2);

      const res = await claimVoting.anonymouslyVoteBatch(
        [claimIndex],
        [finalHashUser3],
        [encryptedSuggestedAmountUser2],
        {
          from: USER2,
        }
      );

      console.log("AnonymousVote gas used: " + res.receipt.gasUsed);
    });

    async function voteAndExpose(suggestedClaimAmount, userPrivateKey, user) {
      const claimIndex = 1;
      const [finalHash, encryptedSuggestedAmount] = await getAnonymousEncrypted(
        claimIndex,
        suggestedClaimAmount,
        userPrivateKey
      );

      await claimVoting.anonymouslyVoteBatch([claimIndex], [finalHash], [encryptedSuggestedAmount], { from: user });

      await setCurrentTime(toBN(await claimingRegistry.anonymousVotingDuration(claimIndex)).plus(10));

      const votesCount = await claimVoting.countVotes(user);
      const myVotes = await claimVoting.myVotes(0, votesCount, { from: user });

      const encrypted = myVotes[0][1];

      await stkBMI.mintArbitrary(user, wei("1000000")); // 1 mil
      await stkBMI.approve(vBMI.address, wei("1000000"), { from: user });
      await vBMI.lockStkBMI(wei("1000000"), { from: user });

      const [hashedSigantureOfClaim, suggestedAmount] = await getAnonymousDecrypted(
        claimIndex,
        encrypted,
        userPrivateKey
      );

      const res = await claimVoting.exposeVoteBatch([claimIndex], [suggestedAmount], [hashedSigantureOfClaim], {
        from: user,
      });

      console.log("ExposeVote gas used: " + res.receipt.gasUsed);
    }

    it("should successfully sign a vote claim using EIP 712", async () => {
      const buffer = Buffer.from(USER3_PRIVATE_KEY, "hex");

      const claim = {
        claimIndex: 52,
      };

      // it should create same signature that was created using metamask
      // 0x30... was created using Metamask
      const signatureOfClaim = signClaimVoting(CONTRACT_DATA, claim, buffer);
      assert.equal(
        signatureOfClaim,
        "0xb73ff4f82a16cc3e51ca576aa6dcbb2d66be0119ec3a5c1cfc24a2b9cde47ed20e2b4260d95663e921238bd58fdd91b8048d747ffa8d5de03323c90b8443cade1c"
      );

      const params = JSON.stringify(msgParams(CONTRACT_DATA, claim));

      const recovered = ethSigUtil.recoverTypedSignature_v4({
        data: JSON.parse(params),
        sig: signatureOfClaim,
      });

      // address recovered from the signature must be equal to the signature that signed it.
      // if it is different, it has a problem.
      assert.equal(ethUtil.toChecksumAddress(recovered), ethUtil.toChecksumAddress(USER3));
    });

    it("should successfully expose vote (1)", async () => {
      await initVoting();
      await voteAndExpose(coverTokensAmount, USER2_PRIVATE_KEY, USER2);
    });

    it("should successfully expose vote (2)", async () => {
      await initVoting2();
      await voteAndExpose(coverTokensAmount2, USER2_PRIVATE_KEY, USER2);
    });

    it("should successfully expose vote (3)", async () => {
      await initVoting2();
      await voteAndExpose(0, USER2_PRIVATE_KEY, USER2);
    });

    it("should successfully expose vote && set correct status after calculation", async () => {
      await initVoting();
      await voteAndExpose(0, USER2_PRIVATE_KEY, USER2);

      const claimIndex = 1;

      await setCurrentTime(toBN(await claimingRegistry.votingDuration(claimIndex)).plus(10));

      await claimVoting.calculateVotingResultBatch([1]);

      assert.equal(await claimVoting.voteStatus(1), VoteStatus.AWAITING_CALCULATION);
    });

    it("should fail voting second time on the same claim", async () => {
      await initVoting();

      const claimIndex = 1;
      const suggestedClaimAmount = coverTokensAmount;

      const [finalHash, encryptedSuggestedAmount] = await getAnonymousEncrypted(
        claimIndex,
        suggestedClaimAmount,
        USER2_PRIVATE_KEY
      );

      await claimVoting.anonymouslyVoteBatch([claimIndex], [finalHash], [encryptedSuggestedAmount], { from: USER2 });

      await truffleAssert.reverts(
        claimVoting.anonymouslyVoteBatch([claimIndex], [finalHash], [encryptedSuggestedAmount], { from: USER2 }),
        "CV: Already voted for this claim"
      );

      await claimVoting.anonymouslyVoteBatch([claimIndex], [finalHash], [encryptedSuggestedAmount], { from: USER3 });
    });

    it("should fail voting if voter is the claimer", async () => {
      await initVoting();

      const claimIndex = 1;
      const suggestedClaimAmount = coverTokensAmount;

      const [finalHash, encryptedSuggestedAmount] = await getAnonymousEncrypted(
        claimIndex,
        suggestedClaimAmount,
        USER2_PRIVATE_KEY
      );

      await truffleAssert.reverts(
        claimVoting.anonymouslyVoteBatch([claimIndex], [finalHash], [encryptedSuggestedAmount], { from: USER1 }),
        "CV: Voter is the claimer"
      );

      await claimVoting.anonymouslyVoteBatch([claimIndex], [finalHash], [encryptedSuggestedAmount], { from: USER3 });
    });

    it("should fail voting if fail array length", async () => {
      await initVoting();

      const claimIndex = 1;
      const suggestedClaimAmount = coverTokensAmount;

      const [finalHash, encryptedSuggestedAmount] = await getAnonymousEncrypted(
        claimIndex,
        suggestedClaimAmount,
        USER2_PRIVATE_KEY
      );

      // empty claimindex array
      await truffleAssert.reverts(
        claimVoting.anonymouslyVoteBatch([], [finalHash], [encryptedSuggestedAmount], { from: USER1 }),
        "CV: Length mismatches"
      );

      // empty final hash
      await truffleAssert.reverts(
        claimVoting.anonymouslyVoteBatch([claimIndex], [], [encryptedSuggestedAmount], { from: USER1 }),
        "CV: Length mismatches"
      );

      // empty encryptedSuggestedAmount
      await truffleAssert.reverts(
        claimVoting.anonymouslyVoteBatch([claimIndex], [finalHash], [], { from: USER1 }),
        "CV: Length mismatches"
      );
    });

    it("should fail voting if anonymous voting is over", async () => {
      await initVoting();

      const claimIndex = 1;
      const suggestedClaimAmount = coverTokensAmount;

      const [finalHash, encryptedSuggestedAmount] = await getAnonymousEncrypted(
        claimIndex,
        suggestedClaimAmount,
        USER2_PRIVATE_KEY
      );

      await setCurrentTime(10 * 24 * 60 * 60); // 10 days

      await truffleAssert.reverts(
        claimVoting.anonymouslyVoteBatch([claimIndex], [finalHash], [encryptedSuggestedAmount], { from: USER2 }),
        "CV: Anonymous voting is over"
      );
    });

    it("should fail exposing unvoted vote", async () => {
      await initVoting();

      const claimIndex = 1;
      const suggestedClaimAmount = coverTokensAmount;

      await stkBMI.mintArbitrary(USER2, wei("100")); // 100
      await stkBMI.approve(vBMI.address, wei("100"), { from: USER2 });
      await vBMI.lockStkBMI(wei("100"), { from: USER2 });

      await setCurrentTime(toBN(await claimingRegistry.anonymousVotingDuration(claimIndex)).plus(10));

      await truffleAssert.reverts(
        claimVoting.exposeVoteBatch([claimIndex], [suggestedClaimAmount], ["0x"], {
          from: USER2,
        }),
        "CV: Vote doesn't exist"
      );
    });

    it("should fail due to different suggested claim amount", async () => {
      await initVoting();

      const claimIndex = 1;
      const suggestedClaimAmount = coverTokensAmount;

      const [finalHash, encryptedSuggestedAmount] = await getAnonymousEncrypted(
        claimIndex,
        suggestedClaimAmount,
        USER2_PRIVATE_KEY
      );

      await claimVoting.anonymouslyVoteBatch([claimIndex], [finalHash], [encryptedSuggestedAmount], { from: USER2 });

      await setCurrentTime(toBN(await claimingRegistry.anonymousVotingDuration(claimIndex)).plus(10));

      const votesCount = await claimVoting.countVotes(USER2);
      const myVotes = await claimVoting.myVotes(0, votesCount, { from: USER2 });

      const encrypted = myVotes[0][1];

      await stkBMI.mintArbitrary(USER2, wei("1000000")); // 1 mil
      await stkBMI.approve(vBMI.address, coverTokensAmount, { from: USER2 });
      await vBMI.lockStkBMI(coverTokensAmount, { from: USER2 });

      const [hashedSignatureOfClaim] = await getAnonymousDecrypted(claimIndex, encrypted, USER2_PRIVATE_KEY);

      await truffleAssert.reverts(
        claimVoting.exposeVoteBatch([claimIndex], [toBN(coverTokensAmount).idiv(2)], [hashedSignatureOfClaim], {
          from: USER2,
        }),
        "CV: Data mismatches"
      );
    });

    it("should fail due to vote not being 'awaiting exposure'", async () => {
      await initVoting();

      const claimIndex = 1;
      const suggestedClaimAmount = coverTokensAmount;

      const [finalHash, encryptedSuggestedAmount] = await getAnonymousEncrypted(
        claimIndex,
        suggestedClaimAmount,
        USER2_PRIVATE_KEY
      );

      await claimVoting.anonymouslyVoteBatch([claimIndex], [finalHash], [encryptedSuggestedAmount], { from: USER2 });

      const votesCount = await claimVoting.countVotes(USER2);
      const myVotes = await claimVoting.myVotes(0, votesCount, { from: USER2 });

      const encrypted = myVotes[0][1];

      await stkBMI.mintArbitrary(USER2, wei("1000000")); // 1 mil
      await stkBMI.approve(vBMI.address, coverTokensAmount, { from: USER2 });
      await vBMI.lockStkBMI(coverTokensAmount, { from: USER2 });

      const [hashedSigantureOfClaim] = await getAnonymousDecrypted(claimIndex, encrypted, USER2_PRIVATE_KEY);

      await truffleAssert.reverts(
        claimVoting.exposeVoteBatch([claimIndex], [coverTokensAmount], [hashedSigantureOfClaim], { from: USER2 }),
        "CV: Vote is not awaiting"
      );
    });

    it("should be expired", async () => {
      await initVoting();

      const claimIndex = 1;
      const suggestedClaimAmount = coverTokensAmount;

      const [finalHash, encryptedSuggestedAmount] = await getAnonymousEncrypted(
        claimIndex,
        suggestedClaimAmount,
        USER2_PRIVATE_KEY
      );

      await claimVoting.anonymouslyVoteBatch([claimIndex], [finalHash], [encryptedSuggestedAmount], { from: USER2 });

      await setCurrentTime(toBN(await claimingRegistry.votingDuration(claimIndex)).plus(10));

      assert.equal(await claimVoting.voteStatus(1), VoteStatus.EXPIRED);
    });
  });

  describe("voteFor()", async () => {
    const epochsNumber = 5;
    const coverTokensAmount = wei("1000");
    const stblAmount = wei("10000");
    const liquidityAmount = wei("5000");

    it("should successfully vote for", async () => {
      await stbl.approve(policyBook.address, stblAmount);
      await policyBook.addLiquidity(liquidityAmount);
      await policyBook.buyPolicy(epochsNumber, coverTokensAmount);

      const toApproveOnePercent = await policyBook.getClaimApprovalAmount(USER1);

      await setCurrentTime(2);

      await bmi.approve(claimVoting.address, toApproveOnePercent);
      await policyBook.submitClaimAndInitializeVoting("");

      await setCurrentTime(10);

      await stkBMI.mintArbitrary(USER2, wei("1000000")); // 1 mil
      await stkBMI.approve(vBMI.address, coverTokensAmount, { from: USER2 });
      await vBMI.lockStkBMI(coverTokensAmount, { from: USER2 });

      const coverage = toBN((await policyBook.userStats(USER1))[0]);
      const userProtocol = BigNumber.min(
        toBN((await policyBook.userStats(USER1))[3])
          .times(20)
          .idiv(100),
        coverage.idiv(100)
      );

      await claimVoting.vote(1, coverage, { from: USER2 });

      const claimResult = await claimVoting.getVotingResult(1);

      assert.equal(toBN(claimResult[0]), coverage.toString());
      assert.equal(toBN(claimResult[1]).toString(), coverage.idiv(100).toString());
      assert.equal(toBN(claimResult[2]).toString(), userProtocol.toString());
      assert.equal(toBN(claimResult[3]).toString(), toBN(coverTokensAmount).toString()); // average withdraw
      assert.equal(toBN(claimResult[4]).toString(), PRECISION.times(wei("1000")).toString()); // yes average stake
      assert.equal(claimResult[5], 0); // no average stake
      assert.equal(toBN(claimResult[6]).toString(), toBN(wei("1000")).toString()); // all voted stake
      assert.equal(claimResult[7], 0); // voted yes percentage (after calculation)

      const votesCount = await claimVoting.countVotes(USER2);

      assert.equal(votesCount, 1);

      assert.equal(await claimVoting.voteStatus(1), VoteStatus.EXPOSED_PENDING);

      const votes = await claimVoting.myVotes(0, votesCount, { from: USER2 });

      assert.equal(votes[0][0][0][0], 1);
      assert.equal(votes[0][0][0][1], USER1);
      assert.equal(votes[0][0][0][2], policyBook.address);
      assert.equal(votes[0][0][0][3], "");
      assert.equal(votes[0][0][0][4], false);
      assert.equal(toBN(votes[0][0][0][5]).toString(), toBN(coverTokensAmount).toString());
      assert.equal(votes[0][0][0][6], 2); // can equal 3 (time bug)
      assert.equal(votes[0][0][1], ClaimStatus.PENDING);
      assert.equal(votes[0][0][2], 0);
      assert.equal(votes[0][1], "");
      assert.equal(toBN(votes[0][2]).toString(), coverage.toString());
      assert.equal(votes[0][3], VoteStatus.EXPOSED_PENDING);
      assert.equal(votes[0][4], 0);

      await setCurrentTime(toBN(await claimingRegistry.votingDuration(1)).plus(10));

      await claimVoting.calculateVotingResultBatch([1]);

      let votesUpdates = await claimVoting.myVotesUpdates(0, votesCount, { from: USER2 });

      assert.equal(votesUpdates[0], 1);
      assert.equal(votesUpdates[1][0], 1);

      await claimVoting.calculateVoterResultBatch(votesUpdates[1], { from: USER2 });

      votesUpdates = await claimVoting.myVotesUpdates(0, votesCount, { from: USER2 });

      assert.equal(votesUpdates[0], 0);
    });

    async function initAppeal() {
      await stbl.approve(policyBook.address, stblAmount);
      await policyBook.addLiquidity(liquidityAmount);

      await setCurrentTime(1);

      await policyBook.buyPolicy(epochsNumber, coverTokensAmount);

      const toApproveOnePercent = await policyBook.getClaimApprovalAmount(USER1);

      await bmi.approve(claimVoting.address, toApproveOnePercent);

      await setCurrentTime(2);

      await policyBook.submitClaimAndInitializeVoting("");

      await setCurrentTime(toBN(await claimingRegistry.votingDuration(1)).plus(5));

      await claimVoting.calculateVotingResultBatch([1]);

      await bmi.approve(claimVoting.address, toApproveOnePercent);

      await setCurrentTime(toBN(await claimingRegistry.votingDuration(1)).plus(10));

      await policyBook.submitAppealAndInitializeVoting("");

      await setCurrentTime(toBN(await claimingRegistry.votingDuration(1)).plus(100));
    }

    it("should reject if no one voted for appeal", async () => {
      await initAppeal();

      await reputationSystemMock.setNewReputationNoCheck(USER1, PRECISION.times(2));

      await setCurrentTime(
        toBN(await claimingRegistry.votingDuration(2))
          .times(2)
          .plus(100)
      );

      await claimVoting.calculateVotingResultBatch([2]);

      assert.equal(await claimingRegistry.claimStatus(2), ClaimStatus.REJECTED);
    });

    it("should vote for appeal if trusted voter", async () => {
      await initAppeal();

      await reputationSystemMock.setNewReputationNoCheck(USER2, PRECISION.times(2));

      await stkBMI.mintArbitrary(USER2, wei(toBN(10).pow(18).toString())); // 10**18
      await stkBMI.approve(vBMI.address, wei("1000"), { from: USER2 });
      await vBMI.lockStkBMI(wei("1000"), { from: USER2 });

      await claimVoting.vote(2, wei("100"), { from: USER2 });

      const votesCount = await claimVoting.countVotes(USER2);
      const votes = await claimVoting.myVotes(0, votesCount, { from: USER2 });

      assert.equal(votes[0][0][0][0], 2);
      assert.equal(votes[0][0][0][1], USER1);
      assert.equal(votes[0][0][0][2], policyBook.address);
      assert.equal(votes[0][0][0][3], "");
      assert.equal(votes[0][0][0][4], true);
      assert.equal(toBN(votes[0][0][0][5]).toString(), toBN(coverTokensAmount).toString());
      assert.equal(
        toBN(votes[0][0][0][6]).toString(),
        toBN(await claimingRegistry.votingDuration(2))
          .plus(10)
          .toString()
      ); // time bug
      assert.equal(votes[0][0][1], ClaimStatus.PENDING);
      assert.equal(votes[0][0][2], 0);
      assert.equal(votes[0][1], "");
      assert.equal(toBN(votes[0][2]).toString(), toBN(wei("100")).toString());
      assert.equal(votes[0][3], VoteStatus.EXPOSED_PENDING);
      assert.equal(votes[0][4], 0);
    });

    async function calculate(staked, suggestedAmounts, reputations) {
      await stbl.approve(policyBook.address, stblAmount);
      await policyBook.addLiquidity(liquidityAmount);
      await policyBook.buyPolicy(epochsNumber, coverTokensAmount);

      const toApproveOnePercent = await policyBook.getClaimApprovalAmount(USER1);

      await bmi.approve(claimVoting.address, toApproveOnePercent);
      await policyBook.submitClaimAndInitializeVoting("");

      for (let i = 0; i < staked.length; i++) {
        const VOTER = accounts[i + 2];

        await stkBMI.mintArbitrary(VOTER, wei(toBN(10).pow(18).toString())); // 10**18
        await stkBMI.approve(vBMI.address, staked[i], { from: VOTER });
        await vBMI.lockStkBMI(staked[i], { from: VOTER });

        await reputationSystemMock.setNewReputationNoCheck(VOTER, reputations[i]);
        await claimVoting.vote(1, suggestedAmounts[i], { from: VOTER });
      }

      let averageWithdrawal = toBN(0);
      let allStake = toBN(0);

      for (let i = 0; i < staked.length; i++) {
        allStake = allStake.plus(toBN(staked[i]).times(toBN(reputations[i])));
      }

      for (let i = 0; i < staked.length; i++) {
        averageWithdrawal = averageWithdrawal.plus(
          toBN(reputations[i]).times(toBN(staked[i])).times(toBN(suggestedAmounts[i])).idiv(allStake)
        );
      }

      return [allStake, averageWithdrawal];
    }

    it("should calculate correct averages (1)", async () => {
      const staked = [wei("2000"), wei("1000")];
      const suggestedAmounts = [coverTokensAmount, wei("500")];
      const reputations = [PRECISION.times(1.5), PRECISION.times(2)];

      await setCurrentTime(2);

      const [allStake, averageWithdrawal] = await calculate(staked, suggestedAmounts, reputations);

      const claimResult = await claimVoting.getVotingResult(1);

      assert.equal(toBN(claimResult[3]).toString(), averageWithdrawal.toString()); // average withdraw
      assert.equal(toBN(claimResult[4]).toString(), allStake.toString()); // yes average stake
    });

    it("should calculate correct averages (2)", async () => {
      const staked = [700, 1500, 7521];
      const suggestedAmounts = [coverTokensAmount, wei("500"), wei("120")];
      const reputations = [PRECISION.times(0.8), PRECISION.times(2), PRECISION.times(2.5)];

      const [allStake, averageWithdrawal] = await calculate(staked, suggestedAmounts, reputations);

      const claimResult = await claimVoting.getVotingResult(1);

      assert.equal(toBN(claimResult[3]).toString(), averageWithdrawal.plus(1).toString()); // average withdraw
      assert.equal(toBN(claimResult[4]).toString(), allStake.toString()); // yes average stake
    });

    it("should calculate correct averages (3)", async () => {
      const staked = [wei("10"), wei("1337"), wei("128376"), wei("123133")];
      const suggestedAmounts = [coverTokensAmount, wei("790"), wei("120"), wei("10")];
      const reputations = [PRECISION.times(0.8), PRECISION.times(2), PRECISION.times(2.5), PRECISION.times(1.68)];

      const [allStake, averageWithdrawal] = await calculate(staked, suggestedAmounts, reputations);

      const claimResult = await claimVoting.getVotingResult(1);

      assert.equal(toBN(claimResult[3]).toString(), averageWithdrawal.plus(2).toString()); // average withdraw
      assert.equal(toBN(claimResult[4]).toString(), allStake.toString()); // yes average stake
    });

    it("should calculate correct averages (4)", async () => {
      const staked = [wei("100"), wei("827341237"), wei("1"), wei("9837459837")];
      const suggestedAmounts = [coverTokensAmount, coverTokensAmount, wei("1"), wei("646")];
      const reputations = [PRECISION.times(0.1), PRECISION, PRECISION.times(3), PRECISION.times(1.11)];

      const [allStake, averageWithdrawal] = await calculate(staked, suggestedAmounts, reputations);

      const claimResult = await claimVoting.getVotingResult(1);

      assert.equal(toBN(claimResult[3]).toString(), averageWithdrawal.plus(1).toString()); // average withdraw
      assert.equal(toBN(claimResult[4]).toString(), allStake.toString()); // yes average stake
    });
  });

  describe("voteAgainst()", async () => {
    const epochsNumber = 7;
    const coverTokensAmount = wei("10000");
    const stblAmount = wei("25000");
    const liquidityAmount = wei("15000");

    it("should successfully vote against", async () => {
      await stbl.approve(policyBook.address, stblAmount);
      await policyBook.addLiquidity(liquidityAmount);
      await policyBook.buyPolicy(epochsNumber, coverTokensAmount);

      const toApproveOnePercent = await policyBook.getClaimApprovalAmount(USER1);

      await bmi.approve(claimVoting.address, toApproveOnePercent);

      await setCurrentTime(2);

      await policyBook.submitClaimAndInitializeVoting("");

      await setCurrentTime(10);

      await stkBMI.mintArbitrary(USER2, wei("1000000")); // 1 mil
      await stkBMI.approve(vBMI.address, coverTokensAmount, { from: USER2 });
      await vBMI.lockStkBMI(coverTokensAmount, { from: USER2 });

      const coverage = toBN((await policyBook.userStats(USER1))[0]);
      const userProtocol = BigNumber.min(
        toBN((await policyBook.userStats(USER1))[3])
          .times(20)
          .idiv(100),
        coverage.idiv(100)
      );

      await claimVoting.vote(1, 0, { from: USER2 });

      const claimResult = await claimVoting.getVotingResult(1);

      assert.equal(toBN(claimResult[0]).toString(), coverage.toString());
      assert.equal(toBN(claimResult[1]).toString(), coverage.idiv(100).toString());
      assert.equal(toBN(claimResult[2]).toString(), userProtocol.toString());

      assert.equal(claimResult[3], 0); // average withdraw
      assert.equal(claimResult[4], 0); // yes average stake
      assert.equal(toBN(claimResult[5]).toString(), PRECISION.times(wei("10000")).toString()); // no average stake
      assert.equal(toBN(claimResult[6]).toString(), toBN(coverTokensAmount).toString()); // all voted stake
      assert.equal(claimResult[7], 0); // voted yes percentage (after calculation)

      const votesCount = await claimVoting.countVotes(USER2);

      assert.equal(votesCount, 1);

      assert.equal(await claimVoting.voteStatus(1), VoteStatus.EXPOSED_PENDING);

      const votes = await claimVoting.myVotes(0, votesCount, { from: USER2 });

      assert.equal(votes[0][0][0][0], 1);
      assert.equal(votes[0][0][0][1], USER1);
      assert.equal(votes[0][0][0][2], policyBook.address);
      assert.equal(votes[0][0][0][3], "");
      assert.equal(votes[0][0][0][4], false);
      assert.equal(toBN(votes[0][0][0][5]).toString(), toBN(coverTokensAmount).toString());
      assert.equal(votes[0][0][0][6], 2); // may be 3 (time bug)
      assert.equal(votes[0][0][1], ClaimStatus.PENDING);
      assert.equal(votes[0][0][2], 0);
      assert.equal(votes[0][1], "");
      assert.equal(votes[0][2], 0);
      assert.equal(votes[0][3], VoteStatus.EXPOSED_PENDING);
      assert.equal(votes[0][4], 0);
    });

    async function calculate(staked, reputations) {
      await stbl.approve(policyBook.address, stblAmount);
      await policyBook.addLiquidity(liquidityAmount);
      await policyBook.buyPolicy(epochsNumber, coverTokensAmount);

      const toApproveOnePercent = await policyBook.getClaimApprovalAmount(USER1);

      await bmi.approve(claimVoting.address, toApproveOnePercent);
      await policyBook.submitClaimAndInitializeVoting("");

      for (let i = 0; i < staked.length; i++) {
        const VOTER = accounts[i + 2];

        await stkBMI.mintArbitrary(VOTER, wei(toBN(10).pow(18).toString())); // 10**18
        await stkBMI.approve(vBMI.address, staked[i], { from: VOTER });
        await vBMI.lockStkBMI(staked[i], { from: VOTER });

        await reputationSystemMock.setNewReputationNoCheck(VOTER, reputations[i]);
        await claimVoting.vote(1, 0, { from: VOTER });
      }

      let allStake = toBN(0);

      for (let i = 0; i < staked.length; i++) {
        allStake = allStake.plus(toBN(staked[i]).times(toBN(reputations[i])));
      }

      return allStake;
    }

    it("should calculate correct averages (1)", async () => {
      const staked = [wei("100"), wei("200")];
      const reputations = [PRECISION.times(0.1), PRECISION.times(3)];

      const allStake = await calculate(staked, reputations);

      const claimResult = await claimVoting.getVotingResult(1);

      assert.equal(toBN(claimResult[5]).toString(), allStake.toString()); // no average stake
    });

    it("should calculate correct averages (2)", async () => {
      const staked = [wei("3333"), wei("4444"), wei("5555")];
      const reputations = [PRECISION.times(0.4), PRECISION.times(1.1), PRECISION.times(2.9)];

      const allStake = await calculate(staked, reputations);

      const claimResult = await claimVoting.getVotingResult(1);

      assert.equal(toBN(claimResult[5]).toString(), allStake.toString()); // no average stake
    });

    it("should calculate correct averages (3)", async () => {
      const staked = [1, 128378, 812736, 923742];
      const reputations = [PRECISION.times(0.123), PRECISION.times(2.123), PRECISION.times(2.2), PRECISION.times(2.9)];

      const allStake = await calculate(staked, reputations);

      const claimResult = await claimVoting.getVotingResult(1);

      assert.equal(toBN(claimResult[5]).toString(), allStake.toString()); // no average stake
    });
  });

  describe("calculateVotingResult()", async () => {
    const epochsNumber = 7;
    const coverTokensAmount = wei("10000");
    const stblAmount = wei("35000");
    const liquidityAmount = wei("25000");

    async function initVoting() {
      await stbl.approve(policyBook.address, stblAmount);
      await policyBook.addLiquidity(liquidityAmount);
      await policyBook.buyPolicy(epochsNumber, coverTokensAmount);

      const toApproveOnePercent = await policyBook.getClaimApprovalAmount(USER1);

      await bmi.approve(claimVoting.address, toApproveOnePercent);
      await policyBook.submitClaimAndInitializeVoting("");
    }

    async function fastStake(VOTER, stake) {
      await stkBMI.mintArbitrary(VOTER, wei(toBN(10).pow(18).toString())); // 10**18
      await stkBMI.approve(vBMI.address, stake, { from: VOTER });
      await vBMI.lockStkBMI(stake, { from: VOTER });
    }

    async function fastVote(VOTER, stake, suggestedAmount, reputation, yes) {
      await fastStake(VOTER, stake);

      await reputationSystemMock.setNewReputationNoCheck(VOTER, reputation);

      if (yes) {
        await claimVoting.vote(1, suggestedAmount, { from: VOTER });
      } else {
        await claimVoting.vote(1, 0, { from: VOTER });
      }
    }

    it("should calculate voting result (1)", async () => {
      await setCurrentTime(2);

      await initVoting();

      await fastVote(accounts[2], wei("120"), wei("500"), PRECISION.times(1.1), false);
      await fastVote(accounts[3], wei("100"), wei("750"), PRECISION.times(2.4), false);
      await fastVote(accounts[4], wei("1000"), wei("1000"), PRECISION.times(0.1), false);
      await fastVote(accounts[5], wei("5000"), wei("1"), PRECISION.times(3), true);

      await setCurrentTime(toBN(await claimingRegistry.votingDuration(1)).plus(10));

      const uBalance = toBN(await stbl.balanceOf(USER1));
      const pBalance = toBN(await stbl.balanceOf(policyBook.address));

      const liquidity = toBN((await policyBook.getNewCoverAndLiquidity()).newTotalLiquidity);

      const res = await claimVoting.calculateVotingResultBatch([1]);
      console.log("CalculateVotingResult (ACCEPT) gas used: " + res.receipt.gasUsed);

      const addon = toBN((await claimVoting.getVotingResult(1))[3]);

      assert.equal(await claimingRegistry.claimStatus(1), ClaimStatus.ACCEPTED);

      assert.equal(
        toBN(await stbl.balanceOf(policyBook.address)).toString(),
        pBalance.minus(addon.idiv(10 ** 12)).toString()
      );
      assert.equal(toBN(await stbl.balanceOf(USER1)).toString(), uBalance.plus(addon.idiv(10 ** 12)).toString());

      assert.equal(toBN(await policyBook.totalLiquidity()).toString(), liquidity.minus(addon).toString());
    });

    it("should calculate voting result (2)", async () => {
      await setCurrentTime(2);

      await initVoting();

      await fastVote(accounts[2], 1000, 500, PRECISION, true);
      await fastVote(accounts[3], 2883, 500, PRECISION, true);
      await fastVote(accounts[4], 1000, 0, PRECISION, false);
      await fastVote(accounts[5], 1000, 0, PRECISION, false);

      await setCurrentTime(toBN(await claimingRegistry.votingDuration(1)).plus(10));

      const uBalance = toBN(await stbl.balanceOf(USER1));
      const pBalance = toBN(await stbl.balanceOf(policyBook.address));

      const liquidity = toBN((await policyBook.getNewCoverAndLiquidity()).newTotalLiquidity);

      await claimVoting.calculateVotingResultBatch([1]);

      const addon = toBN((await claimVoting.getVotingResult(1))[3]);

      assert.equal(await claimingRegistry.claimStatus(1), ClaimStatus.ACCEPTED);

      assert.equal(
        toBN(await stbl.balanceOf(policyBook.address)).toString(),
        pBalance.minus(addon.idiv(10 ** 12)).toString()
      );
      assert.equal(toBN(await stbl.balanceOf(USER1)).toString(), uBalance.plus(addon.idiv(10 ** 12)).toString());

      assert.equal(toBN(await policyBook.totalLiquidity()).toString(), liquidity.minus(addon).toString());
    });

    it("should calculate voting result (3)", async () => {
      await setCurrentTime(2);

      await initVoting();

      await fastVote(accounts[2], wei("1000"), wei("500"), PRECISION, true);
      await fastVote(accounts[3], wei("2882"), wei("500"), PRECISION, true);
      await fastVote(accounts[4], wei("1000"), 0, PRECISION, false);
      await fastVote(accounts[5], wei("1000"), 0, PRECISION, false);

      await setCurrentTime(toBN(await claimingRegistry.votingDuration(1)).plus(10));

      const res = await claimVoting.calculateVotingResultBatch([1]);
      console.log("CalculateVotingResult (REJECT) gas used: " + res.receipt.gasUsed);

      assert.equal(await claimingRegistry.claimStatus(1), ClaimStatus.REJECTED_CAN_APPEAL);
    });

    it("should calculate voting result, quorum (4)", async () => {
      await setCurrentTime(2);

      await initVoting();

      await fastStake(accounts[6], wei("100000"));

      await fastVote(accounts[2], wei("1000"), wei("500"), PRECISION, true);
      await fastVote(accounts[3], wei("8000"), wei("500"), PRECISION, true);
      await fastVote(accounts[4], wei("500"), 0, PRECISION, false);
      await fastVote(accounts[5], wei("499"), 0, PRECISION, false);

      await setCurrentTime(toBN(await claimingRegistry.votingDuration(1)).plus(10));

      const res = await claimVoting.calculateVotingResultBatch([1]);
      console.log("CalculateVotingResult (REJECT QUORUM) gas used: " + res.receipt.gasUsed);

      assert.equal(await claimingRegistry.claimStatus(1), ClaimStatus.REJECTED_CAN_APPEAL);
    });

    it("should calculate voting result, quorum (5)", async () => {
      await setCurrentTime(2);

      await initVoting();

      await fastStake(accounts[6], wei("100000"));

      await fastVote(accounts[2], wei("1200"), wei("500"), PRECISION, true);
      await fastVote(accounts[3], wei("10000"), wei("500"), PRECISION, true);
      await fastVote(accounts[4], wei("400"), 0, PRECISION, false);
      await fastVote(accounts[5], wei("400"), 0, PRECISION, false);

      await setCurrentTime(toBN(await claimingRegistry.votingDuration(1)).plus(10));

      await claimVoting.calculateVotingResultBatch([1]);

      assert.equal(await claimingRegistry.claimStatus(1), ClaimStatus.ACCEPTED);
    });

    it("should revert, public calculation (6)", async () => {
      await setCurrentTime(2);

      await initVoting();

      await fastVote(accounts[2], wei("1200"), wei("500"), PRECISION, true);
      await fastVote(accounts[3], wei("10000"), wei("500"), PRECISION, true);
      await fastVote(accounts[4], wei("400"), 0, PRECISION, false);
      await fastVote(accounts[5], wei("400"), 0, PRECISION, false);

      await setCurrentTime(toBN(await claimingRegistry.votingDuration(1)).plus(10));

      await truffleAssert.reverts(
        claimVoting.calculateVotingResultBatch([1], { from: accounts[3] }),
        "CV: Not allowed to calculate"
      );
    });

    it("should calculate reward, public calculation (7)", async () => {
      await setCurrentTime(2);

      await initVoting();

      await fastVote(accounts[2], wei("1200"), wei("500"), PRECISION, true);
      await fastVote(accounts[3], wei("10000"), wei("500"), PRECISION, true);
      await fastVote(accounts[4], wei("400"), 0, PRECISION, false);
      await fastVote(accounts[5], wei("400"), 0, PRECISION, false);

      const elapsedTime = toBN(48 * 60 * 60);
      const currentTime = toBN(await claimingRegistry.anyoneCanCalculateClaimResultAfter(1))
        .plus(elapsedTime)
        .plus(2);

      const spectator = accounts[3];

      const lockedBMIs = toBN((await claimVoting.getVotingResult(1))[1]);
      const accBalance = toBN(await bmi.balanceOf(spectator));

      await setCurrentTime(currentTime);

      await claimVoting.calculateVotingResultBatch([1], { from: spectator });

      const reward = BigNumber.min(
        lockedBMIs,
        elapsedTime
          .times(
            toBN(await claimVoting.CALCULATION_REWARD_PER_DAY())
              .idiv(SECONDS_IN_DAY)
              .times(lockedBMIs)
          )
          .idiv(PERCENTAGE_100)
      );

      // huge slippage to fix time bug
      assert.closeTo(
        toBN(await bmi.balanceOf(spectator)).toNumber(),
        accBalance.plus(reward).toNumber(),
        toBN(wei("0.001")).toNumber()
      );
      assert.closeTo(
        toBN((await claimVoting.getVotingResult(1))[1]).toNumber(),
        lockedBMIs.minus(reward).toNumber(),
        toBN(wei("0.001")).toNumber()
      );
    });

    it("shouldn't be able to claim new policybook when policy has expired and old claim is pending", async () => {
      await setCurrentTime(2);

      await initVoting();

      assert.equal(await policyRegistry.isPolicyActive(USER1, policyBook.address), true);

      await setCurrentTime(toBN(epochsNumber).plus(1).times(7).times(24).times(60).times(60).plus(100));

      assert.equal(await policyRegistry.isPolicyActive(USER1, policyBook.address), false);

      await truffleAssert.reverts(initVoting(), "PB: Claim is pending");
    });

    it("should be able to claim new policybook when policy has expired", async () => {
      await setCurrentTime(2);

      await initVoting();

      assert.equal(await policyRegistry.isPolicyActive(USER1, policyBook.address), true);

      await fastVote(accounts[2], wei("10000"), wei("500"), PRECISION, true);

      await setCurrentTime(toBN(await claimingRegistry.votingDuration(1)).plus(10));

      await claimVoting.calculateVotingResultBatch([1]);
      assert.equal(await claimingRegistry.claimStatus(1), ClaimStatus.ACCEPTED);

      await setCurrentTime(toBN(epochsNumber).plus(1).times(7).times(24).times(60).times(60).plus(100));

      assert.equal(await policyRegistry.isPolicyActive(USER1, policyBook.address), false);

      await initVoting();
    });

    it("should display correct status when old policy is accepted and new one is bought", async () => {
      await setCurrentTime(2);

      await initVoting();

      assert.equal(await policyRegistry.isPolicyActive(USER1, policyBook.address), true);

      await fastVote(accounts[2], wei("10000"), wei("500"), PRECISION, true);

      await setCurrentTime(toBN(await claimingRegistry.votingDuration(1)).plus(10));

      await claimVoting.calculateVotingResultBatch([1]);
      assert.equal(await claimingRegistry.claimStatus(1), ClaimStatus.ACCEPTED);

      await setCurrentTime(toBN(epochsNumber).plus(1).times(7).times(24).times(60).times(60).plus(100));

      assert.equal(await policyRegistry.isPolicyActive(USER1, policyBook.address), false);

      await stbl.approve(policyBook.address, stblAmount);
      await policyBook.addLiquidity(liquidityAmount);
      await policyBook.buyPolicy(epochsNumber, coverTokensAmount);

      assert.equal(await policyRegistry.isPolicyActive(USER1, policyBook.address), true);

      const info = await policyRegistry.getPoliciesInfo(USER1, true, 0, 1);

      assert.equal(info._policiesCount, 1);
      assert.equal(info._policyStatuses[0], ClaimStatus.CAN_CLAIM);
    });

    it("should only claim same policy after appeal expires", async () => {
      await setCurrentTime(2);

      await initVoting();

      assert.equal(await policyRegistry.isPolicyActive(USER1, policyBook.address), true);

      await fastVote(accounts[2], wei("10000"), wei("0"), PRECISION, true);

      await setCurrentTime(toBN(await claimingRegistry.votingDuration(1)).plus(10));

      await claimVoting.calculateVotingResultBatch([1]);
      assert.equal(await claimingRegistry.claimStatus(1), ClaimStatus.REJECTED_CAN_APPEAL);

      await setCurrentTime(
        toBN(await claimingRegistry.claimEndTime(1))
          .plus(await policyRegistry.STILL_CLAIMABLE_FOR())
          .plus(100)
      );

      assert.equal(await claimingRegistry.claimStatus(1), ClaimStatus.REJECTED);

      assert.equal(await policyRegistry.isPolicyActive(USER1, policyBook.address), true);

      const toApproveOnePercent = await policyBook.getClaimApprovalAmount(USER1);

      await bmi.approve(claimVoting.address, toApproveOnePercent);

      await truffleAssert.reverts(
        policyBook.submitAppealAndInitializeVoting(""),
        "ClaimingRegistry: The claimer can't submit this claim"
      );

      await policyBook.submitClaimAndInitializeVoting("");
    });
  });

  describe("calculateVoterResult()", async () => {
    const epochsNumber = 7;
    const coverTokensAmount = wei("10000");
    const stblAmount = wei("35000");
    const liquidityAmount = wei("25000");

    async function initVoting(policyBookToClaim) {
      await stbl.approve(policyBookToClaim.address, stblAmount);
      await policyBookToClaim.addLiquidity(liquidityAmount);
      await policyBookToClaim.buyPolicy(epochsNumber, coverTokensAmount);

      const toApproveOnePercent = await policyBookToClaim.getClaimApprovalAmount(USER1);

      await bmi.approve(claimVoting.address, toApproveOnePercent);

      await setCurrentTime(2);

      await policyBookToClaim.submitClaimAndInitializeVoting("");
    }

    async function fastVote(voter, claimIndexes, stake, suggestedAmount, reputation, yes) {
      await stkBMI.mintArbitrary(voter, wei(toBN(10).pow(18).toString())); // 10**18
      await stkBMI.approve(vBMI.address, stake, { from: voter });
      await vBMI.lockStkBMI(stake, { from: voter });

      for (let i = 0; i < claimIndexes.length; i++) {
        await reputationSystemMock.setNewReputationNoCheck(voter, reputation);

        if (yes) {
          await claimVoting.vote(claimIndexes[i], suggestedAmount, { from: voter });
        } else {
          await claimVoting.vote(claimIndexes[i], 0, { from: voter });
        }
      }
    }

    async function calculateAverageStake(staked, reputations, from, to) {
      let allStake = toBN(0);

      for (let i = from; i < to; i++) {
        allStake = allStake.plus(toBN(staked[i]).times(toBN(reputations[i])));
      }

      return allStake;
    }

    it("should calculate voter result (yes, majority, accepted)", async () => {
      await initVoting(policyBook);

      const staked = [wei("4000"), wei("3000"), wei("1000"), wei("1000")];
      const reputations = [PRECISION, PRECISION, PRECISION, PRECISION];

      await fastVote(accounts[2], [1], staked[0], wei("500"), reputations[0], true);
      await fastVote(accounts[3], [1], staked[1], wei("500"), reputations[1], true);
      await fastVote(accounts[4], [1], staked[2], 0, reputations[2], false);
      await fastVote(accounts[5], [1], staked[3], 0, reputations[3], false);

      const observer = accounts[2];
      const observedStake = staked[0];
      const observedReputation = reputations[0];

      const allStake = await calculateAverageStake(staked, reputations, 0, 2);

      const paidToProtocol = toBN((await policyBook.userStats(USER1))[3])
        .times(20)
        .idiv(100);
      const coverage = toBN((await policyBook.userStats(USER1))[0]);

      await setCurrentTime(toBN(await claimingRegistry.votingDuration(1)).plus(10));
      await claimVoting.calculateVotingResultBatch([1]);

      const reinsuranceSTBL = await stbl.balanceOf(reinsurancePool.address);
      const acc2STBL = await stbl.balanceOf(observer);
      const reputation = await reputationSystemMock.reputation(observer);

      assert.equal(toBN(reputation).toString(), PRECISION.toString());

      const res = await claimVoting.calculateVoterResultBatch([1], { from: observer });
      console.log("CalculateVoterResult (yes, majority, accepted) gas used: " + res.receipt.gasUsed);

      assert.equal(await claimingRegistry.claimStatus(1), ClaimStatus.ACCEPTED);

      const voteIndex = await claimVoting.voteIndex(1, { from: observer });
      assert.equal(await claimVoting.voteStatus(voteIndex), VoteStatus.MAJORITY);

      assert.equal(toBN(await reputationSystemMock.reputation(observer)).gt(toBN(reputation)), true);

      const userProtocol = BigNumber.min(paidToProtocol, coverage.idiv(100));

      const voterReward = toBN(observedStake)
        .times(toBN(observedReputation))
        .div(allStake)
        .times(userProtocol)
        .dp(0, BigNumber.ROUND_FLOOR);

      assert.equal(
        toBN(await stbl.balanceOf(observer)).toString(),
        toBN(acc2STBL)
          .plus(toBN(voterReward))
          .idiv(10 ** 12)
          .toString()
      );
      assert.equal(
        toBN(await stbl.balanceOf(reinsurancePool.address)).toString(),
        toBN(reinsuranceSTBL)
          .minus(toBN(voterReward).idiv(10 ** 12))
          .toString()
      );
    });

    it("should calculate voter result (yes, majority, rejected)", async () => {
      await initVoting(policyBook);

      const staked = [wei("4000"), wei("3000"), wei("4000"), wei("2000")];
      const reputations = [PRECISION, PRECISION, PRECISION, PRECISION];

      await fastVote(accounts[2], [1], staked[0], wei("500"), reputations[0], true);
      await fastVote(accounts[3], [1], staked[1], wei("500"), reputations[1], true);
      await fastVote(accounts[4], [1], staked[2], 0, reputations[2], false);
      await fastVote(accounts[5], [1], staked[3], 0, reputations[3], false);

      const observer = accounts[2];
      const observedStake = staked[0];
      const observedReputation = reputations[0];

      const allStake = await calculateAverageStake(staked, reputations, 0, 2);

      await setCurrentTime(toBN(await claimingRegistry.votingDuration(1)).plus(10));
      await claimVoting.calculateVotingResultBatch([1]);

      const claimVotingBMI = await bmi.balanceOf(claimVoting.address);
      const accBMI = await bmi.balanceOf(observer);
      const reputation = await reputationSystemMock.reputation(observer);

      assert.equal(toBN(reputation).toString(), PRECISION.toString());

      const res = await claimVoting.calculateVoterResultBatch([1], { from: observer });
      console.log("CalculateVoterResult (yes, majority, rejected) gas used: " + res.receipt.gasUsed);

      assert.equal(await claimingRegistry.claimStatus(1), ClaimStatus.REJECTED_CAN_APPEAL);

      const voteIndex = await claimVoting.voteIndex(1, { from: observer });
      assert.equal(await claimVoting.voteStatus(voteIndex), VoteStatus.MAJORITY);

      assert.equal(toBN(await reputationSystemMock.reputation(observer)).gt(toBN(reputation)), true);

      const lockedBMI = (await claimVoting.getVotingResult(1))[1];

      const voterReward = toBN(observedStake)
        .times(toBN(observedReputation))
        .div(allStake)
        .times(toBN(lockedBMI))
        .dp(0, BigNumber.ROUND_FLOOR);

      assert.equal(toBN(await bmi.balanceOf(observer)).toString(), toBN(accBMI).plus(toBN(voterReward)).toString());
      assert.equal(
        toBN(await bmi.balanceOf(claimVoting.address)).toString(),
        toBN(claimVotingBMI).minus(toBN(voterReward)).toString()
      );
    });

    it("should calculate voter result (no, majority, rejected)", async () => {
      await initVoting(policyBook);

      const staked = [wei("4000"), wei("2000"), wei("4000"), wei("3000")];
      const reputations = [PRECISION, PRECISION, PRECISION, PRECISION];

      await fastVote(accounts[2], [1], staked[0], wei("500"), reputations[0], true);
      await fastVote(accounts[3], [1], staked[1], wei("500"), reputations[1], true);
      await fastVote(accounts[4], [1], staked[2], 0, reputations[2], false);
      await fastVote(accounts[5], [1], staked[3], 0, reputations[3], false);

      const observer = accounts[5];
      const observedStake = staked[3];
      const observedReputation = reputations[3];

      const allStake = await calculateAverageStake(staked, reputations, 2, 4);

      const elapsedTimeReversed = toBN(await claimingRegistry.anyoneCanCalculateClaimResultAfter(1))
        .minus(toBN(await claimingRegistry.votingDuration(1)))
        .minus(toBN(8));

      await setCurrentTime(toBN(await claimingRegistry.votingDuration(1)).plus(10));

      const claimVotingBMI = toBN(await bmi.balanceOf(claimVoting.address));
      const claimerBMI = toBN(await bmi.balanceOf(USER1));
      let lockedBMIs = toBN((await claimVoting.getVotingResult(1))[1]);

      await claimVoting.calculateVotingResultBatch([1]);

      const myReward = BigNumber.min(
        lockedBMIs,
        elapsedTimeReversed
          .times(
            toBN(await claimVoting.CALCULATION_REWARD_PER_DAY())
              .idiv(SECONDS_IN_DAY)
              .times(lockedBMIs)
          )
          .idiv(PERCENTAGE_100)
      );

      assert.equal(toBN(await bmi.balanceOf(USER1)).toString(), claimerBMI.plus(myReward).toString());
      assert.equal(
        toBN(await bmi.balanceOf(claimVoting.address)).toString(),
        claimVotingBMI.minus(myReward).toString()
      );
      assert.equal(toBN((await claimVoting.getVotingResult(1))[1]).toString(), lockedBMIs.minus(myReward).toString());

      const accBMI = await bmi.balanceOf(observer);
      const reputation = await reputationSystemMock.reputation(observer);

      assert.equal(toBN(reputation).toString(), PRECISION.toString());

      const res = await claimVoting.calculateVoterResultBatch([1], { from: observer });
      console.log("CalculateVoterResult (no, majority, rejected) gas used: " + res.receipt.gasUsed);

      assert.equal(await claimingRegistry.claimStatus(1), ClaimStatus.REJECTED_CAN_APPEAL);

      const voteIndex = await claimVoting.voteIndex(1, { from: observer });
      assert.equal(await claimVoting.voteStatus(voteIndex), VoteStatus.MAJORITY);

      assert.equal(toBN(await reputationSystemMock.reputation(observer)).gt(toBN(reputation)), true);

      lockedBMIs = (await claimVoting.getVotingResult(1))[1];

      const voterReward = toBN(observedStake)
        .times(toBN(observedReputation))
        .div(allStake)
        .times(toBN(lockedBMIs))
        .dp(0, BigNumber.ROUND_FLOOR);

      assert.equal(toBN(await bmi.balanceOf(observer)).toString(), toBN(accBMI).plus(voterReward).toString());
      assert.equal(
        toBN(await bmi.balanceOf(claimVoting.address)).toString(),
        claimVotingBMI.minus(voterReward).minus(myReward).toString()
      );
    });

    it("should calculate voter result (yes or no, minority)", async () => {
      await initVoting(policyBook);

      const staked = [wei("4000"), wei("2000"), wei("4000"), wei("3000")];
      const reputations = [PRECISION, PRECISION, PRECISION, PRECISION];

      await fastVote(accounts[2], [1], staked[0], wei("500"), reputations[0], true);
      await fastVote(accounts[3], [1], staked[1], wei("500"), reputations[1], true);
      await fastVote(accounts[4], [1], staked[2], 0, reputations[2], false);
      await fastVote(accounts[5], [1], staked[3], 0, reputations[3], false);

      const observer = accounts[3];

      await setCurrentTime(toBN(await claimingRegistry.votingDuration(1)).plus(10));
      await claimVoting.calculateVotingResultBatch([1]);

      const claimVotingBMI = await bmi.balanceOf(claimVoting.address);
      const accBMI = await bmi.balanceOf(observer);
      const reputation = await reputationSystemMock.reputation(observer);

      assert.equal(toBN(reputation).toString(), PRECISION.toString());

      const res = await claimVoting.calculateVoterResultBatch([1], { from: observer });
      console.log("CalculateVoterResult (yes or no, minority) gas used: " + res.receipt.gasUsed);

      assert.equal(await claimingRegistry.claimStatus(1), ClaimStatus.REJECTED_CAN_APPEAL);

      const voteIndex = await claimVoting.voteIndex(1, { from: observer });
      assert.equal(await claimVoting.voteStatus(voteIndex), VoteStatus.MINORITY);

      assert.equal(toBN(await reputationSystemMock.reputation(observer)).lt(toBN(reputation)), true);

      assert.equal(toBN(await bmi.balanceOf(observer)).toString(), toBN(accBMI).toString());
      assert.equal(toBN(await bmi.balanceOf(claimVoting.address)).toString(), toBN(claimVotingBMI).toString());
    });

    it("should calculate voter result (yes or no, extereme minority)", async () => {
      await initVoting(policyBook);

      const staked = [wei("10"), wei("4000"), wei("2000"), wei("3000")];
      const reputations = [PRECISION, PRECISION, PRECISION, PRECISION];

      await fastVote(accounts[2], [1], staked[0], 0, reputations[0], false);
      await fastVote(accounts[3], [1], staked[1], wei("500"), reputations[1], true);
      await fastVote(accounts[4], [1], staked[2], wei("500"), reputations[2], true);
      await fastVote(accounts[5], [1], staked[3], wei("500"), reputations[3], true);

      const observer = accounts[2];

      await setCurrentTime(toBN(await claimingRegistry.votingDuration(1)).plus(10));
      await claimVoting.calculateVotingResultBatch([1]);

      const stakingStkBMI = await stkBMI.balanceOf(vBMI.address);
      const accStakedStkBMI = await vBMI.balanceOf(observer);
      const reinsuranceStkBMI = await stkBMI.balanceOf(reinsurancePool.address);
      const reputation = await reputationSystemMock.reputation(observer);

      assert.equal(toBN(reputation).toString(), PRECISION.toString());

      const res = await claimVoting.calculateVoterResultBatch([1], { from: observer });
      console.log("CalculateVoterResult (yes or no, extreme minority) gas used: " + res.receipt.gasUsed);

      assert.equal(await claimingRegistry.claimStatus(1), ClaimStatus.ACCEPTED);

      const voteIndex = await claimVoting.voteIndex(1, { from: observer });
      assert.equal(await claimVoting.voteStatus(voteIndex), VoteStatus.MINORITY);

      let votedExtremePercentage = (await claimVoting.getVotingResult(1))[7];
      votedExtremePercentage = BigNumber.min(
        toBN(votedExtremePercentage),
        PERCENTAGE_100.minus(toBN(votedExtremePercentage))
      );
      votedExtremePercentage = toBN(await claimVoting.PENALTY_THRESHOLD()).minus(votedExtremePercentage);

      const voterConf = toBN(accStakedStkBMI)
        .times(votedExtremePercentage)
        .div(PERCENTAGE_100)
        .dp(0, BigNumber.ROUND_FLOOR);

      assert.equal(toBN(await reputationSystemMock.reputation(observer)).lt(toBN(reputation)), true);

      assert.equal(
        toBN(await stkBMI.balanceOf(vBMI.address)).toString(),
        toBN(stakingStkBMI).minus(toBN(voterConf)).toString()
      );
      assert.equal(
        toBN(await vBMI.balanceOf(observer)).toString(),
        toBN(accStakedStkBMI).minus(toBN(voterConf)).toString()
      );
      assert.equal(
        toBN(await stkBMI.balanceOf(reinsurancePool.address)).toString(),
        toBN(reinsuranceStkBMI).plus(toBN(voterConf)).toString()
      );
    });

    it("should calculate correct voter reputation", async () => {
      await initVoting(policyBook);
      await initVoting(policyBook2);

      const staked = [wei("1000"), wei("5000"), wei("5000"), wei("300")];
      const reputations = [PRECISION, PRECISION, PRECISION, PRECISION];

      await fastVote(accounts[2], [1, 2], staked[0], 0, reputations[0], false);
      await fastVote(accounts[3], [1, 2], staked[1], wei("500"), reputations[1], true);
      await fastVote(accounts[4], [1, 2], staked[2], wei("500"), reputations[2], true);
      await fastVote(accounts[5], [1, 2], staked[3], 0, reputations[3], false);

      const observer = accounts[3];
      const observer2 = accounts[4];

      await setCurrentTime(toBN(await claimingRegistry.votingDuration(2)).plus(100));
      await claimVoting.calculateVotingResultBatch([1, 2]);

      assert.equal(await claimingRegistry.claimStatus(1), ClaimStatus.ACCEPTED);
      assert.equal(await claimingRegistry.claimStatus(2), ClaimStatus.ACCEPTED);

      await claimVoting.calculateVoterResultBatch([1, 2], { from: observer });

      await claimVoting.calculateVoterResultBatch([1], { from: observer2 });
      await claimVoting.calculateVoterResultBatch([2], { from: observer2 });

      assert.equal(
        toBN(await reputationSystemMock.reputation(observer)).toString(),
        toBN(await reputationSystemMock.reputation(observer2)).toString()
      );
    });
  });
});
