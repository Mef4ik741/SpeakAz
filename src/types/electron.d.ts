// Типы для Electron API
export interface ElectronAPI {
  registerGlobalShortcut?: (shortcut: string, callback: () => void) => boolean;
  unregisterGlobalShortcut?: (shortcut: string) => void;
  unregisterAllGlobalShortcuts?: () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    process?: {
      type: string;
    };
  }
}

export {};
