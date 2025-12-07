# AI Multi-Agent CLI Orchestrator

ระบบ orchestration สำหรับจัดการ AI agents หลายตัวทำงานร่วมกันในการพัฒนาโปรเจ็กต์ โดยแต่ละ agent มีหน้าที่เฉพาะตัว ทำงานตามลำดับ pipeline และมี review loop เพื่อปรับปรุงคุณภาพโค้ด

## 🎯 Features

- **Multi-Agent Pipeline**: จัดการ agents หลายตัวทำงานตามลำดับ
- **Automated Workflow**: Planner → Implementer → Tester → Reviewer
- **Review Loop**: ตรวจสอบและแก้ไขโค้ดอัตโนมัติจนกว่าจะผ่าน
- **Status Tracking**: ติดตามสถานะของแต่ละ agent แบบ real-time
- **Interactive Task Input**: พิมพ์ task ใหม่ได้โดยตรงใน terminal ✨
- **Real-time Logs**: ดู logs ของแต่ละ agent แบบ real-time ด้วย tmux
- **Configurable**: ปรับแต่ง agents และ pipeline ได้ง่าย
- **Error Handling**: จัดการ errors และ timeouts อย่างเหมาะสม
- **Continuous Operation**: รันต่อเนื่องและรองรับการอัพเดต task ใหม่ได้

## 📋 Prerequisites

- **Node.js** >= 14.x
- **tmux** (สำหรับ tmux-agents.sh)
- **AI CLI Tools**:
  - `gemini` - สำหรับ Planner agent
  - `cursor-agent` - สำหรับ Implementer และ Tester agents
  - `codex` - สำหรับ Reviewer agent

### Installing tmux

```bash
# macOS
brew install tmux

# Ubuntu/Debian
sudo apt-get install tmux

# Fedora
sudo dnf install tmux
```

## 🚀 Installation

1. Clone หรือ download โปรเจ็กต์นี้

2. ตรวจสอบว่า Node.js ติดตั้งแล้ว:
```bash
node --version
```

3. ติดตั้ง dependencies:
```bash
npm install
```

4. ตั้งค่า Environment Variables (แนะนำ):
```bash
cp .env.example .env
# แก้ไข .env ตาม CLI tools ของคุณ
```

## 📖 Usage

### 1. ตั้งค่า Task

มี 2 วิธีในการตั้งค่า task:

#### วิธีที่ 1: แก้ไขไฟล์ `ai_status.json` (แบบเดิม)

```json
{
  "task": "สร้างระบบจัดการผู้ใช้ (User Management System) ด้วย NestJS และ PostgreSQL",
  "planner": "pending",
  "implementer": "pending",
  "tester": "pending",
  "reviewer": "pending"
}
```

#### วิธีที่ 2: พิมพ์ task ใหม่ใน terminal (แนะนำ) ✨

เมื่อรัน orchestrator แล้ว สามารถพิมพ์ task ใหม่ได้โดยตรงใน terminal เมื่อ:
- ไม่มี task ใน `ai_status.json`
- Pipeline เสร็จสิ้นแล้ว
- Pipeline มีปัญหา

Orchestrator จะแสดง prompt:
```
📝 Enter new task (or press Enter to skip):
```

พิมพ์ task ใหม่และกด Enter เพื่อเริ่ม pipeline ใหม่ทันที

### 2. รัน Orchestrator

```bash
npm run orch
# หรือ
node orchestrator.js
```

Orchestrator จะ:
- แสดงสถานะปัจจุบันของแต่ละ agent
- รัน pipeline ตามลำดับ
- แสดง prompt สำหรับ task ใหม่เมื่อเสร็จสิ้น
- รองรับ Ctrl+C เพื่อหยุดอย่างปลอดภัย

### 3. ตรวจสอบผลลัพธ์

Pipeline จะสร้างไฟล์ต่อไปนี้:

**Status File** (อยู่ใน orchestrator directory):
- `ai_status.json` - สถานะของแต่ละ agent

**Documentation Files** (ขึ้นอยู่กับการตั้งค่า `DOCS_IN_TARGET_PROJECT`):
- `docs/AI_PLAN.md` - แผนระบบจาก Planner
- `docs/AI_TEST_REPORT.md` - รายงานผลการทดสอบจาก Tester
- `docs/AI_REVIEW.md` - รีวิวโค้ดจาก Reviewer

**Code Files** (อยู่ใน target project):
- `src/**` - โค้ดที่ Implementer สร้าง
- `tests/**` - Tests ที่ Tester สร้าง

**Log Files** (อยู่ใน `TARGET_PROJECT_ROOT/logs`):
- `planner.log` - Log จาก Planner agent
- `implementer.log` - Log จาก Implementer agent
- `tester.log` - Log จาก Tester agent
- `reviewer.log` - Log จาก Reviewer agent

## ⚙️ Configuration

### วิธีที่ 1: ใช้ Environment Variables (แนะนำ)

สร้างไฟล์ `.env` จาก `.env.example`:

```bash
cp .env.example .env
```

แก้ไขไฟล์ `.env` ตาม CLI tools ของคุณ:

```bash
# Planner Agent
PLANNER_COMMAND=gemini
PLANNER_ARGS=--model gemini-2.0-pro
PLANNER_TIMEOUT_MS=3600000

# Implementer Agent
IMPLEMENTER_COMMAND=cursor-agent
IMPLEMENTER_ARGS=
IMPLEMENTER_TIMEOUT_MS=3600000

# Tester Agent
TESTER_COMMAND=cursor-agent
TESTER_ARGS=
TESTER_TIMEOUT_MS=3600000

# Reviewer Agent
REVIEWER_COMMAND=codex
REVIEWER_ARGS=
REVIEWER_TIMEOUT_MS=3600000

# Pipeline Configuration
REVIEW_LOOP_ENABLED=true
REVIEW_LOOP_MAX_LOOPS=3
```

**ข้อดี**: ไม่ต้องแก้ไขโค้ด, ง่ายต่อการจัดการหลาย environment

### วิธีที่ 2: แก้ไข agentConfig.js โดยตรง

แก้ไขไฟล์ `agents/agentConfig.js` เพื่อปรับแต่ง:

```javascript
agents: {
  planner: {
    command: 'gemini',        // เปลี่ยนเป็น CLI command ของคุณ
    defaultArgs: [],          // arguments สำหรับ command
    timeoutMs: 60 * 60 * 1000, // timeout (1 hour)
  },
  // ...
}
```

### Environment Variables ที่รองรับ

| Variable | Description | Default |
|----------|-------------|---------|
| `PLANNER_COMMAND` | Command สำหรับ Planner agent | `gemini` |
| `PLANNER_ARGS` | Arguments สำหรับ Planner (space-separated) | `` |
| `PLANNER_TIMEOUT_MS` | Timeout ใน milliseconds | `3600000` |
| `IMPLEMENTER_COMMAND` | Command สำหรับ Implementer agent | `cursor-agent` |
| `IMPLEMENTER_ARGS` | Arguments สำหรับ Implementer | `` |
| `IMPLEMENTER_TIMEOUT_MS` | Timeout ใน milliseconds | `3600000` |
| `TESTER_COMMAND` | Command สำหรับ Tester agent | `cursor-agent` |
| `TESTER_ARGS` | Arguments สำหรับ Tester | `` |
| `TESTER_TIMEOUT_MS` | Timeout ใน milliseconds | `3600000` |
| `REVIEWER_COMMAND` | Command สำหรับ Reviewer agent | `codex` |
| `REVIEWER_ARGS` | Arguments สำหรับ Reviewer | `` |
| `REVIEWER_TIMEOUT_MS` | Timeout ใน milliseconds | `3600000` |
| `REVIEW_LOOP_ENABLED` | เปิด/ปิด review loop | `true` |
| `REVIEW_LOOP_MAX_LOOPS` | จำนวนรอบสูงสุด | `3` |
| `TARGET_PROJECT_ROOT` | Directory ที่จะสร้าง code | `` (current dir) |
| `DOCS_IN_TARGET_PROJECT` | เก็บ docs ใน target project (`true`) หรือ orchestrator dir (`false`) | `false` |

**หมายเหตุ**: Log files จะถูกเก็บใน `TARGET_PROJECT_ROOT/logs/` เสมอ เพื่อให้ `tmux-agents.sh` สามารถแสดง real-time logs ได้

### System Prompts

System prompts ยังคงอยู่ใน `agentConfig.js` (ยังไม่รองรับ environment variables) แก้ไขได้โดยตรง:

```javascript
planner: {
  systemPrompt: `
    คุณคือ System Planner / Researcher
    หน้าที่:
    - วิเคราะห์ requirement สำหรับระบบตามโจทย์
    ...
  `,
}
```

## 📁 Project Structure

```
ai-multi-agent-cli/
├── orchestrator.js          # Main orchestrator
├── package.json
├── ai_status.json           # Status tracking file
│
├── agents/                   # Agent implementations
│   ├── agentConfig.js       # Configuration
│   ├── plannerAgent.js      # Planner agent
│   ├── implementerAgent.js  # Implementer agent
│   ├── testerAgent.js      # Tester agent
│   ├── reviewerAgent.js    # Reviewer agent
│   └── tmux-agents.sh      # Tmux script for parallel agents
│
├── lib/                     # Utilities
│   ├── paths.js            # Path constants
│   ├── status.js           # Status management
│   └── runCommand.js       # Command execution
│
└── docs/                    # Documentation
    ├── CODE_REVIEW.md      # Code review summary
    ├── AI_PLAN.md          # Generated plan
    ├── AI_TEST_REPORT.md   # Generated test report
    └── AI_REVIEW.md        # Generated review
```

## 🔄 Workflow

```
┌─────────┐
│ Planner │ → สร้างแผนระบบ (AI_PLAN.md)
└─────────┘
     ↓
┌──────────────┐
│ Implementer  │ → เขียนโค้ด (src/**)
└──────────────┘
     ↓
┌─────────┐
│ Tester  │ → เขียนและรัน tests (tests/**)
└─────────┘
     ↓
┌──────────┐
│ Reviewer │ → ตรวจโค้ด (AI_REVIEW.md)
└──────────┘
     ↓
   [OK?]
     │
     ├─ YES → ✅ เสร็จสิ้น
     │
     └─ NO → Implementer แก้ไข → Reviewer ตรวจใหม่ (loop)
```

## 🤖 Agents

### 1. Planner (Gemini)
- **หน้าที่**: วิเคราะห์ requirement และออกแบบระบบ
- **Output**: `docs/AI_PLAN.md`
- **Input**: Task description

### 2. Implementer (Cursor)
- **หน้าที่**: เขียนโค้ดตามแผน
- **Output**: Source code files
- **Input**: `AI_PLAN.md`, `AI_REVIEW.md` (ถ้ามี)

### 3. Tester (Cursor)
- **หน้าที่**: เขียนและรัน tests
- **Output**: Test files, `docs/AI_TEST_REPORT.md`
- **Input**: `AI_PLAN.md`, Source code

### 4. Reviewer (Codex)
- **หน้าที่**: ตรวจโค้ดและหา issues
- **Output**: `docs/AI_REVIEW.md`
- **Input**: `AI_PLAN.md`, Source code

## 🛠️ Advanced Usage

### รัน Agents แบบ Parallel ด้วย tmux

```bash
./agents/tmux-agents.sh
```

สคริปต์นี้จะสร้าง tmux session พร้อม 4 panes สำหรับแต่ละ agent:

- **Pane 0**: Planner Agent Log (Real-time)
- **Pane 1**: Implementer Agent Log (Real-time)
- **Pane 2**: Tester Agent Log (Real-time)
- **Pane 3**: Reviewer Agent Log (Real-time)

**Features**:
- แสดง real-time logs จากแต่ละ agent
- รองรับ mouse navigation (คลิกเพื่อเปลี่ยน pane)
- Log files ถูกเก็บใน `TARGET_PROJECT_ROOT/logs/`
- แต่ละ pane จะแสดง log ของ agent ที่เกี่ยวข้อง

**การใช้งาน**:
- ใช้ `Ctrl+B` แล้วกด arrow keys เพื่อเปลี่ยน pane
- หรือใช้ mouse คลิกที่ pane ที่ต้องการ
- ใช้ `Ctrl+B` แล้วกด `D` เพื่อ detach session (session จะยังทำงานอยู่)
- ใช้ `tmux attach -t agents` เพื่อกลับมา session

**หมายเหตุ**: Orchestrator ต้องรันอยู่เพื่อให้ agents ทำงาน และ log files จะถูกสร้างเมื่อ agent เริ่มทำงาน

### Skip Steps

แก้ไข `ai_status.json` เพื่อ skip steps ที่ทำเสร็จแล้ว:

```json
{
  "task": "...",
  "planner": "done",      // Skip planner
  "implementer": "pending",
  "tester": "pending",
  "reviewer": "pending"
}
```

### Custom Timeouts

แก้ไข timeout ใน `agentConfig.js`:

```javascript
planner: {
  timeoutMs: 30 * 60 * 1000, // 30 minutes
}
```

## 🐛 Troubleshooting

### Error: Command not found

**ปัญหา**: Agent command ไม่พบใน PATH

**แก้ไข**:
1. ตรวจสอบว่า CLI tool ติดตั้งแล้ว
2. ตรวจสอบว่า command อยู่ใน PATH
3. แก้ไข `command` ใน `agentConfig.js`

### Error: Task is required

**ปัญหา**: ไม่มี task ใน `ai_status.json`

**แก้ไข**: 
1. **วิธีที่ 1 (แนะนำ)**: พิมพ์ task ใหม่ใน terminal เมื่อ orchestrator แสดง prompt
2. **วิธีที่ 2**: เพิ่ม `task` field ใน `ai_status.json`

### Timeout Errors

**ปัญหา**: Agent ใช้เวลานานเกินไป

**แก้ไข**: เพิ่ม `timeoutMs` ใน `agentConfig.js` หรือตรวจสอบว่า agent command ทำงานถูกต้อง

### Review Loop ไม่หยุด

**ปัญหา**: Review loop รันเกิน maxLoops

**แก้ไข**: ตรวจสอบ `AI_REVIEW.md` ว่ามี status token (`[STATUS]: ...`) หรือไม่

## 📝 Status Values

- `pending` - ยังไม่เริ่มทำงาน
- `in_progress` - กำลังทำงาน
- `done` - เสร็จสิ้น
- `failed` - ล้มเหลว
- `unknown` - ไม่ทราบสถานะ
- `needs_fix` - ต้องการการแก้ไข (สำหรับ reviewer)

## 🔧 Development

### Adding New Agents

1. สร้างไฟล์ใหม่ใน `agents/` เช่น `newAgent.js`
2. เพิ่ม config ใน `agentConfig.js`
3. เพิ่ม status field ใน `lib/status.js`
4. เพิ่ม function ใน `orchestrator.js`

ดูตัวอย่างใน `docs/CODE_REVIEW.md`

### Testing

```bash
# ตรวจสอบ syntax
node -c orchestrator.js

# ตรวจสอบ linting (ถ้ามี)
npm run lint
```

## 📄 License

MIT License

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## ⚠️ Notes

- **Important**: ตรวจสอบว่า AI CLI tools ของคุณรองรับการเขียนไฟล์และอ่านไฟล์
- **Important**: แก้ไข `command` และ `defaultArgs` ใน `agentConfig.js` ให้ตรงกับ CLI tools ของคุณ
- **Warning**: Pipeline อาจใช้เวลานาน ขึ้นอยู่กับความซับซ้อนของ task

## 🎓 Example Tasks

### Simple Task
```json
{
  "task": "สร้าง REST API สำหรับ CRUD operations ของ Todo list"
}
```

### Complex Task
```json
{
  "task": "สร้างระบบ E-commerce ด้วย NestJS, Prisma, PostgreSQL, และ Next.js frontend พร้อม authentication, payment integration, และ admin dashboard"
}
```

---

**Happy Coding! 🚀**

