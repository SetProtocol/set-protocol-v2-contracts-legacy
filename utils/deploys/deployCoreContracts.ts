import { Signer } from "ethers";
import { BigNumberish } from "@ethersproject/bignumber";

import {
  Controller,
  IntegrationRegistry,
  PriceOracle,
  DIAPriceOracle,
  SetToken,
  SetTokenCreator,
  SetValuer,
  CustomOracleSetValuer
} from "./../contracts";

import { Address } from "./../types";

import { Controller__factory } from "../../typechain/factories/Controller__factory";
import { IntegrationRegistry__factory } from "../../typechain/factories/IntegrationRegistry__factory";
import { PriceOracle__factory } from "../../typechain/factories/PriceOracle__factory";
import { DIAPriceOracle__factory } from "../../typechain/factories/DIAPriceOracle__factory";
import { SetToken__factory } from "../../typechain/factories/SetToken__factory";
import { SetTokenCreator__factory } from "../../typechain/factories/SetTokenCreator__factory";
import { SetValuer__factory } from "../../typechain/factories/SetValuer__factory";
import { CustomOracleSetValuer__factory } from "../../typechain/factories/CustomOracleSetValuer__factory";

export default class DeployCoreContracts {
  private _deployerSigner: Signer;

  constructor(deployerSigner: Signer) {
    this._deployerSigner = deployerSigner;
  }

  public async deployController(feeRecipient: Address): Promise<Controller> {
    return await new Controller__factory(this._deployerSigner).deploy(feeRecipient);
  }

  public async getController(controllerAddress: Address): Promise<Controller> {
    return await new Controller__factory(this._deployerSigner).attach(controllerAddress);
  }

  public async deploySetTokenCreator(controller: Address): Promise<SetTokenCreator> {
    return await new SetTokenCreator__factory(this._deployerSigner).deploy(controller);
  }

  public async getSetTokenCreator(setTokenCreatorAddress: Address): Promise<SetTokenCreator> {
    return await new SetTokenCreator__factory(this._deployerSigner).attach(setTokenCreatorAddress);
  }

  public async deploySetToken(
    _components: Address[],
    _units: BigNumberish[],
    _modules: Address[],
    _controller: Address,
    _manager: Address,
    _name: string,
    _symbol: string,
  ): Promise<SetToken> {
    return await new SetToken__factory(this._deployerSigner).deploy(
      _components,
      _units,
      _modules,
      _controller,
      _manager,
      _name,
      _symbol,
    );
  }

  public async getSetToken(setTokenAddress: Address): Promise<SetToken> {
    return await new SetToken__factory(this._deployerSigner).attach(setTokenAddress);
  }

  public async deployPriceOracle(
    controller: Address,
    masterQuoteAsset: Address,
    adapters: Address[],
    assetOnes: Address[],
    assetTwos: Address[],
    oracles: Address[],
  ): Promise<PriceOracle> {
    return await new PriceOracle__factory(this._deployerSigner).deploy(
      controller,
      masterQuoteAsset,
      adapters,
      assetOnes,
      assetTwos,
      oracles,
    );
  }

  public async deployDIAPriceOracle(
    masterQuoteAsset: Address,
    oracle: Address,
  ): Promise<DIAPriceOracle> {
    return await new DIAPriceOracle__factory(this._deployerSigner).deploy(masterQuoteAsset, oracle);
  }

  public async getPriceOracle(priceOracleAddress: Address): Promise<PriceOracle> {
    return await new PriceOracle__factory(this._deployerSigner).attach(priceOracleAddress);
  }

  public async deployIntegrationRegistry(controller: Address): Promise<IntegrationRegistry> {
    return await new IntegrationRegistry__factory(this._deployerSigner).deploy(controller);
  }

  public async getIntegrationRegistry(integrationRegistryAddress: Address): Promise<IntegrationRegistry> {
    return await new IntegrationRegistry__factory(this._deployerSigner).attach(integrationRegistryAddress);
  }

  public async deploySetValuer(controller: Address): Promise<SetValuer> {
    return await new SetValuer__factory(this._deployerSigner).deploy(controller);
  }

  public async deployCustomOracleSetValuer(controller: Address): Promise<CustomOracleSetValuer> {
    return await new CustomOracleSetValuer__factory(this._deployerSigner).deploy(controller);
  }
}
