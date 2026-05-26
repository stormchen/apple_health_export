/**
 * 資料夾監控 API 路由
 * POST /api/watch/start - 啟動資料夾監控
 * POST /api/watch/stop - 停止資料夾監控
 * GET /api/watch/status - 取得監控狀態
 * 
 * 注意：由於 Next.js App Router 的路由規則，
 * start/stop/status 各有獨立的路由檔案。
 * 此檔案處理 GET /api/watch（等同 status）
 */

import { NextResponse } from 'next/server';
import { getWatchStatus } from '@/lib/watcher';

/**
 * 取得監控狀態（GET /api/watch）
 */
export async function GET() {
  try {
    const status = getWatchStatus();
    return NextResponse.json({ data: status });
  } catch (error) {
    console.error('取得監控狀態失敗:', error);
    return NextResponse.json(
      { error: '取得監控狀態失敗', detail: error.message },
      { status: 500 }
    );
  }
}
