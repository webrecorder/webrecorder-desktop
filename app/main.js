const { app, BrowserWindow, ipcMain, session, webContents } = require('electron');
const path = require('path');
const cp = require('child_process');
const os = require('os');
const datShare = require('dat-share');
const windowStateKeeper = require('electron-window-state');
const MenuBuilder = require('./menu');
const packageInfo = require('./package');
const fetch = require('node-fetch');


let debugOutput = [];
let pluginName;
let port;
let spawnOptions;
let webrecorderProcess;

let numWindows = 0;
let proxyConfig = {};

const projectDir = path.join(__dirname, '../');
const webrecorderBin = path.join(projectDir, 'python-binaries', 'webrecorder');
const stdio = ['ignore', 'pipe', 'pipe'];
const wrConfig = {};
const pluginDir = 'plugins';

const dataPath = path.join(app.getPath('documents'), 'Webrecorder-Data');

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
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
//app.commandLine.appendSwitch('remote-debugging-port', '0');

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

  const menuBuilder = new MenuBuilder(mainWindow, createWindow);
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

    initUnloadListener(contents);
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

  const datOpts = {
    host: 'localhost',
    port: 0,
    swarmManager: {
      port: 0,
      rootDir: path.join(dataPath, 'storage')
    }
  };

  let datApiPort = null;

  try {
    const datres = await datShare.initServer(datOpts);
    datApiPort = datres.server.address().port;
  } catch(e) {
    console.log('Error Loading Dat Share -- Already running on same port?');
  }

  await startWebrecorder(datApiPort);
  console.log('Python App Started: ' + port);

  process.env.INTERNAL_HOST = 'localhost';
  process.env.INTERNAL_PORT = port;
  process.env.ALLOW_DAT = true;

  const seshReplay = session.fromPartition(`persist:${username}-replay`, { cache: true });

  const seshLiveRecord = session.fromPartition(`persist:${username}`, { cache: false });

  proxyConfig = { proxyRules: `localhost:${port}` };

  seshReplay.setProxy(proxyConfig, () => {
    createWindow();
  });
});


const initUnloadListener = function(wc) {
  let lastUrl = null;
  let url;

  (async () => {
    wc.debugger.attach();

    await wc.debugger.sendCommand('DOM.enable');
    await wc.debugger.sendCommand('Debugger.enable');

    await wc.debugger.sendCommand('DOMDebugger.setEventListenerBreakpoint',
                                  {'eventName': 'beforeunload'})

    async function resume(event, method, params) {
      if (method === 'Debugger.paused') {
        const resp = await grabText(wc.debugger, true);
        wc.debugger.sendCommand('Debugger.resume');
        putText(resp);
      }
    }

    wc.debugger.on('message', resume);
  })();

  async function grabText(deb, resumeCallback) {
    url = wc.getURL();

    if (resumeCallback) {
      const abort = (url === lastUrl);
      lastUrl = null;
      if (abort) {
        return;
      }
    } else {
      lastUrl = url;
    }

    console.log(`*** Getting text from ${url} via ${resumeCallback ? ' debugger ' : ' history '} trigger`);

    let resp = null;

    try {
      resp = await deb.sendCommand('DOM.getDocument', {'depth': -1, 'pierce': true});

      console.log('got text!');
    } catch (e) {
      console.log(e);
    }

    return resp;
  }

  function putText(data) {
    if (!data) {
      console.log('no text');
      return;
    }

    data = JSON.stringify(data);

    const options = {
      method: 'PUT',
      credentials: 'include',
      body: data,
      headers: {
        'Content-Type': 'application/json',
        'x-requested-with': 'XMLHttpRequest'
      }
    };

    fetch(`http://localhost:${port}/api/v1/remote/put-record?target_uri=dom-json:${url}`, options);

    console.log(`Sent ${data.length}`);
  }

  ipcMain.on('unload-wait', (event) => {
    if (!wc) {
      return;
    }

    grabText(wc.debugger).then((resp) => {
      event.reply('unload-resume');
      putText(resp);
    });
  });

  wc.once('destroyed', (event) => {
    wc = null;
  });
}


// renderer process communication
ipcMain.on('toggle-proxy', (evt, arg) => {
  const sesh = session.fromPartition(`persist:${username}`, { cache: false });

  const rules = arg ? proxyConfig : {};

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
