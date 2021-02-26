import "module-alias/register";

import { Account } from "@utils/test/types";
import { BigNumber } from "@ethersproject/bignumber";

import { DIAPriceOracle, DIAOracle } from "@utils/contracts";
import { SystemFixture } from "@utils/fixtures";
import DeployHelper from "@utils/deploys";
import {
  getAccounts,
  getSystemFixture,
  getWaffleExpect
} from "@utils/test/index";
import {
  ether,
} from "@utils/index";

const expect = getWaffleExpect();

const inverse = (number: BigNumber): BigNumber => {
  return ether(1).mul(ether(1)).div(number);
};

describe("DIAPriceOracle", () => {
  let wallet: Account;

  let setup: SystemFixture;
  let unrelatedUser: Account;
  const identifier: string = "ETH/USD";
  const ethPriceWithDiaDecimals = "180322583";
  const btcPriceWithDiaDecimals = "5173342229";
  const ethPriceInWad = ether("1803.22583");
  const btcPriceInWad = ether("51733.42229");

  let diaOracle: DIAOracle;
  let diaPriceOracle: DIAPriceOracle;

  let deployer: DeployHelper;

  const configure = async () => {
    // Using this syntax for sol-coverage to work
    [wallet, unrelatedUser ] = await getAccounts();
    setup = getSystemFixture(wallet.address);
    await setup.initialize();

    deployer = new DeployHelper(wallet.wallet);

    diaOracle = await deployer.external.deployDIAOracle();

    diaPriceOracle = await deployer.core.deployDIAPriceOracle(
      setup.usdc.address,
      diaOracle.address
    );
  };

  describe("constructor", async () => {
    before(configure);
    it("should have the masterQuoteAsset configured", async () => {
      expect(await diaPriceOracle.masterQuoteAsset()).to.eq(setup.usdc.address);
    });
    it("should have the underlyingOracle configured", async () => {
      expect(await diaPriceOracle.underlyingOracle()).to.eq(diaOracle.address);
    });
  });

  describe("adding and removing a pair", async () => {
    before(configure);
    it(
      "WHEN there is no price feed configured, THEN it should revert",
       () => expect(diaPriceOracle.getPrice(setup.weth.address, setup.usdc.address)).to.be.revertedWith("Price feed not available")
      );

    describe("GIVEN a valid price feed", () => {
      before(() => diaOracle.updateCoinInfo(identifier, identifier, ethPriceWithDiaDecimals, 0, Date.now().toString()));
      describe("WHEN adding a pair to a DiaPriceOracle", () => {
        // Should be TransactionResponse, but i don't actually know from where to import it
        let addPairResponse: any;
        before(async() =>  {
          addPairResponse = diaPriceOracle.addPair(setup.weth.address, setup.usdc.address, identifier);
          await addPairResponse;
        });
        it("THEN the pricefeed identifier can be retrieved", async() => {
          expect((await diaPriceOracle.getPriceIdentifier(setup.weth.address, setup.usdc.address)).identifier).to.eq(identifier);
        });
        it(
          "AND an event is emmitted",
           () => expect(addPairResponse).to.emit(diaPriceOracle, "PairAdded").withArgs(setup.weth.address, setup.usdc.address, identifier, "")
          );
        it("AND the price value can be retrieved", async() => {
          expect(await diaPriceOracle.getPrice(setup.weth.address, setup.usdc.address)).to.eq(ethPriceInWad);
        });

        describe("AND WHEN removing a price feed", () => {
          let removePairResponse: any;
          before(async () => {
            removePairResponse = diaPriceOracle.removePair(setup.weth.address, setup.usdc.address);
            await removePairResponse;
          });
          it("THEN queries for it should revert", () => expect(diaPriceOracle.getPrice(setup.weth.address, setup.usdc.address)).to.be.revertedWith("Price feed not available"));
          it(
            "AND an event is emmitted",
             () => expect(removePairResponse).to.emit(diaPriceOracle, "PairRemoved").withArgs(setup.weth.address, setup.usdc.address, identifier)
          );
        });
      });
    });
  });

  describe("overriding a pair", () => {
    before(configure);
    const otherIdentifier = "meme";
    describe("GIVEN a diaPriceOracle with a pricefeed", () => {
      before(() =>  diaPriceOracle.addPair(setup.weth.address, setup.usdc.address, identifier) );
      describe("WHEN adding a pricefeed with the same tokens again", () => {
        let response: any;
        before(async() => {
          response = diaPriceOracle.addPair(setup.weth.address, setup.usdc.address, otherIdentifier);
          await response;
        });
        it("THEN the second pricefeed overwrites the first", async () => {
          expect((await diaPriceOracle.getPriceIdentifier(setup.weth.address, setup.usdc.address)).identifier).to.eq(otherIdentifier);
        });
        it(
          "AND an event is emitted",
           () => expect(response).to.emit(diaPriceOracle, "PairAdded").withArgs(setup.weth.address, setup.usdc.address, otherIdentifier, identifier)
        );
      });
    });
  });

  describe("removing a pair that wasnt added", () => {
    before(configure);
    it(
      "WHEN removing a non-existent pair, THEN it should revert",
       () =>  expect(diaPriceOracle.removePair(setup.weth.address, setup.usdc.address)).to.be.revertedWith("Pair does not exist")
    );
  });

  describe("add/remove permissions", () => {
    before(configure);
    it( "Only the contract admin should be able to add a pair", async() => {
      const connectedDiaPriceOracle: DIAPriceOracle = diaPriceOracle.connect(unrelatedUser.wallet);
      await expect(
        connectedDiaPriceOracle.addPair(setup.weth.address, setup.usdc.address, identifier)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    describe("GIVEN a diaPriceOracle with a pricefeed configured", () => {
      before(() => diaPriceOracle.addPair(setup.weth.address, setup.usdc.address, identifier));
      it("WHEN trying to remove it as an unauthorized user, THEN it should revert", async() => {
        const connectedDiaPriceOracle: DIAPriceOracle = diaPriceOracle.connect(unrelatedUser.wallet);
        await expect(
          connectedDiaPriceOracle.removePair(setup.weth.address, setup.usdc.address))
          .to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("decimal conversions", () => {
    before(configure);
    describe("GIVEN a diaPriceOracle with a five-decimal DIA pricefeed denominated in USD", () => {
      const wethUsdcIdentifier = "weth";
      before(async () =>  {
        await diaPriceOracle.addPair(setup.weth.address, setup.usdc.address, wethUsdcIdentifier);
        // Price of ETH right now, as returned by the dia oracle
        await diaOracle.updateCoinInfo(wethUsdcIdentifier, wethUsdcIdentifier, ethPriceWithDiaDecimals, 0, Date.now().toString());
      });

      it(
        "WHEN asking for a WETH (18 decimal) price denominated in USDC, THEN the diaPriceOracle returns the price with WAD precision",
        async() => {
          expect(await diaPriceOracle.getPrice(setup.weth.address, setup.usdc.address)).to.eq(ethPriceInWad);
      });
    });

    describe("GIVEN a diaPriceOracle with a five-decimal DIA pricefeed denominated in USD", () => {
      const btcUsdcIdentifier = "bitcoin";
      before(async () =>  {
        await diaPriceOracle.addPair(setup.wbtc.address, setup.usdc.address, btcUsdcIdentifier);
        // Price of btc right now, as returned by the dia oracle
        await diaOracle.updateCoinInfo(btcUsdcIdentifier, btcUsdcIdentifier, btcPriceWithDiaDecimals, 0, Date.now().toString());
      });

      it(
        "WHEN asking for a WBTC (8 decimal) price denominated in USDC, THEN the diaPriceOracle returns the price with WAD precision",
        async() => {
          expect(await diaPriceOracle.getPrice(setup.wbtc.address, setup.usdc.address)).to.eq(btcPriceInWad);
      });
      it(
        "AND WHEN asking for a USDC (6 decimal) price denominated in WBTC, THEN the diaPriceOracle returns the price with WAD precision",
        async() => {
          expect(await diaPriceOracle.getPrice(setup.usdc.address, setup.wbtc.address)).to.eq(inverse(btcPriceInWad));
      });
    });
  });

  describe("inverse prices", () => {
    before(configure);
    describe("GIVEN a diaPriceOracle with a A/B pricefeed", () => {
      before(async () =>  {
        await diaPriceOracle.addPair(setup.weth.address, setup.usdc.address, identifier);
        // Price of ETH right now, as returned by the dia oracle
        await diaOracle.updateCoinInfo(identifier, identifier, ethPriceWithDiaDecimals, 0, Date.now().toString());
      });
      it("THEN the identifier for B/A is the same AND the inverse flag is on", async () => {
        const result = await diaPriceOracle.getPriceIdentifier(setup.usdc.address, setup.weth.address);
        expect(result.identifier).to.eq(identifier);
        expect(result.inverse).to.be.true;
      });

      it("AND WHEN asking for the B/A pricefeed, THEN it should provide it", async() => {
        // 1 usdc denominated in eth
        expect(await diaPriceOracle.getPrice(setup.usdc.address, setup.weth.address)).to.eq(inverse(ethPriceInWad));
      });
    });
  });
});
