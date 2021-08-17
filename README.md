[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=square)](https://github.com/prettier/prettier) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# Setup
### Install dependencies

```npm install```

### Please increase RAM limit for Node.js to be able to compile contracts

Set an environmental variable and reboot:

```export NODE_OPTIONS=--max_old_space_size=4096```

### To use the linters, please add these extensions to the VSCode

```ext install JuanBlanco.solidity```

```ext install esbenp.prettier-vscode```

- To lint the file, run **ctrl+shift+i** 

- To lint the whole project, run **npm run lint-fix**

### To verify contracts that are deployed via Truffle, please run:

```truffle run verify <list_of_contracts> --network <network_from_truffle-config>```

### To verify _proxy_ contracts that are deployed via factory, please run:

```npx hardhat verify --network <network_from_truffle-config> <deployed address> "first constructor arg" "second constructor arg" "0x"```

# How to get tokens
### Download wallet 
- Download wallet [Metamask](https://metamask.io/) and create account(add address).

### Add test Ether 

- Open Metamask and select test network Ropsten ;
- Follow to [fauscet](https://faucet.dimensions.network/) and claim test ETH.

### Mint BMI Token 

Open [BMI token](https://ropsten.etherscan.io/address/0xa6b0eeb26743c2f98d2a9fa3806afdc724d7b252) contract on Ropsten Etherscan:
- click on tab `Contract` then `Write Contract`;
- click on button `Connect to Web3` and connect your wallet;
- select functions `mintArbitrary`:
    - in `_to (address)` pass your **address**;
    - in `_amount (uint256)` pass **amount** of tokens you want to mint (you can't mint more than 1 mil BMI);
    - click buttom `Write` and confirm sending transaction on Metamask;
- add BMI token to Metamask wallet:
    - open Metamask and click `Add Token` in tab **Assets**;
    - switch to tab `Custom Tokens` and paste address of BMI token _0xa6b0eeb26743c2f98d2a9fa3806afdc724d7b252_, save changes;
> **Note:** Amount should be in WEI.
Eg. To mint 100 BMI token you should pass 100 * 10^18 == 100000000000000000000.

### Mint STBL Token 

Open [STBL token](https://ropsten.etherscan.io/address/0x731973b26bdecc4fd476e2ad87af317d54e729f2) contract on Ropsten Etherscan:
- click on tab `Contract` then `Write Contract`;
- click on button `Connect to Web3` and connect your wallet;
- select functions `mintArbitrary`:
    - in `_to (address)` pass your **address**;
    - in `_amount (uint256)` pass **amount** of tokens you want to mint (you can't mint more than 1 mil STBL);
    - click buttom `Write` and confirm sending transaction on Metamask;
- add STBL token to Metamask wallet:
    - open Metamask and click `Add Token` in tab **Assets**;
    - switch to tab `Custom Tokens` and paste address of STBL token _0x731973b26bdecc4fd476e2ad87af317d54e729f2_, save changes;
> **Note:** Amount should be in WEI.
Eg. To mint 100 STBL token you should pass 100 * 10^18 == 100000000000000000000.
