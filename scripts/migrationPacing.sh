#!/bin/bash

# Usage: migrationPacing <networkName>
#
# Script that attempts to help better control the transaction rate during a new
# deployment. And provides step and script information on failure
# Public RPC's usually not supports the tx intensive process of deploying BMI


set -e # abort on first error

# Migration sequence
# 1_initial_migration.js
# 2_contracts_registry_migration.js
# 3_token_migration.js
# 4_registry_migration.js
# 5_uniswap_info_migration.js
# 6_bmicoverstaking_and_rewardsgenerator_migration.js
# 7_bmistaking_migration.js
# 8_liquiditymining_migration.js
# 9_liquidity_mining_staking_migration.js
# 10_claimvoting_migration.js
# 11_policy_books_fabric_migration.js
# 90_init_all.js
# 91_policybooks_migration.js
# 98_config_uniswap.js
# 99_config.js

[ "$#" -eq 1 ] || (echo -e "Network must be indicateed explicitly e.g. :\n$ migrationPacing.sh development\n" && exit 2)

networkName=$1
intervalPause=1

set -x # show commands s they run

truffle migrate  --f 1 --to 1 --reset  --network $networkName                2>&1 | tee -a $networkName.env.out
truffle migrate  --f 2 --to 2          --network $networkName                2>&1 | tee -a $networkName.env.out
sleep $intervalPause # Prevent maxing out the rpc client quota

truffle migrate  --f 3 --to 3          --network $networkName --compile-none 2>&1 | tee -a $networkName.env.out
truffle migrate  --f 4 --to 4          --network $networkName --compile-none 2>&1 | tee -a $networkName.env.out
sleep $intervalPause # Prevent maxing out the rpc client quota

truffle migrate  --f 5 --to 5          --network $networkName --compile-none 2>&1 | tee -a $networkName.env.out
truffle migrate  --f 6 --to 6          --network $networkName --compile-none 2>&1 | tee -a $networkName.env.out
sleep $intervalPause # Prevent maxing out the rpc client quota

truffle migrate  --f 7 --to 7          --network $networkName --compile-none 2>&1 | tee -a $networkName.env.out
truffle migrate  --f 8 --to 8          --network $networkName --compile-none 2>&1 | tee -a $networkName.env.out
sleep $intervalPause # Prevent maxing out the rpc client quota

truffle migrate  --f 9 --to 9          --network $networkName --compile-none 2>&1 | tee -a $networkName.env.out
truffle migrate  --f 10 --to 10          --network $networkName --compile-none 2>&1 | tee -a $networkName.env.out
sleep $intervalPause # Prevent maxing out the rpc client quota

truffle migrate  --f 11 --to 11         --network $networkName --compile-none 2>&1 | tee -a $networkName.env.out
sleep $intervalPause # Prevent maxing out the rpc client quota
truffle migrate  --f 90 --to 90         --network $networkName --compile-none 2>&1 | tee -a $networkName.env.out
sleep $intervalPause # Prevent maxing out the rpc client quota

truffle migrate  --f 91 --to 91       --network $networkName --compile-none 2>&1 | tee -a $networkName.env.out
sleep $intervalPause # Prevent maxing out the rpc client quota
truffle migrate  --f 98 --to 98       --network $networkName --compile-none 2>&1 | tee -a $networkName.env.out
sleep $intervalPause # Prevent maxing out the rpc client quota
