/*
 * Script that creates and whitelists PolicyBooks (to set up the app)
 *
 * Usage:
 * truffle exec scripts/policyBooksCreation.js [--network development]
 */

const Proxy = artifacts.require("TransparentUpgradeableProxy");
const ContractsRegistry = artifacts.require("ContractsRegistry");

const PolicyBookFabric = artifacts.require("PolicyBookFabric");
const PolicyBookRegistry = artifacts.require("PolicyBookRegistry");

const ContractType = {
  CONTRACT: 0,
  STABLECOIN: 1,
  SERVICE: 2,
  EXCHANGE: 3,
};

function logTransaction(tx, name) {
  console.log(`Transaction ${name}: gas used ${tx.receipt.gasUsed}, hash ${tx.tx}`);
}

module.exports = async (callback) => {
  const contractsRegistry = await ContractsRegistry.at("0x8050c5a46FC224E3BCfa5D7B7cBacB1e4010118d");

  const policyBookFabric = await PolicyBookFabric.at(await contractsRegistry.getPolicyBookFabricContract());
  const policyBookRegistry = await PolicyBookRegistry.at(await contractsRegistry.getPolicyBookRegistryContract());

  const addressesList = [
    "0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e",
    "0x3472a5a71965499acd81997a54bba8d852c6e53d",
    "0x6b3595068778dd592e39a122f4f5a5cf09c90fe2",
    "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9",
    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
    "0x1f573d6fb3f13d689ff844b4ce37794d79a7ff1c",
    "0xa1faa113cbe53436df28ff0aee54275c13b40975",
    "0xc00e94cb662c3520282e6f5717214004a7f26888",
    "0xd533a949740bb3306d119cc777fa900ba034cd52",
    "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0",
    "0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f",
    "0xfa5047c9c78b8877af97bdcb85db743fd7313d4a",
    "0xdbdb4d16eda451d0503b854cf79d55697f90c8df",
    "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2",
    "0x8888801af4d980682e47f1a9036e589479e835c5",
    "0x0258f474786ddfd37abce6df6bbb1dd5dfc4434a",
    "0x0391d2021f89dc339f60fff84546ea23e337750f",
    "0x2ba592f78db6436527729929aaf6c908497cb200",
    "0xf16e81dce15b08f326220742020379b855b87df9",
    "0x618679df9efcd19694bb1daa8d00718eacfa2883",
    "0xf0939011a9bb95c3b791f0cb546377ed2693a574",
  ];

  const contractTypes = [
    ContractType.CONTRACT,
    ContractType.CONTRACT,
    ContractType.CONTRACT,
    ContractType.CONTRACT,
    ContractType.CONTRACT,
    ContractType.CONTRACT,
    ContractType.CONTRACT,
    ContractType.CONTRACT,
    ContractType.CONTRACT,
    ContractType.CONTRACT,
    ContractType.CONTRACT,
    ContractType.CONTRACT,
    ContractType.CONTRACT,
    ContractType.CONTRACT,
    ContractType.CONTRACT,
    ContractType.CONTRACT,
    ContractType.CONTRACT,
    ContractType.CONTRACT,
    ContractType.CONTRACT,
    ContractType.CONTRACT,
    ContractType.CONTRACT,
  ];

  const poolDescriptions = [
    "Bridge Mutual Yearn Cover",
    "Bridge Mutual Badger DAO Cover",
    "Bridge Mutual SushiSwap Cover",
    "Bridge Mutual Aave Cover",
    "Bridge Mutual Uniswap Cover",
    "Bridge Mutual Bancor Cover",
    "Bridge Mutual AlphaHomora Cover",
    "Bridge Mutual Compound Cover",
    "Bridge Mutual Curve Finance Cover",
    "Bridge Mutual Polygon Cover",
    "Bridge Mutual Synthetix Cover",
    "Bridge Mutual Keeper DAO Cover",
    "Bridge Mutual Alchemix Cover",
    "Bridge Mutual Maker DAO Cover",
    "Bridge Mutual 88mph Cover",
    "Bridge Mutual Orion Cover",
    "Bridge Mutual BarnBridge Cover",
    "Bridge Mutual Cream Finance Cover",
    "Bridge Mutual Popscile Finance Cover",
    "Bridge Mutual Universe xyz Cover",
    "Bridge Mutual Zero Exchange Cover",
  ];

  // output -> bmiXCover
  const poolNames = [
    "Yearn",
    "BadgerDAO",
    "SushiSwap",
    "Aave",
    "Uniswap",
    "Bancor",
    "AlphaHomora",
    "Compound",
    "CurveFinance",
    "Polygon",
    "Synthetix",
    "KeeperDAO",
    "Alchemix",
    "MakerDAO",
    "88mph",
    "Orion",
    "BarnBridge",
    "CreamFinance",
    "PopscileFinance",
    "Universexyz",
    "ZeroExchange",
  ];

  if (
    addressesList.length != contractTypes.length ||
    addressesList.length != poolDescriptions.length ||
    addressesList.length != poolNames.length
  ) {
    console.log("Arrays length mismatch");
    return;
  }

  let policyBooks = [];

  for (let i = 0; i < addressesList.length; i++) {
    logTransaction(
      await policyBookFabric.create(addressesList[i], contractTypes[i], poolDescriptions[i], poolNames[i], 0),
      i + 1 + ") Creating bmi" + poolNames[i] + "Cover pool"
    );

    policyBooks.push(await policyBookRegistry.policyBookFor(addressesList[i]));
  }

  console.log();

  for (let i = 0; i < policyBooks.length; i++) {
    console.log("bmi" + poolNames[i] + "Cover: " + policyBooks[i]);
  }

  callback();
};
