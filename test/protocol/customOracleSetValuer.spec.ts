import "module-alias/register";
import { BigNumber } from "@ethersproject/bignumber";
import { SetToken, DIAPriceOracle, DIAOracle, CustomOracleSetValuer } from "@utils/contracts";
import DeployHelper from "@utils/deploys";
import {
  ether,
  usdc,
  preciseDiv,
  preciseMul,
} from "@utils/index";
import {
  getSystemFixture,
  getWaffleExpect,
  getAccounts,
  addSnapshotBeforeRestoreAfterEach,
} from "@utils/test/index";

import { Address } from "@utils/types";
import { Account } from "@utils/test/types";
import { SystemFixture } from "@utils/fixtures";
import { ADDRESS_ZERO } from "@utils/constants";

const expect = getWaffleExpect();

describe("CustomOracleSetValuer", () => {
  let owner: Account, moduleOne: Account;
  let setToken: SetToken;
  let deployer: DeployHelper;
  let setup: SystemFixture;
  let diaOracle: DIAOracle;
  let diaPriceOracle: DIAPriceOracle;
  let customOracleSetValuer: CustomOracleSetValuer;
  const component1Price: BigNumber = ether(230);
  const component2Price: BigNumber = ether(1);
  const component4Price: BigNumber = ether(1);

  const component1PriceFromDiaOracle: BigNumber = BigNumber.from(230 * 10 ** 5);
  const component2PriceFromDiaOracle: BigNumber = BigNumber.from(1 * 10 ** 5);
  const component4PriceFromDiaOracle: BigNumber = BigNumber.from(1 * 10 ** 5);

  let components: Address[];
  let units: BigNumber[];
  let baseUnits: BigNumber[];
  let modules: Address[];

  beforeEach(async () => {
    [owner, moduleOne] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);
    setup = getSystemFixture(owner.address);
    await setup.initialize();
    diaOracle = await deployer.external.deployDIAOracle();
    diaPriceOracle = await deployer.core.deployDIAPriceOracle(
      setup.usdc.address,
      diaOracle.address
    );
    await diaOracle.updateCoinInfo("weth", "weth", component1PriceFromDiaOracle, "0", Date.now().toString());
    await diaPriceOracle.addPair(setup.weth.address, setup.usdc.address, "weth");

    await diaOracle.updateCoinInfo("dai", "dai", component4PriceFromDiaOracle, "0", Date.now().toString());
    await diaPriceOracle.addPair(setup.dai.address, setup.usdc.address, "dai");

    // The set valuer asks the valuation of a token in terms of itself, that's expected
    await diaOracle.updateCoinInfo("usdc", "usdc", component2PriceFromDiaOracle, "0", Date.now().toString());
    await diaPriceOracle.addPair(setup.usdc.address, setup.usdc.address, "usdc");

    customOracleSetValuer = await deployer.core.deployCustomOracleSetValuer(diaPriceOracle.address);

    await setup.controller.addModule(moduleOne.address);

    components = [setup.usdc.address, setup.weth.address];
    // 100 USDC at $1 and 1 WETH at $230
    units = [usdc(100), ether(1)];
    // Base units of USDC and WETH
    baseUnits = [usdc(1), ether(1)];

    modules = [moduleOne.address];

    setToken = await setup.createSetToken(components, units, modules);

    setToken = setToken.connect(moduleOne.wallet);
    await setToken.initializeModule();
  });

  addSnapshotBeforeRestoreAfterEach();

  describe("#constructor", async () => {
    async function subject(): Promise<CustomOracleSetValuer> {
      return deployer.core.deployCustomOracleSetValuer(diaPriceOracle.address);
    }

    it("should have the correct price oracle address", async () => {
      const setValuer = await subject();

      const actualOracleAddress = await setValuer.priceOracle();
      expect(actualOracleAddress).to.eq(diaPriceOracle.address);
    });
  });

  describe("#calculateSetTokenValuation", async () => {
    let subjectSetToken: Address;
    let subjectQuoteAsset: Address;

    beforeEach(async () => {
      subjectSetToken = setToken.address;
      subjectQuoteAsset = setup.usdc.address;
    });

    async function subject(): Promise<any> {
      setToken = setToken.connect(owner.wallet);
      return customOracleSetValuer.calculateSetTokenValuation(
        subjectSetToken,
        subjectQuoteAsset
      );
    }

    it("should calculate correct SetToken valuation", async () => {
      const setTokenValuation = await subject();

      const normalizedUnitOne = preciseDiv(units[0], baseUnits[0]);
      const normalizedUnitTwo = preciseDiv(units[1], baseUnits[1]);

      const expectedValuation = preciseMul(
        normalizedUnitOne, component2Price
      ).add(preciseMul(
        normalizedUnitTwo, component1Price
      ));
      expect(setTokenValuation).to.eq(expectedValuation);
    });

    describe("when the quote asset is not the master quote asset", async () => {
      beforeEach(async () => {
        subjectQuoteAsset = setup.weth.address;
      });

      it("should calculate correct SetToken valuation", async () => {
        const setTokenValuation = await subject();

        const normalizedUnitOne = preciseDiv(units[0], baseUnits[0]);
        const normalizedUnitTwo = preciseDiv(units[1], baseUnits[1]);

        const quoteToMasterQuote = await setup.ETH_USD_Oracle.read();

        const masterQuoteValuation = preciseMul(
          normalizedUnitOne, component2Price
        ).add(preciseMul(
          normalizedUnitTwo, component1Price
        ));
        const expectedValuation = preciseDiv(masterQuoteValuation, quoteToMasterQuote);

        expect(setTokenValuation).to.eq(expectedValuation);
      });
    });

    describe("when a Set token has an external position", async () => {
      let externalUnits: BigNumber;

      beforeEach(async () => {
        externalUnits = ether(100);
        setToken = setToken.connect(moduleOne.wallet);
        await setToken.addExternalPositionModule(setup.usdc.address, ADDRESS_ZERO);
        await setToken.editExternalPositionUnit(setup.usdc.address, ADDRESS_ZERO, externalUnits);
      });

      it("should calculate correct SetToken valuation", async () => {
        const setTokenValuation = await subject();

        const expectedValuation = preciseMul(
          preciseDiv(units[0].add(externalUnits), baseUnits[0]), component4Price
        ).add(preciseMul(
          preciseDiv(units[1], baseUnits[1]), component1Price
        ));
        expect(setTokenValuation).to.eq(expectedValuation);
      });
    });

    describe("when a Set token has a negative external position", async () => {
      let externalUnits: BigNumber;

      beforeEach(async () => {
        // Edit external DAI units to be negative
        externalUnits = usdc(-10);
        setToken = setToken.connect(moduleOne.wallet);
        await setToken.addExternalPositionModule(setup.usdc.address, ADDRESS_ZERO);
        await setToken.editExternalPositionUnit(setup.usdc.address, ADDRESS_ZERO, externalUnits);
      });

      it("should calculate correct SetToken valuation", async () => {
        const setTokenValuation = await subject();
        const expectedValuation = preciseMul(
          preciseDiv(units[0].add(externalUnits), baseUnits[0]), component4Price
        ).add(preciseMul(
          preciseDiv(units[1], baseUnits[1]), component1Price
        ));
        expect(setTokenValuation).to.eq(expectedValuation);
      });
    });

    describe("when valuation is negative", async () => {
      let externalUnits: BigNumber;

      beforeEach(async () => {
        // Edit external DAI units to be greatly negative
        externalUnits = ether(-500);
        setToken = setToken.connect(moduleOne.wallet);
        await setToken.addExternalPositionModule(setup.usdc.address, ADDRESS_ZERO);
        await setToken.editExternalPositionUnit(setup.usdc.address, ADDRESS_ZERO, externalUnits);
      });

      it("should revert", async () => {
          await expect(subject()).to.be.revertedWith("SafeCast: value must be positive");
        });
    });
  });
});
