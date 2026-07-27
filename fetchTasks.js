require('dotenv').config();
const { WebClient } = require('@slack/web-api');
const fs = require('fs');

const client = new WebClient(process.env.SLACK_USER_TOKEN, {
  retryConfig: { retries: 3, factor: 2 },
  timeout: 15000,
});

const TASK_EMOJI = process.env.TASK_EMOJI;
const LOG_FILE = 'flag_log.json';

function loadLog() {
  if (!fs.existsSync(LOG_FILE)) return {};
  return JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
}

async function fetchFlaggedTasks() {
  const log = loadLog(); // key: "channel:ts" -> { first_seen: ISO date }
  let tasks = [];
  let cursor;

  do {
    let res;
    try {
      res = await client.reactions.list({ limit: 100, cursor, full: true });
    } catch (e) {
      console.error(`Slack API error (reactions.list): ${e.data?.error || e.message}`);
      throw new Error('fetchFlaggedTasks aborted at reactions.list');
    }

    for (const item of res.items) {
      if (item.type !== 'message') continue;
      const hasTaskReaction = item.message.reactions?.some((r) => r.name === TASK_EMOJI);
      if (!hasTaskReaction) continue;

      const key = `${item.channel}:${item.message.ts}`;

      if (!log[key]) {
        log[key] = { first_seen: new Date().toISOString() };
      }

      tasks.push({
        channel: item.channel,
        ts: item.message.ts,
        flaggedAt: log[key].first_seen,
        text: item.message.text,
        user: item.message.user,
        permalink: null,
      });
    }

    cursor = res.response_metadata?.next_cursor;
  } while (cursor);

  for (const task of tasks) {
    try {
      const linkRes = await client.chat.getPermalink({ channel: task.channel, message_ts: task.ts });
      task.permalink = linkRes.permalink;
    } catch (e) {
      // Non-fatal: a missing permalink shouldn't kill the whole run.
      console.warn(`Could not fetch permalink for ts=${task.ts}: ${e.data?.error || e.message}`);
    }
  }

  fs.writeFileSync('tasks.json', JSON.stringify(tasks, null, 2));
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
  console.log(`Saved ${tasks.length} flagged tasks to tasks.json`);
}

fetchFlaggedTasks().catch((e) => {
  console.error(`fetchTasks failed: ${e.message}`);
  process.exit(1);
});
