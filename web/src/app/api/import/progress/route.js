/**
 * 匯入進度 SSE 端點
 * GET /api/import/progress?importId=xxx
 * 使用 Server-Sent Events 即時推送匯入進度
 */

import { getProgress } from '@/lib/progress';

/**
 * SSE 串流端點 - 每秒發送匯入進度
 * @param {Request} request
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const importId = searchParams.get('importId');

  if (!importId) {
    return new Response(
      JSON.stringify({ error: '請提供 importId 參數' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 建立可讀取串流
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let intervalId;
      let closedByClient = false;

      // 每秒發送一次進度
      intervalId = setInterval(() => {
        if (closedByClient) {
          clearInterval(intervalId);
          return;
        }

        try {
          const progress = getProgress(Number(importId));

          if (!progress) {
            // 沒有進度資訊，發送未知狀態
            const data = JSON.stringify({
              importId: Number(importId),
              status: 'unknown',
              message: '找不到此匯入的進度資訊',
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            return;
          }

          // 發送進度資訊
          const data = JSON.stringify({
            importId: Number(importId),
            status: progress.status,
            current: progress.current || 0,
            total: progress.total || 0,
            imported: progress.imported || 0,
            skipped: progress.skipped || 0,
            percentage: progress.total > 0
              ? Math.round((progress.current / progress.total) * 100)
              : 0,
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));

          // 如果匯入已完成或失敗，發送最後一次後關閉串流
          if (progress.status === 'completed' || progress.status === 'failed') {
            clearInterval(intervalId);
            // 延遲一秒關閉，確保客戶端收到最終狀態
            setTimeout(() => {
              try {
                controller.close();
              } catch (e) {
                // 串流可能已關閉
              }
            }, 1000);
          }
        } catch (error) {
          console.error('SSE 進度推送錯誤:', error);
          clearInterval(intervalId);
          try {
            controller.close();
          } catch (e) {
            // 串流可能已關閉
          }
        }
      }, 1000);

      // 監聽客戶端斷線
      request.signal?.addEventListener('abort', () => {
        closedByClient = true;
        clearInterval(intervalId);
        try {
          controller.close();
        } catch (e) {
          // 串流可能已關閉
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
