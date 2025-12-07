// lib/runCommand.js
const { spawn } = require('child_process');
const { ROOT_DIR } = require('./paths');

function runCommand(command, args, inputText, options = {}) {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout || 3600000; // default 1h
    const allowNonZeroExit = options.allowNonZeroExit || false;

    console.log(`\n$ ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
      stdio: ['pipe', 'inherit', 'inherit'],
      cwd: ROOT_DIR,
      shell: process.platform === 'win32',
    });

    let timeoutId = null;
    let isResolved = false;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const safeReject = (err) => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        reject(err);
      }
    };

    const safeResolve = (value) => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve(value);
      }
    };

    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        if (!isResolved) {
          child.kill('SIGTERM');
          // Give it a moment to terminate gracefully
          setTimeout(() => {
            if (!child.killed) {
              child.kill('SIGKILL');
            }
            safeReject(new Error(`${command} timed out after ${timeout}ms`));
          }, 1000);
        }
      }, timeout);
    }

    if (inputText) {
      child.stdin.write(inputText, 'utf8', (err) => {
        if (err) {
          safeReject(new Error(`Failed to write to stdin: ${err.message}`));
          return;
        }
        child.stdin.end();
      });
    } else {
      child.stdin.end();
    }

    child.on('error', (err) => {
      safeReject(new Error(`Failed to spawn ${command}: ${err.message}`));
    });

    child.on('close', (code, signal) => {
      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        // Timeout killed the process, error already handled
        return;
      }
      
      if (code === 0) {
        safeResolve(code);
      } else if (allowNonZeroExit) {
        console.warn(`Warning: ${command} exited with code ${code}`);
        safeResolve(code);
      } else {
        safeReject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

module.exports = {
  runCommand,
};