/*
 * Script that checks the truffle deployed contract instances
 *
 * Usage:
 * truffle exec scripts/deploymentSmokeTest.js [--network development]
 */

const { assert } = require("chai");

const Proxy = artifacts.require("TransparentUpgradeableProxy");
const ContractsRegistry = artifacts.require("ContractsRegistry");

const PolicyBookRegistry = artifacts.require("PolicyBookRegistry");

const PolicyBook = artifacts.require("PolicyBook");

const ClaimVoting = artifacts.require("ClaimVoting");

module.exports = async (deployer, network, accounts) => {
  const contractsRegistry = await ContractsRegistry.at((await Proxy.deployed()).address);

  const policyBookRegistry = await PolicyBookRegistry.at(await contractsRegistry.getPolicyBookRegistryContract());

  const claimVoting = await ClaimVoting.at(await contractsRegistry.getClaimVotingContract());

  let policyBookList = await policyBookRegistry.list(0, 10);

  assert.notEqual(policyBookList.length, 0, "Expecting policy list not being empty");

  if (policyBookList.length > 0) {
    const policyBook = await PolicyBook.at(policyBookList[0]);
    await policyBook.numberStats();
  }

  let allClaims = await claimVoting.allClaims(0, 10);

  assert.equal(allClaims.length, 0, "claimVoting.allClaims expected to return an empty array");

  console.log("All smoke test passed");
};
