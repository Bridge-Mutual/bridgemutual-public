const { logTransaction, logAddress } = require("./helpers/logger.js");

const Proxy = artifacts.require("TransparentUpgradeableProxy");
const ContractsRegistry = artifacts.require("ContractsRegistry");

const PriceFeed = artifacts.require("PriceFeed");

const PolicyBookRegistry = artifacts.require("PolicyBookRegistry");
const PolicyRegistry = artifacts.require("PolicyRegistry");
const ClaimingRegistry = artifacts.require("ClaimingRegistry");
const LiquidityRegistry = artifacts.require("LiquidityRegistry");

const BMICoverStaking = artifacts.require("BMICoverStaking");
const RewardsGenerator = artifacts.require("RewardsGenerator");

const BMIStaking = artifacts.require("BMIStaking");
const STKBMIToken = artifacts.require("STKBMIToken");

const BMIUtilityNFT = artifacts.require("BMIUtilityNFT");
const LiquidityMining = artifacts.require("LiquidityMining");

const LiquidityMiningStaking = artifacts.require("LiquidityMiningStaking");

const ClaimVoting = artifacts.require("ClaimVoting");
const ReputationSystem = artifacts.require("ReputationSystem");
const ReinsurancePool = artifacts.require("ReinsurancePool");
const VBMI = artifacts.require("VBMI");

const PolicyBookImpl = artifacts.require("PolicyBook");
const PolicyBookFabric = artifacts.require("PolicyBookFabric");
const PolicyBookAdmin = artifacts.require("PolicyBookAdmin");
const PolicyQuote = artifacts.require("PolicyQuote");

const team = [
  "0x2C6b033790F3492188A13902a438EF6Ddb6A48b1",
  "0xfe8be8ddcc9b4b022b421c17e16602be48dd4c65",
  "0x2B63c26f08dafFa95f700151B669cb3976eF94Bc",
  "0xEE1558fd89567D662bF62F55990bEbC24852A0f7",
  "0xCDb942Cdf9A393f1309B3D6505C597e9E70ba0a8",
];

module.exports = async (deployer) => {
  const contractsRegistry = await ContractsRegistry.at((await Proxy.deployed()).address);

  const priceFeed = await PriceFeed.at(await contractsRegistry.getPriceFeedContract());

  const policyBookRegistry = await PolicyBookRegistry.at(await contractsRegistry.getPolicyBookRegistryContract());
  const policyRegistry = await PolicyRegistry.at(await contractsRegistry.getPolicyRegistryContract());
  const claimingRegistry = await ClaimingRegistry.at(await contractsRegistry.getClaimingRegistryContract());
  const liquidityRegistry = await LiquidityRegistry.at(await contractsRegistry.getLiquidityRegistryContract());

  const bmiCoverStaking = await BMICoverStaking.at(await contractsRegistry.getBMICoverStakingContract());
  const rewardsGenerator = await RewardsGenerator.at(await contractsRegistry.getRewardsGeneratorContract());

  const bmiStaking = await BMIStaking.at(await contractsRegistry.getBMIStakingContract());
  const stkBMIToken = await STKBMIToken.at(await contractsRegistry.getSTKBMIContract());

  const bmiUtilityNFT = await BMIUtilityNFT.at(await contractsRegistry.getBMIUtilityNFTContract());
  const liquidityMining = await LiquidityMining.at(await contractsRegistry.getLiquidityMiningContract());

  const liquidityMiningStaking = await LiquidityMiningStaking.at(
    await contractsRegistry.getLiquidityMiningStakingContract()
  );

  const claimVoting = await ClaimVoting.at(await contractsRegistry.getClaimVotingContract());
  const reputationSystem = await ReputationSystem.at(await contractsRegistry.getReputationSystemContract());
  const reinsurancePool = await ReinsurancePool.at(await contractsRegistry.getReinsurancePoolContract());
  const vBMI = await VBMI.at(await contractsRegistry.getVBMIContract());

  const policyBookFabric = await PolicyBookFabric.at(await contractsRegistry.getPolicyBookFabricContract());
  const policyBookAdmin = await PolicyBookAdmin.at(await contractsRegistry.getPolicyBookAdminContract());
  const policyQuote = await PolicyQuote.at(await contractsRegistry.getPolicyQuoteContract());

  ////////////////////////////////////////////////////////////

  console.log();

  logTransaction(await claimingRegistry.__ClaimingRegistry_init(), "Init ClaimingRegistry");

  logTransaction(await bmiCoverStaking.__BMICoverStaking_init(), "Init BMICoverStaking");
  logTransaction(await rewardsGenerator.__RewardsGenerator_init(), "Init RewardsGenerator");

  logTransaction(await bmiStaking.__BMIStaking_init(0), "Init BMIStaking");
  logTransaction(await stkBMIToken.__STKBMIToken_init(), "Init STKBMIToken");

  logTransaction(await bmiUtilityNFT.__BMIUtilityNFT_init(), "Init BMIUtilityNFT");
  logTransaction(await liquidityMining.__LiquidityMining_init(), "Init LiquidityMining");

  logTransaction(await liquidityMiningStaking.__LiquidityMiningStaking_init(), "Init LiquidityMiningStaking");

  logTransaction(await claimVoting.__ClaimVoting_init(), "Init ClaimVoting");
  logTransaction(await reputationSystem.__ReputationSystem_init(team), "Init ReputationSystem");
  logTransaction(await reinsurancePool.__ReinsurancePool_init(), "Init ReinsurancePool");
  logTransaction(await vBMI.__VBMI_init(), "Init VBMI");

  logTransaction(
    await policyBookAdmin.__PolicyBookAdmin_init((await PolicyBookImpl.deployed()).address),
    "Init PolicyBookAdmin"
  );

  ////////////////////////////////////////////////////////////

  console.log();

  logTransaction(
    await contractsRegistry.injectDependencies(await contractsRegistry.PRICE_FEED_NAME()),
    "Inject PriceFeed"
  );

  logTransaction(
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_REGISTRY_NAME()),
    "Inject PolicyRegistry"
  );
  logTransaction(
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_REGISTRY_NAME()),
    "Inject PolicyBookRegistry"
  );
  logTransaction(
    await contractsRegistry.injectDependencies(await contractsRegistry.CLAIMING_REGISTRY_NAME()),
    "Inject ClaimingRegistry"
  );
  logTransaction(
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_REGISTRY_NAME()),
    "Inject LiquidityRegistry"
  );

  logTransaction(
    await contractsRegistry.injectDependencies(await contractsRegistry.BMI_COVER_STAKING_NAME()),
    "Inject BMICoverStaking"
  );
  logTransaction(
    await contractsRegistry.injectDependencies(await contractsRegistry.REWARDS_GENERATOR_NAME()),
    "Inject RewardsGenerator"
  );

  logTransaction(
    await contractsRegistry.injectDependencies(await contractsRegistry.BMI_STAKING_NAME()),
    "Inject BMIStaking"
  );
  logTransaction(
    await contractsRegistry.injectDependencies(await contractsRegistry.STKBMI_NAME()),
    "Inject STKBMIToken"
  );

  logTransaction(
    await contractsRegistry.injectDependencies(await contractsRegistry.BMI_UTILITY_NFT_NAME()),
    "Inject BMIUtilityNFT"
  );

  logTransaction(
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_MINING_NAME()),
    "Inject LiquidityMining"
  );

  logTransaction(
    await contractsRegistry.injectDependencies(await contractsRegistry.LIQUIDITY_MINING_STAKING_NAME()),
    "Inject LiquidityMiningStaking"
  );

  logTransaction(
    await contractsRegistry.injectDependencies(await contractsRegistry.CLAIM_VOTING_NAME()),
    "Inject ClaimVoting"
  );
  logTransaction(
    await contractsRegistry.injectDependencies(await contractsRegistry.REPUTATION_SYSTEM_NAME()),
    "Inject ReputationSystem"
  );
  logTransaction(
    await contractsRegistry.injectDependencies(await contractsRegistry.REINSURANCE_POOL_NAME()),
    "Inject ReinsurancePool"
  );
  logTransaction(await contractsRegistry.injectDependencies(await contractsRegistry.VBMI_NAME()), "Inject VBMI");

  logTransaction(
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_FABRIC_NAME()),
    "Inject PolicyBookFabric"
  );
  logTransaction(
    await contractsRegistry.injectDependencies(await contractsRegistry.POLICY_BOOK_ADMIN_NAME()),
    "Inject PolicyBookAdmin"
  );

  ////////////////////////////////////////////////////////////

  console.log("\n+--------------------------------------------------------------------------------+\n");

  logAddress("ContractsRegistry", contractsRegistry.address);

  logAddress("PriceFeed", priceFeed.address);

  logAddress("PolicyBookRegistry", policyBookRegistry.address);
  logAddress("PolicyRegistry", policyRegistry.address);
  logAddress("ClaimingRegistry", claimingRegistry.address);
  logAddress("LiquidityRegistry", liquidityRegistry.address);

  logAddress("BMICoverStaking", bmiCoverStaking.address);
  logAddress("RewardsGenerator", rewardsGenerator.address);

  logAddress("BMIStaking", bmiStaking.address);
  logAddress("STKBMIToken", stkBMIToken.address);

  logAddress("BMIUtilityNFT", bmiUtilityNFT.address);
  logAddress("LiquidityMining", liquidityMining.address);

  logAddress("LiquidityMiningStaking", liquidityMiningStaking.address);

  logAddress("ClaimVoting", claimVoting.address);
  logAddress("ReputationSystem", reputationSystem.address);
  logAddress("ReinsurancePool", reinsurancePool.address);
  logAddress("VBMI", vBMI.address);

  logAddress("PolicyBookFabric", policyBookFabric.address);
  logAddress("PolicyBookAdmin", policyBookAdmin.address);
  logAddress("PolicyQuote", policyQuote.address);

  console.log("+--------------------------------------------------------------------------------+");
};
