// SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;

import "../ClaimVoting.sol";

contract ClaimVotingMock is ClaimVoting {
    function getVotingResult(uint256 claimIndex) external view returns (VotingResult memory) {
        return _votings[claimIndex];
    }

    function voteIndex(uint256 claimIndex) external view returns (uint256) {
        return _allVotesToIndex[msg.sender][claimIndex];
    }

    function vote(uint256 claimIndex, uint256 suggestedClaimAmount) external {
        uint256 stakedBMI = vBMI.balanceOf(msg.sender);
        bool voteFor = (suggestedClaimAmount > 0);

        _calculateAverages(
            claimIndex,
            stakedBMI,
            suggestedClaimAmount,
            reputationSystem.reputation(msg.sender),
            voteFor
        );

        _addAnonymousVote(msg.sender, claimIndex, 0, "");
        _modifyExposedVote(msg.sender, claimIndex, suggestedClaimAmount, stakedBMI, voteFor);
    }
}
