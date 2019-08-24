const { app, ipcMain, Menu, shell, BrowserWindow } = require('electron');
const cp = require('child_process');

module.exports = class MenuBuilder {
  /**
   *
   * @param {BrowserWindow} mainWindow
   */
  constructor(mainWindow, createWindowFunc, browserState) {
    /**
     * @type {BrowserWindow}
     */
    this.mainWindow = mainWindow;

    this.createWindowFunc = createWindowFunc;

    this.state = browserState;
  }

  buildMenu() {
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
    ) {
      this.setupDevelopmentEnvironment();
    }

    let template;

    if (process.platform === 'darwin') {
      template = this.buildDarwinTemplate();
    } else {
      template = this.buildDefaultTemplate();
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    return menu;
  }

  setupDevelopmentEnvironment() {
    this.mainWindow.openDevTools();
    this.mainWindow.webContents.on('context-menu', (e, props) => {
      const { x, y } = props;

      Menu.buildFromTemplate([
        {
          label: 'Inspect element',
          click: () => {
            this.mainWindow.inspectElement(x, y);
          }
        }
      ]).popup(this.mainWindow);
    });
  }

  buildDarwinTemplate() {
    const subMenuAbout = {
      label: 'Webrecorder',
      submenu: [
        {
          label: 'About Webrecorder',
          click: () => {
            this.mainWindow.webContents.send('change-location', '/help');
          }
        },
        { type: 'separator' },
        { label: 'Services', submenu: [] },
        { type: 'separator' },
        {
          label: 'Hide Webrecorder',
          accelerator: 'Command+H',
          selector: 'hide:'
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          selector: 'hideOtherApplications:'
        },
        { label: 'Show All', selector: 'unhideAllApplications:' },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    };

    const subMenuFile = {
      label: 'File',
      submenu: [
        {
          label: 'New Webrecorder Window',
          accelerator: 'Command+N',
          click: () => {
            console.log('Launching: ' + process.argv.join(' '));
            const newApp = cp.spawn(process.argv[0], process.argv.slice(1), {detached: true});
            //this.createWindowFunc();
          }
        },
      ]
    };

    const subMenuEdit = {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'Command+Z', selector: 'undo:' },
        { label: 'Redo', accelerator: 'Shift+Command+Z', selector: 'redo:' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'Command+X', selector: 'cut:' },
        { label: 'Copy', accelerator: 'Command+C', selector: 'copy:' },
        { label: 'Paste', accelerator: 'Command+V', selector: 'paste:' },
        {
          label: 'Select All',
          accelerator: 'Command+A',
          selector: 'selectAll:'
        }
      ]
    };
    const subMenuViewDev = {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'Command+R',
          click: () => {
            this.mainWindow.webContents.reload();
          }
        },
        {
          label: 'Toggle App Developer Tools',
          type: 'checkbox',
          checked: true,
          accelerator: 'Alt+Ctrl+J',
          click: () => {
            this.mainWindow.toggleDevTools();
          }
        },
        {
          label: 'Toggle Page Developer Tools',
          type: 'checkbox',
          accelerator: 'Alt+Ctrl+I',
          click: () => {
            this.state.toggleDevTools();
          }
        },
        {
          label: 'Toggle Full Screen',
          type: 'checkbox',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          }
        }
      ]
    };
    const subMenuViewProd = {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Page Developer Tools',
          type: 'checkbox',
          accelerator: 'Alt+Ctrl+I',
          click: () => {
            this.state.toggleDevTools();
          }
        },
        {
          label: 'Toggle Full Screen',
          type: 'checkbox',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          }
        }
      ]
    };
    const subMenuWindow = {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'Command+M',
          selector: 'performMiniaturize:'
        },
        { type: 'separator' },
        { label: 'Bring All to Front', selector: 'arrangeInFront:' },
      ]
    };
    const subMenuHelp = {
      label: 'Help',
      submenu: [
        {
          label: 'More Info',
          click: () => {
            this.mainWindow.webContents.send('change-location', '/help');
          }
        },
        {
          label: 'Webrecorder.io',
          click() {
            shell.openExternal('https://webrecorder.io');
          }
        }
      ]
    };

    const subMenuView =
      process.env.NODE_ENV === 'development' ? subMenuViewDev : subMenuViewProd;

    return [
      subMenuAbout,
      subMenuFile,
      subMenuEdit,
      subMenuView,
      this.getOptionsMenu(),
      subMenuWindow,
      subMenuHelp
    ];
  }

  buildDefaultTemplate() {
    return [
      {
        label: '&File',
        submenu: [
          {
            label: 'New Webrecorder Window',
            accelerator: 'Ctrl+N',
            click: () => {
              console.log('Launching: ' + process.argv.join(' '));
              const newApp = cp.spawn(process.argv[0], process.argv.slice(1), {detached: true});
            }
          },
        ]
      },
      this.getOptionsMenu(),
      {
        label: '&View',
        submenu:
          process.env.NODE_ENV === 'development'
            ? [
                {
                  label: 'Reload',
                  accelerator: 'Ctrl+R',
                  click: () => {
                    this.mainWindow.webContents.reload();
                  }
                },
                {
                  label: 'Toggle Page Developer Tools',
                  type: 'checkbox',
                  accelerator: 'Alt+Ctrl+I',
                  click: () => {
                    this.state.toggleDevTools();
                  }
                },
                {
                  label: 'Toggle App Developer Tools',
                  type: 'checkbox',
                  checked: true,
                  accelerator: 'Alt+Ctrl+J',
                  click: () => {
                    this.mainWindow.toggleDevTools();
                  }
                },
                {
                  label: 'Toggle Full Screen',
                  type: 'checkbox',
                  accelerator: 'F11',
                  click: () => {
                    this.mainWindow.setFullScreen(
                      !this.mainWindow.isFullScreen()
                    );
                  }
                }
              ]
            : [
                {
                  label: 'Toggle Page Developer Tools',
                  type: 'checkbox',
                  accelerator: 'Alt+Ctrl+I',
                  click: () => {
                    this.state.toggleDevTools();
                  }
                },
                {
                  label: 'Toggle Full Screen',
                  type: 'checkbox',
                  accelerator: 'F11',
                  click: () => {
                    this.mainWindow.setFullScreen(
                      !this.mainWindow.isFullScreen()
                    );
                  }
                }
              ]
      },
      {
        label: '&Help',
        submenu: [
          {
            label: 'Learn More',
            click: () => {
              this.mainWindow.webContents.send('change-location', '/help');
            }
          },
          {
            label: 'Webrecorder.io',
            click() {
              shell.openExternal('https://webrecorder.io');
            }
          }
        ]
      }
    ];
  }

  getOptionsMenu() {
    const menuConfig = {
        label: '&Options',
        submenu: [
          {
            label: 'Clear Cookies',
            click: () => {
              this.state.clearCookies();
            }
          },
          {
            label: 'Mute Audio',
            type: 'checkbox',
            click: (item) => {
              this.state.setMute(item.checked);
            }
          },
          {
            label: 'Enable Mobile Mode',
            type: 'checkbox',
            click: (item) => {
              this.state.setMobile(item.checked);
            }
          },
        ],
    };

    return menuConfig;
  }

};
