# Setup Guide - Development Environment

This guide will help you set up the development environment for the refactored Logic Circuit Simulator.

---

## Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
2. **Git** (for version control)
3. **Code Editor** (VSCode recommended, but any editor works)

---

## Step-by-Step Setup

### 1. Install Node.js

**Check if already installed:**
```bash
node --version
npm --version
```

If you see version numbers (e.g., `v18.17.0` and `9.6.7`), you're good! Skip to step 2.

**If not installed:**

**Windows:**
- Download from: https://nodejs.org/
- Choose "LTS" version (Long Term Support)
- Run installer, click Next → Next → Install
- Restart terminal/command prompt

**Mac:**
```bash
# Option 1: Download from nodejs.org
# Option 2: Use Homebrew
brew install node
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Verify installation:**
```bash
node --version  # Should show v18.x.x or higher
npm --version   # Should show 9.x.x or higher
```

---

### 2. Create Refactoring Branch

**Navigate to your project:**
```bash
cd logic_circuit_simulator
```

**Check current status:**
```bash
git status
git branch  # Should show * main
```

**Create and switch to refactoring branch:**
```bash
git checkout -b refactor/modernization
```

**Push branch to GitHub (backup):**
```bash
git push -u origin refactor/modernization
```

**Verify you're on the branch:**
```bash
git branch
# Should show:
#   main
# * refactor/modernization  ← (asterisk means you're here)
```

---

### 3. Install Dependencies

**Install all packages (from package.json):**
```bash
npm install
```

**What this does:**
- Downloads ~100MB of packages to `node_modules/`
- Creates `package-lock.json` (locks exact versions)
- Takes 1-3 minutes

**You should see output like:**
```
added 245 packages, and audited 246 packages in 2m

found 0 vulnerabilities
```

**Verify installation:**
```bash
ls node_modules/
# Should see folders: vite, mitt, tabulator-tables, etc.
```

---

### 4. Start Development Server

**Start Vite dev server:**
```bash
npm run dev
```

**You should see:**
```
  VITE v5.0.11  ready in 234 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.1.x:3000/
  ➜  press h to show help
```

**Browser should auto-open to http://localhost:3000/**

**Test it:**
- Try placing a gate
- Check browser console (F12) for errors

**Stop the server:**
- Press `Ctrl+C` in terminal

---

### 5. Verify Everything Works

**Run tests (should pass even if no tests yet):**
```bash
npm test
```

**Build for production:**
```bash
npm run build
```

**You should see:**
```
vite v5.0.11 building for production...
✓ built in 1.23s
dist/index.html                  1.45 kB
dist/assets/index-a1b2c3d4.js   85.23 kB
```

**Preview production build:**
```bash
npm run preview
```

Opens at: http://localhost:4173/

---

## Common Issues

### Issue 1: "node: command not found"

**Cause:** Node.js not installed or not in PATH

**Fix:**
```bash
# Restart terminal after installing Node.js
# Or add Node.js to PATH manually
```

---

### Issue 2: "npm ERR! EACCES: permission denied"

**Cause:** Permission issues (common on Mac/Linux)

**Fix:**
```bash
# Don't use sudo! Instead, fix npm permissions:
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Now try again:
npm install
```

---

### Issue 3: "Port 3000 already in use"

**Cause:** Another app is using port 3000

**Fix:**
```bash
# Option 1: Stop other app using port 3000

# Option 2: Use different port
npm run dev -- --port 3001
```

---

### Issue 4: Browser doesn't open automatically

**Fix:**
```bash
# Manually open: http://localhost:3000/
```

---

## VSCode Setup (Optional)

**Install VSCode:**
- Download from: https://code.visualstudio.com/

**Recommended Extensions:**
```
1. "Continue" (AI assistant) - search in extensions
2. "ESLint" - code linting
3. "Prettier" - code formatting
4. "Error Lens" - inline errors
```

**Open project in VSCode:**
```bash
cd logic_circuit_simulator
code .
```

---

## Git Workflow

**Daily workflow:**

```bash
# Morning - get latest changes
git pull origin refactor/modernization

# Work on files
# Edit, save, test

# Commit frequently
git add .
git commit -m "Phase 1: Extract geometry utilities"

# Backup to GitHub
git push origin refactor/modernization

# End of day - final push
git push origin refactor/modernization
```

**Switching between branches:**

```bash
# Switch to main (original working code)
git checkout main

# Switch back to refactoring
git checkout refactor/modernization
```

---

## Troubleshooting

### Clear everything and start fresh

```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Reset to last commit
git reset --hard HEAD

# Start dev server
npm run dev
```

### Check what's running

```bash
# See all Node processes
ps aux | grep node

# Kill specific process
kill -9 <process-id>
```

---

## Quick Reference

| Command | What it does |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server (http://localhost:3000) |
| `npm run build` | Build for production |
| `npm test` | Run tests |
| `npm test:ui` | Run tests with UI |
| `git status` | See changed files |
| `git add .` | Stage all changes |
| `git commit -m "..."` | Commit changes |
| `git push` | Push to GitHub |

---

## Success Checklist

After following this guide, you should have:

- [x] Node.js installed (v18+)
- [x] Created `refactor/modernization` branch
- [x] Installed dependencies (`node_modules/` exists)
- [x] Started dev server (http://localhost:3000 works)
- [x] Saw your app in browser
- [x] No errors in console

**If all checkboxes are checked, you're ready to start refactoring!** ✅

---

## Next Steps

See `REFACTORING_PLAN.md` for the complete refactoring plan.

See `PROGRESS.md` to track your progress through phases.

Start with Phase 1: Extract Constants & Utilities
