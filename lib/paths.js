// lib/paths.js
const path = require('path');

// ORCHESTRATOR_DIR: Where orchestrator is located (config, status)
const ORCHESTRATOR_DIR = process.cwd();

// Helper function to get TARGET_PROJECT_ROOT (reads from env every time)
function getTargetProjectRoot() {
  return process.env.TARGET_PROJECT_ROOT || ORCHESTRATOR_DIR;
}

// Helper function to get DOCS_DIR (reads from env every time)
function getDocsDir() {
  const TARGET_PROJECT_ROOT = getTargetProjectRoot();
  const DOCS_IN_TARGET_PROJECT = process.env.DOCS_IN_TARGET_PROJECT === 'true';
  return DOCS_IN_TARGET_PROJECT ? TARGET_PROJECT_ROOT : ORCHESTRATOR_DIR;
}

// ROOT_DIR: Where status file is stored (always in orchestrator directory)
const ROOT_DIR = ORCHESTRATOR_DIR;

// Use getters to read from env every time (not cached at module load time)
const STATUS_FILE = path.join(ROOT_DIR, 'ai_status.json');

// Export getters for paths that depend on environment variables
module.exports = {
  get ROOT_DIR() { return ROOT_DIR; },
  get ORCHESTRATOR_DIR() { return ORCHESTRATOR_DIR; },
  get TARGET_PROJECT_ROOT() { return getTargetProjectRoot(); },
  get DOCS_DIR() { return getDocsDir(); },
  get LOG_DIR() { return path.join(getTargetProjectRoot(), 'logs'); },
  get STATUS_FILE() { return STATUS_FILE; },
  get PLAN_FILE() { return path.join(getDocsDir(), 'docs', 'AI_PLAN.md'); },
  get REVIEW_FILE() { return path.join(getDocsDir(), 'docs', 'AI_REVIEW.md'); },
  get TEST_REPORT_FILE() { return path.join(getDocsDir(), 'docs', 'AI_TEST_REPORT.md'); },
};