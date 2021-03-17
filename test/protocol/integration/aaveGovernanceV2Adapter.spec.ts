import "module-alias/register";
import { BigNumber } from "@ethersproject/bignumber";
import { keccak256, defaultAbiCoder } from "ethers/lib/utils";
import { getRandomBytesSync } from "ethereum-cryptography/random";
import { Address, Bytes } from "@utils/types";
import { Account } from "@utils/test/types";
import { ADDRESS_ZERO, EMPTY_BYTES, ZERO } from "@utils/constants";
import { AaveGovernanceV2Adapter } from "@utils/contracts";
import DeployHelper from "@utils/deploys";
import {
  addSnapshotBeforeRestoreAfterEach,
  getAccounts,
  getWaffleExpect,
  getRandomAddress
} from "@utils/test/index";
import { AaveV2Fixture, deployAaveV2Fixture } from "@utils/fixtures";


const expect = getWaffleExpect();

describe("AaveGovernanceAdapter", () => {
  let owner: Account;
  let deployer: DeployHelper;
  let aaveGovernanceV2Adapter: AaveGovernanceV2Adapter;
  let mockSetToken: Account;
  let aaveSetup: AaveV2Fixture;

  before(async () => {
    [
      owner,
      mockSetToken,
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);

    aaveSetup = await deployAaveV2Fixture(owner.wallet);

    aaveGovernanceV2Adapter = await deployer.adapters.deployAaveGovernanceV2Adapter(
      aaveSetup.gov.address,
      aaveSetup.aave.address
    );
  });

  addSnapshotBeforeRestoreAfterEach();

  describe("#constructor", async () => {
    let subjectAaveToken: Address;
    let subjectAaveGovernance: Address;

    beforeEach(async () => {
      subjectAaveToken = aaveSetup.aave.address;
      subjectAaveGovernance = aaveSetup.gov.address;
    });

    async function subject(): Promise<any> {
      return deployer.adapters.deployAaveGovernanceV2Adapter(
        subjectAaveGovernance,
        subjectAaveToken,
      );
    }

    it("should have the correct AAVE token address", async () => {
      const deployedAaveGovernanceAdapter = await subject();

      const actualAaveToken = await deployedAaveGovernanceAdapter.aaveToken();
      expect(actualAaveToken).to.eq(subjectAaveToken);
    });

    it("should have the correct AAVE governance contract address", async () => {
      const deployedAaveGovernanceAdapter = await subject();

      const actualGovernanceAddress = await deployedAaveGovernanceAdapter.aaveGovernanceV2();
      expect(actualGovernanceAddress).to.eq(subjectAaveGovernance);
    });
  });

  describe("#getProposeCalldata", async () => {
    let subjectProposalData: Address;

    const targets = [ADDRESS_ZERO];
    const values = [0];
    const signatures = [""];
    const calldatas = ["0x"];
    const withDelegateCall = [false];
    const ipfsHash = keccak256(getRandomBytesSync(32));

    beforeEach(async () => {
      subjectProposalData = defaultAbiCoder.encode(
        ["address", "address[]", "uint256[]", "string[]", "bytes[]", "bool[]", "bytes32"],
        [aaveSetup.executor.address, targets, values, signatures, calldatas, withDelegateCall, ipfsHash]
      );
    });


    async function subject(): Promise<any> {
      return aaveGovernanceV2Adapter.getProposeCalldata(subjectProposalData);
    }

    it("should return the correct data for creating a proposal", async () => {
        const [targetAddress, ethValue, callData] = await subject();

        const expectedCalldata = aaveSetup.gov.interface.encodeFunctionData(
          "create", [aaveSetup.executor.address, targets, values, signatures, calldatas, withDelegateCall, ipfsHash]
        );

        expect(targetAddress).to.eq(aaveSetup.gov.address);
        expect(ethValue).to.eq(BigNumber.from(0));
        expect(callData).to.eq(expectedCalldata);
    });
  });

  describe("#getVoteCalldata", async () => {
    let subjectProposalId: BigNumber;
    let subjectSupport: boolean;
    let subjectData: Bytes;

    beforeEach(async () => {
      subjectProposalId = ZERO;
      subjectSupport = true;
      subjectData = EMPTY_BYTES;
    });

    async function subject(): Promise<any> {
      return aaveGovernanceV2Adapter.getVoteCalldata(subjectProposalId, subjectSupport, subjectData);
    }

    it("should return correct data for voting", async () => {
      const [targetAddress, ethValue, callData] = await subject();
      const expectedCallData = aaveSetup.gov.interface.encodeFunctionData(
        "submitVote",
        [subjectProposalId, subjectSupport]
      );

      expect(targetAddress).to.eq(aaveSetup.gov.address);
      expect(ethValue).to.eq(ZERO);
      expect(callData).to.eq(expectedCallData);
    });

    describe("when voting against a proposal", () => {

      beforeEach(async () => {
        subjectSupport = false;
      });

      it("should return correct data for voting", async () => {
        const [targetAddress, ethValue, callData] = await subject();

        const expectedCallData = aaveSetup.gov.interface.encodeFunctionData(
          "submitVote",
          [subjectProposalId, subjectSupport]
        );

        expect(targetAddress).to.eq(aaveSetup.gov.address);
        expect(ethValue).to.eq(ZERO);
        expect(callData).to.eq(expectedCallData);
      });
    });
  });

  describe("#getDelegateCalldata", async () => {
    let subjectDelegatee: Address;

    beforeEach(async () => {
      subjectDelegatee = await getRandomAddress();
    });

    async function subject(): Promise<any> {
      return aaveGovernanceV2Adapter.getDelegateCalldata(subjectDelegatee);
    }

    it("should return correct data for delegation", async () => {
      const [targetAddress, ethValue, callData] = await subject();

      const expectedCallData = aaveSetup.aave.interface.encodeFunctionData("delegate", [subjectDelegatee]);

      expect(targetAddress).to.eq(aaveSetup.aave.address);
      expect(ethValue).to.eq(ZERO);
      expect(callData).to.eq(expectedCallData);
    });
  });

  describe("#getRegisterCalldata", async () => {
    let subjectSetToken: Address;

    beforeEach(async () => {
      subjectSetToken = mockSetToken.address;
    });

    async function subject(): Promise<any> {
      return aaveGovernanceV2Adapter.getRegisterCalldata(subjectSetToken);
    }

    it("should revert", async () => {
      await expect(subject()).to.be.revertedWith("Registeration not required in AAVE governance V2");
    });
  });

  describe("#getRevokeCalldata", async () => {
    async function subject(): Promise<any> {
      return aaveGovernanceV2Adapter.getRevokeCalldata();
    }

    it("should revert", async () => {
      await expect(subject()).to.be.revertedWith("To revoke delegation, set the delegatee address to the delegator address");
    });
  });
});