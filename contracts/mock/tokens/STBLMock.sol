// SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract STBLMock is ERC20 {
    constructor(
        string memory _name,
        string memory _symbol,
        uint8 decimals
    ) ERC20(_name, _symbol) {
        _setupDecimals(decimals);
        _mint(msg.sender, 1_000_000_000_000 * 10**decimals);
    }

    function mintArbitrary(address _to, uint256 _amount) external {
        require(_amount <= 1_000_000 * 10**decimals(), "STBLMock: Can't mint that amount");

        _mint(_to, _amount);
    }
}
