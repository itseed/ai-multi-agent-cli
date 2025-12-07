// agents/reviewerAgent.js
const fs = require('fs');
const path = require('path');
const {
  PLAN_FILE,
  REVIEW_FILE,
  TARGET_PROJECT_ROOT,
} = require('../lib/paths');
const { readStatus, setStatus } = require('../lib/status');
const { runAgentCommand } = require('../lib/runCommand');
const { agents } = require('./agentConfig');

const cfg = agents.reviewer;

async function runReviewerIfNeeded() {
  const status = readStatus();

  if (status[cfg.statusKey] === 'done') {
    console.log('[Reviewer] Already done, skipping.');
    return;
  }

  if (status[cfg.statusKey] === 'unknown' || status[cfg.statusKey] === 'failed') {
    console.log(
      `[Reviewer] Status is "${status[cfg.statusKey]}", resetting to pending to allow retry.`,
    );
    setStatus(cfg.statusKey, 'pending');
  }

  return await runReviewerOnce();
}

async function runReviewerOnce() {
  console.log('=== [Reviewer] Code Review ===');
  console.log('[Reviewer] TARGET_PROJECT_ROOT =', TARGET_PROJECT_ROOT);
  console.log('[Reviewer] PLAN_FILE          =', PLAN_FILE);
  console.log('[Reviewer] REVIEW_FILE        =', REVIEW_FILE);

  fs.mkdirSync(path.dirname(REVIEW_FILE), { recursive: true });

  const existingReviewMtime = fs.existsSync(REVIEW_FILE)
    ? fs.statSync(REVIEW_FILE).mtimeMs
    : null;

  const prompt = `
${cfg.systemPrompt}

Context:
- Project root to review: ${TARGET_PROJECT_ROOT}
- Plan file path: ${PLAN_FILE}
- Review output file path: ${REVIEW_FILE}

Instructions:
1) Work in the repository at ${TARGET_PROJECT_ROOT}.
2) Read the plan from the file at: ${PLAN_FILE}.
3) Review the codebase (src/, apps/, libs/ ตามที่มีจริง) กับแผนในไฟล์นั้น
4) เขียนรีวิวแบบ Markdown ลงไฟล์: ${REVIEW_FILE}
5) บรรทัดแรกของไฟล์ ให้ใส่หนึ่งอันจากสองอันนี้เท่านั้น:
   [STATUS]: NO_CRITICAL_ISSUES
   [STATUS]: CRITICAL_ISSUES
`.trim();

  let actualCommand = cfg.command;
  let actualArgs = [...(cfg.defaultArgs || [])];
  let useReviewSubcommand = false;

  if (cfg.command === 'codex') {
    actualCommand = 'codex';

    // Check if user wants to use 'exec' or 'review' subcommand
    const hasReview = actualArgs.includes('review');
    const hasExec = actualArgs.includes('exec') || actualArgs.includes('e');

    // Default to 'review' subcommand for code review (better suited for this use case)
    if (!hasReview && !hasExec) {
      // Use 'codex review' subcommand by default
      useReviewSubcommand = true;
      actualArgs.unshift('review');
      // codex review doesn't support -C, -o, --full-auto, etc.
      // We'll use cwd in spawn and capture output manually
    } else if (hasReview && !hasExec) {
      // Use 'codex review' subcommand
      useReviewSubcommand = true;
      // codex review doesn't support -C, -o, --full-auto, etc.
      // We'll use cwd in spawn and capture output manually
    } else {
      // Use 'codex exec' subcommand (if explicitly specified)
      if (!hasExec) {
        actualArgs.unshift('exec');
      }

      if (!actualArgs.includes('-C') && !actualArgs.includes('--cd')) {
        actualArgs.push('-C', TARGET_PROJECT_ROOT);
      }

      if (!actualArgs.includes('--skip-git-repo-check')) {
        actualArgs.push('--skip-git-repo-check');
      }

      if (!actualArgs.includes('--color') && !actualArgs.includes('--colour')) {
        actualArgs.push('--color', 'never');
      }

      if (
        !actualArgs.includes('-o') &&
        !actualArgs.includes('--output-last-message')
      ) {
        actualArgs.push('--output-last-message', REVIEW_FILE);
      }

      if (
        !actualArgs.includes('--full-auto') &&
        !actualArgs.includes('--dangerously-bypass-approvals-and-sandbox')
      ) {
        actualArgs.push('--full-auto');
      }
    }

    // Add '-' to read from stdin (works for both 'exec' and 'review')
    if (actualArgs[actualArgs.length - 1] !== '-') {
      actualArgs.push('-');
    }
  }

  console.log(
    `[Reviewer] Command: ${actualCommand} ${actualArgs.join(' ')}`,
  );

  try {
    setStatus(cfg.statusKey, 'in_progress');

    // If using 'codex review', we need to capture output manually
    if (useReviewSubcommand) {
      const { spawn } = require('child_process');
      const { TARGET_PROJECT_ROOT, LOG_DIR } = require('../lib/paths');
      
      // Ensure log directory exists
      fs.mkdirSync(LOG_DIR, { recursive: true });
      const logFile = path.join(LOG_DIR, `${cfg.id}.log`);
      
      // Write header to log
      const timestamp = new Date().toISOString();
      const header = `\n${'='.repeat(80)}\n[${timestamp}] Agent: ${cfg.id}\nCommand: ${actualCommand} ${actualArgs.join(' ')}\n${'='.repeat(80)}\n\n`;
      fs.appendFileSync(logFile, header);
      console.log(`[${cfg.id}] Log file: ${logFile}`);
      
      return new Promise((resolve, reject) => {
        const child = spawn(actualCommand, actualArgs, {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: TARGET_PROJECT_ROOT,
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
          const dataStr = data.toString();
          stdout += dataStr;
          process.stdout.write(data); // Show in console
          // Also write to log file
          fs.appendFileSync(logFile, dataStr, 'utf8');
        });

        child.stderr.on('data', (data) => {
          const dataStr = data.toString();
          stderr += dataStr;
          process.stderr.write(data); // Show in console
          // Also write to log file
          fs.appendFileSync(logFile, dataStr, 'utf8');
        });

        if (prompt) {
          child.stdin.write(prompt, 'utf8');
          child.stdin.end();
        }

        child.on('close', async (code) => {
          // Write footer to log
          const footer = `\n[${new Date().toISOString()}] Command ${code === 0 ? 'completed successfully' : `exited with code ${code}`}\n`;
          fs.appendFileSync(logFile, footer);
          
          if (code !== 0) {
            console.error(`[Reviewer] codex review exited with code ${code}`);
            setStatus(cfg.statusKey, 'failed');
            resolve('UNKNOWN');
            return;
          }

          // Write output to file
          const output = stdout || stderr;
          if (output.trim()) {
            fs.writeFileSync(REVIEW_FILE, output, 'utf8');
            console.log(`[Reviewer] Output written to ${REVIEW_FILE}`);
          } else {
            console.warn('[Reviewer] No output from codex review');
            setStatus(cfg.statusKey, 'unknown');
            resolve('UNKNOWN');
            return;
          }

          // Continue with file validation
          const reviewContent = fs.readFileSync(REVIEW_FILE, 'utf8');
          const upper = reviewContent.toUpperCase();

          if (upper.includes('[STATUS]: NO_CRITICAL_ISSUES')) {
            console.log('[Reviewer] Status: NO_CRITICAL_ISSUES');
            setStatus(cfg.statusKey, 'done');
            resolve('OK');
          } else if (upper.includes('[STATUS]: CRITICAL_ISSUES')) {
            console.log('[Reviewer] Status: CRITICAL_ISSUES');
            setStatus(cfg.statusKey, 'needs_fix');
            resolve('NEED_FIX');
          } else {
            console.log(
              '[Reviewer] Status: UNKNOWN (no [STATUS]: token found in review file)',
            );
            setStatus(cfg.statusKey, 'unknown');
            resolve('UNKNOWN');
          }
        });

        child.on('error', (err) => {
          console.error('[Reviewer] ERROR:', err);
          setStatus(cfg.statusKey, 'failed');
          reject(err);
        });
      });
    }

    // Use normal runAgentCommand for 'codex exec'
    await runAgentCommand(cfg.id, actualCommand, actualArgs, prompt, {
      timeout: cfg.timeoutMs,
    });

    // รอให้ codex เขียนไฟล์เสร็จ
    let fileExists = false;
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (fs.existsSync(REVIEW_FILE)) {
        fileExists = true;
        break;
      }
      console.log(`[Reviewer] Waiting for output file... (${i + 1}/10)`);
    }

    if (!fileExists) {
      console.warn(
        `[Reviewer] WARNING: REVIEW file not found after waiting: ${REVIEW_FILE}`,
      );
      setStatus(cfg.statusKey, 'unknown');
      return 'UNKNOWN';
    }

    const latestMtime = fs.statSync(REVIEW_FILE).mtimeMs;
    if (existingReviewMtime !== null && latestMtime === existingReviewMtime) {
      console.warn(
        '[Reviewer] WARNING: REVIEW file timestamp unchanged; possible stale output.',
      );
      setStatus(cfg.statusKey, 'unknown');
      return 'UNKNOWN';
    }

    const reviewContent = fs.readFileSync(REVIEW_FILE, 'utf8');
    console.log('----- [Reviewer] Preview AI_REVIEW.md (first 20 lines) -----');
    console.log(reviewContent.split('\n').slice(0, 20).join('\n'));
    console.log('------------------------------------------------------------');

    const upper = reviewContent.toUpperCase();

    if (upper.includes('[STATUS]: NO_CRITICAL_ISSUES')) {
      console.log('[Reviewer] Status: NO_CRITICAL_ISSUES');
      setStatus(cfg.statusKey, 'done');
      return 'OK';
    }

    if (upper.includes('[STATUS]: CRITICAL_ISSUES')) {
      console.log('[Reviewer] Status: CRITICAL_ISSUES');
      setStatus(cfg.statusKey, 'needs_fix');
      return 'NEED_FIX';
    }

    console.log(
      '[Reviewer] Status: UNKNOWN (no [STATUS]: token found in review file)',
    );
    setStatus(cfg.statusKey, 'unknown');
    return 'UNKNOWN';
  } catch (err) {
    console.error('[Reviewer] ERROR:', err);
    setStatus(cfg.statusKey, 'failed');
    return 'UNKNOWN';
  }
}

module.exports = {
  runReviewerIfNeeded,
  runReviewerOnce,
};