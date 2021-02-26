
/*
    Copyright 2020 Protofire

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

    SPDX-License-Identifier: Apache License, Version 2.0
*/

pragma solidity 0.6.10;
import {DIAOracle} from "../../external/contracts/DIAOracle.sol";

/**
 * @title DIAPriceOracle
 *
 * Contract that returns the price for any given asset pair. Price is retrieved either directly from an oracle,
 * calculated using common asset pairs, or uses external data to calculate price.
 * Note: Prices are returned in preciseUnits (i.e. 18 decimals of precision)
 */
contract DIAPriceOracle {
    // Token address of the bridge asset that prices are derived from if the specified pair price is missing, required by the interface
    address public immutable masterQuoteAsset;
    DIAOracle public immutable underlyingOracle;

    constructor( address _masterQuoteAsset, address _underlyingOracle) public {
      masterQuoteAsset =_masterQuoteAsset;
      underlyingOracle = DIAOracle(_underlyingOracle);
    }

    /* ============ External Functions ============ */
    // required by the interface
    function getPrice(address _assetOne, address _assetTwo) external view returns (uint256) {
    }
}
