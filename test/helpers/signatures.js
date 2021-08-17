const { fromRpcSig } = require("ethereumjs-util");
const ethSigUtil = require("eth-sig-util");

const { MAX_UINT256 } = require("./constants");

const sign2612 = (domain, message, privateKey) => {
  const { name, version = "1", chainId = 1, verifyingContract } = domain;
  const { owner, spender, value, nonce = 0, deadline = MAX_UINT256.toString(10) } = message;

  const EIP712Domain = [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ];

  const Permit = [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ];

  const data = {
    primaryType: "Permit",
    types: { EIP712Domain, Permit },
    domain: { name, version, chainId, verifyingContract },
    message: { owner, spender, value: value.toString(10), nonce, deadline },
  };

  const signature = ethSigUtil.signTypedMessage(privateKey, { data });
  return fromRpcSig(signature);
};

module.exports = {
  sign2612,
};
