import "module-alias/register";

import { ethers } from "hardhat";
import { Contract, Signer, constants } from "ethers";
import { AaveGovernanceV2, deployAaveV2Fixture } from "@utils/fixtures";
import { getWaffleExpect } from "@utils/test";

const { AddressZero } = constants;
const expect = getWaffleExpect();

describe("aaveV2Fixture", () => {
  let accounts: Signer[];
  let owner: Signer;
  let ownerAddress: string;
  let aave: Contract, gov: AaveGovernanceV2, executor: Contract;

  before(async () => {
    accounts = await ethers.getSigners();
    owner = accounts[0];
    ownerAddress = await owner.getAddress();
    ({ aave, gov, executor } = await deployAaveV2Fixture(owner));
  });

  it("should create a proposal with an ID", async () => {
    const proposal = await gov.create(
      executor.address,
      [AddressZero],
      ["0"],
      [""],
      ["0x"],
      [false],
      "0x47858569385046d7f77f5032ae41e511b40a7fbfbd315503ba3d99a6dc885f2b"
    );

    const receipt = await proposal.wait();

    // Obtain data on proposalCreated event dispatched in a AaveGovernanceV2#create call
    const proposalCreated = receipt.events![0];

    await expect(proposalCreated.args!.id).to.eq(0);
  });

  describe("voting", () => {
    it("should accept a vote on a proposal", async () => {
      const support: boolean = true;
      await gov.submitVote(0, support);
      const voteOnProposal = await gov.getVoteOnProposal(0, ownerAddress);

      await expect(voteOnProposal.support).to.eq(support);
    });

    it("should accept delegation call", async () => {
      const delegetee = accounts[1];
      const delegeteeAddress = await delegetee.getAddress();

      const result = await aave.delegate(delegeteeAddress);

      await expect(result.hash).to.be.a("string");
    });
  });
});
