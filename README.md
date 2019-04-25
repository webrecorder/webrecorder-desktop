# Webrecorder Desktop

Prototype for Webrecorder Desktop Electron App.

Follow instructions below to build locally. More info coming soon!


## Full Local Build

1) Clone with submodules

```
git clone --recurse-submodules https://github.com/webrecorder/webrecorder-desktop.git

```

This will install the Webrecorder submodule as well

2) Build Webrecorder Python Binaries and install into `python-binaries`

This will build the Webrecorder project and install PyInstaller 3.3.
Python 3.5 is recommended for now and a separte virtualenv just in case.


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


