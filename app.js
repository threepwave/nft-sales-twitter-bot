// external
const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
const { ethers } = require("ethers");
const retry = require("async-retry");
const _ = require("lodash");

// local
const { markets } = require("./markets.js");
const { currencies } = require("./currencies.js");
const { getTokenData, getSeaportSalePrice } = require("./utils.js");
const { transferEventTypes, saleEventTypes } = require("./log_event_types.js");
const { tweet } = require("./tweet");
const abi = require("./abi.json");

const { discord } = require("./discord");

// connect to Alchemy websocket
const web3 = createAlchemyWeb3(
  `wss://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`
);

// sometimes web3.js can return duplicate transactions in a split second, so
let lastTransactionHash;

// Image URL setup for self-hosted PNGs
const cdn = "https://img.cryptsandcaverns.com/img/";

async function monitorContract() {
  try {
    const contract = new web3.eth.Contract(abi, process.env.CONTRACT_ADDRESS);

    contract.events
      .Transfer({})
      .on("connected", (subscriptionId) => {
        console.log("connected");
        console.log(subscriptionId);
      })
      .on("data", async (data) => {
        const transactionHash = data.transactionHash.toLowerCase();

        // duplicate transaction - skip process
        if (transactionHash == lastTransactionHash) {
          return;
        }

        lastTransactionHash = transactionHash;

        console.log(`Data received: ${transactionHash}`);

        // attempt to retrieve the receipt, sometimes not available straight away
        const receipt = await retry(
          async (bail) => {
            const rec = await web3.eth.getTransactionReceipt(transactionHash);

            if (rec == null) {
              throw new Error("receipt not found, try again");
            }

            return rec;
          },
          {
            retries: 5,
          }
        );

        const recipient = receipt.to.toLowerCase();

        // not a marketplace transaction transfer, skip
        if (!(recipient in markets)) {
          return;
        }

        // retrieve market details
        const market = _.get(markets, recipient);

        // default to eth, see currencies.js for currently support currencies
        let currency = {
          name: "ETH",
          decimals: 18,
          threshold: 1,
        };
        let tokens = [];
        let totalPrice;

        for (let log of receipt.logs) {
          const logAddress = log.address.toLowerCase();

          // if non-ETH transaction
          if (logAddress in currencies) {
            currency = currencies[logAddress];
          }

          // token(s) part of the transaction
          if (log.data == "0x" && transferEventTypes.includes(log.topics[0])) {
            const tokenId = web3.utils.hexToNumberString(log.topics[3]);

            tokens.push(tokenId);
          }

          // transaction log - decode log in correct format depending on market & retrieve price
          if (
            logAddress == recipient &&
            saleEventTypes.includes(log.topics[0])
          ) {
            const decodedLogData = web3.eth.abi.decodeLog(
              market.logDecoder,
              log.data,
              []
            );

            console.log("decodedLogData");
            console.log(decodedLogData);

            console.log("market:");
            console.log(market);

            if (market.name.includes("Opensea")) {
              totalPrice += getSeaportSalePrice(decodedLogData);
            } else if (market.name.includes("X2Y2")) {
              totalPrice += ethers.utils.formatUnits(
                decodedLogData.amount,
                currency.decimals
              );
            } else {
              totalPrice += ethers.utils.formatUnits(
                decodedLogData.price,
                currency.decimals
              );
            }
          }
        }

        // remove any dupes
        tokens = _.uniq(tokens);

        // retrieve metadata for the first (or only) ERC721 asset sold
        const tokenData = await getTokenData(tokens[0]);

        // @HACK - Alert when a new sale happens
        console.log(`https://etherscan.io/tx/${transactionHash}`);

        // Construct the image url
        const image_png = `${cdn}${tokens[0]}.png`;

        // if more than one asset sold, link directly to etherscan tx, otherwise the marketplace item
        if (tokens.length > 1) {
          tweet(
            `
                ${_.get(
                  tokenData,
                  "assetName",
                  `#` + tokens[0]
                )} & other assets bought for ${totalPrice} ${currency.name}

                tx: https://etherscan.io/tx/${transactionHash}
                `,
            image_png
          );

          discord(
            `Purchased for ${totalPrice} ${currency.name}`,
            name,
            tokens[0],
            `${market.site}${process.env.CONTRACT_ADDRESS}/${tokens[0]}`,
            image_png
            // traits
          );
        } else {
          // Add 'from' and 'to' in the future
          // console.log(`from: ${data.returnValues.from}`);
          // console.log(`to: ${data.returnValues.to}`);

          // construct metadata from opensea api
          const name = _.get(
            tokenData,
            "assetName",
            `Crypts and Caverns #` + tokens[0]
          );
          const traits = _.get(tokenData, "traits", null);
          const url = `${market.site}${process.env.CONTRACT_ADDRESS}/${tokens[0]}`;

          // Attach png url for discord attachments (has issues with svg embeds)

          tweet(
            `${name} bought for ${totalPrice} ${currency.name} ${url}`,
            image_png
          );
          discord(
            `Purchased for ${totalPrice} ${currency.name}`,
            name,
            tokens[0],
            `${market.site}${process.env.CONTRACT_ADDRESS}/${tokens[0]}`,
            image_png
            // traits
          );
        }
      })
      .on("changed", (event) => {
        console.log("change");
      })
      .on("error", (error, receipt) => {
        // if the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
        console.error(error);
        console.error(receipt);
      });
  } catch (e) {
    console.log(e);
  }
}

// initate websocket connection
monitorContract();
