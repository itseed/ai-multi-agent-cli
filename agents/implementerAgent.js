// agents/implementerAgent.js
const fs = require('fs');
const { PLAN_FILE, REVIEW_FILE, TARGET_PROJECT_ROOT } = require('../lib/paths');
const { readStatus, setStatus } = require('../lib/status');
const { runAgentCommand } = require('../lib/runCommand');
const { agents } = require('./agentConfig');

const cfg = agents.implementer;

async function runImplementerIfNeeded() {
  const status = readStatus();
  if (status[cfg.statusKey] === 'done') {
    console.log('[Implementer] Already done, skipping.');
    return;
  }

  console.log('=== [Implementer] Code Generation ===');

  if (!fs.existsSync(PLAN_FILE)) {
    console.warn(`[Implementer] WARNING: Plan file not found: ${PLAN_FILE}`);
    // Continue anyway, might be implementing without plan
  }

  const prompt = `
${cfg.systemPrompt}

ข้อมูลเพิ่มเติม:
- โปรเจ็กต์ที่จะสร้าง code อยู่ที่: ${TARGET_PROJECT_ROOT}
- ไฟล์แผนหลัก: ${PLAN_FILE}
- ถ้ามีไฟล์รีวิวอยู่แล้ว: ${REVIEW_FILE} (ให้ใช้เป็น reference ในการปรับปรุงโค้ด)

ลงมือ implement Phase 1 ตามแผน
`.trim();

  try {
    await runAgentCommand(cfg.id, cfg.command, cfg.defaultArgs, prompt, {
      timeout: cfg.timeoutMs,
    });

    setStatus(cfg.statusKey, 'done');
    console.log('[Implementer] Completed.\n');
  } catch (err) {
    console.error(`[Implementer] ERROR: ${err.message}`);
    setStatus(cfg.statusKey, 'failed');
    throw err;
  }
}

async function runImplementerFixFromReview() {
  console.log('=== [Implementer] Fixing based on review ===');

  if (!fs.existsSync(REVIEW_FILE)) {
    throw new Error(`Review file not found: ${REVIEW_FILE}`);
  }

  const prompt = `
${cfg.systemPrompt}

ตอนนี้มีไฟล์รีวิวจาก Reviewer อยู่ที่:
- ${REVIEW_FILE}

หน้าที่:
- อ่าน Issues และ Suggestions ทั้งหมด
- ใช้ Recommended Patches (ถ้ามี) เป็น reference
- แก้โค้ดในโปรเจกต์นี้แบบ incremental
- โฟกัสแก้ critical issues ก่อน แล้วปรับปรุงโครงสร้างให้ดีขึ้น

อย่าล้างโค้ดทั้งหมดใหม่
`.trim();

  try {
    await runAgentCommand(cfg.id, cfg.command, cfg.defaultArgs, prompt, {
      timeout: cfg.timeoutMs,
    });

    console.log('[Implementer] Fix based on review completed.\n');
  } catch (err) {
    console.error(`[Implementer] ERROR fixing from review: ${err.message}`);
    throw err;
  }
}

module.exports = {
  runImplementerIfNeeded,
  runImplementerFixFromReview,
};