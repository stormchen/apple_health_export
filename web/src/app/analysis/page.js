'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const PERIODS = [
  { key: '7d', label: '7 天' },
  { key: '30d', label: '30 天' },
  { key: '90d', label: '90 天' },
  { key: '1y', label: '1 年' },
  { key: 'all', label: '全部' },
];

/**
 * 取得健康數據指標的中文翻譯、圖示與主題色彩
 * @param {string} type - 資料庫中的原始指標名稱
 * @returns {object} { label, icon, color }
 */
function getMetricMetadata(type) {
  if (!type) return { label: '未知指標', icon: '📊', color: '#8b5cf6' };

  const mapping = {
    StepCount: { label: '每日步數', icon: '🚶', color: '#00d4aa' },
    HeartRate: { label: '心率 (Heart Rate)', icon: '💓', color: '#8b5cf6' },
    SleepAnalysis: { label: '睡眠分析', icon: '😴', color: '#f59e0b' },
    ActiveEnergyBurned: { label: '活動卡路里 (Active Energy)', icon: '🔥', color: '#f43f5e' },
    BasalEnergyBurned: { label: '基礎代謝卡路里', icon: '⚡', color: '#eab308' },
    DistanceWalkingRunning: { label: '步行與跑步距離', icon: '🗺️', color: '#3b82f6' },
    DistanceCycling: { label: '自行車騎乘距離', icon: '🚴', color: '#06b6d4' },
    AppleStandTime: { label: '站立時間', icon: '🧍', color: '#10b981' },
    AppleExerciseTime: { label: '運動時間', icon: '⏱️', color: '#14b8a6' },
    BodyMass: { label: '體重 (Weight)', icon: '⚖️', color: '#ec4899' },
    BodyMassIndex: { label: 'BMI 指數', icon: '📊', color: '#a855f7' },
    Height: { label: '身高', icon: '📏', color: '#6366f1' },
    PhysicalEffort: { label: '身體活動強度', icon: '⚡', color: '#8b5cf6' },
    WalkingSpeed: { label: '步行速度', icon: '⚡', color: '#10b981' },
    WalkingStepLength: { label: '步行步長', icon: '📏', color: '#00d4aa' },
    WalkingDoubleSupportPercentage: { label: '雙腳支撐比例', icon: '🦶', color: '#3b82f6' },
    WalkingAsymmetryPercentage: { label: '步行不對稱比例', icon: '🦶', color: '#ec4899' },
    AppleStandHour: { label: '站立小時數', icon: '🧍', color: '#14b8a6' },
    HeadphoneAudioExposure: { label: '耳機音量暴露', icon: '🎧', color: '#f43f5e' },
  };

  // 處理運動類別 (Workout)
  if (type.startsWith('Workout_')) {
    const workoutName = type.replace('Workout_', '');
    const workoutLabels = {
      Walking: '步行運動',
      Running: '跑步運動',
      Cycling: '自行車運動',
      Hiking: '徒步健行',
      Elliptical: '橢圓機運動',
      CoreTraining: '核心肌肉訓練',
      Swimming: '游泳運動',
      StairClimbing: '爬樓梯運動',
      FunctionalStrengthTraining: '功能性力量訓練',
    };
    return {
      label: workoutLabels[workoutName] || `${workoutName}運動`,
      icon: '🏋️',
      color: '#00d4aa',
    };
  }

  return mapping[type] || {
    label: type,
    icon: '📊',
    color: '#8b5cf6',
  };
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="custom-tooltip-label">{label}</div>
      {payload.map((entry, i) => (
        <div key={i} className="custom-tooltip-value" style={{ color: entry.color }}>
          {entry.name}: {Number(entry.value).toLocaleString()}
        </div>
      ))}
    </div>
  );
}

function computeStats(data) {
  if (!data || !data.length) return null;
  const values = data.map((d) => d.value).filter((v) => v != null && !isNaN(v));
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((s, v) => s + v, 0);
  const avg = sum / values.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const variance = values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  return {
    avg: avg.toFixed(1),
    median: median.toFixed(1),
    stdDev: stdDev.toFixed(1),
    min: sorted[0].toFixed(1),
    max: sorted[sorted.length - 1].toFixed(1),
    count: values.length,
  };
}

export default function AnalysisPage() {
  const [period, setPeriod] = useState('30d');
  const [metric, setMetric] = useState('');
  const [availableMetrics, setAvailableMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [prevData, setPrevData] = useState([]);

  // 1. 初始化取得資料庫中所有有數據的健康指標類型
  useEffect(() => {
    fetch('/api/stats')
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        if (data.overview && data.overview.availableTypes) {
          const types = data.overview.availableTypes;
          setAvailableMetrics(types);
          if (types.length > 0) {
            // 優先選擇步數 StepCount，其次選第一個
            const hasSteps = types.some((t) => t.type === 'StepCount');
            setMetric(hasSteps ? 'StepCount' : types[0].type);
          }
        }
      })
      .catch((err) => console.error('取得可用健康指標失敗:', err));
  }, []);

  // 2. 當選擇的指標或時間範圍改變時，抓取該指標的聚合數據
  const fetchAnalysis = useCallback(async () => {
    if (!metric) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/health?period=${period}&type=${metric}`);
      if (res.ok) {
        const data = await res.json();
        setChartData(data.metricData || []);
        setPrevData(data.metricPrevData || []);
      } else {
        setChartData([]);
        setPrevData([]);
      }
    } catch (err) {
      console.error('抓取健康分析數據失敗:', err);
      setChartData([]);
      setPrevData([]);
    } finally {
      setLoading(false);
    }
  }, [period, metric]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const meta = getMetricMetadata(metric);
  const stats = computeStats(chartData);
  const prevStats = computeStats(prevData);

  const renderChart = () => {
    if (!chartData.length) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon">{meta.icon}</div>
          <div className="empty-state-title">尚無{meta.label}資料</div>
          <div className="empty-state-desc">
            請確認在所選時間範圍內有此項指標的記錄
          </div>
        </div>
      );
    }

    if (metric === 'SleepAnalysis') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="analysisGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={meta.color} stopOpacity={0.85} />
                <stop offset="100%" stopColor={meta.color} stopOpacity={0.3} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" name={meta.label} fill="url(#analysisGrad)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="analysisAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={meta.color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={meta.color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            name={meta.label}
            stroke={meta.color}
            strokeWidth={2}
            fill="url(#analysisAreaGrad)"
            dot={false}
            activeDot={{ r: 4, stroke: meta.color, strokeWidth: 2, fill: '#0a0e1a' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">深入分析</h1>
      </div>

      {/* Controls */}
      <div className="analysis-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="period-selector">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              className={`period-btn ${period === p.key ? 'active' : ''}`}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <label htmlFor="metric-select" style={{ marginRight: 'var(--space-3)', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
            📊 選擇分析指標：
          </label>
          <select
            id="metric-select"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            style={{
              padding: '8px 16px',
              background: 'rgba(17, 25, 40, 0.75)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              outline: 'none',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {availableMetrics.map((m) => {
              const itemMeta = getMetricMetadata(m.type);
              return (
                <option key={m.type} value={m.type} style={{ background: '#111827', color: '#fff' }}>
                  {itemMeta.icon} {itemMeta.label} ({m.count.toLocaleString()} 筆)
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid fade-in">
          {[
            { label: '平均值', value: stats.avg },
            { label: '中位數', value: stats.median },
            { label: '標準差', value: stats.stdDev },
            { label: '最小值', value: stats.min },
            { label: '最大值', value: stats.max },
            { label: '資料點', value: stats.count },
          ].map((s) => (
            <div key={s.label} className="card stat-card">
              <div className="stat-card-label">{s.label}</div>
              <div className="stat-card-value">{Number(s.value).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {/* Main Chart */}
      <div className="card chart-card fade-in" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="chart-card-header">
          <div>
            <div className="chart-card-title">
              {meta.icon} {meta.label}趨勢
            </div>
            <div className="chart-card-subtitle">
              {period === 'all' ? '全部時間' : `近 ${PERIODS.find((p) => p.key === period)?.label}`}的詳細趨勢
            </div>
          </div>
        </div>
        {loading ? (
          <div className="skeleton skeleton-chart" style={{ height: 340 }} />
        ) : (
          <div className="chart-wrapper tall">{renderChart()}</div>
        )}
      </div>

      {/* Comparison */}
      {stats && prevStats && (
        <div>
          <h2
            style={{
              fontSize: 'var(--text-xl)',
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              marginBottom: 'var(--space-5)',
            }}
          >
            📊 期間對比
          </h2>
          <div className="comparison-grid">
            <div className="card" style={{ padding: 'var(--space-6)' }}>
              <div className="comparison-card-header">本期</div>
              <div className="stats-grid" style={{ marginBottom: 0 }}>
                <div className="stat-card" style={{ padding: 'var(--space-3)' }}>
                  <div className="stat-card-label">平均</div>
                  <div className="stat-card-value">{Number(stats.avg).toLocaleString()}</div>
                </div>
                <div className="stat-card" style={{ padding: 'var(--space-3)' }}>
                  <div className="stat-card-label">最大</div>
                  <div className="stat-card-value">{Number(stats.max).toLocaleString()}</div>
                </div>
              </div>
            </div>
            <div className="card" style={{ padding: 'var(--space-6)' }}>
              <div className="comparison-card-header">上期</div>
              <div className="stats-grid" style={{ marginBottom: 0 }}>
                <div className="stat-card" style={{ padding: 'var(--space-3)' }}>
                  <div className="stat-card-label">平均</div>
                  <div className="stat-card-value">{Number(prevStats.avg).toLocaleString()}</div>
                </div>
                <div className="stat-card" style={{ padding: 'var(--space-3)' }}>
                  <div className="stat-card-label">最大</div>
                  <div className="stat-card-value">{Number(prevStats.max).toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
