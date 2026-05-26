/**
 * 監控狀態 API
 * GET /api/watch/status
 */

import { NextResponse } from 'next/server';
import { getWatchStatus } from '@/lib/watcher';

/**
 * 取得資料夾監控狀態
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
