const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('studio', {
  call: (method, ...args) => ipcRenderer.invoke('studio', method, ...args),
  on: callback => ipcRenderer.on('studio:event', (_event, message) => callback(message))
});
