// SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;

import "../PolicyRegistry.sol";

contract PolicyRegistryMock is PolicyRegistry {
    function setPolicyEndTime(
        address userAddr,
        address policyBookAddr,
        uint256 endTime
    ) external {
        policyInfos[userAddr][policyBookAddr].endTime = endTime;
    }
}
