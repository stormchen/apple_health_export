'use client';

import { useState, useRef, useCallback } from 'react';

const ACCEPTED = '.xml,.zip';
const MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function FileUploader({ onComplete }) {
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | uploading | processing | done | error
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [fileName, setFileName] = useState('');
  const inputRef = useRef(null);
  const sseRef = useRef(null);

  const handleFile = useCallback(
    async (file) => {
      if (!file) return;

      if (file.size > MAX_SIZE) {
        setStatus('error');
        setMessage(`檔案過大（${formatBytes(file.size)}），最大支援 2 GB`);
        return;
      }

      setFileName(file.name);
      setStatus('uploading');
      setProgress(0);
      setMessage('正在上傳檔案…');

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/import', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || '上傳失敗');
        }

        const result = await res.json();

        // If backend returned an importId, listen for progress via SSE
        if (result.importId) {
          setStatus('processing');
          setMessage('正在解析 Apple Health 資料…');
          listenProgress(result.importId);
        } else {
          setStatus('done');
          setProgress(100);
          setMessage(
            `匯入完成！共匯入 ${(result.imported ?? 0).toLocaleString()} 筆資料`
          );
          onComplete?.();
        }
      } catch (err) {
        setStatus('error');
        setMessage(err.message || '上傳時發生錯誤');
      }
    },
    [onComplete]
  );

  const listenProgress = (importId) => {
    if (sseRef.current) sseRef.current.close();

    const es = new EventSource(`/api/import/progress?importId=${importId}`);
    sseRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setProgress(data.percentage ?? 0);

        if (data.status === 'completed') {
          setStatus('done');
          setProgress(100);
          setMessage(`匯入完成！共匯入 ${(data.imported ?? 0).toLocaleString()} 筆資料`);
          es.close();
          onComplete?.();
        } else if (data.status === 'failed') {
          setStatus('error');
          setMessage(data.message || '匯入失敗');
          es.close();
        } else {
          setMessage(`正在解析資料：已掃描 ${data.current?.toLocaleString() || 0} 筆，已匯入 ${data.imported?.toLocaleString() || 0} 筆…`);
        }
      } catch (err) {
        console.error('解析 SSE 資料失敗:', err);
      }
    };

    es.onerror = () => {
      setStatus('error');
      setMessage('進度連線中斷');
      es.close();
    };
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    handleFile(file);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = () => setDragOver(false);

  const onClickSelect = () => {
    if (status === 'uploading' || status === 'processing') return;
    inputRef.current?.click();
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const reset = () => {
    setStatus('idle');
    setProgress(0);
    setMessage('');
    setFileName('');
  };

  const statusIcon = {
    idle: '📂',
    uploading: '⏳',
    processing: '⚙️',
    done: '✅',
    error: '❌',
  };

  return (
    <div
      className={`upload-zone glass-panel ${dragOver ? 'drag-over' : ''}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={onClickSelect}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="upload-zone-input"
        onChange={onFileChange}
      />

      <div className="upload-zone-icon">{statusIcon[status]}</div>

      {status === 'idle' && (
        <>
          <div className="upload-zone-title">拖放 Apple Health 匯出檔案到這裡</div>
          <div className="upload-zone-desc">
            支援 export.xml 或 export.zip 格式，最大 2 GB
          </div>
        </>
      )}

      {status !== 'idle' && (
        <>
          <div className="upload-zone-title">
            {fileName && <span style={{ opacity: 0.7 }}>{fileName}</span>}
          </div>
          <div className="upload-status">
            <span>{message}</span>
          </div>
          <div className="progress-bar-track" style={{ maxWidth: 400 }}>
            <div
              className="progress-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          {(status === 'done' || status === 'error') && (
            <button
              className="btn btn-secondary"
              style={{ marginTop: 'var(--space-4)' }}
              onClick={(e) => {
                e.stopPropagation();
                reset();
              }}
            >
              重新上傳
            </button>
          )}
        </>
      )}
    </div>
  );
}
