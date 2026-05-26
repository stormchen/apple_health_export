/**
 * 停止資料夾監控 API
 * POST /api/watch/stop
 */

import { NextResponse } from 'next/server';
import { stopWatching } from '@/lib/watcher';

/**
 * 停止資料夾監控
 */
export async function POST() {
  try {
    const result = stopWatching();

    return NextResponse.json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error('停止監控失敗:', error);
    return NextResponse.json(
      { error: '停止監控失敗', detail: error.message },
      { status: 500 }
    );
  }
}
