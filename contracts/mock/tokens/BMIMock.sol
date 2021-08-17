// SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;

import "../../tokens/erc20permit-upgradeable/ERC20PermitUpgradeable.sol";

contract BMIMock is ERC20PermitUpgradeable {
    uint256 public constant TOTAL_SUPPLY = 160 * (10**6) * (10**18);

    constructor(address tokenReceiver) {
        __ERC20Permit_init("MBMI");
        __ERC20_init("Bridge Mutual Mock", "MBMI");
        _mint(tokenReceiver, TOTAL_SUPPLY);
    }

    function mintArbitrary(address _to, uint256 _amount) external {
        require(_amount <= 1_000_000 ether, "BMIMock: Can't mint that amount");

        _mint(_to, _amount);
    }
}
