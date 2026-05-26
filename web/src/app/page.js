'use client';

import { useState, useEffect, useCallback } from 'react';
import KPICards from '@/components/Dashboard/KPICards';
import StepTrendChart from '@/components/Charts/StepTrendChart';
import HeartRateChart from '@/components/Charts/HeartRateChart';
import SleepChart from '@/components/Charts/SleepChart';
import ActivityChart from '@/components/Charts/ActivityChart';

const PERIODS = [
  { key: '7d', label: '7 天' },
  { key: '30d', label: '30 天' },
  { key: '90d', label: '90 天' },
  { key: '1y', label: '1 年' },
  { key: 'all', label: '全部' },
];

export default function DashboardPage() {
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState(null);
  const [steps, setSteps] = useState([]);
  const [heartRate, setHeartRate] = useState([]);
  const [sleep, setSleep] = useState([]);
  const [activity, setActivity] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, statsRes] = await Promise.allSettled([
        fetch(`/api/health?period=${period}`),
        fetch('/api/stats'),
      ]);

      if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
        const data = await healthRes.value.json();
        setSteps(data.steps || []);
        setHeartRate(data.heartRate || []);
        setSleep(data.sleep || []);
        setActivity(data.activity || null);
        setKpi(data.kpi || null);
      }

      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const stats = await statsRes.value.json();
        // merge stats into kpi if kpi is null
        if (!kpi) {
          setKpi((prev) => prev || stats.kpi || null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">健康儀表板</h1>
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
      </div>

      {/* KPI Cards */}
      <KPICards data={kpi} loading={loading} />

      {/* Row 1: Steps + Activity */}
      <div className="charts-grid two-col">
        <div className="card chart-card fade-in fade-in-delay-1">
          <div className="chart-card-header">
            <div>
              <div className="chart-card-title">📈 步數趨勢</div>
              <div className="chart-card-subtitle">每日步數及 7 日移動平均</div>
            </div>
          </div>
          {loading ? (
            <div className="skeleton skeleton-chart" />
          ) : (
            <StepTrendChart data={steps} goal={10000} />
          )}
        </div>

        <div className="card chart-card fade-in fade-in-delay-2">
          <div className="chart-card-header">
            <div>
              <div className="chart-card-title">⌚ 今日活動</div>
              <div className="chart-card-subtitle">活動環完成進度</div>
            </div>
          </div>
          {loading ? (
            <div className="skeleton skeleton-chart" />
          ) : (
            <ActivityChart data={activity} />
          )}
        </div>
      </div>

      {/* Row 2: Heart Rate + Sleep */}
      <div className="charts-grid equal">
        <div className="card chart-card fade-in fade-in-delay-3">
          <div className="chart-card-header">
            <div>
              <div className="chart-card-title">💓 心率分析</div>
              <div className="chart-card-subtitle">靜息心率趨勢及範圍</div>
            </div>
          </div>
          {loading ? (
            <div className="skeleton skeleton-chart" />
          ) : (
            <HeartRateChart data={heartRate} />
          )}
        </div>

        <div className="card chart-card fade-in fade-in-delay-4">
          <div className="chart-card-header">
            <div>
              <div className="chart-card-title">😴 睡眠分析</div>
              <div className="chart-card-subtitle">每日睡眠時長</div>
            </div>
          </div>
          {loading ? (
            <div className="skeleton skeleton-chart" />
          ) : (
            <SleepChart data={sleep} goal={8} />
          )}
        </div>
      </div>
    </div>
  );
}
