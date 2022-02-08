/* svg.js - Grab an SVG from opensea and convert it to post to twitter */

const sharp = require('sharp');
const axios = require('axios');

async function svg(url) {
   const file = await axios.get(url, { responseType: 'arrayBuffer'});

   const image = await sharp(Buffer.from(file.data)).png().toBuffer().then((info) => {
        return(info)
   });

   return(image);
}


module.exports = {
    svg: svg,
};