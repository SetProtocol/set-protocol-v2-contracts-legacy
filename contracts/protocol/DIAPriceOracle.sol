pragma solidity 0.6.10;
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { DIAOracle } from "../../external/contracts/DIAOracle.sol";
import { IPriceOracle } from "../interfaces/IPriceOracle.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @title DIAPriceOracle
 *
 * Contract that returns the price for any given asset pair. Price is retrieved directly from a DIA oracle.
 * Note: Prices are returned in preciseUnits (i.e. 18 decimals of precision)
 */
contract DIAPriceOracle is Ownable, IPriceOracle {
    using SafeMath for uint256;
    // DIA oracle returns 5 decimals, and the result requires 18
    uint public constant DECIMAL_CORRECTION = 10**13;
    uint public constant WAD = 10**18;

    /* ============ State Variables ============ */

    address public override immutable masterQuoteAsset;
    DIAOracle public immutable underlyingOracle;
    mapping (address => mapping (address => string)) private  priceIdentifiers;

    /* ============ Events ============ */

    event PairAdded(address indexed _assetOne, address indexed _assetTwo, string identifier, string previous);
    event PairRemoved(address indexed _assetOne, address indexed _assetTwo, string identifier);

    /* ============ Constructor ============ */

    constructor( address _masterQuoteAsset, address _underlyingOracle) public {
      masterQuoteAsset =_masterQuoteAsset;
      underlyingOracle = DIAOracle(_underlyingOracle);
    }

    /* ============ External Functions ============ */

    function getPrice(address _assetOne, address _assetTwo) external override view returns (uint256) {
        uint256 price;
        (bool inverse, string memory identifier) = getPriceIdentifier(_assetOne,_assetTwo);
        (price,,,) = underlyingOracle.getCoinInfo(identifier);

        if (inverse) {
          return WAD.mul(WAD).div(price.mul(DECIMAL_CORRECTION));
        } else {
          return price.mul(DECIMAL_CORRECTION);
        }
    }

    function addPair(address _assetOne, address _assetTwo, string memory identifier) onlyOwner external {
      emit PairAdded(_assetOne, _assetTwo, identifier, priceIdentifiers[_assetOne][_assetTwo]);
      priceIdentifiers[_assetOne][_assetTwo] = identifier;
    }

    function removePair(address _assetOne, address _assetTwo) onlyOwner external {
      string storage identifier = priceIdentifiers[_assetOne][_assetTwo];
      require(bytes(identifier).length != 0,"Pair does not exist");
      emit PairRemoved(_assetOne, _assetTwo, identifier);
      delete(priceIdentifiers[_assetOne][_assetTwo]);
    }

    function getPriceIdentifier (address _assetOne, address _assetTwo) public view returns (bool inverse, string memory identifier){
        identifier = priceIdentifiers[_assetOne][_assetTwo];
        inverse = false;
        if (bytes(identifier).length == 0){
            identifier = priceIdentifiers[_assetTwo][_assetOne];
            inverse = true;
        }
        require(bytes(identifier).length != 0,"Price feed not available");
    }
}
