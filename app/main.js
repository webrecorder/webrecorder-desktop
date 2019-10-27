const { app, BrowserWindow, dialog, ipcMain, Menu, session } = require('electron');
const path = require('path');
const cp = require('child_process');
const os = require('os');
const datShare = require('dat-share');
const windowStateKeeper = require('electron-window-state');
const MenuBuilder = require('./menu');
const packageInfo = require('./package');

let debugOutput = [];
let pluginName;
let spawnOptions;
let webrecorderProcess;

let numWindows = 0;
let proxyConfig = {};

let browserState = null;

let desktopUA, mobileUA;

const projectDir = path.join(__dirname, '../');
const webrecorderBin = path.join(projectDir, 'python-binaries', 'webrecorder');
const stdio = ['ignore', 'pipe', 'pipe'];
const wrConfig = {};
const pluginDir = 'plugins';

const dataPath = path.join(app.getPath('documents'), 'Webrecorder-Data');

let username = os.userInfo().username;

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

app.commandLine.appendSwitch(
  'ppapi-flash-path',
  path.join(projectDir, pluginDir, pluginName)
);
app.commandLine.appendSwitch('enable-features', 'brotli-encoding');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

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

function getSession(isReplay = false) {
  return session.fromPartition(isReplay ? `persist:${username}-replay` : `persist:${username}`, { cache: true });
}

function findPort(rawBuff) {
  const buff = addToDebugOutput(rawBuff);

  if (!buff) {
    return;
  }

  function findProp(prop) {
    const parts = buff.split(prop);
    if (parts.length < 2) {
      return null;
    }
    return parts[1].trim();
  }

  const newUsername = findProp('DEFAULT_USER=');
  if (newUsername) {
    username = newUsername;
  }

  const port = findProp('APP_HOST=http://localhost:');

  if (!port) {
    return;
  }

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

  const mainWindow = new BrowserWindow({
    webPreferences: {
      plugins: true,
      webviewTag: true,
      nodeIntegration: true,
      backgroundThrottling: false,
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
    numWindows++;
  });

  // load the application into the main window
  mainWindow.loadURL(`file://${__dirname}/app.html`);

  mainWindow.on('closed', () => {
    numWindows--;
    if (numWindows > 0) {
      console.log('more windows remain: ' + numWindows);
      return;
    }
    if (webrecorderProcess) {
      if (process.platform === 'win32') {
        cp.execSync(`taskkill /F /PID ${webrecorderProcess.pid} /T`);
      } else {
        webrecorderProcess.kill('SIGINT');
      }
    }
  });

  browserState = new BrowserState();

  const menuBuilder = new MenuBuilder(mainWindow, createWindow, browserState);
  menuBuilder.buildMenu();
}

function startWebrecorder(datApiPort) {
  let cmdline = [
    '--no-browser',
    '--loglevel',
    'info',
    '-d',
    dataPath,
    '-u',
    username,
    '--port',
    0,
    '--behaviors-tarfile',
    path.join(projectDir, 'python-binaries', 'behaviors.tar.gz'),
  ];

  if (datApiPort) {
    cmdline.push('--dat-share-port');
    cmdline.push(datApiPort);
  }

  Object.assign(wrConfig, { dataPath });

  console.log(cmdline.join(' '));

  const prr = {
    resolve: null,
    reject: null,
    promise: null
  };

  prr.promise = new Promise((resolve, reject) => {
    prr.resolve = resolve;
    prr.reject = reject;
  });

  webrecorderProcess = cp.spawn(webrecorderBin, cmdline, spawnOptions);

  // catch any errors spawning webrecorder binary and add to debug info
  webrecorderProcess.on('error', err => {
    debugOutput.push(`Error spawning ${webrecorderBin} binary:\n ${err}\n\n`);
    prr.reject(err);
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

    browserState.init(contents);

    contents.on('destroyed', () => {
      browserState.close();
    });

    contents.on('devtools-closed', () => {
      browserState.setDevtoolsItem(true);
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

  cp.execFile(webrecorderBin, ['--version'], (error, stdout, stderr) => {
    if (error) {
      stdout = '<error - no version>';
    }
    const electronVersion = `electron ${process.versions.electron}<BR>
                             chrome ${process.versions.chrome}`;
    Object.assign(wrConfig, {
      version: `Webrecorder Desktop ${packageInfo.version}<BR>
                ${stdout.replace(/\n/g, '<BR>')}<BR>${electronVersion}`
    });
  });

  // enable dat if true
  const allowDat = true;
  let datApiPort = null;

  if (allowDat) {
    const datOpts = {
      host: 'localhost',
      port: 0,
      swarmManager: {
        port: 0,
        rootDir: path.join(dataPath, 'storage')
      }
    };

    try {
      const datres = await datShare.initServer(datOpts);
      datApiPort = datres.server.address().port;
      process.env.ALLOW_DAT = true;
    } catch(e) {
      console.log('Error Loading Dat Share -- Already running on same port?');
      process.env.ALLOW_DAT = false;
    }
  }

  const sd = new Date();

  try {
    const { port } = await startWebrecorder(datApiPort);
    console.log('Python App Started on %s (startup %dms)\n', port, new Date() - sd);

    process.env.INTERNAL_HOST = 'localhost';
    process.env.INTERNAL_PORT = port;

    proxyConfig = { proxyRules: `localhost:${port}` };
  } catch (e) {

    const detail = getPythonAppErrorDetail(e);

    dialog.showMessageBoxSync({'type': 'error', 'detail': detail});
    app.exit(127);
  }

  const seshReplay = getSession(true);
  const seshLiveRecord = getSession(false);

  // set ua
  const ua = session.defaultSession.getUserAgent();
  desktopUA = ua.replace(/ Electron[^\s]+/, '');

  mobileUA = ua
    .replace(/\([^)]+\)/, "(Linux; Android 5.0; SM-G900P Build/LRX21T)")
    .replace(/Electron[^\s]+/, 'Mobile');

  seshReplay.setUserAgent(desktopUA);
  seshLiveRecord.setUserAgent(desktopUA);

  // verify the self-signed cert
  const certVerify = (request, callback) => callback(0);

  seshReplay.setCertificateVerifyProc(certVerify);
  seshLiveRecord.setCertificateVerifyProc(certVerify);

  seshReplay.setProxy(proxyConfig).then(() => {
    createWindow();
  });
});

// renderer process communication
ipcMain.on('toggle-proxy', (evt, arg) => {
  const sesh = getSession(false);

  const rules = arg ? proxyConfig : {};

  sesh.setProxy(rules).then(() => {
    console.log('proxy set:', rules);
    evt.sender.send('toggle-proxy-done', {});
  });
});

ipcMain.on('async-call', (evt, arg) => {
  evt.sender.send('async-response', {
    config: wrConfig,
    stdout: debugOutput.join('<BR>').replace(/\n/g, '<BR>')});
});


ipcMain.on('clear-cookies', (evt, isReplay) => {
  if (browserState) {
    browserState.clearCookies(isReplay);
  }
});


class BrowserState {
  constructor() {
    this.contents = null;

    this.mobile = false;
    this.muted = false;
  }

  init(contents) {
    this.contents = contents;

    if (this.mobile) {
      this.setMobile(true);
    }

    if (this.muted) {
      this.contents.setAudioMuted(true);
    }

    this.setDevtoolsItem(true);
    this.clearCache();
  }

  close() {
    this.contents = null;
    this.setDevtoolsItem(false);
  }

  setDevtoolsItem(enabled) {
    const menu = Menu.getApplicationMenu();
    if (!menu) {
      return;
    }

    const item = menu.getMenuItemById('devtools');
    if (item) {
      item.enabled = enabled;
      item.checked = false;
    }
  }

  setMute(muted) {
    this.muted = muted;
    if (this.contents) {
      this.contents.setAudioMuted(muted);
    }
  }

  getMute() {
    return this.muted;
  }

  async setMobile(mobile) {
    this.mobile = mobile;

    if (!this.contents) {
      return;
    }

    this.contents.setUserAgent(mobile ? mobileUA : desktopUA);

    const db = this.contents.debugger;

    if (!db.isAttached()) {
      db.attach();
    }

    await db.sendCommand('Emulation.setDeviceMetricsOverride', {
      'width': 0,
      'height': 0,
      'deviceScaleFactor': 0,
      'mobile': mobile,
    });

    await db.sendCommand('Emulation.setTouchEmulationEnabled', {'enabled': mobile});

    await db.sendCommand('Emulation.setEmitTouchEventsForMouse', {'enabled': mobile});

    if (!mobile) {
      db.detach();
    }
  }

  getMobile() {
    return this.mobile;
  }

  clearCookies(isReplay = false) {
    // get current session
    const sesh = getSession(isReplay);
    return sesh.clearStorageData();
  }

  clearCache(isReplay = false) {
    // get current session
    const sesh = getSession(isReplay);
    return sesh.clearCache().then(() => {

      // also clear serviceworkers, as they may be dependent on the cache
      sesh.clearStorageData({'storages': ['serviceworkers']});
    });
  }

  toggleDevTools() {
    if (!this.contents) return;

    if (!this.contents.isDevToolsOpened()) {
      this.contents.openDevTools({'mode': 'undocked', 'activate': true});
    } else {
      this.contents.closeDevTools();
    }
  }
}

function getPythonAppErrorDetail(e) {
    console.log(`Error launching python app, exiting: ${e}`);
    return `Sorry, there was an error launching the Webrecorder Python App and Webrecorder Desktop
must exit.

Please try again or contact us at support@webrecorder.io if the error persists.

Details:
${e}`;

}
