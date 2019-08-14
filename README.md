# Webrecorder Desktop App

The Webrecorder Desktop App is a repackaging of Webrecorder as an Electron application, with an integrated
Chrome browser.

It includes the same functionality available on Webrecorder.io running as a local app, including the
new [Autopilot](https://blog.webrecorder.io/2019/08/07/autopilot.html) feature.

All data captured is stored in a local directory on your machine, in `Webrecorder-Data` in your Documents directory.

Webrecorder Desktop is still in beta, and the latest beta pre-releases can be downloaded below or from [Releases](https://github.com/webrecorder/webrecorder-desktop/releases)

| OS X | Windows (64-bit) | Windows (32-bit) | Linux |
| --- | --- | --- | --- |
| [.dmg](https://github.com/webrecorder/webrecorder-desktop/releases/download/v1.7.0-beta.4/webrecorder-1.7.0-beta.4.dmg) | [.exe (64-bit)](https://github.com/webrecorder/webrecorder-desktop/releases/download/v1.7.0-beta.4/webrecorder-win-x86_64-1.7.0-beta.4.exe) | [.exe (32-bit)](https://github.com/webrecorder/webrecorder-desktop/releases/download/v1.7.0-beta.4/webrecorder-win-x86-1.7.0-beta.4.exe) | [.AppImage](https://github.com/webrecorder/webrecorder-desktop/releases/download/v1.7.0-beta.4/webrecorder-1.7.0-beta.4.AppImage) |

*Note: Running on Linux requires installation of Redis, available as a package on most distros.
OS X and Windows versions come with a bundled version of Redis.*


## Full Local Build

Follow instructions below to build Webrecorder Desktop. More info coming soon!

1) Clone with submodules (the submodule is the main [webrecorder/webrecorder](https://github.com/webrecorder), which contains most of the code)

```
git clone --recurse-submodules https://github.com/webrecorder/webrecorder-desktop.git
```

This will install the Webrecorder submodule as well

2) Build Webrecorder Python Binaries and install into `python-binaries`

This will build the Webrecorder project and install PyInstaller 3.3.
Python 3.5 is recommended for now and a separate virtualenv just in case.


```
./build-wr.sh
```

3) Build the Webrecorder frontend

```
node build-desktop.js
```

4) Run in Dev Mode

```
yarn run start-dev
```

5) Build Electron Binary


```
yarn run dist
```

6) If all goes well, the binary image should be placed in ``./dist/{mac,linux,win}`` directory, depending on your platform.


