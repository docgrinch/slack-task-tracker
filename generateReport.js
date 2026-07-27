require('dotenv').config();
const { WebClient } = require('@slack/web-api');
const fs = require('fs');

const client = new WebClient(process.env.SLACK_USER_TOKEN);

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? 6 : day - 1);
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function decodeSlackText(text) {
  return text
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '[$2]($1)') // Slack link -> Markdown link
    .replace(/<(https?:\/\/[^>]+)>/g, '$1');
}

async function generateReport() {
  const tasks = JSON.parse(fs.readFileSync('tasks.json', 'utf-8'));
  const thisWeekStart = startOfWeek(new Date());

  const channelNames = {};
  for (const t of tasks) {
    if (!channelNames[t.channel]) {
      try {
        const info = await client.conversations.info({ channel: t.channel });
        channelNames[t.channel] = info.channel.name || info.channel.user || t.channel;
      } catch (e) {
        channelNames[t.channel] = t.channel;
      }
    }
  }

  const enriched = tasks.map((t) => {
    const sentDate = new Date(parseFloat(t.ts) * 1000);
    const flaggedDate = new Date(t.flaggedAt);
    return {
      ...t,
      channelName: channelNames[t.channel],
      sentDate,
      flaggedDate,
      sentThisWeek: sentDate >= thisWeekStart,
      flaggedThisWeek: flaggedDate >= thisWeekStart,
      text: decodeSlackText(t.text),
    };
  });

  // Report scope: anything newly flagged this week (this is "what entered your queue this week")
  const relevant = enriched.filter((t) => t.flaggedThisWeek);

  const grouped = {};
  for (const t of relevant) {
    grouped[t.channelName] = grouped[t.channelName] || [];
    grouped[t.channelName].push(t);
  }

  let md = `# 📋 Weekly Task Report\n\n`;
  md += `**Week of:** ${thisWeekStart.toDateString()}\n`;
  md += `**Total tasks flagged this week:** ${relevant.length}\n\n`;

  if (relevant.length === 0) md += `_No tasks flagged this week._\n`;

  for (const [channel, items] of Object.entries(grouped)) {
    md += `## #${channel}\n\n`;
    for (const t of items) {
      const originTag = t.sentThisWeek ? '🆕 new this week' : `📅 originally sent ${t.sentDate.toDateString()}`;
      md += `- [ ] ${t.text.replace(/\n/g, ' ')} — _${originTag}_ · flagged ${t.flaggedDate.toDateString()} — [link](${t.permalink})\n`;
    }
    md += `\n`;
  }

  fs.writeFileSync('weekly_report.md', md);
  console.log('Report written to weekly_report.md');
}

generateReport();
