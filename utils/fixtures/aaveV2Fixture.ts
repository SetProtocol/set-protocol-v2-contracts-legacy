import { waffle } from "hardhat";
import { Contract, Signer, BigNumberish, constants } from "ethers";
import {
  AaveGovernanceV2,
  AaveGovernanceV2__factory,
  GovernanceStrategy,
  GovernanceStrategy__factory
} from "../../typechain";

const { AddressZero } = constants;
const { deployMockContract } = waffle;

const ExecutorArtifact = require("../../external/abi/aave/Executor.json");
const AaveTokenV2Artifact = require("@aave/aave-token/artifacts/contracts/token/AaveTokenV2.sol/AaveTokenV2.json");

interface AaveV2Fixture {
  aave: Contract;
  stkAave: Contract;
  gov: AaveGovernanceV2;
  strategy: Contract;
  executor: Contract;
}

const deployAaveV2Fixture = async function(owner: Signer, initialVotingPower: BigNumberish = 10): Promise<AaveV2Fixture>  {
  // Mock AAVE token
  const aave = await deployMockContract(owner, AaveTokenV2Artifact.abi);
  await aave.mock.getPowerAtBlock.returns(initialVotingPower);
  await aave.mock.totalSupplyAt.returns(initialVotingPower);
  await aave.mock.delegate.returns();

  // Mock stkAAVE token
  const stkAave = await deployMockContract(owner, AaveTokenV2Artifact.abi);
  await stkAave.mock.getPowerAtBlock.returns(0);
  await stkAave.mock.totalSupplyAt.returns(0);

  // Deploy strategy with mocked tokens
  const governanceStrategyFactory = new GovernanceStrategy__factory(owner);
  const strategy = await governanceStrategyFactory.deploy(
    aave.address,
    stkAave.address
  );

  // Mock executor
  const executor = await deployMockContract(owner, ExecutorArtifact.abi);
  await executor.mock.validateCreatorOfProposal.returns(true);
  await executor.mock.VOTING_DURATION.returns(100);

  // Deploy governance
  const aaveGovernanceV2Factory = new AaveGovernanceV2__factory(owner);
  const gov = await aaveGovernanceV2Factory.deploy(
    strategy.address,
    "0",
    AddressZero,
    [executor.address]
  );

  await gov.deployed();

  return { aave, stkAave, gov, strategy, executor } as AaveV2Fixture;
};

export {
  AaveV2Fixture,
  AaveGovernanceV2,
  deployAaveV2Fixture
};
