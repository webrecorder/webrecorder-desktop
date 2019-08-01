const { ipcRenderer } = require('electron');

const wr_msg_handler = '___$wr_msg_handler___$$';

class IPCHandler {
    constructor() {
      this.on_message = null;

      ipcRenderer.on('wr-message', (sender, msg) => {
        if (this.on_message && msg) {
          this.on_message(msg);
        }
      });
    }

    send(msg) {
      ipcRenderer.sendToHost('wr-message', msg);
    }
}

window[wr_msg_handler] = new IPCHandler();

