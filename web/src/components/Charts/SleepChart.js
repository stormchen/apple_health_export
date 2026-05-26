'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="custom-tooltip-label">{label}</div>
      {payload.map((entry, i) => (
        <div key={i} className="custom-tooltip-value" style={{ color: entry.color }}>
          {entry.name}: {Number(entry.value).toFixed(1)} 小時
        </div>
      ))}
    </div>
  );
}

export default function SleepChart({ data = [], goal = 8 }) {
  if (!data.length) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">😴</div>
        <div className="empty-state-title">尚無睡眠資料</div>
        <div className="empty-state-desc">
          請先匯入 Apple Health 資料以查看睡眠分析
        </div>
      </div>
    );
  }

  return (
    <div className="chart-wrapper fade-in">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="sleepGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.85} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.35} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            domain={[0, 'dataMax + 2']}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={goal}
            stroke="#f59e0b"
            strokeDasharray="6 4"
            strokeOpacity={0.4}
            label={{
              value: `目標 ${goal}h`,
              fill: '#64748b',
              fontSize: 11,
              position: 'right',
            }}
          />
          <Bar
            dataKey="hours"
            name="睡眠時長"
            fill="url(#sleepGradient)"
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
