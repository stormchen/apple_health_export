/**
 * 健康資料 API 路由
 * GET /api/health - 查詢健康資料
 */

import { NextResponse } from 'next/server';
import { getDb, queryHealthData } from '@/lib/db';

/**
 * 查詢健康資料
 * @param {Request} request
 * Query params:
 *   - period: 期間類型（7d|30d|90d|1y|all）- 用於儀表板與分析對比
 *   - type: 資料類型（如 StepCount, HeartRate）- 用於自訂原始數據查詢
 *   - from: 開始日期（ISO 8601）
 *   - to: 結束日期（ISO 8601）
 *   - aggregation: 聚合方式（raw|daily|weekly|monthly）
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period');
    const type = searchParams.get('type');

    // 1. 如果前端同時請求了 period 和 type，這是一個針對特定健康指標的深層期間分析請求
    if (period && type) {
      const db = getDb();

      // 取得該指標在資料庫中最新數據的日期作為計算錨點
      const latestRow = db.prepare(`
        SELECT date(start_date) as d 
        FROM health_records 
        WHERE type = ? 
        ORDER BY start_date DESC 
        LIMIT 1
      `).get(type);
      const refDateStr = latestRow?.d || new Date().toISOString().split('T')[0];
      const refDate = new Date(refDateStr);

      let days = 30;
      if (period === '7d') days = 7;
      else if (period === '30d') days = 30;
      else if (period === '90d') days = 90;
      else if (period === '1y') days = 365;
      else if (period === 'all') days = 99999;

      const toDateStr = refDateStr;
      const fromDate = new Date(refDate);
      fromDate.setDate(refDate.getDate() - days);
      const fromDateStr = fromDate.toISOString().split('T')[0];

      const prevToDate = new Date(fromDate);
      prevToDate.setDate(fromDate.getDate() - 1);
      const prevToDateStr = prevToDate.toISOString().split('T')[0];

      const prevFromDate = new Date(prevToDate);
      prevFromDate.setDate(prevToDate.getDate() - days);
      const prevFromDateStr = prevFromDate.toISOString().split('T')[0];

      const isAvgMetric = [
        'HeartRate', 'BodyMass', 'BodyMassIndex', 'WalkingSpeed', 
        'WalkingStepLength', 'WalkingAsymmetryPercentage', 
        'WalkingDoubleSupportPercentage', 'HeadphoneAudioExposure',
        'PhysicalEffort'
      ].includes(type);
      
      const isSleepMetric = type === 'SleepAnalysis';

      let metricData = [];
      let metricPrevData = [];

      if (isSleepMetric) {
        const currentQuery = db.prepare(`
          SELECT date(start_date) AS date, SUM((julianday(end_date) - julianday(start_date)) * 24) AS hours
          FROM health_records
          WHERE type = ? AND value = 1 AND date(start_date) BETWEEN ? AND ?
          GROUP BY date(start_date)
          ORDER BY date(start_date) ASC
        `);
        metricData = currentQuery.all(type, fromDateStr, toDateStr).map(d => ({ 
          date: d.date, 
          value: Number(d.hours.toFixed(1)) 
        }));

        const prevQuery = db.prepare(`
          SELECT date(start_date) AS date, SUM((julianday(end_date) - julianday(start_date)) * 24) AS hours
          FROM health_records
          WHERE type = ? AND value = 1 AND date(start_date) BETWEEN ? AND ?
          GROUP BY date(start_date)
          ORDER BY date(start_date) ASC
        `);
        metricPrevData = prevQuery.all(type, prevFromDateStr, prevToDateStr).map(d => ({ 
          date: d.date, 
          value: Number(d.hours.toFixed(1)) 
        }));
      } else if (isAvgMetric) {
        const currentQuery = db.prepare(`
          SELECT date(start_date) AS date, AVG(value) AS val, MIN(value) as min_val, MAX(value) as max_val
          FROM health_records
          WHERE type = ? AND date(start_date) BETWEEN ? AND ?
          GROUP BY date(start_date)
          ORDER BY date(start_date) ASC
        `);
        metricData = currentQuery.all(type, fromDateStr, toDateStr).map(d => ({ 
          date: d.date, 
          value: Number(d.val.toFixed(1)),
          min: Math.round(d.min_val),
          max: Math.round(d.max_val)
        }));

        const prevQuery = db.prepare(`
          SELECT date(start_date) AS date, AVG(value) AS val
          FROM health_records
          WHERE type = ? AND date(start_date) BETWEEN ? AND ?
          GROUP BY date(start_date)
          ORDER BY date(start_date) ASC
        `);
        metricPrevData = prevQuery.all(type, prevFromDateStr, prevToDateStr).map(d => ({ 
          date: d.date, 
          value: Number(d.val.toFixed(1)) 
        }));
      } else {
        const currentQuery = db.prepare(`
          SELECT date(start_date) AS date, SUM(value) AS sum_val
          FROM health_records
          WHERE type = ? AND date(start_date) BETWEEN ? AND ?
          GROUP BY date(start_date)
          ORDER BY date(start_date) ASC
        `);
        metricData = currentQuery.all(type, fromDateStr, toDateStr).map(d => ({ 
          date: d.date, 
          value: Number(d.sum_val.toFixed(1)) 
        }));

        const prevQuery = db.prepare(`
          SELECT date(start_date) AS date, SUM(value) AS sum_val
          FROM health_records
          WHERE type = ? AND date(start_date) BETWEEN ? AND ?
          GROUP BY date(start_date)
          ORDER BY date(start_date) ASC
        `);
        metricPrevData = prevQuery.all(type, prevFromDateStr, prevToDateStr).map(d => ({ 
          date: d.date, 
          value: Number(d.sum_val.toFixed(1)) 
        }));
      }

      return NextResponse.json({
        metricData,
        metricPrevData
      });
    }

    // 2. 如果只請求了 period，回傳儀表板首頁整合數據
    if (period) {
      const db = getDb();

      // 1. 取得資料庫中最新數據的日期作為計算錨點（防止在歷史數據中今天沒有數據的問題）
      const latestRow = db.prepare(`
        SELECT date(start_date) as d 
        FROM health_records 
        WHERE type = 'StepCount' 
        ORDER BY start_date DESC 
        LIMIT 1
      `).get();
      const refDateStr = latestRow?.d || new Date().toISOString().split('T')[0];
      const refDate = new Date(refDateStr);

      // 2. 決定當前期間與上一期間的天數範圍
      let days = 30;
      if (period === '7d') days = 7;
      else if (period === '30d') days = 30;
      else if (period === '90d') days = 90;
      else if (period === '1y') days = 365;
      else if (period === 'all') days = 99999; // 預設全部時間

      // 本期範圍
      const toDateStr = refDateStr;
      const fromDate = new Date(refDate);
      fromDate.setDate(refDate.getDate() - days);
      const fromDateStr = fromDate.toISOString().split('T')[0];

      // 上期範圍（用於分析頁面的「期間對比」功能）
      const prevToDate = new Date(fromDate);
      prevToDate.setDate(fromDate.getDate() - 1);
      const prevToDateStr = prevToDate.toISOString().split('T')[0];

      const prevFromDate = new Date(prevToDate);
      prevFromDate.setDate(prevToDate.getDate() - days);
      const prevFromDateStr = prevFromDate.toISOString().split('T')[0];

      // 3. 查詢本期數據
      // 步數
      const steps = db.prepare(`
        SELECT date(start_date) AS date, CAST(SUM(value) AS INTEGER) AS value
        FROM health_records
        WHERE type = 'StepCount' AND date(start_date) BETWEEN ? AND ?
        GROUP BY date(start_date)
        ORDER BY date(start_date) ASC
      `).all(fromDateStr, toDateStr);

      // 心率
      const heartRateRaw = db.prepare(`
        SELECT date(start_date) AS date, AVG(value) AS avg, MIN(value) AS min, MAX(value) AS max
        FROM health_records
        WHERE type = 'HeartRate' AND date(start_date) BETWEEN ? AND ?
        GROUP BY date(start_date)
        ORDER BY date(start_date) ASC
      `).all(fromDateStr, toDateStr);
      const heartRate = heartRateRaw.map(d => ({
        date: d.date,
        avg: Math.round(d.avg),
        min: Math.round(d.min),
        max: Math.round(d.max)
      }));

      // 睡眠 (SleepAnalysis value=1 代表睡著時間)
      const sleepRaw = db.prepare(`
        SELECT date(start_date) AS date, SUM((julianday(end_date) - julianday(start_date)) * 24) AS hours
        FROM health_records
        WHERE type = 'SleepAnalysis' AND value = 1 AND date(start_date) BETWEEN ? AND ?
        GROUP BY date(start_date)
        ORDER BY date(start_date) ASC
      `).all(fromDateStr, toDateStr);
      const sleep = sleepRaw.map(d => ({
        date: d.date,
        hours: Number(d.hours.toFixed(1))
      }));

      // 4. 查詢上期數據（用於對比）
      const stepsPrev = db.prepare(`
        SELECT date(start_date) AS date, CAST(SUM(value) AS INTEGER) AS value
        FROM health_records
        WHERE type = 'StepCount' AND date(start_date) BETWEEN ? AND ?
        GROUP BY date(start_date)
        ORDER BY date(start_date) ASC
      `).all(prevFromDateStr, prevToDateStr);

      const heartRatePrevRaw = db.prepare(`
        SELECT date(start_date) AS date, AVG(value) AS avg, MIN(value) AS min, MAX(value) AS max
        FROM health_records
        WHERE type = 'HeartRate' AND date(start_date) BETWEEN ? AND ?
        GROUP BY date(start_date)
        ORDER BY date(start_date) ASC
      `).all(prevFromDateStr, prevToDateStr);
      const heartRatePrev = heartRatePrevRaw.map(d => ({
        date: d.date,
        avg: Math.round(d.avg),
        min: Math.round(d.min),
        max: Math.round(d.max)
      }));

      const sleepPrevRaw = db.prepare(`
        SELECT date(start_date) AS date, SUM((julianday(end_date) - julianday(start_date)) * 24) AS hours
        FROM health_records
        WHERE type = 'SleepAnalysis' AND value = 1 AND date(start_date) BETWEEN ? AND ?
        GROUP BY date(start_date)
        ORDER BY date(start_date) ASC
      `).all(prevFromDateStr, prevToDateStr);
      const sleepPrev = sleepPrevRaw.map(d => ({
        date: d.date,
        hours: Number(d.hours.toFixed(1))
      }));

      // 5. 查詢活動環 (今日 / 錨點日活動環進度)
      const todayStepsVal = db.prepare("SELECT SUM(value) as val FROM health_records WHERE type = 'StepCount' AND date(start_date) = ?").get(refDateStr)?.val || 0;
      const todayCalVal = db.prepare("SELECT SUM(value) as val FROM health_records WHERE type = 'ActiveEnergyBurned' AND date(start_date) = ?").get(refDateStr)?.val || 0;
      const todayExVal = db.prepare("SELECT SUM(value) as val FROM health_records WHERE type LIKE 'Workout_%' AND date(start_date) = ?").get(refDateStr)?.val || 0;

      const activity = {
        steps: { value: Math.round(todayStepsVal), goal: 10000 },
        calories: { value: Math.round(todayCalVal), goal: 600 },
        exercise: { value: Math.round(todayExVal), goal: 30 }
      };

      // 6. 計算 KPI 卡片指標
      const todaySteps = Math.round(todayStepsVal);
      const yesterdayStepsVal = db.prepare("SELECT SUM(value) as val FROM health_records WHERE type = 'StepCount' AND date(start_date) = date(?, '-1 day')").get(refDateStr)?.val || 0;
      const stepsChange = yesterdayStepsVal > 0 ? ((todaySteps - yesterdayStepsVal) / yesterdayStepsVal) * 100 : 0;

      const avgHeartRateRow = db.prepare("SELECT AVG(value) as val FROM health_records WHERE type = 'HeartRate' AND date(start_date) = ?").get(refDateStr);
      const avgHeartRate = avgHeartRateRow?.val ? Math.round(avgHeartRateRow.val) : 70;
      const yesterdayHRRow = db.prepare("SELECT AVG(value) as val FROM health_records WHERE type = 'HeartRate' AND date(start_date) = date(?, '-1 day')").get(refDateStr);
      const yesterdayHR = yesterdayHRRow?.val || avgHeartRate;
      const heartRateChange = yesterdayHR > 0 ? ((avgHeartRate - yesterdayHR) / yesterdayHR) * 100 : 0;

      const lastSleepHoursRow = db.prepare("SELECT SUM((julianday(end_date) - julianday(start_date)) * 24) as val FROM health_records WHERE type = 'SleepAnalysis' AND value = 1 AND date(start_date) = ?").get(refDateStr);
      const lastSleepHours = lastSleepHoursRow?.val ? Number(lastSleepHoursRow.val.toFixed(1)) : 8.0;
      const prevSleepRow = db.prepare("SELECT SUM((julianday(end_date) - julianday(start_date)) * 24) as val FROM health_records WHERE type = 'SleepAnalysis' AND value = 1 AND date(start_date) = date(?, '-1 day')").get(refDateStr);
      const prevSleep = prevSleepRow?.val || lastSleepHours;
      const sleepChange = prevSleep > 0 ? ((lastSleepHours - prevSleep) / prevSleep) * 100 : 0;

      const activeDaysRow = db.prepare("SELECT COUNT(DISTINCT date(start_date)) as count FROM health_records").get();
      const activeDays = activeDaysRow ? activeDaysRow.count : 0;
      const activeDaysChange = 0;

      const kpi = {
        todaySteps,
        stepsChange,
        avgHeartRate,
        heartRateChange,
        lastSleepHours,
        sleepChange,
        activeDays,
        activeDaysChange
      };

      return NextResponse.json({
        steps,
        stepsPrev,
        heartRate,
        heartRatePrev,
        sleep,
        sleepPrev,
        activity,
        kpi
      });
    }

    // 備用選項：保留原有的單一類型 API 查詢，以利深入調試
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const aggregation = searchParams.get('aggregation') || 'raw';

    const validAggregations = ['raw', 'daily', 'weekly', 'monthly'];
    if (!validAggregations.includes(aggregation)) {
      return NextResponse.json(
        { error: `無效的聚合方式，可選值: ${validAggregations.join(', ')}` },
        { status: 400 }
      );
    }

    const data = queryHealthData(type, from, to, aggregation);

    return NextResponse.json({
      data,
      meta: {
        total: data.length,
        type: type || '全部',
        from: from || null,
        to: to || null,
        aggregation,
      },
    });
  } catch (error) {
    console.error('查詢健康資料失敗:', error);
    return NextResponse.json(
      { error: '查詢健康資料失敗', detail: error.message },
      { status: 500 }
    );
  }
}
