const { spawn } = require('child_process');
const path = require('path');

const options = {
  cwd: path.join('webrecorder', 'frontend'),
  stdio: 'inherit',
  shell: true,
  env: process.env
};

spawn('npm install', [], options).on('exit', code => {
  if (code != 0) {
    return process.exit(code);
  }

  spawn('npm run build-desktop', [], options).on('exit', code2 => {
    return process.exit(code2);
  });
});
