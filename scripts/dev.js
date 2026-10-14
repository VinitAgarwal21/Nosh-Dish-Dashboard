const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');

console.log('[Dev Runner] Starting Backend & Frontend services...');

const backend = spawn(process.execPath, ['--watch', 'src/server.js'], {
  cwd: backendDir,
  stdio: 'inherit',
  env: { ...process.env, PORT: '3000' },
});

const frontend = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--configLoader', 'runner'], {
  cwd: frontendDir,
  stdio: 'inherit',
  env: { ...process.env },
});

function cleanup() {
  console.log('\n[Dev Runner] Terminating processes...');
  backend.kill();
  frontend.kill();
  process.exit();
}

backend.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`[Dev Runner] Backend exited with code ${code}`);
  }
});

frontend.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`[Dev Runner] Frontend exited with code ${code}`);
  }
});

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
