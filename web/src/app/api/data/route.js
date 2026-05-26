/**
 * 資料庫資料清理 API 路由
 * DELETE /api/data - 清空所有健康紀錄與匯入歷史
 */

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function DELETE() {
  try {
    const db = getDb();
    
    // 於事務中清空資料表
    db.transaction(() => {
      // 由於有外鍵約束，優先刪除子表 health_records，再刪除主表 import_history
      db.prepare('DELETE FROM health_records').run();
      db.prepare('DELETE FROM import_history').run();
    })();
    
    // 執行 VACUUM 整理資料庫，釋放實體硬碟空間，使其大小縮回 0 或最小值
    db.prepare('VACUUM').run();
    
    console.log('已成功清空資料庫並執行 VACUUM 空間回收！');
    
    return NextResponse.json({ 
      success: true, 
      message: '資料庫已成功清空並重整空間' 
    });
  } catch (error) {
    console.error('清空資料庫失敗:', error);
    return NextResponse.json(
      { error: '清空資料庫失敗', detail: error.message },
      { status: 500 }
    );
  }
}
