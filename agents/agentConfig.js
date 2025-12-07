// agents/agentConfig.js
const { PLAN_FILE, REVIEW_FILE, TEST_REPORT_FILE } = require('../lib/paths');

module.exports = {
  pipeline: {
    steps: ['planner', 'implementer', 'tester', 'reviewer'],
    reviewLoop: {
      enabled: true,
      maxLoops: 3,
    },
  },

  agents: {
    planner: {
      id: 'planner',
      displayName: 'System Planner & Researcher',
      role: 'planner',
      statusKey: 'planner',

      type: 'cli',
      command: 'gemini',    // TODO: แก้เป็นคำสั่ง CLI ของคุณ
      defaultArgs: [],      // เช่น ['chat', '--model', 'gemini-2.0-pro']
      timeoutMs: 60 * 60 * 1000,

      provider: 'google',
      model: 'gemini-2.0-pro',

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
      command: 'cursor-agent',  // TODO: แก้เป็น cursor CLI จริง
      defaultArgs: [],
      timeoutMs: 60 * 60 * 1000,

      provider: 'cursor',
      model: 'gpt-4.1',

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
      command: 'cursor-agent',  // หรือ codex / ai-cli ตัวอื่นตามที่คุณใช้
      defaultArgs: [],
      timeoutMs: 60 * 60 * 1000,

      provider: 'cursor',
      model: 'gpt-4.1',

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
      command: 'codex',     // TODO: แก้เป็น Codex CLI จริง
      defaultArgs: [],
      timeoutMs: 60 * 60 * 1000,

      provider: 'openai',
      model: 'gpt-4.1',

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