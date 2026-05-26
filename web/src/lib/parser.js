/**
 * XML 解析器 - Apple Health 匯出檔案的串流解析模組
 * 使用 sax 套件進行串流解析，支援 .xml 和 .zip 格式
 */

import sax from 'sax';
import fs from 'fs';
import path from 'path';
import { createUnzip } from 'zlib';

// 需要移除的類型前綴
const TYPE_PREFIXES = [
  'HKQuantityTypeIdentifier',
  'HKCategoryTypeIdentifier',
  'HKDataType',
  'HKCharacteristicTypeIdentifier',
  'HKCorrelationTypeIdentifier',
  'HKWorkoutActivityType',
];

/**
 * 清理類型名稱，移除 Apple Health 的前綴
 * @param {string} rawType - 原始類型名稱
 * @returns {string} 清理後的類型名稱
 */
function cleanTypeName(rawType) {
  if (!rawType) return rawType;
  for (const prefix of TYPE_PREFIXES) {
    if (rawType.startsWith(prefix)) {
      return rawType.slice(prefix.length);
    }
  }
  return rawType;
}

/**
 * 從裝置字串中提取簡要裝置資訊
 * @param {string} deviceStr - 原始裝置字串
 * @returns {string|null} 簡化的裝置名稱
 */
function parseDevice(deviceStr) {
  if (!deviceStr) return null;
  // 嘗試提取裝置名稱（格式：<<HKDevice: ..., name:iPhone, ...>>）
  const nameMatch = deviceStr.match(/name:([^,>]+)/);
  if (nameMatch) {
    return nameMatch[1].trim();
  }
  return deviceStr.length > 100 ? deviceStr.substring(0, 100) : deviceStr;
}

/**
 * 標準化日期格式以適應 SQLite 的日期時間函數
 * 將 "2018-07-16 22:33:06 +0800" 轉換為 "2018-07-16 22:33:06 +08:00"
 * @param {string} dateStr - 原始日期字串
 * @returns {string|null} 標準化後的日期字串
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const len = dateStr.length;
  if (len >= 5) {
    const tzPart = dateStr.substring(len - 5);
    if (/^[+-]\d{4}$/.test(tzPart)) {
      return dateStr.substring(0, len - 5) + tzPart.substring(0, 3) + ':' + tzPart.substring(3);
    }
  }
  return dateStr;
}

/**
 * 估計 XML 檔案中的紀錄數量（根據檔案大小粗估）
 * 平均每筆紀錄約 300-500 bytes
 * @param {number} fileSize - 檔案大小（bytes）
 * @returns {number} 估計的紀錄數量
 */
function estimateRecordCount(fileSize) {
  return Math.floor(fileSize / 400);
}

/**
 * 判斷檔案是否為 ZIP 格式
 * @param {string} filePath - 檔案路徑
 * @returns {boolean}
 */
function isZipFile(filePath) {
  return path.extname(filePath).toLowerCase() === '.zip';
}

/**
 * 從 ZIP 檔案中解壓並找到 XML 檔案
 * 使用 Node.js 內建的 unzip 處理簡單 ZIP
 * 注意：Apple Health 匯出的 ZIP 通常包含 apple_health_export/export.xml
 * @param {string} zipPath - ZIP 檔案路徑
 * @returns {Promise<string>} 解壓後的 XML 檔案路徑
 */
async function extractXmlFromZip(zipPath) {
  // 使用動態匯入 node:child_process 呼叫系統的解壓工具
  // 或使用簡易方式：將 ZIP 解壓到同一目錄
  const { execSync } = await import('child_process');
  const extractDir = path.join(path.dirname(zipPath), 'extracted_' + Date.now());
  fs.mkdirSync(extractDir, { recursive: true });

  try {
    // Windows 使用 PowerShell 解壓
    if (process.platform === 'win32') {
      execSync(
        `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`,
        { stdio: 'pipe' }
      );
    } else {
      execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, { stdio: 'pipe' });
    }

    // 遞迴尋找 export.xml 或任何 .xml 檔案
    const xmlFile = findXmlFile(extractDir);
    if (!xmlFile) {
      throw new Error('ZIP 檔案中找不到 XML 檔案');
    }
    return xmlFile;
  } catch (error) {
    throw new Error(`解壓 ZIP 檔案失敗: ${error.message}`);
  }
}

function findXmlFile(dir) {
  const xmlFiles = [];

  function traverse(currentDir) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml')) {
          const stats = fs.statSync(fullPath);
          xmlFiles.push({ path: fullPath, size: stats.size });
        } else if (entry.isDirectory()) {
          traverse(fullPath);
        }
      }
    } catch (e) {
      console.error(`掃描目錄失敗: ${currentDir}`, e.message);
    }
  }

  traverse(dir);

  if (xmlFiles.length === 0) return null;

  // 依檔案大小降序排序（由大到小）
  xmlFiles.sort((a, b) => b.size - a.size);

  console.log(`[ZIP 解析] 找到 ${xmlFiles.length} 個 XML 檔案。選擇最大檔案: ${xmlFiles[0].path} (${(xmlFiles[0].size / 1024 / 1024).toFixed(2)} MB)`);
  return xmlFiles[0].path;
}

/**
 * 解析 Apple Health 匯出檔案
 * @param {string} filePath - XML 或 ZIP 檔案路徑
 * @param {object} options - 解析選項
 * @param {function} options.onProgress - 進度回呼 (current, totalEstimate)
 * @param {function} options.onBatch - 批次回呼 (records[])
 * @param {number} options.batchSize - 批次大小，預設 1000
 * @returns {Promise<{ totalRecords: number, importedRecords: number, skippedRecords: number }>}
 */
export async function parseHealthExport(filePath, options = {}) {
  const {
    onProgress = () => {},
    onBatch = () => {},
    batchSize = 1000,
  } = options;

  // 如果是 ZIP 檔案，先解壓
  let xmlPath = filePath;
  let cleanupDir = null;
  if (isZipFile(filePath)) {
    xmlPath = await extractXmlFromZip(filePath);
    // 記住需要清理的解壓目錄
    cleanupDir = path.dirname(xmlPath);
  }

  // 取得檔案大小以估算進度
  const fileStats = fs.statSync(xmlPath);
  const totalEstimate = estimateRecordCount(fileStats.size);

  return new Promise((resolve, reject) => {
    const parser = sax.createStream(true, {
      trim: true,
      normalize: true,
    });

    let totalRecords = 0;
    let importedRecords = 0;
    let skippedRecords = 0;
    let batch = [];
    let bytesRead = 0;

    // 處理 Record 元素
    parser.on('opentag', (node) => {
      if (node.name === 'Record') {
        const attrs = node.attributes;
        const record = {
          type: cleanTypeName(attrs.type),
          value: attrs.value !== undefined ? parseFloat(attrs.value) : null,
          unit: attrs.unit || null,
          sourceName: attrs.sourceName || null,
          startDate: normalizeDate(attrs.startDate),
          endDate: normalizeDate(attrs.endDate),
          creationDate: normalizeDate(attrs.creationDate),
          device: parseDevice(attrs.device),
        };

        // 確保有必要的欄位
        if (record.type && record.startDate) {
          // 處理 value 為 NaN 的情況
          if (isNaN(record.value)) {
            record.value = null;
          }
          batch.push(record);
          totalRecords++;

          // 達到批次大小時觸發回呼
          if (batch.length >= batchSize) {
            const result = onBatch(batch);
            if (result) {
              importedRecords += result.imported || 0;
              skippedRecords += result.skipped || 0;
            }
            batch = [];
            onProgress(totalRecords, totalEstimate);
          }
        }
      }

      // 處理 Workout 元素
      if (node.name === 'Workout') {
        const attrs = node.attributes;
        const record = {
          type: 'Workout_' + cleanTypeName(attrs.workoutActivityType),
          value: attrs.duration !== undefined ? parseFloat(attrs.duration) : null,
          unit: attrs.durationUnit || 'min',
          sourceName: attrs.sourceName || null,
          startDate: normalizeDate(attrs.startDate),
          endDate: normalizeDate(attrs.endDate),
          creationDate: normalizeDate(attrs.creationDate),
          device: parseDevice(attrs.device),
        };

        if (record.type && record.startDate) {
          if (isNaN(record.value)) {
            record.value = null;
          }
          batch.push(record);
          totalRecords++;

          if (batch.length >= batchSize) {
            const result = onBatch(batch);
            if (result) {
              importedRecords += result.imported || 0;
              skippedRecords += result.skipped || 0;
            }
            batch = [];
            onProgress(totalRecords, totalEstimate);
          }
        }
      }
    });

    parser.on('error', (err) => {
      // sax 解析器錯誤可恢復，記錄但不中斷
      console.error('XML 解析錯誤:', err.message);
      parser.resume();
    });

    parser.on('end', () => {
      // 處理最後剩餘的批次
      if (batch.length > 0) {
        const result = onBatch(batch);
        if (result) {
          importedRecords += result.imported || 0;
          skippedRecords += result.skipped || 0;
        }
        onProgress(totalRecords, totalRecords);
      }

      // 清理解壓的暫存目錄
      if (cleanupDir) {
        try {
          fs.rmSync(cleanupDir, { recursive: true, force: true });
        } catch (e) {
          console.error('清理暫存目錄失敗:', e.message);
        }
      }

      resolve({
        totalRecords,
        importedRecords,
        skippedRecords,
      });
    });

    // 建立讀取串流並導入解析器
    const readStream = fs.createReadStream(xmlPath);

    readStream.on('data', (chunk) => {
      bytesRead += chunk.length;
    });

    readStream.on('error', (err) => {
      reject(new Error(`讀取檔案失敗: ${err.message}`));
    });

    readStream.pipe(parser);
  });
}
