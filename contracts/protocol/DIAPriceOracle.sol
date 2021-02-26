pragma solidity 0.6.10;
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import {DIAOracle} from "../../external/contracts/DIAOracle.sol";

/**
 * @title DIAPriceOracle
 *
 * Contract that returns the price for any given asset pair. Price is retrieved either directly from an oracle,
 * calculated using common asset pairs, or uses external data to calculate price.
 * Note: Prices are returned in preciseUnits (i.e. 18 decimals of precision)
 */
contract DIAPriceOracle is Ownable {
    // Token address of the bridge asset that prices are derived from if the specified pair price is missing, required by the interface
    address public immutable masterQuoteAsset;
    DIAOracle public immutable underlyingOracle;
    mapping (address => mapping (address => string)) private  priceIdentifiers;

    constructor( address _masterQuoteAsset, address _underlyingOracle) public {
      masterQuoteAsset =_masterQuoteAsset;
      underlyingOracle = DIAOracle(_underlyingOracle);
    }

    /* ============ External Functions ============ */
    // required by the interface
    function getPrice(address _assetOne, address _assetTwo) external view returns (uint256) {
        uint256 price;
        (price,,,) = underlyingOracle.getCoinInfo(getPriceIdentifier(_assetOne,_assetTwo));
        return price;
    }

    function addPair(address _assetOne, address _assetTwo, string memory identifier) onlyOwner external {
      priceIdentifiers[_assetOne][_assetTwo] = identifier;
    }

    function getPriceIdentifier (address _assetOne, address _assetTwo) public view returns (string memory identifier){
        identifier = priceIdentifiers[_assetOne][_assetTwo];
        require(bytes(identifier).length != 0,"Price feed not available");
        return identifier;
    }
}
