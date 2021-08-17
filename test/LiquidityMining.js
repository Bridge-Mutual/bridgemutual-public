const LiquidityMiningMock = artifacts.require("LiquidityMiningMock");
const BMIUtilityNFT = artifacts.require("BMIUtilityNFT");
const ContractsRegistry = artifacts.require("ContractsRegistry");
const BMIMock = artifacts.require("BMIMock");
const STBL = artifacts.require("STBLMock");
const PolicyBookMock = artifacts.require("PolicyBookMock");
const PolicyQuote = artifacts.require("PolicyQuote");
const RewardsGenerator = artifacts.require("RewardsGenerator");
const PolicyBookRegistry = artifacts.require("PolicyBookRegistry");
const LiquidityRegistry = artifacts.require("LiquidityRegistry");
const BMICoverStaking = artifacts.require("BMICoverStaking");
const PolicyBookAdmin = artifacts.require("PolicyBookAdmin");

const Reverter = require("./helpers/reverter");
const BigNumber = require("bignumber.js");
const { assert } = require("chai");

const setCurrentTime = require("./helpers/ganacheTimeTraveler");
const truffleAssert = require("truffle-assertions");

const ContractType = {
  CONTRACT: 0,
  STABLECOIN: 1,
  SERVICE: 2,
  EXCHANGE: 3,
};

function toBN(number) {
  return new BigNumber(number);
}

async function checkNFTOnAccount(bmiUtilityNFT, userAddress, platCount, goldCount, silverCount, bronzeCount) {
  assert.equal(toBN(await bmiUtilityNFT.balanceOf(userAddress, 1)).toString(), platCount);
  assert.equal(toBN(await bmiUtilityNFT.balanceOf(userAddress, 2)).toString(), goldCount);
  assert.equal(toBN(await bmiUtilityNFT.balanceOf(userAddress, 3)).toString(), silverCount);
  assert.equal(toBN(await bmiUtilityNFT.balanceOf(userAddress, 4)).toString(), bronzeCount);
}

const wei = web3.utils.toWei;

contract("LiquidityMining", async (accounts) => {
  const reverter = new Reverter(web3);

  const OWNER = accounts[0];
  const USER1 = accounts[1];
  const USER2 = accounts[2];
  const USER3 = accounts[3];
  const FABRIC = accounts[7];
  const BOOK = accounts[8];
  const NOTHING = accounts[9];

  const endLiquidityMiningTime = toBN(1).plus(1209600); // Now + 2 weeks
  const oneMonth = toBN(2592000);
  const stblAmount = toBN(wei("100000", "mwei"));
  const oneBMI = toBN(wei("1"));

  let liquidityMining;
  let bmiUtilityNFT;
  let bmiMock;
  let stbl;
  let policyBookMock;
  let bmiCoverStaking;
  let policyBookAdmin;

  before("setup", async () => {
    const contractsRegistry = await ContractsRegistry.new();
    bmiMock = await BMIMock.new(OWNER);
    stbl = await STBL.new("stbl", "stbl", 6);
    policyBookMock = await PolicyBookMock.new(BOOK, ContractType.CONTRACT);
    const _bmiUtilityNFT = await BMIUtilityNFT.new();
    const _policyQuote = await PolicyQuote.new();
    const _rewardsGenerator = await RewardsGenerator.new();
    const _policyBookRegistry = await PolicyBookRegistry.new();
    const _liquidityRegistry = await LiquidityRegistry.new();
    const _bmiCoverStaking = await BMICoverStaking.new();
    const _policyBookAdmin = await PolicyBookAdmin.new();

    const _liquidityMining = await LiquidityMiningMock.new();

    await contractsRegistry.__ContractsRegistry_init();

    await contractsRegistry.addContract(await contractsRegistry.PRICE_FEED_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.CLAIMING_REGISTRY_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.CLAIM_VOTING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.REINSURANCE_POOL_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.POLICY_REGISTRY_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.LEGACY_REWARDS_GENERATOR_NAME(), NOTHING);

    await contractsRegistry.addContract(await contractsRegistry.POLICY_BOOK_FABRIC_NAME(), FABRIC);
    await contractsRegistry.addContract(await contractsRegistry.USDT_NAME(), stbl.address);
    await contractsRegistry.addContract(await contractsRegistry.BMI_NAME(), bmiMock.address);

    await contractsRegistry.addProxyContract(await contractsRegistry.BMI_UTILITY_NFT_NAME(), _bmiUtilityNFT.address);
    await contractsRegistry.addProxyContract(
      await contractsRegistry.POLICY_BOOK_REGISTRY_NAME(),
      _policyBookRegistry.address
    );
    await contractsRegistry.addProxyContract(await contractsRegistry.LIQUIDITY_MINING_NAME(), _liquidityMining.address);
    await contractsRegistry.addProxyContract(await contractsRegistry.POLICY_QUOTE_NAME(), _policyQuote.address);
    await contractsRegistry.addProxyContract(
      await contractsRegistry.REWARDS_GENERATOR_NAME(),
      _rewardsGenerator.address
    );
    await contractsRegistry.addProxyContract(
      await contractsRegistry.LIQUIDITY_REGISTRY_NAME(),
      _liquidityRegistry.address
    );
    await contractsRegistry.addProxyContract(
      await contractsRegistry.BMI_COVER_STAKING_NAME(),
      _bmiCoverStaking.address
    );
    await contractsRegistry.addProxyContract(
      await contractsRegistry.POLICY_BOOK_ADMIN_NAME(),
      _policyBookAdmin.address
    );

    const policyBookRegistry = await PolicyBookRegistry.at(await contractsRegistry.getPolicyBookRegistryContract());
    const rewardsGenerator = await RewardsGenerator.at(await contractsRegistry.getRewardsGeneratorContract());
    liquidityMining = await LiquidityMiningMock.at(await contractsRegistry.getLiquidityMiningContract());
    bmiUtilityNFT = await BMIUtilityNFT.at(await contractsRegistry.getBMIUtilityNFTContract());
    bmiCoverStaking = await BMICoverStaking.at(await contractsRegistry.getBMICoverStakingContract());
    policyBookAdmin = await PolicyBookAdmin.at(await contractsRegistry.getPolicyBookAdminContract());

    await rewardsGenerator.__RewardsGenerator_init();
    await liquidityMining.__LiquidityMining_init();
    await bmiCoverStaking.__BMICoverStaking_init();
    await policyBookAdmin.__PolicyBookAdmin_init(policyBookMock.address);

    await setCurrentTime(1);
    await policyBookMock.__PolicyBookMock_init(NOTHING, ContractType.CONTRACT);
    await bmiUtilityNFT.__BMIUtilityNFT_init();

    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.REWARDS_GENERATOR_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.BMI_UTILITY_NFT_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_MINING_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.BMI_COVER_STAKING_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_ADMIN_NAME());
    await policyBookMock.setDependencies(contractsRegistry.address);

    await setCurrentTime(1);
    await liquidityMining.startLiquidityMining();

    await bmiUtilityNFT.mintNFTsForLM();

    await policyBookRegistry.add(NOTHING, ContractType.CONTRACT, policyBookMock.address, { from: FABRIC });

    await reverter.snapshot();
  });

  afterEach("revert", reverter.revert);

  describe("mint NFTs", async () => {
    it("shouldn't mint NFTs second time", async () => {
      await truffleAssert.reverts(bmiUtilityNFT.mintNFTsForLM(), "BMIUtilityNFT: NFTs are already minted");
    });
  });

  describe("createTeam", async () => {
    const teamName = "testTeam";

    it("should create team with correct values", async () => {
      const result = await liquidityMining.createTeam(teamName, { from: USER1 });

      assert.equal((await liquidityMining.teamInfos(USER1)).name, teamName);

      const userTeamInfo = await liquidityMining.usersTeamInfo(USER1);

      assert.equal(userTeamInfo.teamAddr, USER1);
      assert.equal(userTeamInfo.stakedAmount, 0);

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, "TeamCreated");
      assert.equal(result.logs[0].args._referralLink, USER1);
      assert.equal(result.logs[0].args._name, teamName);
    });

    it("should not create a team if the user is already in another team", async () => {
      await liquidityMining.createTeam(teamName, { from: USER2 });
      await liquidityMining.joinTheTeam(USER2, { from: USER1 });

      assert.equal((await liquidityMining.teamInfos(USER2)).name, teamName);

      const user1TeamInfo = await liquidityMining.usersTeamInfo(USER1);

      assert.equal(user1TeamInfo.teamAddr, USER2);
      assert.equal(user1TeamInfo.stakedAmount, 0);

      const reason = "LM: The user is already in the team";
      await truffleAssert.reverts(liquidityMining.createTeam("someName", { from: USER1 }), reason);
    });

    it("should get exception, team name is already exists", async () => {
      await liquidityMining.createTeam(teamName, { from: USER1 });

      const reason = "LM: Team name already exists";
      await truffleAssert.reverts(liquidityMining.createTeam(teamName, { from: USER2 }), reason);
    });

    it("should get exception, user is already in the team", async () => {
      await liquidityMining.createTeam(teamName, { from: USER1 });

      const reason = "LM: The user is already in the team";
      await truffleAssert.reverts(liquidityMining.createTeam("someName", { from: USER1 }), reason);
    });

    it("should get exception, team name is too long, or short", async function () {
      const shortTeamName = "";
      const maxLenghtTeamName = "Lorem Ipsum is simply dummy text of the printing a";
      const longTeamName = "Lorem Ipsum is simply dummy text of the printing an";

      const reason = "LM: Team name is too long/short";
      await truffleAssert.reverts(liquidityMining.createTeam(shortTeamName, { from: USER2 }), reason);
      await truffleAssert.reverts(liquidityMining.createTeam(longTeamName, { from: USER2 }), reason);
      await truffleAssert.passes(liquidityMining.createTeam(maxLenghtTeamName, { from: USER2 }));
    });
  });

  describe("joinTheTeam", async () => {
    const teamName = "testTeam";

    beforeEach("setup", async () => {
      await liquidityMining.createTeam(teamName, { from: USER1 });
    });

    it("should successfuly join the team", async () => {
      const result = await liquidityMining.joinTheTeam(USER1, { from: USER2 });

      assert.equal((await liquidityMining.teamInfos(USER1)).name, teamName);

      const userTeamInfo = await liquidityMining.usersTeamInfo(USER2);

      assert.equal(userTeamInfo.teamAddr, USER1);
      assert.equal(userTeamInfo.stakedAmount, 0);

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, "MemberAdded");
      assert.equal(result.logs[0].args._referralLink, USER1);
      assert.equal(result.logs[0].args._newMember, USER2);
      assert.equal(result.logs[0].args._membersNumber, 2);
    });

    it("should get exception if command does not exist", async () => {
      const reason = "LM: There is no such team";
      await truffleAssert.reverts(liquidityMining.joinTheTeam(USER3, { from: USER2 }), reason);
    });

    it("should get exception if user is already in the team", async () => {
      await liquidityMining.joinTheTeam(USER1, { from: USER2 });

      await liquidityMining.createTeam("someTeam", { from: USER3 });

      const reason = "LM: The user is already in the team";
      await truffleAssert.reverts(liquidityMining.joinTheTeam(USER3, { from: USER2 }), reason);
    });
  });

  describe("deleteTeam", async () => {
    const teamName = "testTeam";

    beforeEach("setup", async () => {
      await liquidityMining.createTeam(teamName, { from: USER1 });
    });

    it("should successfuly delete the team", async () => {
      const result = await liquidityMining.deleteTeam({ from: USER1 });

      assert.equal((await liquidityMining.teamInfos(USER1)).name, "");

      const userTeamInfo = await liquidityMining.usersTeamInfo(USER1);

      assert.equal(toBN(userTeamInfo.teamAddr).toString(), "0");
      assert.equal(userTeamInfo.stakedAmount, 0);

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, "TeamDeleted");
      assert.equal(result.logs[0].args._referralLink, USER1);
      assert.equal(result.logs[0].args._name, teamName);
    });

    it("should get exception if team size greater than one", async () => {
      await liquidityMining.joinTheTeam(USER1, { from: USER2 });

      const reason = "LM: Unable to delete a team";
      await truffleAssert.reverts(liquidityMining.deleteTeam({ from: USER1 }), reason);
    });

    it("should get exception, try to delete team without team", async () => {
      const reason = "LM: Unable to delete a team";
      await truffleAssert.reverts(liquidityMining.deleteTeam({ from: USER2 }), reason);
    });

    it("should get exception, try to delete team with stake amount", async () => {
      await stbl.transfer(USER1, stblAmount);
      await stbl.approve(policyBookMock.address, stblAmount, { from: USER1 });
      await liquidityMining.investSTBL(toBN(wei("10000")), policyBookMock.address, { from: USER1 });

      const reason = "LM: Unable to remove a team";
      await truffleAssert.reverts(liquidityMining.deleteTeam({ from: USER1 }), reason);
    });
  });

  describe("test getters", async () => {
    const teamName1 = "Winners";
    const teamName2 = "Golden";
    const teamName3 = "Ninjas";
    const amount = toBN(wei("5000"));

    beforeEach("setup", async () => {
      for (const account of accounts) {
        await stbl.transfer(account, stblAmount);
        await stbl.approve(policyBookMock.address, stblAmount, { from: account });
      }

      await liquidityMining.createTeam(teamName1, { from: OWNER });
      await liquidityMining.createTeam(teamName2, { from: USER1 });
      await liquidityMining.createTeam(teamName3, { from: USER2 });

      await liquidityMining.joinTheTeam(OWNER, { from: accounts[3] });

      await liquidityMining.joinTheTeam(USER1, { from: accounts[4] });
      await liquidityMining.joinTheTeam(USER1, { from: accounts[5] });
      await liquidityMining.joinTheTeam(USER1, { from: accounts[6] });
      await liquidityMining.joinTheTeam(USER1, { from: accounts[7] });

      await liquidityMining.joinTheTeam(USER2, { from: accounts[8] });
      await liquidityMining.joinTheTeam(USER2, { from: accounts[9] });

      for (let i = 1; i <= accounts.length; i++) {
        await setCurrentTime(1);

        await liquidityMining.investSTBL(amount.times(i), policyBookMock.address, { from: accounts[i - 1] });
      }
    });

    it("should return correct values from getTopTeams", async () => {
      await setCurrentTime(endLiquidityMiningTime.plus(10));

      const topTeams = await liquidityMining.getTopTeams();

      assert.equal(topTeams[0].teamName, teamName2);
      assert.equal(topTeams[0].referralLink, USER1);
      assert.equal(topTeams[0].membersNumber, 5);
      assert.closeTo(
        toBN(topTeams[0].totalStakedAmount).toNumber(),
        toBN(wei("140000")).toNumber(),
        toBN(wei("0.0001")).toNumber()
      );
      assert.equal(toBN(topTeams[0].totalReward).toString(), toBN(wei("150000")).toString());
    });

    it("should return correct values from getTopUsers", async () => {
      const topUsers = await liquidityMining.getTopUsers();

      assert.equal(topUsers[0].userAddr, accounts[9]);
      assert.equal(topUsers[0].teamName, "Ninjas");
      assert.closeTo(
        toBN(topUsers[0].stakedAmount).toNumber(),
        toBN(wei("50000")).toNumber(),
        toBN(wei("0.0001")).toNumber()
      );
      assert.equal(toBN(topUsers[0].mainNFT).toString(), "0");
      assert.equal(toBN(topUsers[0].platinumNFT).toString(), "0");
    });

    it("should return correct values from getAllTeamsDetails", async () => {
      let result = await liquidityMining.getAllTeamsDetails(0, 5);

      let expectedTeamNames = [teamName1, teamName2, teamName3];
      let expectedReferralLinks = [OWNER, USER1, USER2];
      let expectedMembersNumber = [2, 5, 3];
      let expectedTotalAmounts = [wei("25000"), wei("140000"), wei("110000")];

      assert.equal(result.length, 3);

      for (let i = 0; i < result.length; i++) {
        assert.equal(result[i].teamName, expectedTeamNames[i]);
        assert.equal(result[i].referralLink, expectedReferralLinks[i]);
        assert.equal(result[i].membersNumber, expectedMembersNumber[i]);
        assert.closeTo(
          toBN(result[i].totalStakedAmount).toNumber(),
          toBN(expectedTotalAmounts[i]).toNumber(),
          toBN(wei("0.01")).toNumber()
        );
        assert.equal(toBN(result[i].totalReward).toString(), "0");
      }

      result = await liquidityMining.getAllTeamsDetails(1, 2);

      expectedTeamNames = [teamName2, teamName3];
      expectedReferralLinks = [USER1, USER2];
      expectedMembersNumber = [5, 3];
      expectedTotalAmounts = [wei("140000"), wei("110000")];

      assert.equal(result.length, 2);

      for (let i = 0; i < result.length; i++) {
        assert.equal(result[i].teamName, expectedTeamNames[i]);
        assert.equal(result[i].referralLink, expectedReferralLinks[i]);
        assert.equal(result[i].membersNumber, expectedMembersNumber[i]);
        assert.closeTo(
          toBN(result[i].totalStakedAmount).toNumber(),
          toBN(expectedTotalAmounts[i]).toNumber(),
          toBN(wei("0.0001")).toNumber()
        );
        assert.equal(toBN(result[i].totalReward).toString(), "0");
      }
    });

    it("should return correct values from getAllUsersInfo", async () => {
      let result = await liquidityMining.getAllUsersInfo(0, 10);

      assert.equal(result.length, accounts.length);
      assert.equal(result[0].teamName, teamName1);

      for (let i = 0; i < accounts.length; i++) {
        const userInfo = result[i];

        assert.equal(userInfo.userAddr, accounts[i]);
        assert.closeTo(
          toBN(userInfo.stakedAmount).toNumber(),
          amount.times(i + 1).toNumber(),
          toBN(wei("0.0001")).times(10000).toNumber()
        );

        if (i == 1 || (i >= 4 && i <= 7)) {
          assert.equal(userInfo.teamName, teamName2);
        } else if (i == 0 || i == 3) {
          assert.equal(userInfo.teamName, teamName1);
        } else {
          assert.equal(userInfo.teamName, teamName3);
        }

        assert.equal(toBN(userInfo.mainNFT).toString(), "0");
        assert.equal(toBN(userInfo.platinumNFT).toString(), "0");
      }

      result = await liquidityMining.getAllUsersInfo(2, 5);

      assert.equal(result.length, 5);

      for (let i = 2; i < 7; i++) {
        const userInfo = result[i - 2];

        assert.equal(userInfo.userAddr, accounts[i]);
        assert.closeTo(
          toBN(userInfo.stakedAmount).toNumber(),
          amount.times(i + 1).toNumber(),
          toBN(wei("0.0001")).times(10000).toNumber()
        );

        if (i == 1 || (i >= 4 && i <= 7)) {
          assert.equal(userInfo.teamName, teamName2);
        } else if (i == 0 || i == 3) {
          assert.equal(userInfo.teamName, teamName1);
        } else {
          assert.equal(userInfo.teamName, teamName3);
        }

        assert.equal(toBN(userInfo.mainNFT).toString(), "0");
        assert.equal(toBN(userInfo.platinumNFT).toString(), "0");
      }
    });

    it("should return correct values from getMyTeamMembers", async () => {
      let result = await liquidityMining.getMyTeamMembers(0, 20, { from: USER1 });

      let addrArray = result[0];
      let stakedAmountArr = result[1];

      assert.equal(addrArray.length, 5);
      assert.equal(stakedAmountArr.length, 5);

      let expectedAddressesIds = [1, 4, 5, 6, 7];
      let expectedStakedAmount = [wei("10000"), wei("25000"), wei("30000"), wei("35000"), wei("40000")];

      for (let i = 0; i < 5; i++) {
        assert.equal(addrArray[i], accounts[expectedAddressesIds[i]]);
        assert.closeTo(
          toBN(stakedAmountArr[i]).toNumber(),
          toBN(expectedStakedAmount[i]).toNumber(),
          toBN(wei("0.0001")).times(10000).toNumber()
        );
      }

      result = await liquidityMining.getMyTeamMembers(0, 2, { from: USER1 });

      addrArray = result[0];
      stakedAmountArr = result[1];

      assert.equal(addrArray.length, 2);
      assert.equal(stakedAmountArr.length, 2);

      expectedAddressesIds = [1, 4];
      expectedStakedAmount = [wei("10000"), wei("25000")];

      for (let i = 0; i < 2; i++) {
        assert.equal(addrArray[i], accounts[expectedAddressesIds[i]]);
        assert.closeTo(
          toBN(stakedAmountArr[i]).toNumber(),
          toBN(expectedStakedAmount[i]).toNumber(),
          toBN(wei("0.00001")).times(10000).toNumber()
        );
      }
    });

    it("should return correct values from getMyTeamInfo", async () => {
      let teamInfo = await liquidityMining.getMyTeamInfo({ from: USER1 });

      assert.closeTo(
        toBN(teamInfo.myStakedAmount).toNumber(),
        amount.times(2).toNumber(),
        toBN(wei("0.0001")).times(10000).toNumber()
      );
      assert.equal(teamInfo.teamDetails.teamName, teamName2);
      assert.equal(teamInfo.teamDetails.referralLink, USER1);
      assert.equal(teamInfo.teamDetails.membersNumber, 5);
      assert.closeTo(
        toBN(teamInfo.teamDetails.totalStakedAmount).toNumber(),
        toBN(wei("140000")).toNumber(),
        toBN(wei("0.00001")).times(100000).toNumber()
      );
      assert.equal(toBN(teamInfo.teamPlace).toString(), "0");

      teamInfo = await liquidityMining.getMyTeamInfo({ from: USER2 });

      assert.closeTo(
        toBN(teamInfo.myStakedAmount).toNumber(),
        amount.times(3).toNumber(),
        toBN(wei("0.0001")).times(10000).toNumber()
      );
      assert.equal(teamInfo.teamDetails.teamName, teamName3);
      assert.equal(teamInfo.teamDetails.referralLink, USER2);
      assert.equal(teamInfo.teamDetails.membersNumber, 3);
      assert.closeTo(
        toBN(teamInfo.teamDetails.totalStakedAmount).toNumber(),
        toBN(wei("110000")).toNumber(),
        toBN(wei("0.0001")).times(10000).toNumber()
      );
      assert.equal(toBN(teamInfo.teamPlace).toString(), "1");
    });

    it("should return correct values from getRewardsInfo (1)", async () => {
      await setCurrentTime(endLiquidityMiningTime.plus(10));

      const reward = await liquidityMining.getRewardsInfo(USER1);

      assert.equal(reward.teamName, "Golden");
      assert.closeTo(
        toBN(reward.totalBMIReward).toNumber(),
        toBN(wei("10714.285714")).toNumber(),
        toBN(wei("0.0001")).toNumber()
      );
      assert.closeTo(
        toBN(reward.availableBMIReward).toNumber(),
        toBN(wei("2142.857142")).toNumber(),
        toBN(wei("0.0001")).toNumber()
      );
      assert.equal(toBN(reward.incomingPeriods).toString(), "4");
      assert.equal(toBN(reward.timeToNextDistribution).toString(), oneMonth.minus(10).toString());
      assert.equal(toBN(reward.claimedBMI).toString(), "0");

      assert.equal(toBN(reward.mainNFTAvailability).toString(), "4");
      assert.equal(toBN(reward.platinumNFTAvailability).toString(), "0");
      assert.isFalse(reward.claimedNFTs);
    });

    it("should return correct values from getRewardsInfo (2)", async () => {
      await setCurrentTime(endLiquidityMiningTime.plus(oneMonth.times(4)).plus(10));

      const reward = await liquidityMining.getRewardsInfo(accounts[9]);

      assert.equal(reward.teamName, "Ninjas");
      assert.closeTo(
        toBN(reward.totalBMIReward).toNumber(),
        toBN(wei("22727.272727")).toNumber(),
        toBN(wei("0.0001")).toNumber()
      );
      assert.closeTo(
        toBN(reward.availableBMIReward).toNumber(),
        toBN(wei("22727.272727")).toNumber(),
        toBN(wei("0.0001")).toNumber()
      );
      assert.equal(toBN(reward.incomingPeriods).toString(), "0");
      assert.equal(toBN(reward.timeToNextDistribution).toString(), "0");
      assert.equal(toBN(reward.claimedBMI).toString(), "0");

      assert.equal(toBN(reward.mainNFTAvailability).toString(), "2");
      assert.equal(toBN(reward.platinumNFTAvailability).toString(), "1");
      assert.isFalse(reward.claimedNFTs);
    });

    it("should return correct values from getRewardsInfo (3)", async () => {
      await bmiMock.transfer(liquidityMining.address, wei("100000"));

      await setCurrentTime(endLiquidityMiningTime.plus(oneMonth.times(2)).plus(10));

      await liquidityMining.distributeNFT({ from: accounts[9] });
      await liquidityMining.distributeBMIReward({ from: accounts[9] });

      await setCurrentTime(endLiquidityMiningTime.plus(oneMonth.times(4)).plus(10));

      const reward = await liquidityMining.getRewardsInfo(accounts[9]);

      assert.equal(reward.teamName, "Ninjas");
      assert.closeTo(
        toBN(reward.totalBMIReward).toNumber(),
        toBN(wei("22727.272727")).toNumber(),
        toBN(wei("0.0001")).toNumber()
      );
      assert.closeTo(
        toBN(reward.availableBMIReward).toNumber(),
        toBN(wei("9090.9090")).toNumber(),
        toBN(wei("0.0001")).toNumber()
      );
      assert.equal(toBN(reward.incomingPeriods).toString(), "0");
      assert.equal(toBN(reward.timeToNextDistribution).toString(), "0");
      assert.closeTo(
        toBN(reward.claimedBMI).toNumber(),
        toBN(wei("13636.3636")).toNumber(),
        toBN(wei("0.0001")).toNumber()
      );

      assert.equal(toBN(reward.mainNFTAvailability).toString(), "2");
      assert.equal(toBN(reward.platinumNFTAvailability).toString(), "1");
      assert.isTrue(reward.claimedNFTs);
    });
  });

  describe("getSlashingPercentage", async () => {
    const PRECISION = toBN(10).pow(25);

    it("should return 0 percentage", async () => {
      await setCurrentTime(1);

      assert.equal(await liquidityMining.getSlashingPercentage(), 0);
    });

    it("should return 25 percentage", async () => {
      const halfPeriod = 604801; // 1 week
      await setCurrentTime(halfPeriod);

      assert.closeTo(
        toBN(await liquidityMining.getSlashingPercentage()).toNumber(),
        toBN(PRECISION.times(25)).toNumber(),
        toBN(PRECISION.idiv(10)).toNumber()
      );
    });

    it("should return 50 percentage", async () => {
      await setCurrentTime(endLiquidityMiningTime.minus(10 * 60));

      assert.closeTo(
        toBN(await liquidityMining.getSlashingPercentage()).toNumber(),
        toBN(PRECISION.times(50)).toNumber(),
        toBN(wei("0.001")).toNumber()
      );
    });

    it("should return 80 percentage", async () => {
      await setCurrentTime(endLiquidityMiningTime.minus(3 * 60 + 53));

      assert.closeTo(
        toBN(await liquidityMining.getSlashingPercentage()).toNumber(),
        toBN(PRECISION.times(80)).toNumber(),
        toBN(PRECISION.idiv(10)).toNumber()
      );
    });

    it("should return 99 percentage", async () => {
      await setCurrentTime(endLiquidityMiningTime.plus(1));

      assert.closeTo(
        toBN(await liquidityMining.getSlashingPercentage()).toNumber(),
        toBN(PRECISION.times(99)).toNumber(),
        toBN(PRECISION.idiv(10)).toNumber()
      );
    });
  });

  describe("investSTBL", async () => {
    const amount = toBN(wei("5000"));

    beforeEach("setup", async () => {
      await setCurrentTime(1);

      for (const account of accounts) {
        await stbl.transfer(account, stblAmount);
        await stbl.approve(policyBookMock.address, stblAmount, { from: account });
      }

      await liquidityMining.createTeam("Winners", { from: OWNER });

      for (let i = 1; i < accounts.length - 1; i++) {
        await liquidityMining.joinTheTeam(OWNER, { from: accounts[i] });
      }
    });

    it("should emit correct event and update staked amount", async () => {
      await liquidityMining.investSTBL(amount.times(10), policyBookMock.address, { from: USER1 });

      let userTeamInfo = await liquidityMining.usersTeamInfo(USER1);
      assert.closeTo(
        toBN(userTeamInfo.stakedAmount).toNumber(),
        amount.times(10).toNumber(),
        toBN(wei("0.00001")).times(10000).toNumber()
      );

      const result = await liquidityMining.investSTBL(amount, policyBookMock.address, { from: USER1 });
      assert.equal(result.logs[0].event, "TeamInvested");
      assert.equal(result.logs[0].args._referralLink, OWNER);
      assert.equal(result.logs[0].args._stblInvestor, USER1);
      assert.closeTo(
        toBN(result.logs[0].args._tokensAmount).toNumber(),
        amount.toNumber(),
        toBN(wei("0.00001")).times(1000).toNumber()
      );

      userTeamInfo = await liquidityMining.usersTeamInfo(USER1);
      assert.closeTo(
        toBN(userTeamInfo.stakedAmount).toNumber(),
        amount.times(11).toNumber(),
        toBN(wei("0.0001")).times(10000).toNumber()
      );
    });

    it("should successfully update information", async () => {
      for (let i = 0; i < accounts.length - 1; i++) {
        await liquidityMining.investSTBL(amount.times(i + 1), policyBookMock.address, { from: accounts[i] });
      }

      const expectedTopUsersIds = [8, 7, 6, 5, 4];

      for (let i = 0; i < 5; i++) {
        assert.equal(await liquidityMining.topUsers(i), accounts[expectedTopUsersIds[i]]);
      }

      let index = accounts.length - 2;
      const teamLeaders = await liquidityMining.getTeamLeaders(OWNER);

      for (let i = 0; i < accounts.length - 1; i++) {
        assert.equal(teamLeaders[i], accounts[index]);
        index--;
      }
    });

    it("should return zero", async () => {
      await liquidityMining.investSTBL(amount, policyBookMock.address);

      await policyBookAdmin.whitelist(policyBookMock.address, true);

      await policyBookMock.approve(bmiCoverStaking.address, amount.idiv(2));
      await bmiCoverStaking.stakeBMIX(amount.idiv(2), policyBookMock.address);

      assert.equal(toBN(await policyBookMock.getAvailableBMIXWithdrawableAmount(OWNER)).toString(), "0");
    });

    it("should get exception, try to invest STBL until the end of liquidity mining", async () => {
      await setCurrentTime(endLiquidityMiningTime.plus(10));

      const reason = "LM: LME didn't start or finished";
      await truffleAssert.reverts(liquidityMining.investSTBL(amount, policyBookMock.address, { from: USER1 }), reason);
    });

    it("should get exception, try to invest STBL without team", async () => {
      const reason = "LM: User is without a team";
      await truffleAssert.reverts(
        liquidityMining.investSTBL(amount, policyBookMock.address, { from: accounts[9] }),
        reason
      );
    });
  });

  describe("distributeNFT", async () => {
    const amount = toBN(wei("5000"));

    beforeEach("setup", async () => {
      for (const account of accounts) {
        await stbl.transfer(account, stblAmount);
        await stbl.approve(policyBookMock.address, stblAmount, { from: account });
      }

      await liquidityMining.createTeam("Winners", { from: OWNER });
      await liquidityMining.investSTBL(amount, policyBookMock.address, { from: OWNER });
    });

    it("should correctly send NFT", async () => {
      for (let i = 1; i < accounts.length; i++) {
        await liquidityMining.joinTheTeam(OWNER, { from: accounts[i] });
        await liquidityMining.investSTBL(amount.times(i + 1), policyBookMock.address, { from: accounts[i] });
      }

      await setCurrentTime(endLiquidityMiningTime.plus(10));

      let currentUser = accounts[9];
      await liquidityMining.distributeNFT({ from: currentUser });

      await checkNFTOnAccount(bmiUtilityNFT, currentUser, 1, 1, 0, 0);

      currentUser = accounts[0];
      await liquidityMining.distributeNFT({ from: currentUser });

      await checkNFTOnAccount(bmiUtilityNFT, currentUser, 0, 0, 0, 1);
    });

    it("should get exception, try to distribute NFTs before liquidity mining time expires", async () => {
      await truffleAssert.reverts(
        liquidityMining.distributeNFT({ from: USER1 }),
        "LM: LME didn't start or still going"
      );
    });

    it("should get exception, try to distribute NFTs several times", async () => {
      await setCurrentTime(endLiquidityMiningTime.plus(10));
      await liquidityMining.distributeNFT();

      await truffleAssert.reverts(liquidityMining.distributeNFT(), "LM: NFT is already distributed");
    });
  });

  describe("checkNFTReward", async () => {
    it("should return true if user has NFT reward", async () => {
      await stbl.transfer(USER1, stblAmount);
      await stbl.approve(policyBookMock.address, stblAmount, { from: USER1 });

      await liquidityMining.createTeam("Winners", { from: USER1 });

      await liquidityMining.investSTBL(wei("900"), policyBookMock.address, { from: USER1 });

      await setCurrentTime(endLiquidityMiningTime.plus(100));

      assert.equal(toBN(await liquidityMining.checkMainNFTReward(USER1)).toString(), "2");
      assert.equal(toBN(await liquidityMining.checkPlatinumNFTReward(USER1)).toString(), "1");
    });

    async function invest(user, team, amount) {
      await stbl.transfer(user, stblAmount);
      await stbl.approve(policyBookMock.address, stblAmount, { from: user });

      await liquidityMining.joinTheTeam(team, { from: user });

      await liquidityMining.investSTBL(amount, policyBookMock.address, { from: user });
    }

    it("should return true for main NFT reward and false for platinum", async () => {
      await liquidityMining.createTeam("Winners");
      await liquidityMining.createTeam("Chain breakers", { from: accounts[1] });

      await invest(accounts[2], accounts[0], wei("1000"));
      await invest(accounts[3], accounts[0], wei("999"));
      await invest(accounts[4], accounts[0], wei("998"));
      await invest(accounts[5], accounts[0], wei("997"));
      await invest(accounts[6], accounts[0], wei("996"));
      await invest(accounts[7], accounts[1], wei("995"));

      await setCurrentTime(endLiquidityMiningTime.plus(100));

      assert.equal(toBN(await liquidityMining.checkMainNFTReward(accounts[7])).toString(), "2");
      assert.equal(toBN(await liquidityMining.checkPlatinumNFTReward(accounts[7])).toString(), "0");
    });

    it("should return false if liquidity mining is not over", async () => {
      await stbl.transfer(USER1, stblAmount);
      await stbl.approve(policyBookMock.address, stblAmount, { from: USER1 });

      await liquidityMining.createTeam("Winners", { from: USER1 });

      await liquidityMining.investSTBL(wei("900"), policyBookMock.address, { from: USER1 });

      assert.equal(toBN(await liquidityMining.checkMainNFTReward(USER1)).toString(), "0");
      assert.equal(toBN(await liquidityMining.checkPlatinumNFTReward(USER1)).toString(), "0");
    });
  });

  describe("distributeBMIReward", async () => {
    const amountToTransfer = oneBMI.times(1000000);

    beforeEach("setup", async () => {
      await stbl.transfer(USER1, stblAmount);
      await stbl.approve(policyBookMock.address, stblAmount, { from: USER1 });

      await stbl.transfer(USER2, stblAmount);
      await stbl.approve(policyBookMock.address, stblAmount, { from: USER2 });

      await liquidityMining.createTeam("Winners", { from: USER1 });
      await liquidityMining.joinTheTeam(USER1, { from: USER2 });

      await bmiMock.transfer(liquidityMining.address, amountToTransfer);

      assert.equal(toBN(await bmiMock.balanceOf(liquidityMining.address)).toString(), amountToTransfer.toString());
    });

    it("should revert if no reward is available", async () => {
      await setCurrentTime(endLiquidityMiningTime.plus(10));

      await truffleAssert.reverts(liquidityMining.distributeBMIReward({ from: USER1 }), "LM: No BMI reward available");
    });

    it("should get 100% of tokens when user invest 100%", async () => {
      await liquidityMining.investSTBL(wei("1000"), policyBookMock.address, { from: USER1 });
      await setCurrentTime(endLiquidityMiningTime.plus(10));

      await liquidityMining.distributeBMIReward({ from: USER1 });
      assert.equal(toBN(await bmiMock.balanceOf(USER1)).toString(), oneBMI.times(30000));
    });

    it("should correctly get reward for different users", async () => {
      await stbl.transfer(USER3, stblAmount);
      await stbl.approve(policyBookMock.address, stblAmount, { from: USER3 });

      await liquidityMining.joinTheTeam(USER1, { from: USER3 });

      await liquidityMining.investSTBL(wei("100"), policyBookMock.address, { from: USER1 });
      await liquidityMining.investSTBL(wei("400"), policyBookMock.address, { from: USER2 });
      await liquidityMining.investSTBL(wei("500"), policyBookMock.address, { from: USER3 });

      await setCurrentTime(endLiquidityMiningTime.plus(10));

      await liquidityMining.distributeBMIReward({ from: USER1 });
      await liquidityMining.distributeBMIReward({ from: USER2 });
      await liquidityMining.distributeBMIReward({ from: USER3 });

      // huge slippage to fix time bug
      assert.closeTo(
        toBN(await bmiMock.balanceOf(USER1)).toNumber(),
        oneBMI.times(3000).toNumber(),
        toBN(wei("0.01")).toNumber()
      );
      assert.closeTo(
        toBN(await bmiMock.balanceOf(USER2)).toNumber(),
        oneBMI.times(12000).toNumber(),
        toBN(wei("0.01")).toNumber()
      );
      assert.closeTo(
        toBN(await bmiMock.balanceOf(USER3)).toNumber(),
        oneBMI.times(15000).toNumber(),
        toBN(wei("0.01")).toNumber()
      );
    });

    it("should get 100% of tokens 5 month reward on 2 place", async () => {
      await stbl.transfer(USER3, stblAmount);
      await stbl.approve(policyBookMock.address, stblAmount, { from: USER3 });

      await liquidityMining.createTeam("Golden", { from: USER3 });

      await liquidityMining.investSTBL(wei("1000"), policyBookMock.address, { from: USER1 });
      await liquidityMining.investSTBL(wei("500"), policyBookMock.address, { from: USER3 });

      await setCurrentTime(endLiquidityMiningTime.plus(10).plus(oneMonth.times(4)));

      await liquidityMining.distributeBMIReward({ from: USER3 });
      assert.equal(toBN(await bmiMock.balanceOf(USER3)).toString(), oneBMI.times(50000).toString());
    });

    it("should correctly get reward multiple times", async () => {
      await liquidityMining.investSTBL(wei("1000"), policyBookMock.address, { from: USER1 });
      await setCurrentTime(endLiquidityMiningTime.plus(10).plus(oneMonth));

      await liquidityMining.distributeBMIReward({ from: USER1 });
      assert.equal(toBN(await bmiMock.balanceOf(USER1)).toString(), oneBMI.times(60000).toString());

      await setCurrentTime(endLiquidityMiningTime.plus(10).plus(oneMonth.times(7)));

      await liquidityMining.distributeBMIReward({ from: USER1 });
      assert.equal(toBN(await bmiMock.balanceOf(USER1)).toString(), oneBMI.times(150000).toString());
    });

    it("should get exception, 2 weeks have not expired", async () => {
      await truffleAssert.reverts(
        liquidityMining.distributeBMIReward({ from: USER1 }),
        "LM: LME didn't start or still going"
      );
    });
  });

  describe("checkAvailableBMIReward", async () => {
    beforeEach("setup", async () => {
      await stbl.transfer(USER1, stblAmount);
      await stbl.approve(policyBookMock.address, stblAmount, { from: USER1 });

      await stbl.transfer(USER2, stblAmount);
      await stbl.approve(policyBookMock.address, stblAmount, { from: USER2 });

      await liquidityMining.createTeam("Winners", { from: USER1 });
      await liquidityMining.joinTheTeam(USER1, { from: USER2 });
    });

    it("should return correct reward to both users", async () => {
      await liquidityMining.investSTBL(wei("900"), policyBookMock.address, { from: USER1 });
      await liquidityMining.investSTBL(wei("100"), policyBookMock.address, { from: USER2 });

      await setCurrentTime(endLiquidityMiningTime.plus(10).plus(oneMonth.times(2)));

      const user1Reward = toBN(await liquidityMining.checkAvailableBMIReward(USER1)).toNumber();
      const user2Reward = toBN(await liquidityMining.checkAvailableBMIReward(USER2)).toNumber();

      const user1ExpectedReward = oneBMI.times(81000);
      const user2ExpectedReward = oneBMI.times(9000);

      assert.closeTo(user1Reward, user1ExpectedReward.toNumber(), toBN(wei("0.00001")).times(1000).toNumber());
      assert.closeTo(user2Reward, user2ExpectedReward.toNumber(), toBN(wei("0.00001")).times(1000).toNumber());
    });

    it("should return zero if user do not have staked amount", async () => {
      await liquidityMining.investSTBL(wei("900"), policyBookMock.address, { from: USER1 });

      await setCurrentTime(endLiquidityMiningTime.plus(10));

      const user1Reward = toBN(await liquidityMining.checkAvailableBMIReward(USER1)).toString();
      const user2Reward = toBN(await liquidityMining.checkAvailableBMIReward(USER2)).toString();

      const user1ExpectedReward = oneBMI.times(30000);
      const user2ExpectedReward = 0;

      assert.equal(user1Reward, user1ExpectedReward);
      assert.equal(user2Reward, user2ExpectedReward);
    });

    it("should return correct values several times", async () => {
      await liquidityMining.investSTBL(wei("1000"), policyBookMock.address, { from: USER1 });

      await setCurrentTime(endLiquidityMiningTime.plus(10));

      let user1Reward = toBN(await liquidityMining.checkAvailableBMIReward(USER1)).toString();
      let user1ExpectedReward = oneBMI.times(30000);

      assert.equal(user1Reward, user1ExpectedReward.toString());

      await setCurrentTime(endLiquidityMiningTime.plus(10).plus(oneMonth.times(4)));

      user1Reward = toBN(await liquidityMining.checkAvailableBMIReward(USER1));
      user1ExpectedReward = oneBMI.times(150000);

      assert.equal(user1Reward.toString(), user1ExpectedReward.toString());
    });
  });
});
