// lib/paths.js
const path = require('path');

const PROJECT_ROOT = process.env.TARGET_PROJECT_ROOT || process.cwd();
const ORCH_DIR = path.join(PROJECT_ROOT, process.env.AI_ORCH_DIR || '.ai-orch');

// ROOT_DIR is the project root where status and docs files are stored
const ROOT_DIR = PROJECT_ROOT;

const STATUS_FILE      = path.join(ROOT_DIR, 'ai_status.json');
const PLAN_FILE        = path.join(ROOT_DIR, 'docs', 'AI_PLAN.md');
const REVIEW_FILE      = path.join(ROOT_DIR, 'docs', 'AI_REVIEW.md');
const TEST_REPORT_FILE = path.join(ROOT_DIR, 'docs', 'AI_TEST_REPORT.md');

module.exports = {
  ROOT_DIR,
  PROJECT_ROOT,
  ORCH_DIR,
  STATUS_FILE,
  PLAN_FILE,
  REVIEW_FILE,
  TEST_REPORT_FILE,
};