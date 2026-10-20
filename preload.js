'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  reportUi: (state) => ipcRenderer.send('ui-state', state),
  dragStart: () => ipcRenderer.send('drag-start'),
  dragMove: () => ipcRenderer.send('drag-move'),
  dragEnd: () => ipcRenderer.invoke('drag-end'),
  setScale: (scale) => ipcRenderer.send('set-scale', Number(scale)),
  setAlwaysOnTop: (enabled) => ipcRenderer.send('set-always-on-top', Boolean(enabled)),
  setAutoStart: (enabled) => ipcRenderer.send('set-auto-start', Boolean(enabled)),
  saveConfig: (patch) => ipcRenderer.send('save-config', patch),
  resetPosition: () => ipcRenderer.send('reset-position'),
  hidePet: () => ipcRenderer.send('hide-pet'),
  quitApp: () => ipcRenderer.send('quit-app'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  onConfig: (callback) => {
    const handler = (_event, config) => callback(config);
    ipcRenderer.on('config', handler);
    return () => ipcRenderer.removeListener('config', handler);
  },
  onAction: (callback) => {
    const handler = (_event, action) => callback(action);
    ipcRenderer.on('pet-action', handler);
    return () => ipcRenderer.removeListener('pet-action', handler);
  },
  onHover: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('hover-state', handler);
    return () => ipcRenderer.removeListener('hover-state', handler);
  }
});
