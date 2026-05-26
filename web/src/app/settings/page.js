'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    stepGoal: 10000,
    sleepGoal: 8,
    watchPath: '',
    scanInterval: 60,
    watchEnabled: false,
  });
  const [dbInfo, setDbInfo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    // Load settings
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        if (data && typeof data === 'object') {
          setSettings((prev) => ({ ...prev, ...data }));
        }
      })
      .catch(() => {});

    // Load db info
    fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => setDbInfo(data))
      .catch(() => {});
  }, []);

  const handleChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    try {
      await fetch('/api/data', { method: 'DELETE' });
      setDbInfo((prev) => (prev ? { ...prev, totalRecords: 0 } : prev));
      setConfirmClear(false);
    } catch (err) {
      console.error('Clear failed:', err);
    }
  };

  const handleToggleWatch = async () => {
    const next = !settings.watchEnabled;
    handleChange('watchEnabled', next);
    try {
      await fetch('/api/watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next, path: settings.watchPath, interval: settings.scanInterval }),
      });
    } catch {}
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">設定</h1>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? '儲存中…' : saved ? '✓ 已儲存' : '💾 儲存設定'}
        </button>
      </div>

      {/* Goals */}
      <div className="settings-section">
        <div className="settings-section-title">🎯 目標設定</div>
        <div className="card" style={{ padding: 'var(--space-6)' }}>
          <div className="settings-group">
            <div className="settings-row">
              <div>
                <div className="settings-label">每日步數目標</div>
                <div className="settings-label-hint">建議值：8,000 – 12,000 步</div>
              </div>
              <input
                type="number"
                className="settings-input"
                value={settings.stepGoal}
                onChange={(e) => handleChange('stepGoal', Number(e.target.value))}
                min={1000}
                max={50000}
                step={500}
              />
            </div>
            <div className="settings-row">
              <div>
                <div className="settings-label">每日睡眠目標（小時）</div>
                <div className="settings-label-hint">建議值：7 – 9 小時</div>
              </div>
              <input
                type="number"
                className="settings-input"
                value={settings.sleepGoal}
                onChange={(e) => handleChange('sleepGoal', Number(e.target.value))}
                min={4}
                max={12}
                step={0.5}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Folder Watch */}
      <div className="settings-section">
        <div className="settings-section-title">📁 資料夾監控</div>
        <div className="card" style={{ padding: 'var(--space-6)' }}>
          <div className="settings-group">
            <div className="settings-row">
              <div>
                <div className="settings-label">監控路徑</div>
                <div className="settings-label-hint">Apple Health 匯出檔案目錄</div>
              </div>
              <input
                type="text"
                className="settings-input"
                placeholder="/path/to/apple_health_export"
                value={settings.watchPath}
                onChange={(e) => handleChange('watchPath', e.target.value)}
              />
            </div>
            <div className="settings-row">
              <div>
                <div className="settings-label">掃描間隔（秒）</div>
                <div className="settings-label-hint">設定自動掃描新檔案的頻率</div>
              </div>
              <input
                type="number"
                className="settings-input"
                value={settings.scanInterval}
                onChange={(e) => handleChange('scanInterval', Number(e.target.value))}
                min={10}
                max={3600}
                step={10}
              />
            </div>
            <div className="settings-row">
              <div>
                <div className="settings-label">監控狀態</div>
                <div className="settings-label-hint">
                  {settings.watchEnabled ? '監控運行中' : '監控已停止'}
                </div>
              </div>
              <button
                className={`btn ${settings.watchEnabled ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleToggleWatch}
              >
                {settings.watchEnabled ? '⏹ 停止監控' : '▶ 啟動監控'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="settings-section">
        <div className="settings-section-title">🗄️ 資料管理</div>
        <div className="card" style={{ padding: 'var(--space-6)' }}>
          <div className="settings-group">
            <div className="settings-row">
              <div className="settings-label">資料庫大小</div>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {dbInfo?.dbSize || '—'}
              </span>
            </div>
            <div className="settings-row">
              <div className="settings-label">總紀錄數</div>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {dbInfo?.totalRecords != null
                  ? Number(dbInfo.totalRecords).toLocaleString()
                  : '—'}
              </span>
            </div>
            <div className="settings-row">
              <div>
                <div className="settings-label">清除所有資料</div>
                <div className="settings-label-hint" style={{ color: 'var(--status-error)' }}>
                  此操作無法復原
                </div>
              </div>
              <button className="btn btn-danger" onClick={handleClear}>
                {confirmClear ? '⚠ 確認清除？再按一次' : '🗑️ 清除資料'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
