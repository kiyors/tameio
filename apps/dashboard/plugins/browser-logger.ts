import type { Plugin } from "vite";

export function browserLogger(): Plugin {
  return {
    name: "vite-plugin-browser-logger",
    enforce: "pre",

    // In dev mode, inject a small script to capture console logs
    transform(code, id) {
      // Inject into the main router file so it loads early on the client
      if (id.includes("src/router.tsx")) {
        const injectScript = `
if (typeof window !== 'undefined' && import.meta.hot) {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;

  function safeStringify(obj) {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return "[Circular]";
        seen.add(value);
      }
      return value;
    }, 2);
  }

  function sendLog(type, args) {
    try {
      const message = Array.from(args).map(arg => {
        if (arg instanceof Error) {
          return arg.stack || arg.message;
        }
        if (typeof arg === 'object') {
          try { return safeStringify(arg); } catch(e) { return '[Object]'; }
        }
        return String(arg);
      }).join(' ');

      import.meta.hot.send('keiri:browser-log', { type, message });
    } catch(e) {}
  }

  // Only patch once
  if (!window.__BROWSER_LOGGER_PATCHED__) {
    window.__BROWSER_LOGGER_PATCHED__ = true;

    console.log = function() {
      originalLog.apply(console, arguments);
      sendLog('log', arguments);
    };
    console.error = function() {
      originalError.apply(console, arguments);
      sendLog('error', arguments);
    };
    console.warn = function() {
      originalWarn.apply(console, arguments);
      sendLog('warn', arguments);
    };
    console.info = function() {
      if (originalInfo) originalInfo.apply(console, arguments);
      sendLog('info', arguments);
    };

    window.addEventListener("error", (event) => {
      sendLog('error', ['[Uncaught Error]', event.error || event.message]);
    });

    window.addEventListener("unhandledrejection", (event) => {
      sendLog('error', ['[Unhandled Promise]', event.reason]);
    });
  }
}
`;
        return injectScript + "\n" + code;
      }
      return null;
    },

    configureServer(server) {
      server.ws.on("keiri:browser-log", (data) => {
        const { type, message } = data;

        // Skip React Hot Reloading logs
        if (message.includes("[HMR]")) return;
        if (message.includes("[vite]")) return;

        const time = new Date().toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        let color = "\x1b[90m"; // gray
        let prefix = "\x1b[34m[browser]\x1b[0m"; // blue

        if (type === "error") {
          color = "\x1b[31m";
          prefix = "\x1b[31m[browser error]\x1b[0m";
        } else if (type === "warn") {
          color = "\x1b[33m";
          prefix = "\x1b[33m[browser warn]\x1b[0m";
        }

        console.log(`\x1b[90m${time}\x1b[0m ${prefix} ${color}${message}\x1b[0m`);
      });
    },
  };
}
