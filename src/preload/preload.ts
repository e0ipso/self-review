import { contextBridge, ipcRenderer } from 'electron';
import { createElectronAPI } from './bridge';

contextBridge.exposeInMainWorld('electronAPI', createElectronAPI(ipcRenderer));
