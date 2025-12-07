// agents/reviewerAgent.js
const fs = require('fs');
const path = require('path');
const { PLAN_FILE, REVIEW_FILE, ROOT_DIR } = require('../lib/paths');
const { runCommand } = require('../lib/runCommand');
const { agents } = require('./agentConfig');

const cfg = agents.reviewer;

async function runReviewerOnce() {
  console.log('=== [Reviewer] Code Review ===');

  fs.mkdirSync(path.dirname(REVIEW_FILE), { recursive: true });

  const prompt = `
${cfg.systemPrompt}

ข้อมูลโปรเจกต์:
- โปรเจกต์อยู่ที่: ${ROOT_DIR}
- แผนระบบ: ${PLAN_FILE}
- ไฟล์รีวิว: ${REVIEW_FILE}

สร้างรีวิวใหม่ตามรูปแบบที่กำหนดใน system prompt
`.trim();

  try {
    await runCommand(cfg.command, cfg.defaultArgs, prompt, {
      timeout: cfg.timeoutMs,
    });

    if (!fs.existsSync(REVIEW_FILE)) {
      console.warn(`[Reviewer] WARNING: REVIEW file not found: ${REVIEW_FILE}`);
      return 'UNKNOWN';
    }

    const reviewContent = fs.readFileSync(REVIEW_FILE, 'utf8');
    if (reviewContent.includes('[STATUS]: NO_CRITICAL_ISSUES')) {
      console.log('[Reviewer] Status: NO_CRITICAL_ISSUES');
      return 'OK';
    }
    if (reviewContent.includes('[STATUS]: CRITICAL_ISSUES')) {
      console.log('[Reviewer] Status: CRITICAL_ISSUES');
      return 'NEED_FIX';
    }

    console.log('[Reviewer] Status: UNKNOWN (no status token found)');
    return 'UNKNOWN';
  } catch (err) {
    console.error(`[Reviewer] ERROR: ${err.message}`);
    return 'UNKNOWN';
  }
}

module.exports = {
  runReviewerOnce,
};