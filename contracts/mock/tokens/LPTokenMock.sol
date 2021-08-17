// SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LPTokenMock is ERC20 {
    uint112 private _reserve0;
    uint112 private _reserve1;

    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        _mint(msg.sender, 1_000_000 ether);
    }

    function setReserves(uint112 reserve0, uint112 reserve1) external {
        require(
            reserve0 <= 1_000_000_000 ether && reserve0 <= 1_000_000_000 ether,
            "LPTokenMock: Can't set that amount"
        );

        _reserve0 = reserve0;
        _reserve1 = reserve1;
    }

    function getReserves()
        public
        view
        returns (
            uint112 reserve0,
            uint112 reserve1,
            uint32 blockTimestampLast
        )
    {
        reserve0 = _reserve0;
        reserve1 = _reserve1;
        blockTimestampLast = uint32(block.timestamp);
    }

    function mintArbitrary(address _to, uint256 _amount) external {
        require(_amount <= 10_000 ether, "LPTokenMock: Can't mint that amount");

        _mint(_to, _amount);
    }
}
