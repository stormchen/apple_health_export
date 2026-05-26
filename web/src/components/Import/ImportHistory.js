'use client';

import { useState, useEffect } from 'react';

function formatBytes(bytes) {
  if (!bytes) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function statusMap(s) {
  switch (s) {
    case 'completed':
    case 'success':
      return { label: '完成', cls: 'success' };
    case 'processing':
      return { label: '處理中', cls: 'processing' };
    case 'failed':
    case 'error':
      return { label: '失敗', cls: 'failed' };
    default:
      return { label: '等待中', cls: 'pending' };
  }
}

export default function ImportHistory({ refreshKey }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/import')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((data) => setRecords(Array.isArray(data.data) ? data.data : []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="card" style={{ padding: 'var(--space-6)' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ marginBottom: 'var(--space-4)' }}>
            <div className="skeleton skeleton-text full" />
            <div className="skeleton skeleton-text short" />
          </div>
        ))}
      </div>
    );
  }

  if (!records.length) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">尚無匯入紀錄</div>
          <div className="empty-state-desc">
            上傳 Apple Health 匯出檔案後，匯入紀錄將在這裡顯示
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'auto' }}>
      <table className="import-table">
        <thead>
          <tr>
            <th>檔案名稱</th>
            <th>檔案大小</th>
            <th>匯入筆數</th>
            <th>略過筆數</th>
            <th>狀態</th>
            <th>時間</th>
          </tr>
        </thead>
        <tbody>
          {records.map((rec, i) => {
            const st = statusMap(rec.status);
            return (
              <tr key={rec.id || i}>
                <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  {rec.filename || '—'}
                </td>
                <td>{formatBytes(rec.file_size)}</td>
                <td>{rec.records_imported != null ? Number(rec.records_imported).toLocaleString() : '—'}</td>
                <td>{rec.records_skipped != null ? Number(rec.records_skipped).toLocaleString() : '—'}</td>
                <td>
                  <span className={`status-badge ${st.cls}`}>{st.label}</span>
                </td>
                <td>
                  {rec.started_at
                    ? new Date(rec.started_at).toLocaleString('zh-TW')
                    : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
