/**
 * Logger utility for development debugging
 * Only logs in development mode (import.meta.env.DEV)
 */

const DEBUG = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

export const logger = {
    /**
     * Debug level logging - only in development
     * @param {...any} args - Arguments to log
     */
    debug: (...args) => DEBUG && console.log('[DEBUG]', ...args),

    /**
     * Info level logging - only in development
     * @param {...any} args - Arguments to log
     */
    info: (...args) => DEBUG && console.info('[INFO]', ...args),

    /**
     * Warning level logging - always logged
     * @param {...any} args - Arguments to log
     */
    warn: (...args) => console.warn('[WARN]', ...args),

    /**
     * Error level logging - always logged
     * @param {...any} args - Arguments to log
     */
    error: (...args) => console.error('[ERROR]', ...args),
};
