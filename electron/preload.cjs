const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('wg', {
  profiles: () => ipcRenderer.invoke('profiles:list'),
  import: () => ipcRenderer.invoke('profiles:import'),
  connect: (profilePath) => ipcRenderer.invoke('vpn:connect', profilePath),
  disconnect: () => ipcRenderer.invoke('vpn:disconnect'),
  status: () => ipcRenderer.invoke('vpn:status')
})
