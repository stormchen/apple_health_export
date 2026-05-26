'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const NAV_ITEMS = [
  { href: '/', icon: '📊', label: '儀表板' },
  { href: '/import', icon: '📥', label: '資料匯入' },
  { href: '/analysis', icon: '🔍', label: '深入分析' },
  { href: '/settings', icon: '⚙️', label: '設定' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="sidebar-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label="選單"
      >
        {open ? '✕' : '☰'}
      </button>

      {/* Overlay for mobile */}
      <div
        className={`sidebar-overlay ${open ? 'open' : ''}`}
        onClick={() => setOpen(false)}
      />

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">⚕</div>
          <span className="sidebar-brand-text">HealthLens</span>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-nav-item ${isActive(item.href) ? 'active' : ''}`}
              onClick={() => setOpen(false)}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span className="sidebar-nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-footer-item">
            <span>上次匯入</span>
            <span className="sidebar-footer-value">
              {stats?.lastImport
                ? new Date(stats.lastImport).toLocaleDateString('zh-TW')
                : '—'}
            </span>
          </div>
          <div className="sidebar-footer-item">
            <span>資料筆數</span>
            <span className="sidebar-footer-value">
              {stats?.totalRecords
                ? Number(stats.totalRecords).toLocaleString()
                : '—'}
            </span>
          </div>
          <div className="sidebar-footer-item">
            <span>資料庫大小</span>
            <span className="sidebar-footer-value">
              {stats?.dbSize || '—'}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
