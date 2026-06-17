const fs = require('fs');
const path = require('path');
const cp = require('child_process');

async function run() {
  const testProfile = path.join(process.env.USERPROFILE, '.web-mcp', 'chrome-tamper-test');
  fs.rmSync(testProfile, { recursive: true, force: true });
  fs.mkdirSync(path.join(testProfile, 'Default'), { recursive: true });

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  console.log('1. Launching Chrome to generate initial profile...');
  let p = cp.spawn(chromePath, ['--user-data-dir=' + testProfile, '--no-first-run', '--no-default-browser-check', 'about:blank']);
  await new Promise(r => setTimeout(r, 8000));
  cp.execSync('taskkill /F /IM chrome.exe /T');
  await new Promise(r => setTimeout(r, 2000));

  const prefsPath = path.join(testProfile, 'Default', 'Preferences');
  const secPrefsPath = path.join(testProfile, 'Default', 'Secure Preferences');
  
  console.log('Secure Preferences exists?', fs.existsSync(secPrefsPath));

  console.log('2. Setting developer_mode = true in Preferences...');
  let prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
  if (!prefs.extensions) prefs.extensions = {};
  if (!prefs.extensions.ui) prefs.extensions.ui = {};
  prefs.extensions.ui.developer_mode = true;
  fs.writeFileSync(prefsPath, JSON.stringify(prefs));

  console.log('3. Deleting Secure Preferences (simulating wrapper.ts)...');
  fs.unlinkSync(secPrefsPath);

  console.log('4. Launching Chrome again...');
  p = cp.spawn(chromePath, ['--user-data-dir=' + testProfile, '--no-first-run', '--no-default-browser-check', 'about:blank']);
  await new Promise(r => setTimeout(r, 8000));
  cp.execSync('taskkill /F /IM chrome.exe /T');
  await new Promise(r => setTimeout(r, 2000));

  console.log('5. Checking developer_mode after launch...');
  let prefsAfter = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
  console.log('developer_mode is:', prefsAfter.extensions?.ui?.developer_mode);
}

run();
