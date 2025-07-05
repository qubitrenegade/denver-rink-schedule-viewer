// Simple conditional logger for development vs production
let isDev: boolean;
try {
  isDev = (import.meta.env as any)?.DEV;
} catch {
  isDev = false;
}

export const logger = {
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  error: (...args: any[]) => {
    // Always log errors, even in production
    console.error(...args);
  }
};