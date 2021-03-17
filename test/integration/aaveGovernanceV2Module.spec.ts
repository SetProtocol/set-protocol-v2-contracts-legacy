import "module-alias/register";
import { BigNumber } from "@ethersproject/bignumber";
import { keccak256, defaultAbiCoder } from "ethers/lib/utils";
import { getRandomBytesSync } from "ethereum-cryptography/random";

import { Address, Bytes } from "@utils/types";
import { Account } from "@utils/test/types";
import { ADDRESS_ZERO, EMPTY_BYTES, ONE_DAY_IN_SECONDS } from "@utils/constants";
import { AaveGovernanceV2Adapter, SetToken, GovernanceModule } from "@utils/contracts";
import DeployHelper from "@utils/deploys";
import {
  ether,
} from "@utils/index";
import {
  addSnapshotBeforeRestoreAfterEach,
  getAccounts,
  getWaffleExpect,
  getSystemFixture,
  increaseTimeAsync,
} from "@utils/test/index";

import { AaveV2Fixture, deployAaveV2Fixture, SystemFixture } from "@utils/fixtures";

const expect = getWaffleExpect();

describe("AaveGovernanceV2Module", () => {
  let owner: Account;
  let delegatee: Account;
  let deployer: DeployHelper;
  let setup: SystemFixture;

  let aaveSetup: AaveV2Fixture;

  let governanceModule: GovernanceModule;
  let aaveGovernanceV2Adapter: AaveGovernanceV2Adapter;

  const aaveGovernanceV2AdapterIntegrationName: string = "AAVEV2";

  before(async () => {
    [
      owner,
      delegatee,
    ] = await getAccounts();

    // System setup
    deployer = new DeployHelper(owner.wallet);
    setup = getSystemFixture(owner.address);
    await setup.initialize();

    // Aave setup
    aaveSetup = await deployAaveV2Fixture(owner.wallet);

    proposalDummyData = {
      executor: aaveSetup.executor.address,
      targets: [ADDRESS_ZERO],
      values: [BigNumber.from(0)],
      signatures: [""],
      calldatas: ["0x"],
      withDelegatecalls: [false],
      ipfsHash: keccak256(getRandomBytesSync(32)),
    };

    // GovernanceModule setup
    governanceModule = await deployer.modules.deployGovernanceModule(setup.controller.address);
    await setup.controller.addModule(governanceModule.address);

    // AaveGovernanceV2Adapter setup
    aaveGovernanceV2Adapter = await deployer.adapters.deployAaveGovernanceV2Adapter(
      aaveSetup.gov.address,
      aaveSetup.aave.address,
    );

    await setup.integrationRegistry.addIntegration(
      governanceModule.address,
      aaveGovernanceV2AdapterIntegrationName,
      aaveGovernanceV2Adapter.address
    );
  });

  addSnapshotBeforeRestoreAfterEach();

  context("when a SetToken has been deployed and governance initialized", async () => {
    let setToken: SetToken;

    let componentUnits: BigNumber[];

    before(async () => {
      componentUnits = [ether(1000), ether(100)]; // 1000 AAVE, 100 stkAAVE
      setToken = await setup.createSetToken(
        [aaveSetup.aave.address, aaveSetup.stkAave.address],
        componentUnits,
        [setup.issuanceModule.address, governanceModule.address]
      );

      // Initialize modules
      await governanceModule.initialize(setToken.address);
    });

    describe("#delegate", async () => {
      async function subject(): Promise<any> {
        return governanceModule.connect(owner.wallet).delegate(
          setToken.address,
          aaveGovernanceV2AdapterIntegrationName,
          delegatee.address,
        );
      }

      it("should delegate voting rights", async () => {
        await aaveSetup.aave.mock.delegate.withArgs(delegatee.address).revertsWithReason("#delegate called");

        await expect(subject()).to.be.revertedWith("#delegate called");
      });
    });

    describe("#propose", async () => {
      async function subject(proposalData: string): Promise<any> {
        return governanceModule.connect(owner.wallet).propose(
          setToken.address,
          aaveGovernanceV2AdapterIntegrationName,
          proposalData
        );
      }

      it("should create a proposal", async () => {
        const executor = aaveSetup.executor.address;
        const targets = [ADDRESS_ZERO];
        const values = [BigNumber.from(0)];
        const signatures = [""];
        const calldatas = ["0x"];
        const withDelegatecalls = [false];
        const ipfsHash = keccak256(getRandomBytesSync(32));

        const proposalData = defaultAbiCoder.encode(
          ["address", "address[]", "uint256[]", "string[]", "bytes[]", "bool[]", "bytes32"],
          [executor, targets, values, signatures, calldatas, withDelegatecalls, ipfsHash]
        );

        await subject(proposalData);

        const proposal = await aaveSetup.gov.getProposalById(0);

        expect(proposal.executor).to.eq(executor);
        expect(proposal.targets).to.deep.eq(targets);
        expect(proposal[4]).to.deep.eq(values);
        expect(proposal.signatures).to.deep.eq(signatures);
        expect(proposal.calldatas).to.deep.eq(calldatas);
        expect(proposal.withDelegatecalls).to.deep.eq(withDelegatecalls);
        expect(proposal.ipfsHash).to.eq(ipfsHash);
      });
    });

    describe("#vote", async () => {
      let subjectSetToken: Address;
      let subjectProposalId: BigNumber;
      let subjectSupport: boolean;
      let subjectData: Bytes;
      let subjectIntegrationName: string;
      let subjectCaller: Account;

      beforeEach(async () => {
        // Params for proposal
        const proposal = await aaveSetup.gov.create(
          aaveSetup.executor.address,
          [ADDRESS_ZERO],
          [0],
          [""],
          ["0x"],
          [false],
          keccak256(getRandomBytesSync(32))
        );

        const proposalReviewPeriod = ONE_DAY_IN_SECONDS;
        await increaseTimeAsync(proposalReviewPeriod);

        const receipt = await proposal.wait();

        // Getting data on proposalCreated event dispatched in a AaveGovernanceV2#create call
        const proposalCreated = receipt.events![0];

        subjectSetToken = setToken.address;
        subjectIntegrationName = aaveGovernanceV2AdapterIntegrationName;
        subjectProposalId = proposalCreated.args!.id;
        subjectSupport = true;
        subjectData = EMPTY_BYTES;
        subjectCaller = owner;
      });

      async function subject(): Promise<any> {
        return governanceModule.connect(subjectCaller.wallet).vote(
          subjectSetToken,
          subjectIntegrationName,
          subjectProposalId,
          subjectSupport,
          subjectData
        );
      }

      it("should vote in Aave", async () => {
        await subject();

        const votesData = await aaveSetup.gov.getVoteOnProposal(subjectProposalId, setToken.address);
        expect(votesData.support).to.be.true;
      });
    });
  });
});
