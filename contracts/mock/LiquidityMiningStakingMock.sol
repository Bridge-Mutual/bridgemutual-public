// SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;

import "../LiquidityMiningStaking.sol";

contract LiquidityMiningStakingMock is LiquidityMiningStaking {
    function rewards(address staker) external view returns (uint256) {
        return _applySlashing(_rewards[staker], liquidityMining.startLiquidityMiningTime());
    }
}
