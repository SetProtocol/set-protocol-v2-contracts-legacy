import "module-alias/register";

import { Account } from "@utils/test/types";
import { BigNumber } from "@ethersproject/bignumber";

import { DIAPriceOracle, DIAOracle } from "@utils/contracts";
import DeployHelper from "@utils/deploys";
import {
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

  const configure = async () => {
    // Using this syntax for sol-coverage to work
    [wallet, usdc, weth, unrelatedUser ] = await getAccounts();

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

  describe("adding and removing a pair", async () => {
    before(configure);
    const ethPrice: BigNumber = ether(1500);
    it(
      "WHEN there is no price feed configured, THEN it should revert",
       () => expect(diaPriceOracle.getPrice(weth.address, usdc.address)).to.be.revertedWith("Price feed not available")
      );

    describe("GIVEN a valid price feed", () => {
      before(() => diaOracle.updateCoinInfo(identifier, identifier, ethPrice, 0, Date.now().toString()));
      describe("WHEN adding a pair to a DiaPriceOracle", () => {
        // Should be TransactionResponse, but i don't actually know from where to import it
        let addPairResponse: any;
        before(async() =>  {
          addPairResponse = diaPriceOracle.addPair(weth.address, usdc.address, identifier);
          await addPairResponse;
        });
        it("THEN the pricefeed identifier can be retrieved", async() => {
          expect(await diaPriceOracle.getPriceIdentifier(weth.address, usdc.address)).to.eq(identifier);
        });
        it(
          "AND an event is emmitted",
           () => expect(addPairResponse).to.emit(diaPriceOracle, "PairAdded").withArgs(weth.address, usdc.address, identifier, "")
          );
        it("AND the price value can be retrieved", async() => {
          expect(await diaPriceOracle.getPrice(weth.address, usdc.address)).to.eq(ethPrice);
        });

        describe("AND WHEN removing a price feed", () => {
          let removePairResponse: any;
          before(async () => {
            removePairResponse = diaPriceOracle.removePair(weth.address, usdc.address);
            await removePairResponse;
          });
          it("THEN queries for it should revert", () => expect(diaPriceOracle.getPrice(weth.address, usdc.address)).to.be.revertedWith("Price feed not available"));
          it(
            "AND an event is emmitted",
             () => expect(removePairResponse).to.emit(diaPriceOracle, "PairRemoved").withArgs(weth.address, usdc.address, identifier)
          );
        });
      });
    });
  });

  describe("overriding a pair", () => {
    before(configure);
    const otherIdentifier = "meme";
    describe("GIVEN a diaPriceOracle with a pricefeed", () => {
      before(() =>  diaPriceOracle.addPair(weth.address, usdc.address, identifier) );
      describe("WHEN adding a pricefeed with the same tokens again", () => {
        let response: any;
        before(async() => {
          response = diaPriceOracle.addPair(weth.address, usdc.address, otherIdentifier);
          await response;
        });
        it("THEN the second pricefeed overwrites the first", async () => {
          expect(await diaPriceOracle.getPriceIdentifier(weth.address, usdc.address)).to.eq(otherIdentifier);
        });
        it(
          "AND an event is emitted",
           () => expect(response).to.emit(diaPriceOracle, "PairAdded").withArgs(weth.address, usdc.address, otherIdentifier, identifier)
        );
      });
    });
  });

  describe("removing a pair that wasnt added", () => {
    before(configure);
    it(
      "WHEN removing a non-existent pair, THEN it should revert",
       () =>  expect(diaPriceOracle.removePair(weth.address, usdc.address)).to.be.revertedWith("Pair does not exist")
    );
  });

  describe("add/remove permissions", () => {
    before(configure);
    it( "Only the contract admin should be able to add a pair", async() => {
      const connectedDiaPriceOracle: DIAPriceOracle = diaPriceOracle.connect(unrelatedUser.wallet);
      await expect(
        connectedDiaPriceOracle.addPair(weth.address, usdc.address, identifier)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    describe("GIVEN a diaPriceOracle with a pricefeed configured", () => {
      before(() => diaPriceOracle.addPair(weth.address, usdc.address, identifier));
      it("WHEN trying to remove it as an unauthorized user, THEN it should revert", async() => {
        const connectedDiaPriceOracle: DIAPriceOracle = diaPriceOracle.connect(unrelatedUser.wallet);
        await expect(connectedDiaPriceOracle.removePair(weth.address, usdc.address)).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });
});
