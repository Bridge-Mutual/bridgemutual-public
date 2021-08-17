// SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WETHMock is ERC20 {
    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        _mint(msg.sender, 1_000_000_000_000 ether);
    }

    function mintArbitrary(address _to, uint256 _amount) external {
        require(_amount <= 1_000_000 ether, "WETHMock: Can't mint that amount");

        _mint(_to, _amount);
    }
}
