/**
 * 統計資料 API 路由
 * GET /api/stats - 取得總覽統計或特定類型的趨勢資料
 */

import { NextResponse } from 'next/server';
import { getDb, getStats, getAvailableTypes, queryHealthData } from '@/lib/db';
import fs from 'fs';
import path from 'path';

/**
 * 取得統計資料
 * @param {Request} request
 * 
 * 無參數：回傳總覽統計
 * 有 type 參數：回傳特定類型的趨勢資料
 *   - type: 資料類型
 *   - period: 聚合方式（daily|weekly|monthly）
 *   - from: 開始日期
 *   - to: 結束日期
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const period = searchParams.get('period');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // 如果指定了 type，回傳該類型的趨勢資料
    if (type) {
      const aggregation = period || 'daily';
      const data = queryHealthData(type, from, to, aggregation);
      return NextResponse.json({
        type,
        period: aggregation,
        from,
        to,
        data,
      });
    }

    // 取得整體統計
    const stats = getStats();
    const availableTypes = getAvailableTypes();
    const db = getDb();

    // 步數統計
    const stepsStats = getStepsStats(db);

    // 心率統計
    const heartRateStats = getHeartRateStats(db);

    // 睡眠統計
    const sleepStats = getSleepStats(db);

    // 活動消耗統計
    const activityStats = getActivityStats(db);

    // 計算資料庫大小
    const DB_PATH = path.join(process.cwd(), 'data', 'health.db');
    let dbSize = '0 B';
    try {
      if (fs.existsSync(DB_PATH)) {
        const fileStats = fs.statSync(DB_PATH);
        const bytes = fileStats.size;
        if (bytes > 0) {
          const k = 1024;
          const sizes = ['B', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          dbSize = `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
        }
      }
    } catch (e) {
      console.error('計算資料庫大小失敗:', e);
    }

    return NextResponse.json({
      totalRecords: stats.totalRecords,
      dbSize,
      overview: {
        totalRecords: stats.totalRecords,
        dateRange: stats.dateRange,
        availableTypes,
        typeCount: stats.typeCount,
      },
      steps: stepsStats,
      heartRate: heartRateStats,
      sleep: sleepStats,
      activity: activityStats,
    });
  } catch (error) {
    console.error('取得統計資料失敗:', error);
    return NextResponse.json(
      { error: '取得統計資料失敗', detail: error.message },
      { status: 500 }
    );
  }
}

/**
 * 取得步數相關統計
 * @param {Database} db - 資料庫實例
 * @returns {object} 步數統計
 */
function getStepsStats(db) {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 今日步數
    const todaySteps = db.prepare(`
      SELECT COALESCE(SUM(value), 0) AS total
      FROM health_records
      WHERE type = 'StepCount' AND date(start_date) = ?
    `).get(today);

    // 每日步數統計（用於計算平均值）
    const dailySteps = db.prepare(`
      SELECT date(start_date) AS day, SUM(value) AS total
      FROM health_records
      WHERE type = 'StepCount'
      GROUP BY date(start_date)
      ORDER BY day DESC
    `).all();

    // 週平均（最近 7 天）
    const weekData = dailySteps.slice(0, 7);
    const weekAvg = weekData.length > 0
      ? Math.round(weekData.reduce((s, d) => s + d.total, 0) / weekData.length)
      : 0;

    // 月平均（最近 30 天）
    const monthData = dailySteps.slice(0, 30);
    const monthAvg = monthData.length > 0
      ? Math.round(monthData.reduce((s, d) => s + d.total, 0) / monthData.length)
      : 0;

    // 全時間平均
    const allTimeAvg = dailySteps.length > 0
      ? Math.round(dailySteps.reduce((s, d) => s + d.total, 0) / dailySteps.length)
      : 0;

    // 最高紀錄
    const maxDay = dailySteps.length > 0
      ? dailySteps.reduce((max, d) => d.total > max.total ? d : max, dailySteps[0])
      : { total: 0, day: null };

    return {
      today: todaySteps?.total || 0,
      weekAvg,
      monthAvg,
      allTimeAvg,
      max: maxDay.total,
      maxDate: maxDay.day,
    };
  } catch (error) {
    console.error('取得步數統計失敗:', error);
    return { today: 0, weekAvg: 0, monthAvg: 0, allTimeAvg: 0, max: 0, maxDate: null };
  }
}

/**
 * 取得心率相關統計
 * @param {Database} db - 資料庫實例
 * @returns {object} 心率統計
 */
function getHeartRateStats(db) {
  try {
    // 最新心率
    const latest = db.prepare(`
      SELECT value FROM health_records
      WHERE type = 'HeartRate'
      ORDER BY start_date DESC LIMIT 1
    `).get();

    // 靜息心率平均（取最近 30 天的最低值的平均）
    const avgResting = db.prepare(`
      SELECT AVG(min_hr) AS avg FROM (
        SELECT MIN(value) AS min_hr
        FROM health_records
        WHERE type = 'HeartRate'
        GROUP BY date(start_date)
        ORDER BY date(start_date) DESC
        LIMIT 30
      )
    `).get();

    // 全部心率的最小和最大值
    const minMax = db.prepare(`
      SELECT MIN(value) AS min, MAX(value) AS max
      FROM health_records
      WHERE type = 'HeartRate' AND value > 0
    `).get();

    return {
      latest: latest?.value || null,
      avgResting: avgResting?.avg ? Math.round(avgResting.avg) : null,
      min: minMax?.min || null,
      max: minMax?.max || null,
    };
  } catch (error) {
    console.error('取得心率統計失敗:', error);
    return { latest: null, avgResting: null, min: null, max: null };
  }
}

/**
 * 取得睡眠相關統計
 * @param {Database} db - 資料庫實例
 * @returns {object} 睡眠統計
 */
function getSleepStats(db) {
  try {
    // 睡眠資料（Apple Health 用 SleepAnalysis 類型）
    // 計算每晚睡眠時長（以分鐘計）
    const sleepData = db.prepare(`
      SELECT
        date(start_date) AS night,
        SUM(
          (julianday(end_date) - julianday(start_date)) * 24 * 60
        ) AS minutes
      FROM health_records
      WHERE type = 'SleepAnalysis'
        AND value = 1
      GROUP BY date(start_date)
      ORDER BY night DESC
    `).all();

    // 昨晚睡眠
    const lastNight = sleepData.length > 0 ? Math.round(sleepData[0].minutes) : null;

    // 週平均
    const weekData = sleepData.slice(0, 7);
    const weekAvg = weekData.length > 0
      ? Math.round(weekData.reduce((s, d) => s + d.minutes, 0) / weekData.length)
      : null;

    // 月平均
    const monthData = sleepData.slice(0, 30);
    const monthAvg = monthData.length > 0
      ? Math.round(monthData.reduce((s, d) => s + d.minutes, 0) / monthData.length)
      : null;

    return {
      lastNight,
      weekAvg,
      monthAvg,
    };
  } catch (error) {
    console.error('取得睡眠統計失敗:', error);
    return { lastNight: null, weekAvg: null, monthAvg: null };
  }
}

/**
 * 取得活動消耗相關統計
 * @param {Database} db - 資料庫實例
 * @returns {object} 活動統計
 */
function getActivityStats(db) {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 今日活動消耗卡路里
    const todayCalories = db.prepare(`
      SELECT COALESCE(SUM(value), 0) AS total
      FROM health_records
      WHERE type = 'ActiveEnergyBurned' AND date(start_date) = ?
    `).get(today);

    // 每日卡路里統計
    const dailyCalories = db.prepare(`
      SELECT date(start_date) AS day, SUM(value) AS total
      FROM health_records
      WHERE type = 'ActiveEnergyBurned'
      GROUP BY date(start_date)
      ORDER BY day DESC
      LIMIT 7
    `).all();

    const weekAvgCalories = dailyCalories.length > 0
      ? Math.round(dailyCalories.reduce((s, d) => s + d.total, 0) / dailyCalories.length)
      : 0;

    return {
      todayCalories: todayCalories?.total || 0,
      weekAvgCalories,
    };
  } catch (error) {
    console.error('取得活動統計失敗:', error);
    return { todayCalories: 0, weekAvgCalories: 0 };
  }
}
