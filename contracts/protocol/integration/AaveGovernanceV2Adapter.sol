/*
    Copyright 2020 Set Labs Inc.

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
pragma experimental "ABIEncoderV2";


/**
 * @title AaveGovernanceV2Adapter
 * @author Set Protocol
 *
 * Governance adapter for Aave governance V2 that returns data for voting
 */
contract AaveGovernanceV2Adapter {

    /* ============ Constants ============ */

    // // 1 is a vote for in AAVE
    // bool public constant VOTE_FOR = true;

    // // 2 represents a vote against in AAVE
    // bool public constant VOTE_AGAINST = false;

    /* ============ State Variables ============ */

    // Address of Aave governance V2 contract
    address public immutable aaveGovernanceV2;

    // Address of Aave token
    address public immutable aaveToken;

    /* ============ Constructor ============ */

    /**
     * Set state variables
     *
     * @param _aaveGovernanceV2       Address of AAVE governance V2 contract
     * @param _aaveToken              Address of AAVE token
     */
    constructor(address _aaveGovernanceV2, address _aaveToken) public {
        aaveGovernanceV2 = _aaveGovernanceV2;
        aaveToken = _aaveToken;
    }

    /* ============ External Getter Functions ============ */

    /**
     * Generates the calldata to vote on a proposal. Bytes data paramater is unused in Aave Governance V2
     *
     * @param _proposalId           ID of the proposal to vote on
     * @param _support              Boolean indicating whether to support proposal
     *
     * @return address              Target contract address
     * @return uint256              Total quantity of ETH (Set to 0)
     * @return bytes                Propose calldata
     */
    function getVoteCalldata(uint256 _proposalId, bool _support, bytes memory /* _data */) external view returns (address, uint256, bytes memory) {
        // submitVote(uint256 proposalId, bool support)
        bytes memory callData = abi.encodeWithSignature("submitVote(uint256,bool)", _proposalId, _support);

        return (aaveGovernanceV2, 0, callData);
    }

    /**
     * Generates the calldata to delegate votes to another ETH address.
     * To reset delegation, set the delegatee address to the delegator (setToken) address.
     *
     * @param _delegatee            Address of the delegatee
     *
     * @return address              Target contract address
     * @return uint256              Total quantity of ETH (Set to 0)
     * @return bytes                Propose calldata
     */
    function getDelegateCalldata(address _delegatee) external view returns (address, uint256, bytes memory) {
        // delegate(address _delegatee)
        bytes memory callData = abi.encodeWithSignature("delegate(address)", _delegatee);

        return (aaveToken, 0, callData);
    }

    /**
     * Reverts as AAVE currently does not have a register mechanism in governance
     */
    function getRegisterCalldata(address /* _setToken */) external view returns (address, uint256, bytes memory) {
        revert("Registeration not required in AAVE governance V2");
    }

    /**
     * Reverts as AAVE currently does not have a register mechanism in governance
     */
    function getRevokeCalldata() external view returns (address, uint256, bytes memory) {
        revert("To revoke delegation, set the delegatee address to the delegator address");
    }

    /**
     * Generates the calldata to create a new proposal.
     * The caller must have proposition power higher than PROPOSITION_THRESHOLD to create a proposal.
     * Executor is a contract deployed to validate proposal creation and voting.
     * There two types of proposals and each has it's own executor.
     * Critical proposals that affect governance consensus (long) and proposals affecting only protocol parameters (short).
     * https://docs.aave.com/developers/protocol-governance/governance#proposal-types
     *
     * @param _proposalData         Byte data containing data about the proposal
     *
     * @return address              Target contract address
     * @return uint256              Total quantity of ETH (Set to 0)
     * @return bytes                Propose calldata
     */
    function getProposeCalldata(bytes memory _proposalData) external view returns (address, uint256, bytes memory) {
        // Decode proposal data
        (
            address executor,
            address[] memory targets,
            uint256[] memory values,
            string[] memory signatures,
            bytes[] memory calldatas,
            bool[] memory withDelegatecalls,
            bytes32 ipfsHash
        ) = abi.decode(_proposalData, (address,address[],uint256[],string[],bytes[],bool[],bytes32));

        // create(address,address[],uint256[],bytes[],bytes[],bool[],bytes32)
        bytes memory callData = abi.encodeWithSignature("create(address,address[],uint256[],string[],bytes[],bool[],bytes32)",
            executor,
            targets,
            values,
            signatures,
            calldatas,
            withDelegatecalls,
            ipfsHash
        );

        return (aaveGovernanceV2, 0, callData);
    }
}