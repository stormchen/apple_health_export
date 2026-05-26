'use client';

import { useState, useCallback } from 'react';
import FileUploader from '@/components/Import/FileUploader';
import ImportHistory from '@/components/Import/ImportHistory';

export default function ImportPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleComplete = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">資料匯入</h1>
      </div>

      {/* Upload Area */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <FileUploader onComplete={handleComplete} />
      </div>

      {/* Import History */}
      <div>
        <h2
          style={{
            fontSize: 'var(--text-xl)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 600,
            marginBottom: 'var(--space-5)',
          }}
        >
          📋 匯入歷史
        </h2>
        <ImportHistory refreshKey={refreshKey} />
      </div>
    </div>
  );
}
