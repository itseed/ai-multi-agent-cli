#!/usr/bin/env node
/**
 * Orchestrator หลัก – planner -> implementer -> tester -> reviewer (+ loop แก้)
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

let envPath = '.env'; // default
if (process.env.TARGET_PROJECT_ROOT) {
  const p = path.join(process.env.TARGET_PROJECT_ROOT, '.env');
  if (fs.existsSync(p)) envPath = p;
}

dotenv.config({ path: envPath });

const { readStatus, setStatus } = require('./lib/status');
const { ROOT_DIR } = require('./lib/paths');
const { pipeline } = require('./agents/agentConfig');
const { runPlannerIfNeeded } = require('./agents/plannerAgent');
const {
  runImplementerIfNeeded,
  runImplementerFixFromReview,
} = require('./agents/implementerAgent');
const { runTesterIfNeeded } = require('./agents/testerAgent');
const { runReviewerOnce } = require('./agents/reviewerAgent');

async function main() {
  console.log('=== AI Multi-Agent Orchestrator ===');
  const status = readStatus();

  if (!status.task || status.task.trim() === '') {
    console.error('ERROR: No task specified in ai_status.json');
    process.exit(1);
  }

  console.log('Project:', ROOT_DIR);
  console.log('Task   :', status.task);
  console.log('--------------------------------------------\n');

  try {
    // 1) Planner
    await runPlannerIfNeeded();

    // 2) Implementer
    await runImplementerIfNeeded();

    // 3) Tester
    await runTesterIfNeeded();

    // 4) Reviewer + loop
    const { enabled, maxLoops } = pipeline.reviewLoop;
    let iteration = 0;
    let finalStatus = 'UNKNOWN';

    if (!enabled) {
      console.log('Review loop disabled in config.');
      finalStatus = 'OK'; // Assume OK if review is disabled
    } else {
      while (iteration < maxLoops) {
        iteration++;
        console.log(`\n##### REVIEW LOOP ROUND ${iteration} #####\n`);

        const reviewStatus = await runReviewerOnce();

        if (reviewStatus === 'OK') {
          finalStatus = 'OK';
          break;
        }

        if (reviewStatus === 'NEED_FIX') {
          if (iteration >= maxLoops) {
            console.warn(`Reached max review loops (${maxLoops}).`);
            finalStatus = 'NEED_FIX';
            break;
          }
          await runImplementerFixFromReview();
          continue;
        }

        finalStatus = 'UNKNOWN';
        break;
      }
    }

    setStatus('reviewer', finalStatus === 'OK' ? 'done' : 'unknown');
    console.log('\n=== PIPELINE FINISHED ===');
    console.log('Final review status:', finalStatus);

    if (finalStatus !== 'OK') process.exit(1);
  } catch (err) {
    console.error('\n=== PIPELINE FAILED ===');
    console.error('Error:', err.message);
    if (err.stack) {
      console.error('Stack:', err.stack);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});