/**
 * 設定 API 路由
 * GET /api/settings - 取得所有設定
 * PUT /api/settings - 更新設定
 */

import { NextResponse } from 'next/server';
import { getDb, getSetting, setSetting } from '@/lib/db';

// 預設設定鍵值
const DEFAULT_KEYS = [
  'watchFolder',
  'watchInterval',
  'dailyStepGoal',
  'dailySleepGoal',
  'theme',
];

/**
 * 取得所有設定
 */
export async function GET() {
  try {
    // 確保資料庫已初始化
    getDb();

    const settings = {};
    for (const key of DEFAULT_KEYS) {
      settings[key] = getSetting(key);
    }

    return NextResponse.json({ data: settings });
  } catch (error) {
    console.error('取得設定失敗:', error);
    return NextResponse.json(
      { error: '取得設定失敗', detail: error.message },
      { status: 500 }
    );
  }
}

/**
 * 更新設定
 * Body: { key: string, value: string }
 */
export async function PUT(request) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json(
        { error: '請提供設定鍵（key）' },
        { status: 400 }
      );
    }

    if (value === undefined || value === null) {
      return NextResponse.json(
        { error: '請提供設定值（value）' },
        { status: 400 }
      );
    }

    setSetting(key, String(value));

    return NextResponse.json({
      success: true,
      data: { key, value: String(value) },
    });
  } catch (error) {
    console.error('更新設定失敗:', error);
    return NextResponse.json(
      { error: '更新設定失敗', detail: error.message },
      { status: 500 }
    );
  }
}
