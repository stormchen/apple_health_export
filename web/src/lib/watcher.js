/**
 * 資料夾監控模組 - 使用 chokidar 和 node-cron 監控指定資料夾
 * 當偵測到新的 XML/ZIP 檔案時，自動觸發匯入流程
 */

import chokidar from 'chokidar';
import cron from 'node-cron';
import path from 'path';
import fs from 'fs';
import { parseHealthExport } from './parser.js';
import {
  getDb,
  createImport,
  updateImport,
  insertHealthRecords,
  getSetting,
} from './db.js';
import { updateProgress, getProgress } from './progress.js';

// 監控器實例
let watcher = null;
// 定時任務實例
let cronTask = null;
// 監控狀態
let watchStatus = {
  active: false,
  folder: '',
  interval: 60,
  lastCheck: null,
  filesProcessed: 0,
};

// 已處理過的檔案（避免重複處理）
const processedFiles = new Set();

/**
 * 處理發現的檔案 - 執行匯入流程
 * @param {string} filePath - 檔案路徑
 */
async function processFile(filePath) {
  const filename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  // 只處理 XML 和 ZIP 檔案
  if (ext !== '.xml' && ext !== '.zip') return;

  // 避免重複處理
  if (processedFiles.has(filePath)) return;
  processedFiles.add(filePath);

  console.log(`[監控] 偵測到新檔案: ${filename}`);

  try {
    const fileStats = fs.statSync(filePath);
    const { id: importId } = createImport(filename, fileStats.size);

    // 初始化進度追蹤
    updateProgress(importId, {
      status: 'processing',
      current: 0,
      total: 0,
      imported: 0,
      skipped: 0,
    });

    const result = await parseHealthExport(filePath, {
      onProgress: (current, total) => {
        updateProgress(importId, {
          status: 'processing',
          current,
          total,
        });
      },
      onBatch: (records) => {
        const batchResult = insertHealthRecords(records, importId);
        const currentProgress = getProgress(importId);
        updateProgress(importId, {
          imported: (currentProgress?.imported || 0) + batchResult.imported,
          skipped: (currentProgress?.skipped || 0) + batchResult.skipped,
        });
        return batchResult;
      },
    });

    // 更新匯入紀錄為完成
    updateImport(importId, {
      recordsTotal: result.totalRecords,
      recordsImported: result.importedRecords,
      recordsSkipped: result.skippedRecords,
      status: 'completed',
      completedAt: new Date().toISOString(),
    });

    updateProgress(importId, {
      status: 'completed',
      current: result.totalRecords,
      total: result.totalRecords,
      imported: result.importedRecords,
      skipped: result.skippedRecords,
    });

    watchStatus.filesProcessed++;
    console.log(`[監控] 檔案匯入完成: ${filename} (${result.importedRecords} 筆)`);
  } catch (error) {
    console.error(`[監控] 檔案處理失敗: ${filename}`, error.message);
  }
}

/**
 * 掃描資料夾中的檔案
 * @param {string} folder - 資料夾路徑
 */
async function scanFolder(folder) {
  if (!folder || !fs.existsSync(folder)) return;

  watchStatus.lastCheck = new Date().toISOString();

  try {
    const entries = fs.readdirSync(folder, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.xml' || ext === '.zip') {
          const fullPath = path.join(folder, entry.name);
          if (!processedFiles.has(fullPath)) {
            await processFile(fullPath);
          }
        }
      }
    }
  } catch (error) {
    console.error('[監控] 掃描資料夾失敗:', error.message);
  }
}

/**
 * 啟動資料夾監控
 * @param {string} folder - 要監控的資料夾路徑（可選，不傳則從設定讀取）
 * @param {number} intervalMinutes - 監控間隔（分鐘，可選）
 * @returns {{ success: boolean, message: string }}
 */
export function startWatching(folder, intervalMinutes) {
  // 如果已在監控中，先停止
  if (watchStatus.active) {
    stopWatching();
  }

  // 從設定讀取或使用傳入的參數
  const watchFolder = folder || getSetting('watchFolder');
  const watchInterval = intervalMinutes || parseInt(getSetting('watchInterval') || '60', 10);

  if (!watchFolder) {
    return { success: false, message: '未設定監控資料夾路徑' };
  }

  if (!fs.existsSync(watchFolder)) {
    return { success: false, message: `資料夾不存在: ${watchFolder}` };
  }

  try {
    // 使用 chokidar 監控新增檔案
    watcher = chokidar.watch(watchFolder, {
      ignored: /(^|[\/\\])\../, // 忽略隱藏檔案
      persistent: true,
      ignoreInitial: true, // 不處理啟動時已存在的檔案
      awaitWriteFinish: {
        stabilityThreshold: 2000, // 等待檔案寫入完成
        pollInterval: 100,
      },
    });

    watcher.on('add', (filePath) => {
      processFile(filePath);
    });

    watcher.on('error', (error) => {
      console.error('[監控] chokidar 錯誤:', error.message);
    });

    // 設定定時掃描任務
    const cronExpression = `*/${Math.max(1, watchInterval)} * * * *`;
    if (cron.validate(cronExpression)) {
      cronTask = cron.schedule(cronExpression, () => {
        console.log('[監控] 執行定時掃描...');
        scanFolder(watchFolder);
      });
    }

    // 立即執行一次掃描
    scanFolder(watchFolder);

    watchStatus = {
      active: true,
      folder: watchFolder,
      interval: watchInterval,
      lastCheck: new Date().toISOString(),
      filesProcessed: 0,
    };

    console.log(`[監控] 已啟動資料夾監控: ${watchFolder} (每 ${watchInterval} 分鐘)`);
    return { success: true, message: `已啟動監控: ${watchFolder}` };
  } catch (error) {
    return { success: false, message: `啟動監控失敗: ${error.message}` };
  }
}

/**
 * 停止資料夾監控
 * @returns {{ success: boolean, message: string }}
 */
export function stopWatching() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }

  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }

  watchStatus.active = false;
  console.log('[監控] 已停止資料夾監控');
  return { success: true, message: '已停止監控' };
}

/**
 * 取得監控狀態
 * @returns {object} 監控狀態資訊
 */
export function getWatchStatus() {
  return { ...watchStatus };
}
