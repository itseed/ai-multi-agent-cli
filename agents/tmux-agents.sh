#!/usr/bin/env bash

SESSION_NAME="ai-agents"
PROJECT_DIR="$(pwd)"

# TODO: แก้ให้ตรงกับ CLI จริง
CMD_PLANNER="gemini"
CMD_IMPLEMENTER="cursor-agent"
CMD_TESTER="cursor-agent"
CMD_REVIEWER="codex"

# ตรวจสอบว่า tmux ติดตั้งแล้วหรือยัง
if ! command -v tmux &> /dev/null; then
  echo "ERROR: tmux is not installed."
  echo "Please install tmux:"
  echo "  brew install tmux"
  echo "  or"
  echo "  sudo apt-get install tmux  # on Ubuntu/Debian"
  exit 1
fi

# ตรวจสอบว่า commands มีอยู่จริงหรือไม่ (optional warning)
for cmd_name in "PLANNER" "IMPLEMENTER" "TESTER" "REVIEWER"; do
  cmd_var="CMD_${cmd_name}"
  cmd_value="${!cmd_var}"
  if ! command -v "$cmd_value" &> /dev/null; then
    echo "WARNING: Command '$cmd_value' (${cmd_name}) not found in PATH."
  fi
done

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "Killing existing tmux session: $SESSION_NAME"
  tmux kill-session -t "$SESSION_NAME"
fi

echo "Creating tmux session: $SESSION_NAME"

tmux new-session -d -s "$SESSION_NAME" -c "$PROJECT_DIR" \
  "echo 'Planner Agent'; echo; $CMD_PLANNER"

tmux split-window -h -t "$SESSION_NAME:0" -c "$PROJECT_DIR" \
  "echo 'Implementer Agent'; echo; $CMD_IMPLEMENTER"

tmux select-pane -t "$SESSION_NAME:0.0"
tmux split-window -v -t "$SESSION_NAME:0.0" -c "$PROJECT_DIR" \
  "echo 'Tester Agent'; echo; $CMD_TESTER"

tmux select-pane -t "$SESSION_NAME:0.1"
tmux split-window -v -t "$SESSION_NAME:0.1" -c "$PROJECT_DIR" \
  "echo 'Reviewer Agent'; echo; $CMD_REVIEWER"

tmux select-layout -t "$SESSION_NAME:0" tiled

# Enable mouse support for easier pane navigation
# Try modern syntax first (tmux 2.1+), fallback to older syntax
tmux set -g mouse on 2>/dev/null || \
tmux set -g mouse-mode on 2>/dev/null || \
tmux set -g mouse-utf8 on 2>/dev/null || \
echo "Note: Could not enable mouse support (may need manual config)"

echo "Agents started in tmux session: $SESSION_NAME"
echo "Mouse support enabled - you can click to switch panes"
tmux attach -t "$SESSION_NAME"