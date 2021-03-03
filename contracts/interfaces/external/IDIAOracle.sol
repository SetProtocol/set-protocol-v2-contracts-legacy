pragma solidity 0.6.10;

interface IDIAOracle {
	function getCoinInfo(string memory name) external view returns (uint256, uint256, uint256, string memory);
}
