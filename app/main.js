const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const cp = require('child_process');
const os = require('os');
const datShare = require('dat-share');
const windowStateKeeper = require('electron-window-state');
const MenuBuilder = require('./menu');
const packageInfo = require('./package');

let debugOutput = [];
let mainWindow = null;
let pluginName;
let port;
let spawnOptions;
let webrecorderProcess;

const projectDir = path.join(__dirname, '../');
const webrecorderBin = path.join(projectDir, 'python-binaries', 'webrecorder');
const stdio = ['ignore', 'pipe', 'pipe'];
const wrConfig = {};
const pluginDir = 'plugins';

const username = os.userInfo().username;


switch (process.platform) {
  case 'win32':
    pluginName = 'pepflashplayer.dll';
    spawnOptions = { detached: true, stdio };
    break;
  case 'darwin':
    pluginName = 'PepperFlashPlayer.plugin';
    spawnOptions = { detached: true, stdio };
    break;
  case 'linux':
    pluginName = 'libpepflashplayer.so';
    spawnOptions = { detached: true, stdio };
    break;
  default:
    console.log('platform unsupported');
    break;
}

app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch(
  'ppapi-flash-path',
  path.join(projectDir, pluginDir, pluginName)
);
app.commandLine.appendSwitch('enable-features', 'brotli-encoding');

function addToDebugOutput(rawBuff) {
  const buff = rawBuff.toString();
  console.log(buff);

  debugOutput.push(buff);
  //fs.appendFileSync('/tmp/out.log', buff);

  // clip line buffer
  if (debugOutput.length > 500) {
    debugOutput.shift();
  }
  return buff;
}

function findPort(rawBuff) {
  const buff = addToDebugOutput(rawBuff);

  if (!buff || port) {
    return;
  }

  const parts = buff.split('APP_HOST=http://localhost:');
  if (parts.length !== 2) {
    return;
  }

  port = parts[1].trim();

  if (process.platform !== 'win32') {
    webrecorderProcess.unref();
  }

  const appUrl = `http://localhost:${port}/`;

  console.log(
    `webrecorder is listening on: ${appUrl} (pid ${webrecorderProcess.pid}) `
  );

  Object.assign(wrConfig, { host: appUrl });

  return { port, appUrl };
}

function installExtensions() {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS', 'REDUX_DEVTOOLS'];

  return Promise.all(
    extensions.map(name => installer.default(installer[name], forceDownload))
  ).catch(console.log);
}

function createWindow() {
  // keep track of window state
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1000,
    defaultHeight: 800
  });

  mainWindow = new BrowserWindow({
    webPreferences: {
      plugins: true,
      webviewTag: true,
      nodeIntegration: true,
    },

    // start with state from windowStateKeeper
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    isMaximized: mainWindowState.isMaximized,
    isFullScreen: mainWindowState.isFullScreen,

    // hide the window until the content is loaded
    show: false
  });

  // have windowStateKeeper subscribe to window state changes
  mainWindowState.manage(mainWindow);

  // show the window once its content is ready to go
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // load the application into the main window
  mainWindow.loadURL(`file://${__dirname}/app.html`);

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (webrecorderProcess) {
      if (process.platform === 'win32') {
        cp.execSync(`taskkill /F /PID ${webrecorderProcess.pid} /T`);
      } else {
        webrecorderProcess.kill('SIGINT');
      }
    }
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();
}

function starWebrecorder() {
  const dataPath = path.join(app.getPath('downloads'), 'Webrecorder-Data');
  let cmdline = [
    '--no-browser',
    '--loglevel',
    'info',
    '-d',
    dataPath,
    '-u',
    username,
    '--port',
    0
  ];

  Object.assign(wrConfig, { dataPath });

  console.log(cmdline.toString());

  webrecorderProcess = cp.spawn(webrecorderBin, cmdline, spawnOptions);

  // catch any errors spawning webrecorder binary and add to debug info
  webrecorderProcess.on('error', err => {
    debugOutput.push(`Error spawning ${webrecorderBin} binary:\n ${err}\n\n`);
  });

  // log any stderr notices
  webrecorderProcess.stderr.on('data', buff => {
    const buffStr = buff.toString();
    console.log(buffStr);

    //fs.appendFileSync('/tmp/err.log', buff.toString());

    debugOutput.push(`stderr: ${buffStr}`);

    // clip line buffer
    if (debugOutput.length > 500) {
      debugOutput.shift();
    }
  });

  let foundPortAppURL = false;

  const prr = {
    resolve: null,
    reject: null,
    promise: null
  };

  prr.promise = new Promise((resolve, reject) => {
    prr.resolve = resolve;
    prr.reject = reject;
  });

  webrecorderProcess.stdout.on('data', buff => {
    if (!foundPortAppURL) {
      const portAppURL = findPort(buff);
      if (portAppURL) {
        foundPortAppURL = true;
        prr.resolve(portAppURL);
      }
      return;
    }
    addToDebugOutput(buff);
  });
  return prr.promise;
}

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  app.quit();
});

// Ensure new-window urls are just opened directly in the webview
app.on('web-contents-created', (e, contents) => {
  if (contents.getType() === 'webview') {
    // Listen for any new window events on the webview
    contents.on('new-window', (e, url) => {
      e.preventDefault();
      contents.loadURL(url);
    });
  }
});

app.on('ready', async () => {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  ) {
    await installExtensions();
  }

  cp.execFile(webrecorderBin, ['--version'], (err, stdout, stderr) => {
    const electronVersion = `electron ${process.versions.electron}<BR>
                             chrome ${process.versions.chrome}`;
    Object.assign(wrConfig, {
      version: `Webrecorder Desktop ${packageInfo.version}<BR>
                ${stdout.replace(/\n/g, '<BR>')}<BR>${electronVersion}`
    });
  });

  const dataPath = path.join(
    app.getPath('downloads'),
    'Webrecorder-Data',
    'storage'
  );

  const datOpts = {
    host: 'localhost',
    port: 3000,
    swarmManager: {
      port: 3282,
      rootDir: dataPath
    }
  };

  await datShare.initServer(datOpts);
  await starWebrecorder();
  console.log('Python App Started: ' + port);

  process.env.INTERNAL_HOST = 'localhost';
  process.env.INTERNAL_PORT = port;
  process.env.ALLOW_DAT = true;

  const sesh = session.fromPartition(`persist:${username}-replay`, { cache: true });
  const proxy = `localhost:${port}`;
  sesh.setProxy({ proxyRules: proxy }, () => {
    createWindow();
  });
});


// renderer process communication
ipcMain.on('toggle-proxy', (evt, arg) => {
  const sesh = session.fromPartition(`persist:${username}`, { cache: false });

  let rules;

  if (arg) {
    rules = { proxyRules: `localhost:${process.env.INTERNAL_PORT}` };
  } else {
    rules = {};
  }

  sesh.setProxy(rules, () => {
    console.log('proxy set:', rules);
    evt.sender.send('toggle-proxy-done', {});
  });
});

ipcMain.on('async-call', (evt, arg) => {
  evt.sender.send('async-response', {
    config: wrConfig,
    stdout: debugOutput.join('<BR>').replace(/\n/g, '<BR>')});
});


ipcMain.on('clear-cookies', () => {
  // get current session
  const sesh = session.fromPartition(`persist:${username}`);
  sesh.clearStorageData({ storages: 'cookies' }, () => console.log('cookies cleared !'));
});
