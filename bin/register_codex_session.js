#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const sessionsRoot = path.join(process.env.HOME || '', '.codex', 'sessions');

main();

function main() {
  const magicworkBin = process.env.MW_MAGICWORK_BIN || '';
  const osRoot = process.env.MW_OS_ROOT || '';
  const date = process.env.MW_TASK_DATE || '';
  const branch = process.env.MW_TASK_BRANCH || '';
  const worktreePath = process.env.MW_TASK_WORKTREE || '';
  const startedAtMs = Number(process.env.MW_SESSION_STARTED_AT_MS || '0');

  if (!magicworkBin || !date || !branch || !worktreePath || !startedAtMs) {
    process.exit(0);
  }

  const session = waitForSession(worktreePath, startedAtMs);
  if (!session?.id) {
    process.exit(0);
  }

  const args = [magicworkBin, 'record-session', '--date', date, '--branch', branch, '--session-id', session.id];
  if (osRoot) {
    args.push('--os-root', osRoot);
  }

  spawnSync(process.execPath, args, {
    stdio: 'ignore',
  });
}

function waitForSession(worktreePath, startedAtMs) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const session = findLatestSession(worktreePath, startedAtMs);
    if (session) {
      return session;
    }
    sleep(1000);
  }
  return null;
}

function findLatestSession(worktreePath, startedAtMs) {
  if (!fs.existsSync(sessionsRoot)) {
    return null;
  }

  const candidates = [];
  const stack = [sessionsRoot];

  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) {
        continue;
      }
      const stat = fs.statSync(fullPath);
      if (stat.mtimeMs < startedAtMs - 10000) {
        continue;
      }
      const sessionMeta = readSessionMeta(fullPath);
      if (!sessionMeta || sessionMeta.cwd !== worktreePath) {
        continue;
      }
      candidates.push({
        id: sessionMeta.id,
        path: fullPath,
        timestamp: Date.parse(sessionMeta.timestamp || '') || stat.mtimeMs,
      });
    }
  }

  candidates.sort((a, b) => b.timestamp - a.timestamp);
  return candidates[0] || null;
}

function readSessionMeta(filePath) {
  const firstLine = fs.readFileSync(filePath, 'utf8').split('\n').find(Boolean);
  if (!firstLine) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(firstLine);
  } catch (error) {
    return null;
  }

  if (parsed.type !== 'session_meta' || !parsed.payload) {
    return null;
  }
  return parsed.payload;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
