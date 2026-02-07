/**
 * Centralized structured logger used by the client app.
 * Logs are kept in a bounded in-memory buffer and mirrored to console when enabled.
 */

const DEFAULT_ENABLED = true;
const MAX_LOG_ENTRIES = 2000;

const parseBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};

const runtimeState = {
  enabled: parseBool(import.meta.env.VITE_DEBUG_LOGS, DEFAULT_ENABLED),
  sessionId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  sequence: 0,
  entries: []
};

const getConsoleMethod = (level) => {
  if (level === 'error') return 'error';
  if (level === 'warn') return 'warn';
  return 'log';
};

const normalizePayload = (payload) => {
  if (payload instanceof Error) {
    return {
      message: payload.message,
      stack: payload.stack,
      name: payload.name
    };
  }
  return payload;
};

const appendEntry = (entry) => {
  runtimeState.entries.push(entry);
  if (runtimeState.entries.length > MAX_LOG_ENTRIES) {
    runtimeState.entries.splice(0, runtimeState.entries.length - MAX_LOG_ENTRIES);
  }
};

const exposeLoggerOnWindow = () => {
  if (typeof window === 'undefined') return;

  window.__BUCKSHOT_LOGGER__ = {
    get enabled() {
      return runtimeState.enabled;
    },
    setEnabled(next) {
      runtimeState.enabled = !!next;
    },
    get sessionId() {
      return runtimeState.sessionId;
    },
    get entries() {
      return [...runtimeState.entries];
    },
    exportJson() {
      return JSON.stringify(runtimeState.entries, null, 2);
    },
    clear() {
      runtimeState.entries.length = 0;
    }
  };
};

exposeLoggerOnWindow();

/**
 * Create a scoped logger for a module/class.
 * @param {string} scope - Module or class name.
 * @returns {{debug: Function, info: Function, warn: Function, error: Function, child: Function}}
 */
export function createLogger(scope) {
  const safeScope = scope || 'App';

  /**
   * Emit one structured log entry.
   * @param {'debug'|'info'|'warn'|'error'} level - Log level.
   * @param {string} event - Stable event name.
   * @param {object} payload - Structured context payload.
   */
  const write = (level, event, payload = {}) => {
    const nowMs = Date.now();
    const entry = {
      seq: ++runtimeState.sequence,
      ts: new Date(nowMs).toISOString(),
      ms: nowMs,
      sessionId: runtimeState.sessionId,
      level,
      scope: safeScope,
      event: event || 'event',
      payload: normalizePayload(payload)
    };

    appendEntry(entry);

    if (runtimeState.enabled) {
      const method = getConsoleMethod(level);
      const line = `[${entry.ts}] [${entry.scope}] ${entry.event}`;
      console[method](line, entry.payload);
    }

    return entry;
  };

  return {
    debug: (event, payload) => write('debug', event, payload),
    info: (event, payload) => write('info', event, payload),
    warn: (event, payload) => write('warn', event, payload),
    error: (event, payload) => write('error', event, payload),
    child: (childScope) => createLogger(`${safeScope}:${childScope}`)
  };
}

/**
 * Toggle logs globally at runtime.
 * @param {boolean} nextEnabled - Next enabled state.
 */
export function setLoggingEnabled(nextEnabled) {
  runtimeState.enabled = !!nextEnabled;
}

/**
 * Read current logging enabled state.
 * @returns {boolean}
 */
export function isLoggingEnabled() {
  return runtimeState.enabled;
}

/**
 * Export an immutable copy of buffered logs.
 * @returns {Array<object>}
 */
export function getLogEntries() {
  return [...runtimeState.entries];
}
