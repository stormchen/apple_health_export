'use client';

import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  PolarAngleAxis,
} from 'recharts';

const RING_CONFIG = [
  { key: 'steps', label: '步數', color: '#00d4aa', icon: '🚶' },
  { key: 'calories', label: '卡路里', color: '#8b5cf6', icon: '🔥' },
  { key: 'exercise', label: '運動時間', color: '#f59e0b', icon: '⏱️' },
];

export default function ActivityChart({ data }) {
  // data shape: { steps: { value, goal }, calories: { value, goal }, exercise: { value, goal } }
  const hasData = data && (data.steps || data.calories || data.exercise);

  if (!hasData) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⌚</div>
        <div className="empty-state-title">尚無活動資料</div>
        <div className="empty-state-desc">
          匯入資料後即可查看每日活動環
        </div>
      </div>
    );
  }

  const rings = RING_CONFIG.map((cfg, i) => {
    const d = data[cfg.key] || { value: 0, goal: 1 };
    const pct = Math.min((d.value / d.goal) * 100, 100);
    return {
      name: cfg.label,
      value: pct,
      fill: cfg.color,
      rawValue: d.value,
      goal: d.goal,
      icon: cfg.icon,
    };
  });

  // Recharts RadialBar expects data sorted inner→outer
  const chartData = [...rings].reverse();

  return (
    <div className="activity-rings-container fade-in">
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="30%"
            outerRadius="90%"
            data={chartData}
            startAngle={90}
            endAngle={-270}
            barSize={12}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            <RadialBar
              dataKey="value"
              cornerRadius={6}
              background={{ fill: 'rgba(255,255,255,0.04)' }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>

      <div className="activity-rings-legend">
        {rings.map((ring) => (
          <div key={ring.name} className="activity-legend-item">
            <div
              className="activity-legend-dot"
              style={{ background: ring.fill }}
            />
            <span className="activity-legend-label">
              {ring.icon} {ring.name}
            </span>
            <span className="activity-legend-value">
              {Number(ring.rawValue).toLocaleString()}
              <span style={{ opacity: 0.5, fontSize: '0.8em', marginLeft: 4 }}>
                / {Number(ring.goal).toLocaleString()}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
