# Webrecorder Desktop App

The Webrecorder Desktop App is a complete packaging of [Webrecorder](https://github.com/webrecorder/webrecorder) hosted service as an Electron application, with an integrated Chromium browser.

It includes the same functionality available on Webrecorder.io running as a local app, including the
new [Autopilot](https://blog.webrecorder.io/2019/08/14/autopilot.html) feature.

All data captured is stored in a local directory on your machine, in `Webrecorder-Data` in your Documents directory.

Webrecorder Desktop can be downloaded below or from [Releases](https://github.com/webrecorder/webrecorder-desktop/releases)

| OS X | Windows (64-bit) | Windows (32-bit) | Linux |
| --- | --- | --- | --- |
| [.dmg](https://github.com/webrecorder/webrecorder-desktop/releases/download/v2.0.2/webrecorder-2.0.2.dmg) | [.exe (64-bit)](https://github.com/webrecorder/webrecorder-desktop/releases/download/v2.0.2/webrecorder-win-x86_64-2.0.2.exe) | [.exe (32-bit)](https://github.com/webrecorder/webrecorder-desktop/releases/download/v2.0.2/webrecorder-win-x86-2.0.2.exe) | [.AppImage](https://github.com/webrecorder/webrecorder-desktop/releases/download/v2.0.2/webrecorder-2.0.2.AppImage) |

*Note: Running on Linux requires installation of Redis, available as a package on most distros.
OS X and Windows versions come with a bundled version of Redis.*

<img src="https://blog.webrecorder.io/assets/desktop-app.png" width="400" title="Desktop App"><img src="https://blog.webrecorder.io/assets/desktop-capture.png" width="400" title="App Settings">

## Current Features

In addition to the core Webrecorder functionality, the desktop app includes additional features specific to the desktop environmentment. A few of these brand new features are still experimental or in beta, as listed below, so please let us know if anything is not working as expected!


### Latest Chromium Browser with Flash Support

Like Webrecorder Player, the Webrecorder Desktop app is built with Electron, and includes the latest release of Chromium, ensuring capture and replay is done with a modern browser. The app also includes a recent Flash plugin to allow for capture and replay of any Flash content. (The App Settings screen includes versions of all components).


### Local Storage of All Data

All Webrecorder Data is stored in the `<Documents>/Webrecorder-Data` directory, with actual WARC files under the storage subdirectory. The Autopilot behaviors are placed in the ‘behaviors’ subdirectory. The directory layout may be updated in the future as we work towards a more standardized directory format for web archives. 


### Capture, Replay & Curation

The app includes capture, replay, patching as well as curation and collection management features, same as those found on https://webrecorder.io. Existing collections can also be imported (as WARC files) and exported collections can be uploaded to https://webrecorder.io if desired.


### Autopilot

The desktop app includes the full [Autopilot](https://guide.webrecorder.io/autopilot) capabilities for capture of certain dynamic websites, introduced with our last release. Unlike a regular browser, Webrecorder Desktop can run Autopilot in the background and be minimized without affecting the quality of Autopilot capture. For example, users can start Autopilot and have it run in the background while doing other work. (There is an option to mute audio in the Options menu for this use case). There is no limit to how long Autopilot can run locally, and only limits are available network bandwidth and disk storage!

### Preview Mode (Beta)

The desktop app includes a new *Preview* mode that allows browsing content without capture. In particular, this can be used to preview a page before capturing it but also to log in to any sites that require login without capturing the login itself. 

After logging to a site in Preview mode, users can then switch to capture mode via the dropdown menu, beginning capture from after the login has completed.

<img src="https://blog.webrecorder.io/assets/preview.png" width="400" title="Preview Mode">

This workflow is recommended for capturing any sites that require a login. To reset all logins, there is also a “Clear Cookies” option in the Options menu. (This feature is currently in beta and we welcome any feedback on this!)


### Mobile Device Emulation Mode (Experimental)
The desktop app also includes an experimental mobile device emulation mode, toggleable from the Options menu. With this mode, Webrecorder Desktop will act as a mobile browser and allow for capturing of mobile only content. The window can be resized as needed to support any mobile device. (This feature is currently in beta and we welcome any feedback on this!)

<img src="https://blog.webrecorder.io/assets/mobile.png" width="200" title="Mobile Mode">

### DAT Protocol Support (Experimental)

The app includes our [previously-announced approach to sharing web archive collections](https://blog.webrecorder.io/2018/08/02/webrecorder-dat-integration.html) via the [Dat peer-to-peer protocol](https://dat.foundation/). To enable sharing of a collection, select `Share via Dat` from the collection menu.
The collection will then have a unique `dat://` url, which will allow the full collection (and future updates) to be synched using various tools that use the [Dat protocol](https://awesome.datproject.org/#using-dat), to allow for automated backup of local collections, if desired. There is not (yet) a way to import existing collections via Dat, but import is planned for a future update.


### Capture Cache (Experimental)

When browsing sites that share resources, Webrecorder Desktop enables the browser cache to avoid capturing
the same resources multiple times and writing them to WARC. The cache is reset per recording session,
but can also be cleared manually via the Options menu *Clear Cache* option. 
The cache should reduce duplicates resources loaded over the network and speed up the browsing and thereby the capture process.
This feature is still experimental.


### TOR Capture Support (Experimental)

Webrecorder Desktop can capture web content over [Tor](https://torproject.org/), including Tor hidden services.
However, this requires a bit of manual setup. A local Tor Relay must be [installed locally](https://2019.www.torproject.org/docs/installguide.html.en).

Then, via a command-line, set `export SOCKS_HOST=localhost` before starting Webrecorder Desktop to have it use the Tor SOCKS proxy. Future versions may simplify this process.


# Building Webrecorder Desktop

To build Webrecorder Desktop locally, please follow the instructions:

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


