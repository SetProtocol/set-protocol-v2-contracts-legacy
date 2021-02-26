import "module-alias/register";

import { Account } from "@utils/test/types";
import { BigNumber } from "@ethersproject/bignumber";
import { DIAPriceOracle, DIAOracle } from "@utils/contracts";
import DeployHelper from "@utils/deploys";
import {
  addSnapshotBeforeRestoreAfterEach,
  getAccounts,
  getWaffleExpect
} from "@utils/test/index";
import { ether } from "@utils/index";

const expect = getWaffleExpect();

describe.only("DIAPriceOracle", () => {
  let wallet: Account;

  let usdc: Account;
  let weth: Account;
  let unrelatedUser: Account;
  const identifier: string = "ETH/USD";

  let diaOracle: DIAOracle;
  let diaPriceOracle: DIAPriceOracle;

  let deployer: DeployHelper;

  addSnapshotBeforeRestoreAfterEach();
  const configure = async () => {
    // Using this syntax for sol-coverage to work
    [wallet, usdc, weth, unrelatedUser ] = await getAccounts();

    console.log(unrelatedUser);
    console.log(unrelatedUser.wallet);
    console.log(Object.keys(unrelatedUser));

    deployer = new DeployHelper(wallet.wallet);

    diaOracle = await deployer.external.deployDIAOracle();

    diaPriceOracle = await deployer.core.deployDIAPriceOracle(
      usdc.address,
      diaOracle.address
    );
  };

  describe("constructor", async () => {
    before(configure);
    it("should have the masterQuoteAsset configured", async () => {
      expect(await diaPriceOracle.masterQuoteAsset()).to.eq(usdc.address);
    });
    it("should have the underlyingOracle configured", async () => {
      expect(await diaPriceOracle.underlyingOracle()).to.eq(diaOracle.address);
    });
  });

  describe("addPair", async () => {
    before(configure);
    const ethPrice: BigNumber = ether(1500);
    it(
      "WHEN there is no price feed configured, THEN it should revert",
       () => expect(diaPriceOracle.getPrice(weth.address, usdc.address)).to.be.revertedWith("Price feed not available")
      );

    describe("GIVEN a valid price feed", () => {
      before(() => diaOracle.updateCoinInfo(identifier, identifier, ethPrice, 0, Date.now().toString()));
    describe("WHEN adding a pair to a DiaPriceOracle", () => {
      before(() =>  diaPriceOracle.addPair(weth.address, usdc.address, identifier) );
      it("THEN the pricefeed identifier can be retrieved", async() => {
        expect(await diaPriceOracle.getPriceIdentifier(weth.address, usdc.address)).to.eq(identifier);
      });
      it("AND the price value can be retrieved", async() => {
        expect(await diaPriceOracle.getPrice(weth.address, usdc.address)).to.eq(ethPrice);
      });
    });
    });
  });

  describe("permissions", async () => {
    it( "Only the contract admin should be able to add a paie", async() => {
      const connectedDiaPriceOracle: DIAPriceOracle = diaPriceOracle.connect(unrelatedUser.wallet);
      await expect(connectedDiaPriceOracle.addPair(weth.address, usdc.address, identifier)).to.be.revertedWith("Ownable: caller is not the owner"); }
      );
    it.skip("Only the contract admin should be able to remove a pair", async () => {
    });
  });

});
