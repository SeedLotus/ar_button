/**
 * Object Drum Studio — Development Logger
 *
 * 仅在开发模式下激活。Release 构建时自动禁用（无 window.__ODS_DEV__ 且
 * 非 localhost 时，所有日志方法静默跳过）。
 *
 * 特性：
 *  - 四级日志：DEBUG / INFO / WARN / ERROR
 *  - 环形缓冲：内存最多保留 500 条
 *  - localStorage 备份：每 30 条或 5 秒自动刷盘
 *  - 监听器模式：Log 面板通过 subscribe 实时获取新条目
 *  - 导出：JSON 格式下载
 */

const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const LEVEL_LABELS = ["DEBUG", "INFO", "WARN", "ERROR"];
const MAX_MEMORY_ENTRIES = 500;
const STORAGE_KEY = "ods-log-buffer";
const FLUSH_INTERVAL_MS = 5000;
const FLUSH_BATCH_SIZE = 30;

let _instance = null;

export class Logger {
  constructor() {
    if (_instance) return _instance;
    this._entries = [];
    this._listeners = new Set();
    this._pending = 0;
    this._flushTimer = null;
    this._enabled = _detectDevMode();
    this._minLevel = LEVELS.DEBUG;
    // Restore persisted entries
    this._restore();
    _instance = this;
  }

  // ---- public API ----

  get enabled() {
    return this._enabled;
  }

  /** 手动开关（可在控制台调用 window.__odsLogger.enabled = false） */
  set enabled(value) {
    this._enabled = !!value;
    if (value) {
      this.info("Logger", "日志已启用");
    }
  }

  debug(source, message, data) {
    this._log("DEBUG", source, message, data);
  }

  info(source, message, data) {
    this._log("INFO", source, message, data);
  }

  warn(source, message, data) {
    this._log("WARN", source, message, data);
  }

  error(source, message, data) {
    this._log("ERROR", source, message, data);
  }

  /** 获取内存中的所有日志 */
  entries(level = null) {
    if (level && LEVELS[level] !== undefined) {
      const min = LEVELS[level];
      return this._entries.filter((e) => LEVELS[e.level] >= min);
    }
    return [...this._entries];
  }

  /** 订阅新日志，返回取消函数 */
  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  /** 导出为 JSON 并触发下载 */
  exportJson(filename = "ods-log") {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const blob = new Blob([JSON.stringify(this._entries, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.info("Logger", `已导出 ${this._entries.length} 条日志`);
  }

  /** 清空所有日志 */
  clear() {
    this._entries = [];
    this._pending = 0;
    this._persist(true);
    this._listeners.forEach((fn) => fn({ type: "clear" }));
  }

  /** 立即刷盘 */
  flush() {
    this._persist(true);
  }

  // ---- internal ----

  _log(level, source, message, data) {
    if (!this._enabled) return;

    const entry = {
      ts: Date.now(),
      iso: new Date().toISOString(),
      level,
      source,
      message,
    };
    if (data !== undefined) {
      try {
        entry.data = typeof data === "object" ? { ...data } : data;
      } catch {
        entry.data = String(data);
      }
    }

    this._entries.push(entry);
    if (this._entries.length > MAX_MEMORY_ENTRIES) {
      this._entries = this._entries.slice(-MAX_MEMORY_ENTRIES);
    }

    this._pending++;

    // Console mirror
    const consoleFn =
      level === "ERROR"
        ? console.error
        : level === "WARN"
          ? console.warn
          : console.debug;
    const tag = `[ODS:${level}]`;
    if (data !== undefined) {
      consoleFn(`${tag} ${source}: ${message}`, data);
    } else {
      consoleFn(`${tag} ${source}: ${message}`);
    }

    // Notify listeners
    this._listeners.forEach((fn) => fn({ type: "entry", entry }));

    // Flush to storage
    if (this._pending >= FLUSH_BATCH_SIZE) {
      this._persist();
    } else if (!this._flushTimer) {
      this._flushTimer = setTimeout(() => {
        this._flushTimer = null;
        this._persist();
      }, FLUSH_INTERVAL_MS);
    }
  }

  _persist(force = false) {
    if (!force && this._pending < FLUSH_BATCH_SIZE) return;
    this._pending = 0;
    if (this._flushTimer) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }
    try {
      // 只持久化最后 200 条到 localStorage（避免配额溢出）
      const slice = this._entries.slice(-200);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slice));
    } catch {
      // localStorage 满了，清掉旧数据重试
      try {
        localStorage.removeItem(STORAGE_KEY);
        const minimal = this._entries.slice(-50);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
      } catch {
        /* 放弃持久化 */
      }
    }
  }

  _restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this._entries = parsed.slice(-MAX_MEMORY_ENTRIES);
        }
      }
    } catch {
      /* ignore corrupt data */
    }
  }
}

// ---- dev-mode detection ----

function _detectDevMode() {
  // 1) Electron 主进程注入的标志
  if (window.__ODS_DEV__ === true) return true;

  // 2) 本地开发服务器
  const host = window.location.hostname;
  if (
    host === "127.0.0.1" ||
    host === "localhost" ||
    host === "[::1]"
  ) {
    return true;
  }

  // 3) URL 参数 ?ods-debug=1
  if (new URLSearchParams(window.location.search).get("ods-debug") === "1") {
    return true;
  }

  return false;
}

// 单例
export const logger = new Logger();

// 挂到 window 方便调试
if (logger.enabled) {
  window.__odsLogger = logger;
}
