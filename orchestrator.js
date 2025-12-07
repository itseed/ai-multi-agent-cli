#!/usr/bin/env node
/**
 * Orchestrator หลัก – planner -> implementer -> tester -> reviewer (+ loop แก้)
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env from current directory first
let envPath = '.env';
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// If TARGET_PROJECT_ROOT is set, also try to load .env from target project
// (but current directory .env takes precedence)
if (process.env.TARGET_PROJECT_ROOT) {
  const targetEnvPath = path.join(process.env.TARGET_PROJECT_ROOT, '.env');
  if (fs.existsSync(targetEnvPath)) {
    dotenv.config({ path: targetEnvPath, override: false }); // Don't override current .env
  }
}

const readline = require('readline');
const { readStatus, setStatus, writeStatus } = require('./lib/status');
const { ROOT_DIR, TARGET_PROJECT_ROOT, ORCHESTRATOR_DIR } = require('./lib/paths');
const { pipeline } = require('./agents/agentConfig');
const { runPlannerIfNeeded } = require('./agents/plannerAgent');
const {
  runImplementerIfNeeded,
  runImplementerFixFromReview,
} = require('./agents/implementerAgent');
const { runTesterIfNeeded } = require('./agents/testerAgent');
const { runReviewerIfNeeded, runReviewerOnce } = require('./agents/reviewerAgent');

// Function to display current status
function displayStatus() {
  const status = readStatus();
  const statusIcons = {
    done: '✓',
    pending: '○',
    in_progress: '⟳',
    unknown: '?',
    failed: '✗',
    needs_fix: '⚠',
  };
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 Current Status');
  console.log('='.repeat(60));
  console.log(`Task: ${status.task || '(not set)'}`);
  console.log(`Planner:     ${statusIcons[status.planner] || '?'} ${status.planner || 'pending'}`);
  console.log(`Implementer: ${statusIcons[status.implementer] || '?'} ${status.implementer || 'pending'}`);
  console.log(`Tester:      ${statusIcons[status.tester] || '?'} ${status.tester || 'pending'}`);
  console.log(`Reviewer:    ${statusIcons[status.reviewer] || '?'} ${status.reviewer || 'pending'}`);
  console.log('='.repeat(60) + '\n');
}

// Check if all agents are done
function isAllDone(status) {
  return (
    status.planner === 'done' &&
    status.implementer === 'done' &&
    status.tester === 'done' &&
    status.reviewer === 'done'
  );
}

// Reset all agent statuses to pending
function resetAllAgents() {
  setStatus('planner', 'pending');
  setStatus('implementer', 'pending');
  setStatus('tester', 'pending');
  setStatus('reviewer', 'pending');
}

// Prompt user for new task
function promptTask() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('\n📝 Enter new task (or press Enter to skip): ', (answer) => {
      rl.close();
      const task = answer.trim();
      if (task) {
        const status = readStatus();
        status.task = task;
        writeStatus(status);
        console.log(`\n✅ Task set: "${task}"\n`);
        resolve(task);
      } else {
        console.log('\n⏭️  Skipped. Waiting for task in ai_status.json...\n');
        resolve(null);
      }
    });
  });
}

async function main() {
  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n\n⚠️  Interrupted by user (Ctrl+C)');
    console.log('Pipeline stopped. Current status saved.');
    displayStatus();
    process.exit(0);
  });

  let lastTask = '';
  let lastStatus = null;

  // Main loop: wait for new tasks
  while (true) {
    const status = readStatus();
    const currentTask = status.task || '';

    // Check if all agents are done
    if (isAllDone(status)) {
      if (currentTask && currentTask === lastTask) {
        // Same task, all done - wait for new task
        console.log('\n✅ All agents completed successfully!');
        displayStatus();
        console.log('⏳ Waiting for new task...');
        console.log('💡 Enter a new task below, or update the "task" field in ai_status.json');
        console.log('💡 Or press Ctrl+C to exit\n');
        
        // Prompt for new task
        const newTask = await promptTask();
        if (newTask) {
          lastTask = newTask;
          lastStatus = null;
          resetAllAgents();
          // Continue to run pipeline with new task
        } else {
          // Poll for task changes in file
          await new Promise(resolve => setTimeout(resolve, 2000)); // Check every 2 seconds
        }
        continue;
      } else if (currentTask && currentTask !== lastTask) {
        // New task detected - reset and start
        console.log('\n🆕 New task detected!');
        console.log(`Previous: ${lastTask || '(none)'}`);
        console.log(`New:      ${currentTask}`);
        console.log('🔄 Resetting all agents to start new pipeline...\n');
        resetAllAgents();
        lastTask = currentTask;
        lastStatus = null;
        // Continue to run pipeline
      } else if (!currentTask) {
        // No task set - prompt user
        console.log('\n📋 No task specified.');
        console.log('💡 Enter a new task below, or update the "task" field in ai_status.json\n');
        
        const newTask = await promptTask();
        if (newTask) {
          lastTask = newTask;
          lastStatus = null;
          resetAllAgents();
          // Continue to run pipeline with new task
        } else {
          // Wait before checking again
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        continue;
      }
    }

    // If we have a task and not all done, run the pipeline
    if (currentTask && !isAllDone(status)) {
      lastTask = currentTask;
      
      try {
        // 1) Planner
        displayStatus();
        await runPlannerIfNeeded();
        displayStatus();

        // 2) Implementer
        await runImplementerIfNeeded();
        displayStatus();

        // 3) Tester
        try {
          await runTesterIfNeeded();
          displayStatus();
        } catch (err) {
          console.error('❌ Tester failed:', err.message);
          displayStatus();
          console.log('💡 Fix the test issues and run again, or reset tester status to retry.\n');
          // Wait a bit before checking again
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }

    // 4) Reviewer + loop
    const { enabled, maxLoops } = pipeline.reviewLoop;
    let iteration = 0;
    let finalStatus = 'UNKNOWN';

    if (!enabled) {
      console.log('ℹ️  Review loop disabled in config.');
      finalStatus = 'OK';
    } else {
      const currentStatus = readStatus();
      if (currentStatus.reviewer === 'done') {
        console.log('✓ Reviewer already done, skipping review loop.');
        finalStatus = 'OK';
      } else {
        const firstReviewStatus = await runReviewerIfNeeded();
        displayStatus();
        
        if (firstReviewStatus === 'OK') {
          finalStatus = 'OK';
        } else if (firstReviewStatus === 'NEED_FIX') {
          iteration = 1;
          
          while (iteration < maxLoops) {
            iteration++;
            console.log(`\n🔄 Review Loop Round ${iteration}/${maxLoops}\n`);

            const reviewStatus = await runReviewerOnce();
            displayStatus();

            if (reviewStatus === 'OK') {
              finalStatus = 'OK';
              break;
            }

            if (reviewStatus === 'NEED_FIX') {
              if (iteration >= maxLoops) {
                console.warn(`⚠️  Reached max review loops (${maxLoops}).`);
                console.log('💡 You can manually fix issues and run again, or reset reviewer status to retry.');
                finalStatus = 'NEED_FIX';
                break;
              }
              console.log('🔧 Fixing issues based on review...\n');
              try {
                await runImplementerFixFromReview();
                displayStatus();
                // After fixing, re-run tester and reviewer
                setStatus('tester', 'pending');
                setStatus('reviewer', 'pending');
                console.log('🔄 Re-running tests after fix...\n');
                await runTesterIfNeeded();
                displayStatus();
                console.log('🔄 Re-running review after fix...\n');
                // Continue to next iteration which will re-run reviewer
                continue;
              } catch (err) {
                console.error('❌ Fix failed:', err.message);
                displayStatus();
                console.log('💡 Fix the issues manually and run again, or reset implementer status to retry.\n');
                finalStatus = 'NEED_FIX';
                break;
              }
            }

            finalStatus = 'UNKNOWN';
            break;
          }
        } else {
          finalStatus = 'UNKNOWN';
        }
      }
    }

        setStatus('reviewer', finalStatus === 'OK' ? 'done' : 'unknown');
        displayStatus();
        
        if (finalStatus === 'OK') {
          console.log('✅ Pipeline completed successfully!\n');
          // Will loop back to check if all done
        } else {
          console.log('⚠️  Pipeline finished with issues. Check status above.\n');
          console.log('💡 Fix the issues and run again, or enter a new task below.\n');
          
          // Prompt for new task
          const newTask = await promptTask();
          if (newTask) {
            lastTask = newTask;
            lastStatus = null;
            resetAllAgents();
            // Continue to run pipeline with new task
          } else {
            // Wait a bit before checking again
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      } catch (err) {
        console.error('\n❌ PIPELINE FAILED');
        console.error('Error:', err.message);
        if (err.stack) {
          console.error('Stack:', err.stack);
        }
        displayStatus();
        console.log('💡 Fix the issue and run again, or enter a new task below.\n');
        
        // Prompt for new task
        const newTask = await promptTask();
        if (newTask) {
          lastTask = newTask;
          lastStatus = null;
          resetAllAgents();
          // Continue to run pipeline with new task
        } else {
          // Wait a bit before checking again
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    } else if (!currentTask) {
      // No task set - prompt user
      console.log('\n📋 No task specified.');
      console.log('💡 Enter a new task below, or update the "task" field in ai_status.json\n');
      
      const newTask = await promptTask();
      if (newTask) {
        lastTask = newTask;
        lastStatus = null;
        resetAllAgents();
        // Continue to run pipeline with new task
      } else {
        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
}

main().catch((err) => {
  console.error('❌ FATAL ERROR:', err);
  displayStatus();
  console.log('💡 Press Ctrl+C to exit.\n');
  // Keep process alive
});