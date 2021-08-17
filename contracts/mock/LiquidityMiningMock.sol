// SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;

import "../LiquidityMining.sol";

contract LiquidityMiningMock is LiquidityMining {
    function setStartTime(uint256 time) external {
        startLiquidityMiningTime = time;
    }

    function getStartTime() external view returns (uint256) {
        return startLiquidityMiningTime;
    }

    function getTeamLeaders(address _referralLink) external view returns (address[] memory) {
        return teamInfos[_referralLink].teamLeaders;
    }
}
