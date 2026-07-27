require('dotenv').config();
const { WebClient } = require('@slack/web-api');
const fs = require('fs');

const client = new WebClient(process.env.SLACK_USER_TOKEN, {
  retryConfig: { retries: 3, factor: 2 },
  timeout: 15000,
});

async function postReport() {
  let md;
  try {
    md = fs.readFileSync('weekly_report.md', 'utf-8');
  } catch (e) {
    console.error(`Could not read weekly_report.md: ${e.message}`);
    throw new Error('postReport aborted: report file missing');
  }

  let myUserId;
  try {
    const auth = await client.auth.test();
    myUserId = auth.user_id;
  } catch (e) {
    console.error(`Slack API error (auth.test): ${e.data?.error || e.message}`);
    throw new Error('postReport aborted at auth.test');
  }

  let imChannelId;
  try {
    const im = await client.conversations.open({ users: myUserId });
    imChannelId = im.channel.id;
  } catch (e) {
    console.error(`Slack API error (conversations.open): ${e.data?.error || e.message}`);
    throw new Error('postReport aborted at conversations.open');
  }

  try {
    await client.chat.postMessage({
      channel: imChannelId,
      text: md,
      unfurl_links: false,
    });
  } catch (e) {
    console.error(`Slack API error (chat.postMessage): ${e.data?.error || e.message}`);
    throw new Error('postReport aborted at chat.postMessage');
  }

  console.log(`Report posted to Slack DM (${imChannelId})`);
}

postReport().catch((e) => {
  console.error(`postReport failed: ${e.message}`);
  process.exit(1);
});
