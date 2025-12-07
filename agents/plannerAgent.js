// agents/plannerAgent.js
const fs = require('fs');
const path = require('path');
const { PLAN_FILE } = require('../lib/paths');
const { readStatus, setStatus } = require('../lib/status');
const { runCommand } = require('../lib/runCommand');
const { agents } = require('./agentConfig');

const cfg = agents.planner;

async function runPlannerIfNeeded() {
  const status = readStatus();
  if (status[cfg.statusKey] === 'done') {
    console.log('[Planner] Already done, skipping.');
    return;
  }

  console.log('=== [Planner] Research & Planning ===');
  fs.mkdirSync(path.dirname(PLAN_FILE), { recursive: true });

  const task = status.task;
  if (!task || task.trim() === '') {
    throw new Error('Task is required for planner');
  }

  const prompt = `
${cfg.systemPrompt}

โจทย์ของระบบคือ: "${task}"

ให้คุณสร้างแผนตามที่อธิบายไว้ใน system prompt
และบันทึกลงไฟล์:
  ${PLAN_FILE}
`.trim();

  try {
    await runCommand(cfg.command, cfg.defaultArgs, prompt, {
      timeout: cfg.timeoutMs,
    });

    if (!fs.existsSync(PLAN_FILE)) {
      console.warn(`[Planner] WARNING: ${PLAN_FILE} not found after run.`);
      // Don't fail, but mark as done with warning
    }

    setStatus(cfg.statusKey, 'done');
    console.log('[Planner] Completed.\n');
  } catch (err) {
    console.error(`[Planner] ERROR: ${err.message}`);
    setStatus(cfg.statusKey, 'failed');
    throw err;
  }
}

module.exports = {
  runPlannerIfNeeded,
};