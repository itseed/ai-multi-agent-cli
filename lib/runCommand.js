// lib/runCommand.js
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { TARGET_PROJECT_ROOT, LOG_DIR } = require('./paths');

// Commands that require interactive terminal
const TERMINAL_REQUIRED_COMMANDS = ['codex'];

// Check if a command exists
function commandExists(command) {
  try {
    if (process.platform === 'win32') {
      execSync(`where ${command}`, { stdio: 'ignore' });
    } else {
      execSync(`which ${command}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

// Filter ANSI escape sequences and terminal control sequences from output
function filterEscapeSequences(data) {
  if (typeof data === 'string') {
    // Remove ANSI escape sequences (colors, cursor movements, etc.)
    // Pattern: \x1b[ followed by numbers, semicolons, question marks, and letters
    return data
      .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '') // ANSI escape sequences including [?2004h
      .replace(/\x1b\][0-9;]*[a-zA-Z]/g, '')  // OSC escape sequences
      .replace(/\x1b[=><]/g, '')              // Other escape sequences
      .replace(/\x1b\?[0-9;]*[a-zA-Z]/g, '')  // Terminal control sequences
      .replace(/\x1b\[[?][0-9;]*[hl]/g, '');  // Bracketed paste mode like [?2004h or [?2004l
  }
  // For Buffer, convert to string first
  return filterEscapeSequences(data.toString());
}

function runCommand(command, args, inputText, options = {}) {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout || 3600000; // default 1h
    const allowNonZeroExit = options.allowNonZeroExit || false;

    // Check if command requires terminal
    const needsTerminal = TERMINAL_REQUIRED_COMMANDS.includes(command);
    
    // Use pseudo-terminal wrapper for commands that need it
    let actualCommand = command;
    let actualArgs = args;
    
    if (needsTerminal && process.platform !== 'win32') {
      // Try multiple methods to create pseudo-terminal
      if (commandExists('unbuffer')) {
        // Best option: unbuffer from expect package
        actualCommand = 'unbuffer';
        actualArgs = ['-p', command, ...args];
      } else {
        // Last resort: try running without wrapper
        // Some commands might work if we set TERM environment variable
        console.warn(`[WARN] No pty wrapper found (unbuffer/expect).`);
        console.warn(`[WARN] Trying ${command} directly. If it fails, install 'unbuffer':`);
        console.warn(`[WARN]   macOS: brew install expect`);
        console.warn(`[WARN]   Linux: sudo apt-get install expect`);
        // Don't wrap, but set TERM environment variable
        // The spawn will handle this via env option
      }
    }

    console.log(`\n$ ${command} ${args.join(' ')}`);

    // Set environment variables for terminal emulation
    const env = { ...process.env };
    if (needsTerminal && process.platform !== 'win32') {
      // Set TERM to make commands think they have a terminal
      env.TERM = env.TERM || 'xterm-256color';
      // Some commands check for this
      env.COLUMNS = env.COLUMNS || '80';
      env.LINES = env.LINES || '24';
    }

    // Create log streams if logFile is provided in options
    const logFile = options.logFile;
    let stdoutStream = process.stdout;
    let stderrStream = process.stderr;
    
    if (logFile) {
      const logStream = fs.createWriteStream(logFile, { flags: 'a' });
      stdoutStream = logStream;
      stderrStream = logStream;
    }

    const child = spawn(actualCommand, actualArgs, {
      stdio: ['pipe', logFile ? 'pipe' : 'inherit', logFile ? 'pipe' : 'inherit'],
      cwd: TARGET_PROJECT_ROOT, // Run commands in target project directory
      shell: process.platform === 'win32',
      env: env,
    });
    
    // Pipe stdout/stderr to log file if provided
    if (logFile) {
      child.stdout.on('data', (data) => {
        // Filter escape sequences for log file, but keep original for console
        const dataStr = Buffer.isBuffer(data) ? data.toString('utf8') : data;
        const filteredData = filterEscapeSequences(dataStr);
        stdoutStream.write(filteredData);
        process.stdout.write(data); // Show original (with colors) in console
      });
      
      child.stderr.on('data', (data) => {
        // Filter escape sequences for log file, but keep original for console
        const dataStr = Buffer.isBuffer(data) ? data.toString('utf8') : data;
        const filteredData = filterEscapeSequences(dataStr);
        stderrStream.write(filteredData);
        process.stderr.write(data); // Show original (with colors) in console
      });
      
      child.on('close', () => {
        if (stdoutStream !== process.stdout) {
          stdoutStream.end();
        }
        if (stderrStream !== process.stderr) {
          stderrStream.end();
        }
      });
    }

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
      // Log prompt to console for debugging (truncate if too long)
      const promptPreview = inputText.length > 200 
        ? inputText.substring(0, 200) + '...' 
        : inputText;
      console.log(`[DEBUG] Sending prompt (${inputText.length} chars) to ${command}`);
      
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
        // Provide helpful error message for terminal-related errors
        let errorMsg = `${command} exited with code ${code}`;
        if (needsTerminal && code === 1) {
          errorMsg += '\n';
          errorMsg += 'This command requires an interactive terminal. ';
          errorMsg += 'Please install "unbuffer" (from expect package) to enable pseudo-terminal support:\n';
          errorMsg += '  macOS: brew install expect\n';
          errorMsg += '  Linux: sudo apt-get install expect';
        }
        safeReject(new Error(errorMsg));
      }
    });
  });
}

/**
 * Run command for a specific agent with separate log file
 * @param {string} agentName - Name of the agent (e.g., 'planner', 'implementer', 'tester', 'reviewer')
 * @param {string} command - Command to run
 * @param {string[]} args - Command arguments
 * @param {string} inputText - Input text to send to stdin
 * @param {object} options - Options (timeout, allowNonZeroExit)
 */
function runAgentCommand(agentName, command, args, inputText, options = {}) {
  return new Promise((resolve, reject) => {
    // Ensure log directory exists
    fs.mkdirSync(LOG_DIR, { recursive: true });
    
    // Create log file path
    const logFile = path.join(LOG_DIR, `${agentName}.log`);
    
    // Write header to log
    const timestamp = new Date().toISOString();
    const header = `\n${'='.repeat(80)}\n[${timestamp}] Agent: ${agentName}\nCommand: ${command} ${args.join(' ')}\n${'='.repeat(80)}\n\n`;
    fs.appendFileSync(logFile, header);
    
    // Also log to console
    console.log(`[${agentName}] Log file: ${logFile}`);
    
    // Run the command with logging
    const logOptions = { ...options, logFile };
    runCommand(command, args, inputText, logOptions)
      .then((result) => {
        const footer = `\n[${new Date().toISOString()}] Command completed successfully\n`;
        fs.appendFileSync(logFile, footer);
        resolve(result);
      })
      .catch((err) => {
        const footer = `\n[${new Date().toISOString()}] Command failed: ${err.message}\n`;
        fs.appendFileSync(logFile, footer);
        reject(err);
      });
  });
}

module.exports = {
  runCommand,
  runAgentCommand,
};