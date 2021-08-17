// SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;

import "../ClaimingRegistry.sol";

contract ClaimingRegistryMock is ClaimingRegistry {
    using EnumerableSet for EnumerableSet.UintSet;

    function updateStatus(
        address user,
        address policyBook,
        ClaimStatus status
    ) external {
        uint256 index = _allClaimsToIndex[policyBook][user];
        _allClaimsByIndexInfo[index].status = status;

        if (status == ClaimStatus.REJECTED && _allClaimsByIndexInfo[index].appeal) {
            delete _allClaimsToIndex[policyBook][user];
        }
    }

    function hasClaim(address claimer, address policyBookAddress) external view returns (bool) {
        return _myClaims[claimer].contains(_allClaimsToIndex[policyBookAddress][claimer]);
    }
}
