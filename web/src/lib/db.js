/**
 * 資料庫層 - SQLite 資料庫初始化和操作模組
 * 使用 better-sqlite3 進行同步資料庫操作
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// 資料庫單例實例
let db = null;

// 資料目錄路徑
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'health.db');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

/**
 * 確保必要的目錄存在
 */
function ensureDirectories() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * 取得資料庫實例（單例模式）
 * @returns {Database} better-sqlite3 資料庫實例
 */
export function getDb() {
  if (!db) {
    ensureDirectories();
    db = new Database(DB_PATH);
    // 啟用 WAL 模式以提升並行效能
    db.pragma('journal_mode = WAL');
    // 啟用外鍵約束
    db.pragma('foreign_keys = ON');
    // 初始化資料表
    initDb();
  }
  return db;
}

/**
 * 初始化資料表和索引
 */
export function initDb() {
  const database = db || getDb();

  database.exec(`
    -- 匯入歷史表
    CREATE TABLE IF NOT EXISTS import_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      file_size INTEGER,
      records_total INTEGER DEFAULT 0,
      records_imported INTEGER DEFAULT 0,
      records_skipped INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      started_at TEXT,
      completed_at TEXT
    );

    -- 健康紀錄主表
    CREATE TABLE IF NOT EXISTS health_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      value REAL,
      unit TEXT,
      source_name TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT,
      creation_date TEXT,
      device TEXT,
      import_id INTEGER REFERENCES import_history(id)
    );

    -- 建立索引：依類型和開始日期查詢
    CREATE INDEX IF NOT EXISTS idx_health_records_type_date
      ON health_records(type, start_date);

    -- 建立索引：依匯入 ID 查詢
    CREATE INDEX IF NOT EXISTS idx_health_records_import_id
      ON health_records(import_id);

    -- 建立唯一約束：防止重複匯入
    CREATE UNIQUE INDEX IF NOT EXISTS idx_health_records_unique
      ON health_records(type, start_date, end_date, value, source_name);

    -- 設定表
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    );
  `);

  // 初始化預設設定
  const defaultSettings = {
    watchFolder: '',
    watchInterval: '60',
    dailyStepGoal: '10000',
    dailySleepGoal: '480',
    theme: 'dark',
  };

  const upsertSetting = database.prepare(`
    INSERT OR IGNORE INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
  `);

  for (const [key, value] of Object.entries(defaultSettings)) {
    upsertSetting.run(key, value);
  }
}

/**
 * 批次插入健康紀錄（使用 transaction，INSERT OR IGNORE 防止重複）
 * @param {Array} records - 健康紀錄陣列
 * @param {number} importId - 匯入 ID
 * @returns {{ imported: number, skipped: number }} 匯入結果
 */
export function insertHealthRecords(records, importId) {
  const database = getDb();

  const insert = database.prepare(`
    INSERT OR IGNORE INTO health_records
      (type, value, unit, source_name, start_date, end_date, creation_date, device, import_id)
    VALUES
      (@type, @value, @unit, @sourceName, @startDate, @endDate, @creationDate, @device, @importId)
  `);

  let imported = 0;
  let skipped = 0;

  const insertMany = database.transaction((records) => {
    for (const record of records) {
      const result = insert.run({
        type: record.type,
        value: record.value ?? null,
        unit: record.unit ?? null,
        sourceName: record.sourceName ?? null,
        startDate: record.startDate,
        endDate: record.endDate ?? null,
        creationDate: record.creationDate ?? null,
        device: record.device ?? null,
        importId: importId,
      });
      if (result.changes > 0) {
        imported++;
      } else {
        skipped++;
      }
    }
  });

  insertMany(records);

  return { imported, skipped };
}

/**
 * 查詢健康資料
 * @param {string} type - 資料類型
 * @param {string} from - 開始日期（ISO 8601）
 * @param {string} to - 結束日期（ISO 8601）
 * @param {string} aggregation - 聚合方式：'raw', 'daily', 'weekly', 'monthly'
 * @returns {Array} 查詢結果
 */
export function queryHealthData(type, from, to, aggregation = 'raw') {
  const database = getDb();
  const params = {};
  let whereClause = '1=1';

  if (type) {
    whereClause += ' AND type = @type';
    params.type = type;
  }
  if (from) {
    whereClause += ' AND start_date >= @from';
    params.from = from;
  }
  if (to) {
    whereClause += ' AND start_date <= @to';
    params.to = to;
  }

  // 原始資料查詢
  if (aggregation === 'raw') {
    const stmt = database.prepare(`
      SELECT id, type, value, unit, source_name, start_date, end_date, creation_date, device
      FROM health_records
      WHERE ${whereClause}
      ORDER BY start_date DESC
      LIMIT 10000
    `);
    return stmt.all(params);
  }

  // 聚合查詢：依日期分組
  let dateExpr;
  switch (aggregation) {
    case 'daily':
      dateExpr = "date(start_date)";
      break;
    case 'weekly':
      // ISO 週：用 strftime 取得年和週數
      dateExpr = "strftime('%Y-W%W', start_date)";
      break;
    case 'monthly':
      dateExpr = "strftime('%Y-%m', start_date)";
      break;
    default:
      dateExpr = "date(start_date)";
  }

  const stmt = database.prepare(`
    SELECT
      ${dateExpr} AS period,
      type,
      unit,
      COUNT(*) AS count,
      SUM(value) AS total,
      AVG(value) AS avg,
      MIN(value) AS min,
      MAX(value) AS max
    FROM health_records
    WHERE ${whereClause}
    GROUP BY ${dateExpr}, type, unit
    ORDER BY period DESC
  `);

  return stmt.all(params);
}

/**
 * 取得匯入歷史
 * @returns {Array} 匯入歷史列表
 */
export function getImportHistory() {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT * FROM import_history ORDER BY id DESC
  `);
  return stmt.all();
}

/**
 * 建立新的匯入紀錄
 * @param {string} filename - 檔案名稱
 * @param {number} fileSize - 檔案大小（bytes）
 * @returns {{ id: number }} 新建立的匯入紀錄 ID
 */
export function createImport(filename, fileSize) {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO import_history (filename, file_size, status, started_at)
    VALUES (?, ?, 'processing', datetime('now'))
  `);
  const result = stmt.run(filename, fileSize);
  return { id: result.lastInsertRowid };
}

/**
 * 更新匯入狀態
 * @param {number} id - 匯入紀錄 ID
 * @param {object} data - 要更新的欄位
 */
export function updateImport(id, data) {
  const database = getDb();
  const fields = [];
  const params = { id };

  if (data.recordsTotal !== undefined) {
    fields.push('records_total = @recordsTotal');
    params.recordsTotal = data.recordsTotal;
  }
  if (data.recordsImported !== undefined) {
    fields.push('records_imported = @recordsImported');
    params.recordsImported = data.recordsImported;
  }
  if (data.recordsSkipped !== undefined) {
    fields.push('records_skipped = @recordsSkipped');
    params.recordsSkipped = data.recordsSkipped;
  }
  if (data.status !== undefined) {
    fields.push('status = @status');
    params.status = data.status;
  }
  if (data.errorMessage !== undefined) {
    fields.push('error_message = @errorMessage');
    params.errorMessage = data.errorMessage;
  }
  if (data.completedAt !== undefined) {
    fields.push("completed_at = @completedAt");
    params.completedAt = data.completedAt;
  }

  if (fields.length === 0) return;

  const stmt = database.prepare(`
    UPDATE import_history SET ${fields.join(', ')} WHERE id = @id
  `);
  stmt.run(params);
}

/**
 * 取得設定值
 * @param {string} key - 設定鍵
 * @returns {string|null} 設定值
 */
export function getSetting(key) {
  const database = getDb();
  const stmt = database.prepare('SELECT value FROM settings WHERE key = ?');
  const row = stmt.get(key);
  return row ? row.value : null;
}

/**
 * 設定值
 * @param {string} key - 設定鍵
 * @param {string} value - 設定值
 */
export function setSetting(key, value) {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  stmt.run(key, value);
}

/**
 * 取得所有可用的健康資料類型
 * @returns {Array} 類型列表，包含各類型的筆數
 */
export function getAvailableTypes() {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT type, unit, COUNT(*) AS count,
           MIN(start_date) AS earliest,
           MAX(start_date) AS latest
    FROM health_records
    GROUP BY type, unit
    ORDER BY count DESC
  `);
  return stmt.all();
}

/**
 * 取得整體統計資訊
 * @returns {object} 統計資訊
 */
export function getStats() {
  const database = getDb();

  // 總筆數
  const totalRecords = database.prepare('SELECT COUNT(*) AS count FROM health_records').get().count;

  // 日期範圍
  const dateRange = database.prepare(`
    SELECT MIN(start_date) AS earliest, MAX(start_date) AS latest
    FROM health_records
  `).get();

  // 各類型統計
  const typeStats = database.prepare(`
    SELECT type, COUNT(*) AS count,
           MIN(start_date) AS earliest,
           MAX(start_date) AS latest
    FROM health_records
    GROUP BY type
    ORDER BY count DESC
  `).all();

  // 匯入統計
  const importStats = database.prepare(`
    SELECT COUNT(*) AS totalImports,
           SUM(records_imported) AS totalImported,
           SUM(records_skipped) AS totalSkipped
    FROM import_history
    WHERE status = 'completed'
  `).get();

  return {
    totalRecords,
    dateRange: {
      earliest: dateRange?.earliest || null,
      latest: dateRange?.latest || null,
    },
    typeCount: typeStats.length,
    typeStats,
    importStats: {
      totalImports: importStats?.totalImports || 0,
      totalImported: importStats?.totalImported || 0,
      totalSkipped: importStats?.totalSkipped || 0,
    },
  };
}
