// SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;

import "../PolicyBook.sol";

contract PolicyBookMock is PolicyBook {
    uint256 public dummy;

    function __PolicyBookMock_init(
        address _insuranceContract,
        IPolicyBookFabric.ContractType _contractType
    ) external initializer {
        this.__PolicyBook_init(_insuranceContract, _contractType, "PBM", "PBM");
    }

    function triggerPremiumsDistribution() external withPremiumsDistribution {}

    function getSTBLToBMIXRatio() external view returns (uint256) {
        (, uint256 currentLiquidity) = getNewCoverAndLiquidity();

        return _getSTBLToBMIXRatio(currentLiquidity);
    }

    function setTotalLiquidity(uint256 _stblInThePoolTotal) external {
        totalLiquidity = _stblInThePoolTotal;
    }

    function setTotalCoverTokens(uint256 _stblInThePoolBought) external {
        totalCoverTokens = _stblInThePoolBought;
    }

    function setWhitelistedStatus(bool status) external {
        whitelisted = status;
    }

    function mint(uint256 _amountToMint) external {
        _mint(_msgSender(), _amountToMint);
    }

    function burn(uint256 _amountToBurn) external {
        _burn(_msgSender(), _amountToBurn);
    }

    function callOnUpgrade() external {
        dummy = 1337;
    }
}
