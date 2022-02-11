// external
const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
const axios = require('axios');
const _ = require('lodash');
// local
const { markets } = require('./markets.js');
const { currencies } = require('./currencies.js');
const { transferEventTypes, saleEventTypes } = require('./log_event_types.js');
const { tweet } = require('./tweet');
const abi = require('./abi.json');

const { svg } = require('./svg')
const { discord } = require('./discord');


// connect to Alchemy websocket
const web3 = createAlchemyWeb3(`wss://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`);

async function monitorContract() {
    /*
    // retrieve metadata for the first (or only) ERC21 asset sold
    const tokenData = await getTokenData(601);

    // construct metadata
    const name = _.get(tokenData, 'assetName', null);
    const traits = _.get(tokenData, 'traits', null);

    // construct image from opensea svg
    const image_url = _.get(tokenData, 'image_url', null);
    const image = await svg(image_url); // Convert url to base64 image buffer
    const token = 601;
    const url = 'https://opensea.io/assets/0x86f7692569914b5060ef39aab99e62ec96a6ed45/5057'
    const text = 'Purchased for 12431 ETH'
    
    discord(text, name, 601, url, image, traits); 
    */

    const contract = new web3.eth.Contract(abi, process.env.CONTRACT_ADDRESS);

    contract.events.Transfer({})
        .on('connected', (subscriptionId) => {
            console.log(subscriptionId);
        })
        .on('data', async (data) => {
            const receipt = await web3.eth.getTransactionReceipt(data.transactionHash);

            const recipient = receipt.to.toLowerCase();

            // not a marketplace transaction transfer, skip
            if (!(recipient in markets)) {
                return;
            }

            // retrieve market details
            const market = _.get(markets, recipient);

            // default to eth, see currencies.js for currently support currencies
            let currency = {
                'name': 'ETH',
                'decimals': 18,
                'threshold': 1
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
                if (logAddress == recipient && saleEventTypes.includes(log.topics[0])) {
                    const decodedLogData = web3.eth.abi.decodeLog(market.logDecoder, log.data, []);

                    totalPrice = web3.utils.fromWei(decodedLogData.price);
                }
            }

            // custom - don't post sales below a currencies manually set threshold
            // if (Number(totalPrice) < currency.threshold) {
            //     console.log(`Sale under ${currency.threshold}: Token ID: ${tokens[0]}, Price: ${totalPrice}`);

            //     return;
            // }

            // retrieve metadata for the first (or only) ERC21 asset sold
            const tokenData = await getTokenData(tokens[0]);

            // construct image from opensea svg
            const image_url = _.get(tokenData, 'image_url', null);
            const image = await svg(image_url); // Convert url to base64 image buffer

            // if more than one asset sold, link directly to etherscan tx, otherwise the marketplace item
            if (tokens.length > 1) {
                tweet(`
                ${_.get(tokenData, 'assetName', `#` + tokens[0])} & other assets bought for ${totalPrice} ${currency.name}

                tx: https://etherscan.io/tx/${data.transactionHash}
                `, image);
            } else {
                console.log('data');
                console.log(data);
                console.log(`from: ${data.returnValues.from}`);
                console.log(`to: ${data.returnValues.to}`);

                // construct metadata from opensea api
                const name = _.get(tokenData, 'assetName', `Crypts and Caverns #` + tokens[0])
                const traits = _.get(tokenData, 'traits', null);
                const url = `${market.site}${process.env.CONTRACT_ADDRESS}/${tokens[0]}`

                // convert image from SVG -> PNG
                const image_url = _.get(tokenData, 'image_url', null);
                const image = await svg(image_url); // Convert url to base64 image buffer
                
                tweet(`${name} bought for ${totalPrice} ${currency.name} ${url}`, image);                
                discord(`Purchased for ${totalPrice} ${currency.name}`, name, tokens[0], `${market.site}${process.env.CONTRACT_ADDRESS}/${tokens[0]}`, image, traits); 
            }
        })
        .on('changed', (event) => {
            console.log('change');
        })
        .on('error', (error, receipt) => {
            // if the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
            console.error(error);
            console.error(receipt);
        }); 
} 

async function getTokenData(tokenId) {
    try {
        // retrieve metadata for asset from opensea
        const response = await axios.get(`https://api.opensea.io/api/v1/asset/${process.env.CONTRACT_ADDRESS}/${tokenId}`, {
            headers: {
                'X-API-KEY': process.env.X_API_KEY
            }
        });

        const data = response.data;

        // just the asset name for now, but retrieve whatever you need
        return {
            'assetName': _.get(data, 'name'),
            'image_url': _.get(data, 'image_url'),
            'traits': _.get(data, 'traits')
        };
    } catch (error) {
        console.error(error);
    }
}

// initate websocket connection
monitorContract(); 