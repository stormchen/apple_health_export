'use client';

import { useState, useEffect, useRef } from 'react';

function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (target == null || isNaN(target)) {
      setValue(0);
      return;
    }
    const start = performance.now();
    const from = 0;
    const to = Number(target);

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

function formatNumber(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString();
}

const CARDS = [
  {
    key: 'steps',
    icon: '🚶',
    label: '今日步數',
    color: 'teal',
    unit: '步',
    field: 'todaySteps',
    changeField: 'stepsChange',
  },
  {
    key: 'heartRate',
    icon: '💓',
    label: '平均心率',
    color: 'violet',
    unit: 'bpm',
    field: 'avgHeartRate',
    changeField: 'heartRateChange',
  },
  {
    key: 'sleep',
    icon: '😴',
    label: '昨晚睡眠',
    color: 'amber',
    unit: '小時',
    field: 'lastSleepHours',
    changeField: 'sleepChange',
  },
  {
    key: 'activeDays',
    icon: '🔥',
    label: '活躍天數',
    color: 'rose',
    unit: '天',
    field: 'activeDays',
    changeField: 'activeDaysChange',
  },
];

export default function KPICards({ data, loading }) {
  if (loading) {
    return (
      <div className="kpi-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card kpi-card">
            <div className="skeleton skeleton-text short" />
            <div className="skeleton" style={{ height: 44, width: '60%' }} />
            <div className="skeleton skeleton-text" style={{ width: '40%' }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="kpi-grid">
      {CARDS.map((card, i) => (
        <KPICardItem
          key={card.key}
          card={card}
          value={data?.[card.field]}
          change={data?.[card.changeField]}
          delay={i}
        />
      ))}
    </div>
  );
}

function KPICardItem({ card, value, change, delay }) {
  const displayValue = useCountUp(value ?? 0);

  const changeDir =
    change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
  const changeIcon = change > 0 ? '↑' : change < 0 ? '↓' : '—';
  const changeText =
    change != null && change !== 0
      ? `${changeIcon} ${Math.abs(change).toFixed(1)}%`
      : '— 持平';

  return (
    <div className={`card kpi-card fade-in fade-in-delay-${delay + 1}`}>
      <div className={`kpi-card-glow ${card.color}`} />
      <div className="kpi-card-header">
        <span className="kpi-card-icon">{card.icon}</span>
        <span className="kpi-card-label">{card.label}</span>
      </div>
      <div className={`kpi-card-value ${card.color}`}>
        {value != null ? formatNumber(displayValue) : '—'}
        {value != null && (
          <span className="kpi-card-unit">{card.unit}</span>
        )}
      </div>
      <div>
        <span className={`kpi-card-change ${changeDir}`}>
          {changeText}
        </span>
      </div>
    </div>
  );
}
