const config = require('../config'); // Может понадобиться для logLevel в будущем

const getTimestamp = () => new Date().toISOString();

// Простой оберточный логгер. Можно легко заменить на Winston, Pino и т.д.
const logger = {
  log: (message, ...args) => {
    if (args.length > 0 && args[args.length-1] instanceof Error) {
        const err = args.pop();
        console.log(`[${getTimestamp()}] [LOG] ${message}`, ...args, `Error: ${err.message}`);
    } else {
        console.log(`[${getTimestamp()}] [LOG] ${message}`, ...args);
    }
  },
  info: (message, ...args) => {
    if (args.length > 0 && args[args.length-1] instanceof Error) {
        const err = args.pop();
        console.info(`[${getTimestamp()}] [INFO] ${message}`, ...args, `Error: ${err.message}`);
    } else {
        console.info(`[${getTimestamp()}] [INFO] ${message}`, ...args);
    }
  },
  warn: (message, ...args) => {
    if (args.length > 0 && args[args.length-1] instanceof Error) {
        const err = args.pop();
        console.warn(`[${getTimestamp()}] [WARN] ${message}`, ...args, `Error: ${err.message}`);
    } else {
        console.warn(`[${getTimestamp()}] [WARN] ${message}`, ...args);
    }
  },
  error: (message, ...args) => {
    // Если последний аргумент - ошибка, выведем ее stack
    if (args.length > 0 && args[args.length-1] instanceof Error) {
        const err = args.pop();
        console.error(`[${getTimestamp()}] [ERROR] ${message}`, ...args, `Error: ${err.message}\nStack: ${err.stack || 'N/A'}`);
    } else {
        console.error(`[${getTimestamp()}] [ERROR] ${message}`, ...args);
    }
  },
  debug: (message, ...args) => {
    if (config.logLevel === 'debug') { // Пример использования logLevel
        if (args.length > 0 && args[args.length-1] instanceof Error) {
            const err = args.pop();
            console.debug(`[${getTimestamp()}] [DEBUG] ${message}`, ...args, `Error: ${err.message}`);
        } else {
            console.debug(`[${getTimestamp()}] [DEBUG] ${message}`, ...args);
        }
    }
  },
};

module.exports = logger;