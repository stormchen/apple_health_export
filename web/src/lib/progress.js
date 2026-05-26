/**
 * 進度追蹤模組 - 全域匯入進度管理
 * 用於在 API 路由之間共享匯入進度資訊
 */

// 全域進度追蹤物件
// key: importId, value: { status, current, total, imported, skipped }
const progressMap = new Map();

/**
 * 更新匯入進度
 * @param {number} importId - 匯入 ID
 * @param {object} data - 進度資料
 */
export function updateProgress(importId, data) {
  const existing = progressMap.get(importId) || {};
  progressMap.set(importId, {
    ...existing,
    ...data,
    updatedAt: Date.now(),
  });
}

/**
 * 取得匯入進度
 * @param {number} importId - 匯入 ID
 * @returns {object|null} 進度資料
 */
export function getProgress(importId) {
  return progressMap.get(importId) || null;
}

/**
 * 移除匯入進度（完成或失敗後清理）
 * @param {number} importId - 匯入 ID
 */
export function removeProgress(importId) {
  progressMap.delete(importId);
}

/**
 * 取得所有進行中的匯入進度
 * @returns {object} 所有進度資料
 */
export function getAllProgress() {
  const result = {};
  for (const [id, data] of progressMap) {
    result[id] = data;
  }
  return result;
}
