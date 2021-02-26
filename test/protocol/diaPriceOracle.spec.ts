import "module-alias/register";

import { Account } from "@utils/test/types";
import { DIAPriceOracle, DIAOracle } from "@utils/contracts";
import DeployHelper from "@utils/deploys";
import {
  addSnapshotBeforeRestoreAfterEach,
  getAccounts,
  getWaffleExpect
} from "@utils/test/index";

const expect = getWaffleExpect();

describe.only("DIAPriceOracle", () => {
  let wallet: Account;

  let usdc: Account;

  let diaOracle: DIAOracle;
  let diaPriceOracle: DIAPriceOracle;

  let deployer: DeployHelper;

  addSnapshotBeforeRestoreAfterEach();

  before(async () => {
    // Using this syntax for sol-coverage to work
    [wallet, usdc ] = await getAccounts();

    deployer = new DeployHelper(wallet.wallet);

    diaOracle = await deployer.external.deployDIAOracle();

    diaPriceOracle = await deployer.core.deployDIAPriceOracle(
      usdc.address,
      diaOracle.address
    );
  });

  describe("constructor", async () => {
    it("should have the masterQuoteAsset configured", async () => {
      expect(await diaPriceOracle.masterQuoteAsset()).to.eq(usdc.address);
    });
    it("should have the underlyingOracle configured", async () => {
      expect(await diaPriceOracle.underlyingOracle()).to.eq(diaOracle.address);
    });
  });

});
