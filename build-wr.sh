#!/bin/bash
set -e

pushd webrecorder/webrecorder
python3 setup.py install
pip install 'pyinstaller==3.3'
bash ./webrecorder/standalone/build_full.sh
popd

mv ./webrecorder/webrecorder/webrecorder/standalone/dist/webrecorder_full ./python-binaries/webrecorder
chmod a+x ./python-binaries/webrecorder

