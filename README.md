# Slack Weekly Task Tracker

Turns emoji-flagged Slack messages into a weekly Markdown report, delivered as a Slack DM. No bot invites required — it works entirely off your own reactions across every channel/DM you're already in.

> **This repo contains no credentials.** You bring your own Slack app and token (instructions below). Nothing here talks to any server besides Slack's own API.

## How it works

1. React to any Slack message with a chosen emoji (default: 📌) to flag it as a task.
2. Run the script whenever you want your report — it pulls every currently-flagged message via the Slack `reactions.list` API.
3. It generates a Markdown report grouped by channel, showing both the date the message was originally sent and the date you flagged it.
4. The report is DM'd to you on Slack and archived locally under `reports/`.

## Prerequisites

- Node.js 18 or newer
- A Slack workspace where you can install a custom app
- `git` (to clone this repo)

## Installation

### 1. Clone the repo

```bash
git clone https://github.com/docgrinch/slack-task-tracker.git
cd slack-task-tracker
```

### 2. Install dependencies

**Linux / macOS** (identical):

```bash
npm ci
```

`npm ci` installs exactly what's pinned in `package-lock.json`, avoiding surprise version drift — recommended over `npm install` for reproducibility.

### 3. Create your own Slack App

You need your own app + token; this repo never ships or requires anyone else's credentials.

1. Go to https://api.slack.com/apps → **Create New App** → **From scratch**.
2. Name it and select your workspace.
3. Go to **OAuth & Permissions** → under **User Token Scopes**, add:
   - `reactions:read`
   - `channels:history`, `groups:history`, `im:history`, `mpim:history`
   - `channels:read`, `groups:read`, `im:read`
   - `chat:write`
   - `im:write`
4. Click **Install to Workspace** and authorize.
5. Copy the **User OAuth Token** (starts with `xoxp-`).

> ⚠️ **This token acts as your own Slack identity.** It can read anything you personally can read in the workspace. Treat it exactly like a password: never commit it, never share it, rotate it periodically via **OAuth & Permissions → Reinstall App**. Only request the scopes listed above — resist the temptation to add more "just in case."

### 4. Configure environment variables

```bash
cp .env.example .env
chmod 600 .env
```

Edit `.env`:

```
SLACK_USER_TOKEN=xoxp-your-token-here
TASK_EMOJI=pushpin
DOTENV_CONFIG_QUIET=true
```

`TASK_EMOJI` uses Slack's emoji *name* (no colons) — e.g. `pushpin` for 📌, `white_check_mark` for ✅.

## Usage

Run this whenever you want your task report — for example, every Monday morning:

```bash
node runWeekly.js
```

This single command:
- pulls all currently 📌-flagged messages,
- builds `weekly_report.md`,
- DMs it to you on Slack,
- archives a dated copy under `reports/`,
- and locks down all generated files to `600` permissions automatically.

That's it — no scheduler required. Running it by hand each Monday is the simplest, lowest-maintenance option and is what's recommended by default.

## Optional: automate with a scheduler

If you'd rather not remember to run it manually, both Linux and macOS support scheduling it — this is optional and adds a small amount of operational complexity (a background job that can fail silently if misconfigured, log files to monitor, etc.).

<details>
<summary>Linux — cron</summary>

```bash
crontab -e
```

Add:

```
0 8 * * 1 cd /full/path/to/slack-task-tracker && $(which node) runWeekly.js >> cron.log 2>&1
```

This runs every Monday at 8:00 AM. Check `cron.log` periodically to confirm it's actually succeeding.

</details>

<details>
<summary>macOS — cron or launchd</summary>

macOS `cron` works the same as Linux, but newer macOS versions sandbox it under **System Settings → Privacy & Security → Full Disk Access** — if the job silently doesn't fire, add `/usr/sbin/cron` (or your terminal app) to that list.

`launchd` is the more "native" macOS alternative:

1. Create `~/Library/LaunchAgents/com.slacktasktracker.weekly.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.slacktasktracker.weekly</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/full/path/to/slack-task-tracker/runWeekly.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/full/path/to/slack-task-tracker</string>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Weekday</key>
        <integer>1</integer>
        <key>Hour</key>
        <integer>8</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/full/path/to/slack-task-tracker/cron.log</string>
    <key>StandardErrorPath</key>
    <string>/full/path/to/slack-task-tracker/cron.log</string>
</dict>
</plist>
```

2. Load it:

```bash
launchctl load ~/Library/LaunchAgents/com.slacktasktracker.weekly.plist
```

Adjust `/usr/local/bin/node` to match `which node` on your machine (Apple Silicon Homebrew installs are typically `/opt/homebrew/bin/node`).

</details>

## Security notes

- `.env`, `tasks.json`, `flag_log.json`, `weekly_report.md`, and `reports/` are gitignored and automatically locked to `600`/`700` permissions by `runWeekly.js` — never commit these, and double-check `git status` before any commit if you modify the project.
- The Slack token has broad read access by design (see the warning in Step 3). Rotate it periodically.
- Run `npm audit` periodically to check for dependency vulnerabilities; use `npm ci` (not `npm install`) for reproducible installs.
- If deploying this on a shared or multi-user machine, consider running it under a dedicated low-privilege OS user rather than your primary login.
- This is a personal-use utility, not a hardened multi-tenant service — don't deploy it to run on anyone else's behalf without adapting the OAuth flow accordingly.

## Project structure

```
.
├── fetchTasks.js       # Pulls flagged messages from Slack
├── generateReport.js   # Builds the weekly Markdown report
├── postReport.js       # Sends the report as a Slack DM
├── runWeekly.js         # Orchestrates the full pipeline + file security
├── .env.example         # Template for required environment variables (no real secrets)
├── .gitignore
├── LICENSE
├── package.json
└── reports/              # Archived weekly reports (gitignored, not present in this repo)
```

## Contributing

Issues and PRs welcome. Please don't include real Slack tokens, workspace names, or message content in any issue/PR — sanitize examples first.

## License

MIT — see [LICENSE](./LICENSE).
