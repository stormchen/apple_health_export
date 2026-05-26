/**
 * 啟動資料夾監控 API
 * POST /api/watch/start
 */

import { NextResponse } from 'next/server';
import { startWatching } from '@/lib/watcher';

/**
 * 啟動資料夾監控
 * Body（可選）: { folder: string, intervalMinutes: number }
 */
export async function POST(request) {
  try {
    let folder = null;
    let intervalMinutes = null;

    // 嘗試解析請求 body
    try {
      const body = await request.json();
      folder = body.folder || null;
      intervalMinutes = body.intervalMinutes || null;
    } catch (e) {
      // 沒有 body 也沒關係，會從設定讀取
    }

    const result = startWatching(folder, intervalMinutes);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('啟動監控失敗:', error);
    return NextResponse.json(
      { error: '啟動監控失敗', detail: error.message },
      { status: 500 }
    );
  }
}
