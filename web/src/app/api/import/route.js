/**
 * 匯入 API 路由
 * POST /api/import - 上傳並匯入 XML/ZIP 檔案
 * GET /api/import - 取得匯入歷史
 */

import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { createImport, updateImport, insertHealthRecords, getImportHistory } from '@/lib/db';
import { parseHealthExport } from '@/lib/parser';
import { updateProgress } from '@/lib/progress';

// 上傳目錄路徑
const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');

/**
 * 上傳並匯入健康資料檔案
 * 接收 multipart/form-data，將檔案存到 data/uploads/，然後背景執行解析
 */
export async function POST(request) {
  try {
    // 確保上傳目錄存在
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });

    // 解析 multipart/form-data
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        { error: '請上傳檔案' },
        { status: 400 }
      );
    }

    // 驗證檔案類型
    const filename = file.name;
    const ext = path.extname(filename).toLowerCase();
    if (ext !== '.xml' && ext !== '.zip') {
      return NextResponse.json(
        { error: '僅支援 XML 和 ZIP 格式的檔案' },
        { status: 400 }
      );
    }

    // 將檔案寫入磁碟
    const buffer = Buffer.from(await file.arrayBuffer());
    const timestamp = Date.now();
    const savedFilename = `${timestamp}_${filename}`;
    const savedPath = path.join(UPLOADS_DIR, savedFilename);
    fs.writeFileSync(savedPath, buffer);

    // 建立匯入紀錄
    const { id: importId } = createImport(filename, buffer.length);

    // 初始化進度
    updateProgress(importId, {
      status: 'processing',
      current: 0,
      total: 0,
      imported: 0,
      skipped: 0,
    });

    // 背景執行解析（不 await，讓它在背景執行）
    runImport(importId, savedPath).catch((error) => {
      console.error(`匯入失敗 [${importId}]:`, error);
    });

    return NextResponse.json({
      importId,
      status: 'processing',
      message: '檔案已上傳，正在背景解析中',
    });
  } catch (error) {
    console.error('上傳檔案失敗:', error);
    return NextResponse.json(
      { error: '上傳檔案失敗', detail: error.message },
      { status: 500 }
    );
  }
}

/**
 * 背景執行匯入流程
 * @param {number} importId - 匯入 ID
 * @param {string} filePath - 檔案路徑
 */
async function runImport(importId, filePath) {
  let totalImported = 0;
  let totalSkipped = 0;

  try {
    const result = await parseHealthExport(filePath, {
      onProgress: (current, total) => {
        updateProgress(importId, {
          status: 'processing',
          current,
          total,
          imported: totalImported,
          skipped: totalSkipped,
        });
      },
      onBatch: (records) => {
        const batchResult = insertHealthRecords(records, importId);
        totalImported += batchResult.imported;
        totalSkipped += batchResult.skipped;
        return batchResult;
      },
    });

    // 更新匯入紀錄為完成
    updateImport(importId, {
      recordsTotal: result.totalRecords,
      recordsImported: totalImported,
      recordsSkipped: totalSkipped,
      status: 'completed',
      completedAt: new Date().toISOString(),
    });

    updateProgress(importId, {
      status: 'completed',
      current: result.totalRecords,
      total: result.totalRecords,
      imported: totalImported,
      skipped: totalSkipped,
    });

    console.log(`匯入完成 [${importId}]: 共 ${result.totalRecords} 筆，匯入 ${totalImported} 筆，跳過 ${totalSkipped} 筆`);
  } catch (error) {
    // 更新匯入紀錄為失敗
    updateImport(importId, {
      status: 'failed',
      errorMessage: error.message,
      completedAt: new Date().toISOString(),
    });

    updateProgress(importId, {
      status: 'failed',
      error: error.message,
    });

    console.error(`匯入失敗 [${importId}]:`, error.message);
  }
}

/**
 * 取得匯入歷史列表
 */
export async function GET() {
  try {
    const history = getImportHistory();
    return NextResponse.json({ data: history });
  } catch (error) {
    console.error('取得匯入歷史失敗:', error);
    return NextResponse.json(
      { error: '取得匯入歷史失敗', detail: error.message },
      { status: 500 }
    );
  }
}
