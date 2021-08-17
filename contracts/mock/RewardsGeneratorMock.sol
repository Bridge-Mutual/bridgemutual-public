// SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../RewardsGenerator.sol";

contract RewardsGeneratorMock is RewardsGenerator {
    using SafeMath for uint256;

    uint256 public dummy;

    function getPolicyBookReward(address policyBookAddress)
        external
        view
        returns (PolicyBookRewardInfo memory)
    {
        return _policyBooksRewards[policyBookAddress];
    }

    function getStake(uint256 nftIndex) external view returns (StakeRewardInfo memory) {
        return _stakes[nftIndex];
    }

    function reset(address policyBookAddress, uint256 nftIndex) external {
        delete _policyBooksRewards[policyBookAddress];
        delete _stakes[nftIndex];

        lastUpdateBlock = toUpdateRatio = cumulativeSum = totalPoolStaked = 0;
    }

    function getRewardNoCheck(address policyBookAddress, uint256 nftIndex)
        external
        view
        returns (uint256)
    {
        uint256 cumulativePoolReward = _getPBCumulativeReward(policyBookAddress);

        return _getNFTCumulativeReward(nftIndex, cumulativePoolReward);
    }

    function callOnUpgrade() external {
        dummy = 1337;
    }
}
