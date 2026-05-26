'use client';

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="custom-tooltip-label">{label}</div>
      {payload.map((entry, i) => (
        <div key={i} className="custom-tooltip-value" style={{ color: entry.color }}>
          {entry.name}: {entry.value} bpm
        </div>
      ))}
    </div>
  );
}

export default function HeartRateChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">💓</div>
        <div className="empty-state-title">尚無心率資料</div>
        <div className="empty-state-desc">
          請先匯入 Apple Health 資料以查看心率分析
        </div>
      </div>
    );
  }

  return (
    <div className="chart-wrapper fade-in">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="hrRangeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
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
            domain={['dataMin - 5', 'dataMax + 5']}
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* min-max range band */}
          <Area
            type="monotone"
            dataKey="max"
            name="最高"
            stroke="none"
            fill="url(#hrRangeGradient)"
            dot={false}
            activeDot={false}
          />
          <Area
            type="monotone"
            dataKey="min"
            name="最低"
            stroke="none"
            fill="#0a0e1a"
            dot={false}
            activeDot={false}
          />
          {/* Average line */}
          <Line
            type="monotone"
            dataKey="avg"
            name="平均心率"
            stroke="#8b5cf6"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, stroke: '#8b5cf6', strokeWidth: 2, fill: '#0a0e1a' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
