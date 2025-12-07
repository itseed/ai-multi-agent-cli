// lib/paths.js
const path = require('path');

const ROOT_DIR = process.cwd();

const STATUS_FILE      = path.join(ROOT_DIR, 'ai_status.json');
const PLAN_FILE        = path.join(ROOT_DIR, 'docs', 'AI_PLAN.md');
const REVIEW_FILE      = path.join(ROOT_DIR, 'docs', 'AI_REVIEW.md');
const TEST_REPORT_FILE = path.join(ROOT_DIR, 'docs', 'AI_TEST_REPORT.md');

module.exports = {
  ROOT_DIR,
  STATUS_FILE,
  PLAN_FILE,
  REVIEW_FILE,
  TEST_REPORT_FILE,
};