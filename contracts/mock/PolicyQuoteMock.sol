// SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;

import "../interfaces/IPolicyQuote.sol";

contract PolicyQuoteMock is IPolicyQuote {
    uint256 public mockQuote;

    function setQuote(uint256 _quote) external {
        mockQuote = _quote;
    }

    function getQuotePredefined(
        uint256 _durationSeconds,
        uint256 _tokens,
        uint256 _totalCoverTokens,
        uint256 _totalLiquidity,
        bool _safePolicyBook
    ) external view override returns (uint256) {
        return mockQuote;
    }

    function getQuote(
        uint256 _durationSeconds,
        uint256 _tokens,
        address _policyBookAddr
    ) external view override returns (uint256) {
        return mockQuote;
    }
}
