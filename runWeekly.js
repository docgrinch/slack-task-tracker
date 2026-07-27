require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_DIR = __dirname;

function run(cmd) {
  console.log(`> ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: PROJECT_DIR });
  } catch (e) {
    console.error(`Step failed: ${cmd}`);
    console.error(`Exit code: ${e.status}`);
    process.exitCode = 1;
    throw new Error('runWeekly aborted');
  }
}

// Locks a file down to owner-read-write only (600). Silently skips if the
// file doesn't exist yet (e.g. first run before it's created).
function secureFile(filePath) {
  try {
    fs.chmodSync(filePath, 0o600);
    console.log(`Secured: ${path.basename(filePath)} (600)`);
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error(`Could not chmod ${filePath}: ${e.message}`);
    }
  }
}

try {
  // Lock down .env first, every run, regardless of step outcome.
  secureFile(path.join(PROJECT_DIR, '.env'));

  // 1. Pull latest flagged tasks -> writes tasks.json + flag_log.json
  run('node fetchTasks.js');
  secureFile(path.join(PROJECT_DIR, 'tasks.json'));
  secureFile(path.join(PROJECT_DIR, 'flag_log.json'));

  // 2. Generate the markdown report -> writes weekly_report.md
  run('node generateReport.js');
  secureFile(path.join(PROJECT_DIR, 'weekly_report.md'));

  // 3. Post it to Slack
  run('node postReport.js');

  // 4. Archive a dated copy locally
  const archiveDir = path.join(PROJECT_DIR, 'reports');
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { mode: 0o700 });
  const dateStamp = new Date().toISOString().split('T')[0];
  const archivePath = path.join(archiveDir, `weekly_report_${dateStamp}.md`);
  fs.copyFileSync(path.join(PROJECT_DIR, 'weekly_report.md'), archivePath);
  secureFile(archivePath);

  console.log(`Done. Archived to reports/weekly_report_${dateStamp}.md`);
} catch (e) {
  console.error('Weekly run failed:', e.message);
  process.exit(1);
}
