#!/usr/bin/env bash

##############################################
# Load .env
##############################################

# ตรวจว่ามีไฟล์ .env ในโปรเจ็กต์หรือไม่
if [ -f ".env" ]; then
  export $(grep -v '^#' .env | xargs)
else
  echo "[WARN] .env not found. Using default environment."
fi

##############################################
# Resolve project root
##############################################

if [ -z "$TARGET_PROJECT_ROOT" ]; then
  echo "[ERROR] TARGET_PROJECT_ROOT is not set in .env"
  exit 1
fi

PROJECT_DIR="$TARGET_PROJECT_ROOT"

# Get orchestrator directory
# This script should be run from orchestrator directory
ORCHESTRATOR_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Log directory is in TARGET_PROJECT_ROOT (not orchestrator)
LOG_DIR="$PROJECT_DIR/logs"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

##############################################
# Agent CLI commands (fallback to default)
##############################################

PLANNER_CLI=${PLANNER_CLI:-gemini}
IMPLEMENTER_CLI=${IMPLEMENTER_CLI:-cursor-agent}
TESTER_CLI=${TESTER_CLI:-cursor-agent}
REVIEWER_CLI=${REVIEWER_CLI:-codex}

##############################################
# Tmux session config
##############################################

SESSION_NAME="ai-agents"
echo "[INFO] Starting tmux session: $SESSION_NAME"
echo "[INFO] Project root: $PROJECT_DIR"

# Kill session if already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "[INFO] Killing existing tmux session: $SESSION_NAME"
  tmux kill-session -t "$SESSION_NAME"
fi

# Enable mouse support (global and session-specific)
tmux set-option -g mouse on 2>/dev/null || tmux set-option -g mouse-mode on 2>/dev/null

##############################################
# Pane Layout
#
#  ┌───────────────┬──────────────────┐
#  │   Planner      │   Implementer    │
#  │   (Gemini)     │   (Cursor)       │
#  ├───────────────┼──────────────────┤
#  │   Tester       │   Reviewer       │
#  │ (Cursor/Test)  │   (Codex)        │
#  └───────────────┴──────────────────┘
##############################################

##############################################
# Create session + Pane 1 (Planner)
##############################################

tmux new-session -d -s "$SESSION_NAME" -c "$ORCHESTRATOR_DIR" \
  "clear; echo '=== Planner Agent Log (Real-time) ==='; echo 'Log: $LOG_DIR/planner.log'; echo ''; tail -n 50 -f '$LOG_DIR/planner.log' 2>/dev/null || (echo 'Waiting for log file...' && touch '$LOG_DIR/planner.log' && tail -f '$LOG_DIR/planner.log')"

##############################################
# Pane 2 (Implementer)
##############################################

tmux split-window -h -t "$SESSION_NAME:0" -c "$ORCHESTRATOR_DIR" \
  "clear; echo '=== Implementer Agent Log (Real-time) ==='; echo 'Log: $LOG_DIR/implementer.log'; echo ''; tail -n 50 -f '$LOG_DIR/implementer.log' 2>/dev/null || (echo 'Waiting for log file...' && touch '$LOG_DIR/implementer.log' && tail -f '$LOG_DIR/implementer.log')"

##############################################
# Pane 3 (Tester)
##############################################

tmux select-pane -t "$SESSION_NAME:0.0"
tmux split-window -v -t "$SESSION_NAME:0.0" -c "$ORCHESTRATOR_DIR" \
  "clear; echo '=== Tester Agent Log (Real-time) ==='; echo 'Log: $LOG_DIR/tester.log'; echo ''; tail -n 50 -f '$LOG_DIR/tester.log' 2>/dev/null || (echo 'Waiting for log file...' && touch '$LOG_DIR/tester.log' && tail -f '$LOG_DIR/tester.log')"

##############################################
# Pane 4 (Reviewer)
##############################################

tmux select-pane -t "$SESSION_NAME:0.1"
tmux split-window -v -t "$SESSION_NAME:0.1" -c "$ORCHESTRATOR_DIR" \
  "clear; echo '=== Reviewer Agent Log (Real-time) ==='; echo 'Log: $LOG_DIR/reviewer.log'; echo ''; tail -n 50 -f '$LOG_DIR/reviewer.log' 2>/dev/null || (echo 'Waiting for log file...' && touch '$LOG_DIR/reviewer.log' && tail -f '$LOG_DIR/reviewer.log')"

##############################################
# Final Layout
##############################################

tmux select-layout -t "$SESSION_NAME:0" tiled

# Ensure mouse is enabled for the session
tmux set-option -t "$SESSION_NAME" mouse on 2>/dev/null || tmux set-option -t "$SESSION_NAME" mouse-mode on 2>/dev/null

echo "[INFO] Tmux agents ready."
echo "[INFO] Mouse support: enabled"
echo "[INFO] Log directory: $LOG_DIR (in target project)"
echo "[INFO] Each pane shows real-time log for its respective agent"
echo "[INFO] Logs update automatically as orchestrator runs"
echo "[INFO] Attach: tmux attach -t $SESSION_NAME"

tmux attach -t "$SESSION_NAME"