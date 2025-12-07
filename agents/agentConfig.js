// agents/agentConfig.js
const { PLAN_FILE, REVIEW_FILE, TEST_REPORT_FILE } = require('../lib/paths');

// Helper function to get env var with default
function getEnv(key, defaultValue) {
  return process.env[key] !== undefined ? process.env[key] : defaultValue;
}

// Helper function to parse args from env (space-separated string)
function parseArgs(envValue, defaultValue = []) {
  if (!envValue || envValue.trim() === '') {
    return defaultValue;
  }
  return envValue.trim().split(/\s+/).filter(arg => arg.length > 0);
}

// Helper function to parse boolean from env
function parseBool(envValue, defaultValue = false) {
  if (envValue === undefined) return defaultValue;
  return envValue.toLowerCase() === 'true' || envValue === '1';
}

// Helper function to parse number from env
function parseNumber(envValue, defaultValue) {
  if (envValue === undefined) return defaultValue;
  const num = parseInt(envValue, 10);
  return isNaN(num) ? defaultValue : num;
}

module.exports = {
  pipeline: {
    steps: ['planner', 'implementer', 'tester', 'reviewer'],
    reviewLoop: {
      enabled: parseBool(getEnv('REVIEW_LOOP_ENABLED', 'true')),
      maxLoops: parseNumber(getEnv('REVIEW_LOOP_MAX_LOOPS', '3'), 3),
    },
  },

  agents: {
    planner: {
      id: 'planner',
      displayName: 'System Planner & Researcher',
      role: 'planner',
      statusKey: 'planner',

      type: 'cli',
      command: getEnv('PLANNER_COMMAND', 'gemini'),
      defaultArgs: parseArgs(getEnv('PLANNER_ARGS', '')),
      timeoutMs: parseNumber(getEnv('PLANNER_TIMEOUT_MS', '3600000'), 60 * 60 * 1000),

      provider: getEnv('PLANNER_PROVIDER', 'google'),
      model: getEnv('PLANNER_MODEL', 'gemini-2.0-pro'),

      io: {
        reads: [],
        writes: [PLAN_FILE],
      },

      systemPrompt: `
คุณคือ System Planner / Researcher
หน้าที่:
- วิเคราะห์ requirement สำหรับระบบตามโจทย์
- ออกแบบ module, feature, entity, database schema, API คร่าว ๆ
- วาง Phase การพัฒนาเป็นลำดับ
- เขียนผลลัพธ์เป็น Markdown

ข้อห้าม:
- ห้ามเขียนโค้ด implementation
      `.trim(),
    },

    implementer: {
      id: 'implementer',
      displayName: 'Code Implementer',
      role: 'implementer',
      statusKey: 'implementer',

      type: 'cli',
      command: getEnv('IMPLEMENTER_COMMAND', 'cursor-agent'),
      defaultArgs: parseArgs(getEnv('IMPLEMENTER_ARGS', '')),
      timeoutMs: parseNumber(getEnv('IMPLEMENTER_TIMEOUT_MS', '3600000'), 60 * 60 * 1000),

      provider: getEnv('IMPLEMENTER_PROVIDER', 'cursor'),
      model: getEnv('IMPLEMENTER_MODEL', 'gpt-4.1'),

      io: {
        reads: [PLAN_FILE, REVIEW_FILE],
        writes: ['src/**'],
      },

      systemPrompt: `
คุณคือ Code Implementer
หน้าที่:
- อ่านแผนจาก AI_PLAN.md
- ลงมือสร้างโครงสร้างโค้ดและ module ตามแผน
- เมื่อมีรีวิวจาก reviewer ให้แก้ไขตามข้อเสนอแนะ
- เขียนโค้ดให้ compile / run ได้จริง ไม่ใช่ pseudo code
      `.trim(),
    },

    tester: {
      id: 'tester',
      displayName: 'Test Engineer',
      role: 'tester',
      statusKey: 'tester',

      type: 'cli',
      command: getEnv('TESTER_COMMAND', 'cursor-agent'),
      defaultArgs: parseArgs(getEnv('TESTER_ARGS', '')),
      timeoutMs: parseNumber(getEnv('TESTER_TIMEOUT_MS', '3600000'), 60 * 60 * 1000),

      provider: getEnv('TESTER_PROVIDER', 'cursor'),
      model: getEnv('TESTER_MODEL', 'gpt-4.1'),

      io: {
        reads: [PLAN_FILE, 'src/**'],
        writes: [TEST_REPORT_FILE, 'tests/**'],
      },

      systemPrompt: `
คุณคือ Test Engineer Agent
หน้าที่:
- ออกแบบและสร้าง Test (Unit / Integration) จากแผนใน AI_PLAN.md และโค้ดปัจจุบัน
- วางโครงไฟล์ test ให้เหมาะกับ tech stack (เช่น Jest, Vitest, Playwright ตามโปรเจกต์)
- ถ้าเครื่องมือของคุณสามารถรันคำสั่ง shell ได้ ให้รันคำสั่งทดสอบ เช่น "npm test" หรือ "pnpm test"
- สรุปผลการทดสอบลงไฟล์ AI_TEST_REPORT.md (test ผ่าน/ตก, coverage โดยประมาณ, จุดที่ยังไม่มี test)
      `.trim(),
    },

    reviewer: {
      id: 'reviewer',
      displayName: 'Code Reviewer',
      role: 'reviewer',
      statusKey: 'reviewer',

      type: 'cli',
      command: getEnv('REVIEWER_COMMAND', 'codex'),
      defaultArgs: parseArgs(getEnv('REVIEWER_ARGS', '')),
      timeoutMs: parseNumber(getEnv('REVIEWER_TIMEOUT_MS', '3600000'), 60 * 60 * 1000),

      provider: getEnv('REVIEWER_PROVIDER', 'openai'),
      model: getEnv('REVIEWER_MODEL', 'gpt-4.1'),

      io: {
        reads: [PLAN_FILE, 'src/**'],
        writes: [REVIEW_FILE],
      },

      systemPrompt: `
คุณคือ Code Reviewer
หน้าที่:
- ตรวจโค้ดตามแผนใน AI_PLAN.md
- เน้น correctness, security, architecture, readability
- เขียนรีวิวลง AI_REVIEW.md พร้อมสถานะ:

[STATUS]: CRITICAL_ISSUES หรือ [STATUS]: NO_CRITICAL_ISSUES

แล้วแจกแจง Strengths / Issues / Suggestions / Recommended Patches
      `.trim(),
    },
  },
};