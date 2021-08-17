const BMICoverStaking = artifacts.require("BMICoverStaking");
const RewardsGenerator = artifacts.require("RewardsGeneratorMock");
const ContractsRegistry = artifacts.require("ContractsRegistry");
const PolicyBookFabric = artifacts.require("PolicyBookFabric");
const PolicyBookRegistry = artifacts.require("PolicyBookRegistry");
const PolicyBookMock = artifacts.require("PolicyBookMock");
const STBLMock = artifacts.require("STBLMock");
const BMIMock = artifacts.require("BMIMock");
const WETHMock = artifacts.require("WETHMock");
const PolicyBookAdmin = artifacts.require("PolicyBookAdmin");
const BMIStaking = artifacts.require("BMIStaking");
const StkBMIToken = artifacts.require("STKBMIToken");
const LiquidityMiningMock = artifacts.require("LiquidityMiningMock");
const LiquidityRegistry = artifacts.require("LiquidityRegistry");
const PriceFeed = artifacts.require("PriceFeed");
const UniswapRouterMock = artifacts.require("UniswapRouterMock");
const VBMI = artifacts.require("VBMI");

const { assert } = require("chai");
const BigNumber = require("bignumber.js");
const truffleAssert = require("truffle-assertions");
const setCurrentTime = require("./helpers/ganacheTimeTraveler");
const advanceBlockAtTime = require("./helpers/ganacheTimeTraveler");
const Reverter = require("./helpers/reverter");
const { sign2612 } = require("./helpers/signatures");

const ContractType = {
  CONTRACT: 0,
  STABLECOIN: 1,
  SERVICE: 2,
  EXCHANGE: 3,
};

function toBN(number) {
  return new BigNumber(number);
}

async function advanceBlocks(amount) {
  for (let i = 0; i < amount; i++) {
    await advanceBlockAtTime(1);
  }
}

async function getCurrentBlockTimestamp() {
  return (await web3.eth.getBlock("latest")).timestamp;
}

const wei = web3.utils.toWei;

contract("BMICoverStaking", async (accounts) => {
  const reverter = new Reverter(web3);
  const MAIN = accounts[0];
  const HELP = accounts[1];
  const LEGACY_REWARDS_GENERATOR = accounts[2];
  const NOTHING = accounts[9];

  const MAIN_PRIVATE_KEY = "ad5d3fd80dfc93fa3a5aa232d21cd73da7c6eac6f80d709a590e7245cb6fb9fb";

  const ZERO = "0x0000000000000000000000000000000000000000";

  const APY_PRECISION = toBN(10).pow(5);
  const PRECISION = toBN(10).pow(25);

  let stblMock;
  let bmiMock;
  let policyBook;
  let policyBook2;
  let bmiCoverStaking;
  let rewardsGenerator;
  let bmiStaking;
  let liquidityMiningMock;
  let policyBookAdmin;

  before("setup", async () => {
    const mockInsuranceContractAddress1 = "0x0000000000000000000000000000000000000001";
    const mockInsuranceContractAddress2 = "0x0000000000000000000000000000000000000002";

    const contractsRegistry = await ContractsRegistry.new();
    const policyBookImpl = await PolicyBookMock.new();
    const wethMock = await WETHMock.new("weth", "weth");
    const uniswapRouterMock = await UniswapRouterMock.new();
    const _policyBookAdmin = await PolicyBookAdmin.new();
    const _policyBookRegistry = await PolicyBookRegistry.new();
    const _policyBookFabric = await PolicyBookFabric.new();
    const _bmiCoverStaking = await BMICoverStaking.new();
    const _rewardsGenerator = await RewardsGenerator.new();
    const _bmiStaking = await BMIStaking.new();
    const _liquidityMiningMock = await LiquidityMiningMock.new();
    const _stkBMIToken = await StkBMIToken.new();
    const _liquidityRegistry = await LiquidityRegistry.new();
    const _priceFeed = await PriceFeed.new();
    const _vBMI = await VBMI.new();
    stblMock = await STBLMock.new("mockSTBL", "MSTBL", 6);
    bmiMock = await BMIMock.new(NOTHING);

    await contractsRegistry.__ContractsRegistry_init();

    await contractsRegistry.addContract(await contractsRegistry.LEGACY_BMI_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.POLICY_REGISTRY_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.CLAIM_VOTING_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.CLAIMING_REGISTRY_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.BMI_UTILITY_NFT_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.REINSURANCE_POOL_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.POLICY_QUOTE_NAME(), NOTHING);
    await contractsRegistry.addContract(await contractsRegistry.LIQUIDITY_MINING_STAKING_NAME(), NOTHING);
    await contractsRegistry.addContract(
      await contractsRegistry.LEGACY_REWARDS_GENERATOR_NAME(),
      LEGACY_REWARDS_GENERATOR
    );

    await contractsRegistry.addContract(await contractsRegistry.WETH_NAME(), wethMock.address);
    await contractsRegistry.addContract(await contractsRegistry.USDT_NAME(), stblMock.address);
    await contractsRegistry.addContract(await contractsRegistry.BMI_NAME(), bmiMock.address);
    await contractsRegistry.addContract(await contractsRegistry.UNISWAP_ROUTER_NAME(), uniswapRouterMock.address);

    await contractsRegistry.addProxyContract(await contractsRegistry.PRICE_FEED_NAME(), _priceFeed.address);
    await contractsRegistry.addProxyContract(
      await contractsRegistry.POLICY_BOOK_ADMIN_NAME(),
      _policyBookAdmin.address
    );
    await contractsRegistry.addProxyContract(
      await contractsRegistry.BMI_COVER_STAKING_NAME(),
      _bmiCoverStaking.address
    );
    await contractsRegistry.addProxyContract(await contractsRegistry.STKBMI_NAME(), _stkBMIToken.address);
    await contractsRegistry.addProxyContract(
      await contractsRegistry.REWARDS_GENERATOR_NAME(),
      _rewardsGenerator.address
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
      await contractsRegistry.LIQUIDITY_REGISTRY_NAME(),
      _liquidityRegistry.address
    );
    await contractsRegistry.addProxyContract(await contractsRegistry.BMI_STAKING_NAME(), _bmiStaking.address);
    await contractsRegistry.addProxyContract(
      await contractsRegistry.LIQUIDITY_MINING_NAME(),
      _liquidityMiningMock.address
    );
    await contractsRegistry.addProxyContract(await contractsRegistry.VBMI_NAME(), _vBMI.address);

    const policyBookFabric = await PolicyBookFabric.at(await contractsRegistry.getPolicyBookFabricContract());
    const stkBMIToken = await StkBMIToken.at(await contractsRegistry.getSTKBMIContract());
    policyBookAdmin = await PolicyBookAdmin.at(await contractsRegistry.getPolicyBookAdminContract());
    bmiCoverStaking = await BMICoverStaking.at(await contractsRegistry.getBMICoverStakingContract());
    rewardsGenerator = await RewardsGenerator.at(await contractsRegistry.getRewardsGeneratorContract());
    bmiStaking = await BMIStaking.at(await contractsRegistry.getBMIStakingContract());
    liquidityMiningMock = await LiquidityMiningMock.at(await contractsRegistry.getLiquidityMiningContract());
    const vBMI = await VBMI.at(await contractsRegistry.getVBMIContract());

    await policyBookAdmin.__PolicyBookAdmin_init(policyBookImpl.address);
    await stkBMIToken.__STKBMIToken_init();
    await bmiCoverStaking.__BMICoverStaking_init();
    await rewardsGenerator.__RewardsGenerator_init();
    await bmiStaking.__BMIStaking_init(0);
    await liquidityMiningMock.__LiquidityMining_init();
    await vBMI.__VBMI_init();

    await contractsRegistry.injectDependencies(await contractsRegistry.PRICE_FEED_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_ADMIN_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_REGISTRY_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.BMI_COVER_STAKING_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.REWARDS_GENERATOR_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.BMI_STAKING_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.STKBMI_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_MINING_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_FABRIC_NAME());
    await contractsRegistry.injectDependencies(await contractsRegistry.VBMI_NAME());

    await uniswapRouterMock.setReserve(stblMock.address, wei(toBN(10 ** 3).toString()));
    await uniswapRouterMock.setReserve(wethMock.address, wei(toBN(10 ** 15).toString()));
    await uniswapRouterMock.setReserve(bmiMock.address, wei(toBN(10 ** 15).toString()));

    const initialDeposit = wei("1000");

    await stblMock.approve(policyBookFabric.address, initialDeposit);

    await setCurrentTime(1);

    const policyBookAddress = (
      await policyBookFabric.create(
        mockInsuranceContractAddress1,
        ContractType.STABLECOIN,
        "mock1",
        "1",
        initialDeposit
      )
    ).logs[0].args.at;

    policyBook = await PolicyBookMock.at(policyBookAddress);

    await policyBookAdmin.whitelist(policyBookAddress, true);

    const liquidity = wei("1000000");

    await stblMock.approve(policyBookAddress, liquidity);
    await policyBook.addLiquidity(liquidity);

    await stblMock.mintArbitrary(HELP, wei("1000000", "mwei"));

    await stblMock.approve(policyBookAddress, liquidity, { from: HELP });
    await policyBook.addLiquidity(liquidity, { from: HELP });

    await stblMock.approve(policyBookFabric.address, initialDeposit);

    await setCurrentTime(1);

    const policyBook2Address = (
      await policyBookFabric.create(
        mockInsuranceContractAddress2,
        ContractType.STABLECOIN,
        "mock2",
        "2",
        initialDeposit
      )
    ).logs[0].args.at;

    policyBook2 = await PolicyBookMock.at(policyBook2Address);

    await policyBookAdmin.whitelist(policyBook2Address, true);
    await stblMock.mintArbitrary(HELP, wei("1000000", "mwei"));
    await stblMock.approve(policyBook2Address, liquidity);
    await policyBook2.addLiquidity(liquidity);

    await stblMock.approve(policyBook2Address, liquidity, { from: HELP });
    await policyBook2.addLiquidity(liquidity, { from: HELP });

    await setCurrentTime(1);

    await liquidityMiningMock.startLiquidityMining();

    await rewardsGenerator.setRewardPerBlock(wei("100"));

    await reverter.snapshot();
  });

  afterEach("revert", reverter.revert);

  describe("util functions", async () => {
    it("should set URI", async () => {
      assert.equal(await bmiCoverStaking.uri(0), "0");

      await bmiCoverStaking.setBaseURI("https://token-cdn-domain/");

      assert.equal(await bmiCoverStaking.uri(0), "https://token-cdn-domain/0");
      assert.equal(await bmiCoverStaking.uri(1337), "https://token-cdn-domain/1337");
    });
  });

  describe("stakeBMIX", async () => {
    it("should fail due to insufficient balance", async () => {
      await truffleAssert.reverts(
        bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address, { from: NOTHING }),
        "ERC20: transfer amount exceeds balance"
      );
    });

    it("should fail due to insufficient allowance", async () => {
      await truffleAssert.reverts(
        bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address),
        "ERC20: transfer amount exceeds allowance"
      );
    });

    it("should fail because PolicyBook is not whitelisted", async () => {
      await policyBookAdmin.whitelist(policyBook.address, false);

      await truffleAssert.reverts(
        bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address),
        "BDS: PB is not whitelisted"
      );
    });

    it("should fail if stake 0", async () => {
      await truffleAssert.reverts(
        bmiCoverStaking.stakeBMIX(0, policyBook.address, { from: NOTHING }),
        "BDS: Zero tokens"
      );
    });

    it("should mint new NFT", async () => {
      await bmiCoverStaking.setBaseURI("https://token-cdn-domain/");

      await policyBook.approve(bmiCoverStaking.address, wei("1000"));

      const result = await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);

      assert.equal((await bmiCoverStaking.stakingInfoByToken(1)).stakedBMIXAmount, wei("1000"));
      assert.equal(await bmiCoverStaking.balanceOf(MAIN), 1);
      assert.equal(await bmiCoverStaking.ownerOf(1), MAIN);

      await policyBook.approve(bmiCoverStaking.address, wei("1000")); // just for a new block

      const info = await bmiCoverStaking.stakingInfoByStaker(MAIN, [policyBook.address], 0, 1);

      assert.equal(info.policyBooksInfo.length, 1);
      assert.equal(toBN(info.policyBooksInfo[0].totalStakedSTBL).toString(), toBN(wei("1000")).toString());
      assert.equal(
        toBN(info.policyBooksInfo[0].rewardPerBlock).toString(),
        toBN(wei("100")).times(PRECISION).toString()
      );
      assert.equal(
        toBN(info.policyBooksInfo[0].stakingAPY).toString(),
        toBN(await bmiCoverStaking.getPolicyBookAPY(policyBook.address)).toString()
      );
      assert.equal(toBN(info.policyBooksInfo[0].liquidityAPY).toString(), toBN(await policyBook.getAPY()).toString());

      assert.equal(info.usersInfo.length, 1);
      assert.equal(toBN(info.usersInfo[0].totalStakedBMIX).toString(), toBN(wei("1000")).toString());
      assert.equal(toBN(info.usersInfo[0].totalStakedSTBL).toString(), toBN(wei("1000")).toString());
      assert.closeTo(
        toBN(info.usersInfo[0].totalBmiReward).toNumber(),
        toBN(wei("100")).toNumber(),
        toBN(wei("0.00001")).toNumber()
      );

      assert.equal(info.nftsCount.length, 1);
      assert.equal(info.nftsCount[0], 1);

      assert.equal(info.nftsInfo.length, 1);
      assert.equal(info.nftsInfo[0].length, 1);
      assert.equal(info.nftsInfo[0][0].nftIndex, 1);
      assert.equal(info.nftsInfo[0][0].uri, "https://token-cdn-domain/1");
      assert.equal(toBN(info.nftsInfo[0][0].stakedBMIXAmount).toString(), toBN(wei("1000")).toString());
      assert.equal(toBN(info.nftsInfo[0][0].stakedSTBLAmount).toString(), toBN(wei("1000")).toString());
      assert.closeTo(
        toBN(info.nftsInfo[0][0].reward).toNumber(),
        toBN(wei("100")).toNumber(),
        toBN(wei("0.00001")).toNumber()
      );

      assert.equal(result.logs.length, 2);
      assert.equal(result.logs[1].event, "StakingNFTMinted");
      assert.equal(result.logs[1].args.id, 1);
      assert.equal(result.logs[1].args.policyBookAddress, policyBook.address);
      assert.equal(result.logs[1].args.to, MAIN);
    });

    it("should mint new NFTs", async () => {
      await policyBook.approve(bmiCoverStaking.address, wei("1000"));
      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);

      await policyBook.approve(bmiCoverStaking.address, wei("999"));
      await bmiCoverStaking.stakeBMIX(wei("999"), policyBook.address);

      await policyBook.approve(bmiCoverStaking.address, wei("998"));
      await bmiCoverStaking.stakeBMIX(wei("998"), policyBook.address);

      assert.equal(await bmiCoverStaking.balanceOf(MAIN), 3);
      assert.equal((await bmiCoverStaking.stakingInfoByToken(1)).stakedBMIXAmount, wei("1000"));
      assert.equal((await bmiCoverStaking.stakingInfoByToken(2)).stakedBMIXAmount, wei("999"));
      assert.equal((await bmiCoverStaking.stakingInfoByToken(3)).stakedBMIXAmount, wei("998"));
      assert.equal(await bmiCoverStaking.ownerOf(1), MAIN);
      assert.equal(await bmiCoverStaking.ownerOf(2), MAIN);
      assert.equal(await bmiCoverStaking.ownerOf(3), MAIN);
    });

    it("should mint new NFTs and then aggregate into a single one", async () => {
      await policyBook.approve(bmiCoverStaking.address, wei("1000"));
      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);

      await policyBook.approve(bmiCoverStaking.address, wei("999"));
      await bmiCoverStaking.stakeBMIX(wei("999"), policyBook.address);

      await policyBook.approve(bmiCoverStaking.address, wei("998"));
      await bmiCoverStaking.stakeBMIX(wei("998"), policyBook.address);

      await bmiCoverStaking.aggregateNFTs(policyBook.address, [1, 2, 3]);

      assert.equal(await bmiCoverStaking.balanceOf(MAIN), 1);
      assert.equal((await bmiCoverStaking.stakingInfoByToken(4)).stakedBMIXAmount, wei("2997"));
      assert.equal(await bmiCoverStaking.ownerOf(4), MAIN);
    });

    it("should transfer BMIX tokens to Staking", async () => {
      await policyBook.approve(bmiCoverStaking.address, wei("1000"));

      assert.equal(await policyBook.balanceOf(bmiCoverStaking.address), 0);
      assert.equal(toBN(await policyBook.balanceOf(MAIN)).toString(), toBN(wei("1001000")).toString());

      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);

      assert.equal(await policyBook.balanceOf(bmiCoverStaking.address), wei("1000"));
      assert.equal(toBN(await policyBook.balanceOf(MAIN)).toString(), toBN(wei("1000000")).toString());
    });

    it("should be able to withdraw", async () => {
      await bmiMock.mintArbitrary(bmiCoverStaking.address, wei("10000"));
      await policyBook.approve(bmiCoverStaking.address, wei("2000"));
      await liquidityMiningMock.setStartTime(1);

      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);

      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);

      await bmiCoverStaking.aggregateNFTs(policyBook.address, [1, 2]);

      assert.equal(await bmiCoverStaking.balanceOf(MAIN), 1); // after aggregate, user can only have 1 nft
      assert.equal(await bmiCoverStaking.ownerOf(3), MAIN);

      await bmiCoverStaking.withdrawFundsWithProfit(3);
    });

    it("should correctly calculate slashing percentage", async () => {
      await policyBook.approve(bmiCoverStaking.address, wei("1000"));
      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);

      await policyBook.approve(bmiCoverStaking.address, wei("999"));
      await bmiCoverStaking.stakeBMIX(wei("999"), policyBook.address);

      await policyBook.approve(bmiCoverStaking.address, wei("998"));
      await bmiCoverStaking.stakeBMIX(wei("998"), policyBook.address);

      await setCurrentTime(50 * 24 * 60 * 60);

      const slashingPercentage = await bmiCoverStaking.getSlashingPercentage();

      // data needed to get slashing percentage
      const startTime = await liquidityMiningMock.getStartTime();

      const MAX_EXIT_FEE = toBN(90).times(PRECISION);
      const MIN_EXIT_FEE = toBN(20).times(PRECISION);
      const EXIT_FEE_DURATION = 100 * 24 * 60 * 60; // 100 days in seconds

      const blockTimestamp = toBN(await getCurrentBlockTimestamp());

      const feeSpan = MAX_EXIT_FEE.minus(MIN_EXIT_FEE);
      const feePerSecond = feeSpan.dividedToIntegerBy(EXIT_FEE_DURATION);
      const fee = BigNumber.min(blockTimestamp.minus(startTime).times(feePerSecond), feeSpan);
      const calculatedSlashingPercentage = MAX_EXIT_FEE.minus(fee);

      assert.equal(slashingPercentage.toString(10), calculatedSlashingPercentage.toString(10));
    });

    it("should not be possible to aggregate NFT from different Policies", async () => {
      await policyBook.approve(bmiCoverStaking.address, wei("1000"));
      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);

      await policyBook.approve(bmiCoverStaking.address, wei("999"));
      await bmiCoverStaking.stakeBMIX(wei("999"), policyBook.address);

      await policyBook.approve(bmiCoverStaking.address, wei("998"));
      await bmiCoverStaking.stakeBMIX(wei("998"), policyBook.address);

      // PolicyBook 2
      await policyBook2.approve(bmiCoverStaking.address, wei("1000"));
      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook2.address);

      await policyBook2.approve(bmiCoverStaking.address, wei("999"));
      await bmiCoverStaking.stakeBMIX(wei("999"), policyBook2.address);

      await policyBook2.approve(bmiCoverStaking.address, wei("998"));
      await bmiCoverStaking.stakeBMIX(wei("998"), policyBook2.address);

      const infoToken1 = await bmiCoverStaking.stakingInfoByToken(1);
      assert.equal(infoToken1.policyBookAddress, policyBook.address);

      const infoToken4 = await bmiCoverStaking.stakingInfoByToken(4);
      assert.equal(infoToken4.policyBookAddress, policyBook2.address);

      const nftPolicyBook = await bmiCoverStaking.policyBookByNFT(4);
      assert.equal(nftPolicyBook, policyBook2.address);

      // only aggregate nfts from the same policy
      await truffleAssert.reverts(
        bmiCoverStaking.aggregateNFTs(policyBook.address, [4, 5, 6]),
        "BDS: NFTs from distinct origins"
      );

      await truffleAssert.reverts(
        bmiCoverStaking.aggregateNFTs(policyBook.address, [1, 2, 6]),
        "BDS: NFTs from distinct origins"
      );

      await truffleAssert.reverts(
        bmiCoverStaking.aggregateNFTs(policyBook.address, [5, 1, 2]),
        "BDS: NFTs from distinct origins"
      );

      await truffleAssert.reverts(
        bmiCoverStaking.aggregateNFTs(policyBook.address, [1, 4, 3]),
        "BDS: NFTs from distinct origins"
      );

      await bmiCoverStaking.aggregateNFTs(policyBook2.address, [4, 5]);

      //after aggregate, number of nfts should decrease
      assert.equal(await bmiCoverStaking.balanceOf(MAIN), 5);
      await truffleAssert.reverts(bmiCoverStaking.stakingInfoByToken(4), "BDS: Token doesn't exist");
      await truffleAssert.reverts(bmiCoverStaking.stakingInfoByToken(5), "BDS: Token doesn't exist");

      await bmiCoverStaking.aggregateNFTs(policyBook2.address, [6, 7]);

      // after aggregating, nft token id should be deleted
      await truffleAssert.reverts(bmiCoverStaking.stakingInfoByToken(7), "BDS: Token doesn't exist");

      const infoToken8 = await bmiCoverStaking.stakingInfoByToken(8);
      assert.equal(infoToken8.policyBookAddress, policyBook2.address);
    });
  });

  describe("extreme cases tests", async () => {
    it("everything should be ok if a user transfered NFT to zero address", async () => {
      await policyBook.approve(bmiCoverStaking.address, wei("2000"));

      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);

      await truffleAssert.reverts(bmiCoverStaking.safeTransferFrom(MAIN, ZERO, 1, 1, []), "ERC1155: zero address");
    });

    it("everything should be ok if a user transfered NFT to a different user", async () => {
      await policyBook.approve(bmiCoverStaking.address, wei("2000"));
      await policyBook.approve(bmiCoverStaking.address, wei("2000"), { from: HELP });

      assert.equal(await bmiCoverStaking.totalStaked(MAIN), 0);

      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);
      await bmiCoverStaking.stakeBMIX(wei("999"), policyBook.address);

      assert.equal(await bmiCoverStaking.totalStaked(MAIN), wei("1999"));

      await bmiCoverStaking.stakeBMIX(wei("500"), policyBook.address, { from: HELP });
      await bmiCoverStaking.stakeBMIX(wei("499"), policyBook.address, { from: HELP });

      assert.equal(await bmiCoverStaking.totalStaked(HELP), wei("999"));

      await bmiCoverStaking.safeTransferFrom(MAIN, HELP, 1, 1, []);

      assert.equal(await bmiCoverStaking.totalStaked(MAIN), wei("999"));
      assert.equal(await bmiCoverStaking.totalStaked(HELP), wei("1999"));
    });

    it("should aggregate NFTs correctly", async () => {
      await policyBook.approve(bmiCoverStaking.address, wei("2000"));
      await policyBook.approve(bmiCoverStaking.address, wei("2000"), { from: HELP });

      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);
      await bmiCoverStaking.stakeBMIX(wei("999"), policyBook.address);

      await bmiCoverStaking.stakeBMIX(wei("500"), policyBook.address, { from: HELP });
      await bmiCoverStaking.stakeBMIX(wei("499"), policyBook.address, { from: HELP });

      await bmiCoverStaking.safeTransferFrom(MAIN, HELP, 1, 1, []);

      await bmiCoverStaking.aggregateNFTs(policyBook.address, [1, 3, 4], { from: HELP });

      assert.equal((await bmiCoverStaking.stakingInfoByToken(5)).stakedBMIXAmount, wei("1999"));
      assert.equal(await bmiCoverStaking.balanceOf(MAIN), 1);
      assert.equal(await bmiCoverStaking.balanceOf(HELP), 1);
    });
  });

  describe("restakeBMIProfit", async () => {
    it("should restake BMIs", async () => {
      await setCurrentTime(1);
      await liquidityMiningMock.setStartTime(1);

      await bmiMock.mintArbitrary(bmiCoverStaking.address, wei("10000"));
      await policyBook.approve(bmiCoverStaking.address, wei("1000"));

      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);

      await advanceBlocks(9);

      const staked = await bmiStaking.getStakedBMI(MAIN);
      assert.equal(toBN(staked).toString(), "0");

      await bmiCoverStaking.restakeBMIProfit(1);

      assert.closeTo(
        toBN(await bmiStaking.getStakedBMI(MAIN)).toNumber(),
        toBN(wei("1000")).toNumber(),
        toBN(wei("0.00001")).toNumber()
      );

      await truffleAssert.reverts(bmiCoverStaking.restakeBMIProfit(2), "BDS: Token doesn't exist");
    });

    it("should restake all BMIs", async () => {
      await setCurrentTime(1);
      await liquidityMiningMock.setStartTime(1);

      await bmiMock.mintArbitrary(bmiCoverStaking.address, wei("10000"));
      await policyBook.approve(bmiCoverStaking.address, wei("1000"));

      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);

      await advanceBlocks(9);

      const staked = await bmiStaking.getStakedBMI(MAIN);
      assert.equal(staked, 0);

      await bmiCoverStaking.restakeStakerBMIProfit(policyBook.address);

      assert.closeTo(
        toBN(await bmiStaking.getStakedBMI(MAIN)).toNumber(),
        toBN(wei("1000")).toNumber(),
        toBN(wei("0.00001")).toNumber()
      );
    });
  });

  describe("APY", async () => {
    it("should calculate correct APY", async () => {
      await policyBook.approve(bmiCoverStaking.address, wei("1000"));
      await bmiCoverStaking.stakeBMIX(wei("10"), policyBook.address);

      let APY = toBN(await bmiCoverStaking.getPolicyBookAPY(policyBook.address));

      assert.equal(APY.div(APY_PRECISION).toString(), "2140227272.72727");

      await policyBookAdmin.whitelist(policyBook.address, false);

      APY = toBN(await bmiCoverStaking.getPolicyBookAPY(policyBook.address));

      assert.equal(APY, 0);
    });
  });

  describe("withdrawBMIProfit", async () => {
    it("should revert due to nonexistent token", async () => {
      await truffleAssert.reverts(bmiCoverStaking.withdrawBMIProfit(1), "BDS: Token doesn't exist");
    });

    it("should revert due to different token ownership", async () => {
      await policyBook.approve(bmiCoverStaking.address, wei("1000"));

      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);

      await truffleAssert.reverts(bmiCoverStaking.withdrawBMIProfit(1, { from: HELP }), "BDS: Not a token owner");
    });

    it("should fail if stake to a non existing policy book", async () => {
      await policyBook.approve(bmiCoverStaking.address, wei("1000"));

      await truffleAssert.reverts(bmiCoverStaking.stakeBMIX(wei("1000"), HELP), "BDS: Not a PB");
    });

    it("should withdraw 100 BMI", async () => {
      await bmiMock.mintArbitrary(bmiCoverStaking.address, wei("10000"));
      await policyBook.approve(bmiCoverStaking.address, wei("1000"));

      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);
      const result = await bmiCoverStaking.withdrawBMIProfit(1);

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, "StakingBMIProfitWithdrawn");
      assert.equal(result.logs[0].args.id, 1);
      assert.equal(result.logs[0].args.policyBookAddress, policyBook.address);
      assert.closeTo(
        toBN(result.logs[0].args.amount).toNumber(),
        toBN(wei("10")).toNumber(),
        toBN(wei("0.0001")).toNumber()
      );
      assert.equal(result.logs[0].args.to, MAIN);
    });

    it("should withdraw all 100 BMI", async () => {
      await bmiMock.mintArbitrary(bmiCoverStaking.address, wei("10000"));
      await policyBook.approve(bmiCoverStaking.address, wei("1000"));

      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);
      const result = await bmiCoverStaking.withdrawStakerBMIProfit(policyBook.address);

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, "StakingBMIProfitWithdrawn");
      assert.equal(result.logs[0].args.id, 1);
      assert.equal(result.logs[0].args.policyBookAddress, policyBook.address);
      assert.closeTo(
        toBN(result.logs[0].args.amount).toNumber(),
        toBN(wei("10")).toNumber(),
        toBN(wei("0.0001")).toNumber()
      );
      assert.equal(result.logs[0].args.to, MAIN);
    });
  });

  describe("withdrawFundsWithProfit", async () => {
    it("should revert due to nonexistent token", async () => {
      await truffleAssert.reverts(bmiCoverStaking.withdrawFundsWithProfit(1), "BDS: Token doesn't exist");
    });

    it("should not fail", async () => {
      await bmiMock.mintArbitrary(bmiCoverStaking.address, wei("100"));

      await policyBook.approve(bmiCoverStaking.address, wei("1000"));

      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);

      await bmiCoverStaking.withdrawFundsWithProfit(1);
    });

    it("should revert due to different token owner", async () => {
      await policyBook.approve(bmiCoverStaking.address, wei("1000"));

      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);

      await truffleAssert.reverts(bmiCoverStaking.withdrawBMIProfit(1, { from: HELP }), "BDS: Not a token owner");
    });

    it("should withdraw funds, profit and burn NFT", async () => {
      await setCurrentTime(1);

      await bmiMock.mintArbitrary(bmiCoverStaking.address, wei("10000"));
      await policyBook.approve(bmiCoverStaking.address, wei("1000"));

      assert.equal(await policyBook.balanceOf(bmiCoverStaking.address), 0);
      assert.equal(toBN(await policyBook.balanceOf(MAIN)).toString(), toBN(wei("1001000")).toString());

      assert.equal(await stblMock.balanceOf(rewardsGenerator.address), 0);
      assert.equal(
        toBN(await stblMock.balanceOf(policyBook.address)).toString(),
        toBN(wei("2001000", "mwei")).toString()
      );

      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);

      assert.equal(toBN(await policyBook.balanceOf(bmiCoverStaking.address)).toString(), toBN(wei("1000")).toString());
      assert.equal(
        toBN(await stblMock.balanceOf(policyBook.address)).toString(),
        toBN(wei("2001000", "mwei")).toString()
      );

      assert.equal((await bmiCoverStaking.stakingInfoByToken(1)).stakedBMIXAmount, wei("1000"));
      assert.equal(await bmiCoverStaking.balanceOf(MAIN), 1);
      assert.equal(await bmiCoverStaking.ownerOf(1), MAIN);

      await liquidityMiningMock.setStartTime(1);
      await setCurrentTime(50 * 24 * 60 * 60);

      const result = await bmiCoverStaking.withdrawFundsWithProfit(1);

      assert.equal(await bmiCoverStaking.balanceOf(MAIN), 0);

      assert.equal(await policyBook.balanceOf(bmiCoverStaking.address), 0);
      assert.equal(toBN(await policyBook.balanceOf(MAIN)).toString(), toBN(wei("1001000")).toString());

      assert.equal(result.logs.length, 4);
      assert.equal(result.logs[0].event, "StakingBMIProfitWithdrawn");
      assert.equal(result.logs[0].args.policyBookAddress, policyBook.address);
      assert.equal(result.logs[0].args.id, 1);
      assert.equal(result.logs[0].args.to, MAIN);
      assert.closeTo(
        toBN(result.logs[0].args.amount).toNumber(),
        toBN(wei("135")).toNumber(),
        toBN(wei("0.001")).toNumber()
      ); // slashed 45%

      assert.equal(result.logs[1].event, "StakingFundsWithdrawn");
      assert.equal(result.logs[1].args.policyBookAddress, policyBook.address);
      assert.equal(result.logs[1].args.id, 1);
      assert.equal(result.logs[1].args.to, MAIN);

      assert.equal(result.logs[3].event, "StakingNFTBurned");
      assert.equal(result.logs[3].args.id, 1);
      assert.equal(result.logs[3].args.policyBookAddress, policyBook.address);
    });

    it("should withdraw all funds, all profit and burn NFT", async () => {
      await setCurrentTime(1);

      await bmiMock.mintArbitrary(bmiCoverStaking.address, wei("10000"));
      await policyBook.approve(bmiCoverStaking.address, wei("2000"));

      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);

      await liquidityMiningMock.setStartTime(1);

      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);

      const result = await bmiCoverStaking.withdrawStakerFundsWithProfit(policyBook.address);

      assert.equal(await bmiCoverStaking.balanceOf(MAIN), 0);

      assert.equal(await policyBook.balanceOf(bmiCoverStaking.address), 0);
      assert.equal(toBN(await policyBook.balanceOf(MAIN)).toString(), toBN(wei("1001000")).toString());

      assert.equal(result.logs.length, 8);
      assert.equal(result.logs[0].event, "StakingBMIProfitWithdrawn");
      assert.equal(result.logs[0].args.policyBookAddress, policyBook.address);
      assert.equal(result.logs[0].args.id, 2);
      assert.equal(result.logs[0].args.to, MAIN);
      assert.closeTo(
        toBN(result.logs[0].args.amount).toNumber(),
        toBN(wei("5")).toNumber(),
        toBN(wei("0.00001")).toNumber()
      ); // slashed 90% (shared 1 block with 2)

      assert.equal(result.logs[1].event, "StakingFundsWithdrawn");
      assert.equal(result.logs[1].args.policyBookAddress, policyBook.address);
      assert.equal(result.logs[1].args.id, 2);
      assert.equal(result.logs[1].args.to, MAIN);

      assert.equal(result.logs[3].event, "StakingNFTBurned");
      assert.equal(result.logs[3].args.id, 2);
      assert.equal(result.logs[3].args.policyBookAddress, policyBook.address);

      assert.equal(result.logs[4].event, "StakingBMIProfitWithdrawn");
      assert.equal(result.logs[4].args.policyBookAddress, policyBook.address);
      assert.equal(result.logs[4].args.id, 1);
      assert.equal(result.logs[4].args.to, MAIN);
      assert.closeTo(
        toBN(result.logs[4].args.amount).toNumber(),
        toBN(wei("25")).toNumber(),
        toBN(wei("0.0001")).toNumber()
      ); // slashed 90% (shared 1 block with 2)

      assert.equal(result.logs[5].event, "StakingFundsWithdrawn");
      assert.equal(result.logs[5].args.policyBookAddress, policyBook.address);
      assert.equal(result.logs[5].args.id, 1);
      assert.equal(result.logs[5].args.to, MAIN);

      assert.equal(result.logs[7].event, "StakingNFTBurned");
      assert.equal(result.logs[7].args.id, 1);
      assert.equal(result.logs[7].args.policyBookAddress, policyBook.address);
    });
  });

  describe("slashing", async () => {
    it("should be 90%", async () => {
      await setCurrentTime(1);
      await liquidityMiningMock.setStartTime(1);

      await bmiMock.mintArbitrary(bmiCoverStaking.address, wei("10000"));
      await policyBook.approve(bmiCoverStaking.address, wei("1000"));

      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);

      await advanceBlocks(10);

      const reward = toBN(await bmiCoverStaking.getSlashedBMIProfit(1));
      const reward2 = toBN(await bmiCoverStaking.getSlashedStakerBMIProfit(MAIN, policyBook.address, 0, 1));

      assert.equal(reward.toString(), wei("100"));
      assert.equal(reward.toString(), reward2.toString());
    });

    it("should be 45%", async () => {
      await setCurrentTime(1);
      await liquidityMiningMock.setStartTime(1);

      await bmiMock.mintArbitrary(bmiCoverStaking.address, wei("10000"));
      await policyBook.approve(bmiCoverStaking.address, wei("1000"));

      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);

      await advanceBlocks(9);
      await setCurrentTime(50 * 24 * 60 * 60); // 50 days

      assert.closeTo(
        toBN(await bmiCoverStaking.getSlashedBMIProfit(1)).toNumber(),
        toBN(wei("450")).toNumber(),
        toBN(wei("0.0001")).toNumber()
      );
    });

    it("should be 20%", async () => {
      await setCurrentTime(1);
      await liquidityMiningMock.setStartTime(1);

      await bmiMock.mintArbitrary(bmiCoverStaking.address, wei("10000"));
      await policyBook.approve(bmiCoverStaking.address, wei("1000"));

      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);

      await advanceBlocks(9);
      await setCurrentTime(200 * 24 * 60 * 60); // 200 days

      const reward = toBN(await bmiCoverStaking.getSlashedBMIProfit(1));

      assert.equal(reward.toString(), wei("800"));
    });
  });

  describe("stakeWithPermit", async () => {
    it("should stake with permit", async () => {
      const buffer = Buffer.from(MAIN_PRIVATE_KEY, "hex");
      const contractData = { name: await policyBook.symbol(), verifyingContract: policyBook.address };

      const transactionData = {
        owner: MAIN,
        spender: bmiCoverStaking.address,
        value: wei("1000"),
      };

      const { v, r, s } = sign2612(contractData, transactionData, buffer);

      const balance = toBN(await policyBook.balanceOf(MAIN));
      assert.equal(await bmiCoverStaking.balanceOf(MAIN), 0);

      await bmiCoverStaking.stakeBMIXWithPermit(wei("1000"), policyBook.address, v, r, s);

      assert.equal(balance.minus(wei("1000")).toString(), toBN(await policyBook.balanceOf(MAIN)).toString());
      assert.equal(await bmiCoverStaking.balanceOf(MAIN), 1);
    });

    it("should fail if stake with permit 0 tokens", async () => {
      const buffer = Buffer.from(MAIN_PRIVATE_KEY, "hex");
      const contractData = { name: await policyBook.symbol(), verifyingContract: policyBook.address };

      const transactionData = {
        owner: MAIN,
        spender: bmiCoverStaking.address,
        value: wei("0"),
      };

      const { v, r, s } = sign2612(contractData, transactionData, buffer);

      await truffleAssert.reverts(
        bmiCoverStaking.stakeBMIXWithPermit(wei("0"), policyBook.address, v, r, s),
        "BDS: Zero tokens"
      );
    });
  });

  describe("Fail tests", async () => {
    it("should fail when aggregate NFT using wrong conditions", async () => {
      await policyBook.approve(bmiCoverStaking.address, wei("1000"));
      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);

      await policyBook.approve(bmiCoverStaking.address, wei("999"));
      await bmiCoverStaking.stakeBMIX(wei("999"), policyBook.address);

      await policyBook.approve(bmiCoverStaking.address, wei("998"));
      await bmiCoverStaking.stakeBMIX(wei("998"), policyBook.address);

      // only owner can aggregate nfts
      await truffleAssert.reverts(
        bmiCoverStaking.aggregateNFTs(policyBook.address, [1, 2], { from: NOTHING }),
        "BDS: Not a token owner"
      );

      // should revert if it isn't a policy book
      await truffleAssert.reverts(bmiCoverStaking.aggregateNFTs(HELP, [2, 3]), "BDS: Not a PB");

      await truffleAssert.reverts(bmiCoverStaking.aggregateNFTs(policyBook.address, [4]), "BDS: Can't aggregate");

      await truffleAssert.reverts(bmiCoverStaking.aggregateNFTs(policyBook.address, []), "BDS: Can't aggregate");

      await truffleAssert.reverts(
        bmiCoverStaking.aggregateNFTs(policyBook.address, [1, 2, 3, 4]),
        "EnumerableMap: nonexistent key"
      );

      await truffleAssert.reverts(bmiCoverStaking.stakingInfoByToken(10), "BDS: Token doesn't exist");

      await truffleAssert.reverts(bmiCoverStaking.stakingInfoByToken(0), "BDS: Token doesn't exist");

      const nonExistingPolicyBook = await bmiCoverStaking.policyBookByNFT(10);
      assert.equal(nonExistingPolicyBook, ZERO);
    });
  });

  describe("migrate", async () => {
    it("should test migration exhaustively", async () => {
      await bmiMock.mintArbitrary(bmiCoverStaking.address, wei("100000"));

      await setCurrentTime(1);
      await liquidityMiningMock.setStartTime(1);

      await policyBook.approve(bmiCoverStaking.address, wei("1000"));
      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);

      await policyBook.approve(bmiCoverStaking.address, wei("1000"));
      await bmiCoverStaking.stakeBMIX(wei("1000"), policyBook.address);

      await advanceBlocks(100);
      await setCurrentTime(100 * 24 * 60 * 60 + 100); // 100 days + 100 seconds

      const reward1 = toBN(await bmiCoverStaking.getBMIProfit(1));

      assert.closeTo(reward1.toNumber(), toBN(wei("5250")).toNumber(), toBN(wei("0.0000001")).toNumber());

      const reward2 = toBN(await bmiCoverStaking.getBMIProfit(2));

      assert.closeTo(reward2.toNumber(), toBN(wei("5050")).toNumber(), toBN(wei("0.0000001")).toNumber());

      await rewardsGenerator.reset(policyBook.address, 1);

      await truffleAssert.reverts(bmiCoverStaking.restakeBMIProfit(1), "RewardsGenerator: Not staked");
      await truffleAssert.reverts(bmiCoverStaking.withdrawBMIProfit(1), "RewardsGenerator: Not staked");
      await truffleAssert.reverts(
        bmiCoverStaking.aggregateNFTs(policyBook.address, [1, 2]),
        "RewardsGenerator: Aggregated not staked"
      );

      await rewardsGenerator.reset(policyBook.address, 2);

      assert.equal(toBN(await bmiCoverStaking.getBMIProfit(1)).toString(), "0");
      assert.equal(toBN(await bmiCoverStaking.getBMIProfit(2)).toString(), "0");

      await policyBook.forceUpdateBMICoverStakingRewardMultiplier();

      await rewardsGenerator.migrationStake(policyBook.address, 1, wei("1000"), reward1.toFixed(), {
        from: LEGACY_REWARDS_GENERATOR,
      });

      await rewardsGenerator.migrationStake(policyBook.address, 2, wei("1000"), reward2.toFixed(), {
        from: LEGACY_REWARDS_GENERATOR,
      });

      assert.closeTo(
        toBN(await bmiCoverStaking.getBMIProfit(1)).toNumber(),
        reward1.plus(wei("100")).toNumber(),
        toBN(wei("0.0000001")).toNumber()
      );

      assert.closeTo(
        toBN(await bmiCoverStaking.getBMIProfit(2)).toNumber(),
        reward2.toNumber(),
        toBN(wei("0.0000001")).toNumber()
      );

      await bmiCoverStaking.aggregateNFTs(policyBook.address, [1, 2]);

      assert.closeTo(
        toBN(await bmiCoverStaking.getBMIProfit(3)).toNumber(),
        toBN(wei("10500")).toNumber(),
        toBN(wei("0.0000001")).toNumber()
      );

      // nothing should change except the reward (1 block passes here)
      await policyBook.forceUpdateBMICoverStakingRewardMultiplier({ from: HELP });

      const result = await bmiCoverStaking.withdrawFundsWithProfit(3);

      assert.equal(result.logs.length, 4);
      assert.equal(result.logs[0].event, "StakingBMIProfitWithdrawn");
      assert.equal(result.logs[0].args.policyBookAddress, policyBook.address);
      assert.equal(result.logs[0].args.id, 3);
      assert.equal(result.logs[0].args.to, MAIN);
      assert.closeTo(
        toBN(result.logs[0].args.amount).toNumber(),
        toBN(wei("8560")).toNumber(),
        toBN(wei("0.000001")).toNumber()
      ); // slashed 20%

      assert.equal(result.logs[1].event, "StakingFundsWithdrawn");
      assert.equal(result.logs[1].args.policyBookAddress, policyBook.address);
      assert.equal(result.logs[1].args.id, 3);
      assert.equal(result.logs[1].args.to, MAIN);
    });
  });
});
