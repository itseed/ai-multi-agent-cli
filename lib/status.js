// lib/status.js
const fs = require('fs');
const { STATUS_FILE } = require('./paths');

function writeStatus(status) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), 'utf8');
}

function readStatus() {
  if (!fs.existsSync(STATUS_FILE)) {
    const defaultStatus = {
      task: '',
      planner: 'pending',
      implementer: 'pending',
      tester: 'pending',
      reviewer: 'pending',
    };
    writeStatus(defaultStatus);
    return defaultStatus;
  }

  const raw = fs.readFileSync(STATUS_FILE, 'utf8').trim();

  if (!raw) {
    const defaultStatus = {
      task: '',
      planner: 'pending',
      implementer: 'pending',
      tester: 'pending',
      reviewer: 'pending',
    };
    writeStatus(defaultStatus);
    return defaultStatus;
  }

  try {
    const status = JSON.parse(raw);
    return {
      task: status.task || '',
      planner: status.planner || 'pending',
      implementer: status.implementer || 'pending',
      tester: status.tester || 'pending',
      reviewer: status.reviewer || 'pending',
      ...status,
    };
  } catch (err) {
    throw new Error(`Failed to parse ${STATUS_FILE}: ${err.message}`);
  }
}

function setStatus(key, value) {
  const s = readStatus();
  s[key] = value;
  writeStatus(s);
}

module.exports = {
  readStatus,
  writeStatus,
  setStatus,
};