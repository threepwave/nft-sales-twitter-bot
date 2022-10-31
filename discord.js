/* Post to discord webook 

Intro to Discord webhooks: https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks
Webhook post spec: https://discord.com/developers/docs/resources/webhook#execute-webhook
*/

const _ = require("lodash");
const axios = require("axios");

const discordConfig = {
  webhook_url: process.env.DISCORD_WEBHOOK,
};

// async function discord(text, name, tokenId, url, image, traits) {
async function discord(text, name, tokenId, url, image) {
  try {
    console.log("discord:");
    console.log(text);
    console.log(name);
    console.log(tokenId);
    console.log(url);
    console.log(image);
    // Opensea Property Fields
    // const fields = assembleFields(traits);
    const metadata = [
      {
        title: name,
        url: url,
        image: {
          url: image,
        },
        description: text,
        // fields: fields,
      },
    ];

    // Post text to discord webhook URL
    const message = await axios.post(discordConfig.webhook_url, {
      content: null,
      embeds: metadata,
      // file: img,
    });
  } catch (error) {
    console.error(error);
  }
}

function assembleFields(traits) {
  // construct attribute metadata from opensea api

  // Sort traits so we can predict the order and pluck values
  const { compare } = Intl.Collator("en-US");
  traits.sort((a, b) => compare(a.trait_type, b.trait_type));
  let fields = [
    {
      name: "Name",
      value: traits[4].value,
      inline: false,
    },
    {
      name: "Environment",
      value: traits[2].value,
      inline: true,
    },
    {
      name: "Affinity",
      value: traits[0].value,
      inline: true,
    },
    {
      name: "Legendary",
      value: traits[3].value,
      inline: true,
    },
    {
      name: "Size",
      value: traits[6].value,
      inline: true,
    },
    {
      name: "Points",
      value: traits[5].value,
      inline: true,
    },
    {
      name: "Doors",
      value: traits[1].value,
      inline: true,
    },
    {
      name: "Structure",
      value: traits[7].value,
      inline: true,
    },
  ];

  return fields;
}

module.exports = {
  discord: discord,
};
