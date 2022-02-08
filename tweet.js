const twit = require('twit');

const twitterConfig = {
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token: process.env.ACCESS_TOKEN_KEY,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET,
};

const twitterClient = new twit(twitterConfig);

// Tweet a text-based status
async function tweet(tweetText, tweetImage) {
    const tweet = {
        status: tweetText,
    };

    twitterClient.post('media/upload', {media_data: tweetImage.toString('base64')}, function(error, media, response) {
        if (!error) {      
          // If successful, a media object will be returned.
          // Lets tweet it
          var status = {
            status: tweetText,
            media_ids: media.media_id_string // Pass the media id string
          }
      
          twitterClient.post('statuses/update', status, (error, tweet, response) => {
                if (!error) {
                    console.log(`Successfully tweeted: ${tweetText}`);
                } else {
                    console.error(error);
                }
            });
      
        } else {
            console.error(error);
        }
      });

    
}


module.exports = {
    tweet: tweet,
};