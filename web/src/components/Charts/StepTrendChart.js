'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Line,
} from 'recharts';

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

export default function StepTrendChart({ data = [], goal = 10000 }) {
  // compute 7-day moving average
  const enriched = data.map((item, idx) => {
    const window = data.slice(Math.max(0, idx - 6), idx + 1);
    const avg = Math.round(
      window.reduce((s, d) => s + (d.value || 0), 0) / window.length
    );
    return { ...item, ma7: avg };
  });

  if (!data.length) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📈</div>
        <div className="empty-state-title">尚無步數資料</div>
        <div className="empty-state-desc">
          請先匯入 Apple Health 資料以查看步數趨勢
        </div>
      </div>
    );
  }

  return (
    <div className="chart-wrapper fade-in">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={enriched} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="stepGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00d4aa" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#00d4aa" stopOpacity={0.02} />
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
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={goal}
            stroke="#00d4aa"
            strokeDasharray="6 4"
            strokeOpacity={0.4}
            label={{
              value: `目標 ${goal.toLocaleString()}`,
              fill: '#64748b',
              fontSize: 11,
              position: 'right',
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            name="步數"
            stroke="#00d4aa"
            strokeWidth={2}
            fill="url(#stepGradient)"
            dot={false}
            activeDot={{ r: 4, stroke: '#00d4aa', strokeWidth: 2, fill: '#0a0e1a' }}
          />
          <Line
            type="monotone"
            dataKey="ma7"
            name="7日平均"
            stroke="#00d4aa"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            strokeOpacity={0.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
