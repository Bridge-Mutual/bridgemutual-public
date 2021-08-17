// SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;

import "../ReputationSystem.sol";

contract ReputationSystemMock is ReputationSystem {
    using SafeMath for uint256;

    function setNewReputationNoCheck(address user, uint256 newReputation) external {
        require(newReputation >= PRECISION.div(10), "ReputationSystemMock: reputation too low");
        require(newReputation <= PRECISION.mul(3), "ReputationSystemMock: reputation too high");

        if (_reputation[user] == 0) {
            _votedOnceCount++;
            _roundedReputations[REPUTATION_PRECISION / 3]++;
            _reputation[user] = PRECISION;
        }

        uint256 flooredOldReputation = _reputation[user].mul(10).div(PRECISION);

        _reputation[user] = newReputation;

        uint256 flooredNewReputation = _reputation[user].mul(10).div(PRECISION);

        _roundedReputations[flooredOldReputation]--;
        _roundedReputations[flooredNewReputation]++;

        _recalculateTrustedVoterReputationThreshold();
    }
}
