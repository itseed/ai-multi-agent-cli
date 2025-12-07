// agents/testerAgent.js
const fs = require('fs');
const path = require('path');
const { PLAN_FILE, TEST_REPORT_FILE, ROOT_DIR } = require('../lib/paths');
const { readStatus, setStatus } = require('../lib/status');
const { runCommand } = require('../lib/runCommand');
const { agents } = require('./agentConfig');

const cfg = agents.tester;

async function runTesterIfNeeded() {
  const status = readStatus();
  if (status[cfg.statusKey] === 'done') {
    console.log('[Tester] Already done, skipping.');
    return;
  }

  console.log('=== [Tester] Test Design & Execution ===');
  fs.mkdirSync(path.dirname(TEST_REPORT_FILE), { recursive: true });

  const prompt = `
${cfg.systemPrompt}

ข้อมูลโปรเจกต์:
- โปรเจกต์อยู่ที่: ${ROOT_DIR}
- แผนระบบ: ${PLAN_FILE}
- ไฟล์รายงานผลการทดสอบ: ${TEST_REPORT_FILE}

ขั้นตอนที่คาดหวัง:
1) อ่านแผนจาก AI_PLAN.md
2) ตรวจโค้ดที่มีอยู่ใน src/** เพื่อหา module สำคัญ
3) สร้าง/อัปเดต test files (เช่นในโฟลเดอร์ tests หรือใต้ src/**/__tests__)
4) ถ้าเครื่องมือคุณสามารถรันคำสั่ง shell ได้ ให้รัน "npm test" หรือ "pnpm test"
5) สรุปผลเป็น Markdown ลง AI_TEST_REPORT.md
`.trim();

  try {
    await runCommand(cfg.command, cfg.defaultArgs, prompt, {
      timeout: cfg.timeoutMs,
    });

    if (!fs.existsSync(TEST_REPORT_FILE)) {
      console.warn(`[Tester] WARNING: ${TEST_REPORT_FILE} not found after run.`);
      // Continue anyway, tests might be written but report not created
    }

    setStatus(cfg.statusKey, 'done');
    console.log('[Tester] Completed.\n');
  } catch (err) {
    console.error(`[Tester] ERROR: ${err.message}`);
    setStatus(cfg.statusKey, 'failed');
    throw err;
  }
}

module.exports = {
  runTesterIfNeeded,
};