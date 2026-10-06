// src/components/pdf/PDFPagePreview.tsx
// PDF page inline preview on citation hover — Section 3.1
// Uses pdfjs-dist to render a specific page
'use client';
import { useEffect, useRef, useState } from 'react';

interface PDFPagePreviewProps {
  storageUrl: string;   // Signed URL from Supabase Storage
  pageNum: number;
  passage?: string;     // Highlight passage (amber)
  width?: number;
}

export default function PDFPagePreview({ storageUrl, pageNum, passage, width = 320 }: PDFPagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!storageUrl || !canvasRef.current) return;

    let cancelled = false;

    async function renderPage() {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        // Use the worker from CDN (required by pdfjs)
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        const pdf = await pdfjsLib.getDocument(storageUrl).promise;
        const page = await pdf.getPage(pageNum);

        const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });

        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (!cancelled) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      }
    }

    renderPage();
    return () => { cancelled = true; };
  }, [storageUrl, pageNum, width]);

  return (
    <div style={{ position: 'relative', width, overflow: 'hidden', borderRadius: 'var(--r-md)' }}>
      {loading && (
        <div className="shimmer" style={{ width, height: 200 }} />
      )}
      {error && (
        <div style={{ padding: '12px', fontSize: 'var(--size-xs)', color: 'var(--error)' }}>
          Failed to load PDF preview
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{
          display: loading ? 'none' : 'block',
          width: '100%',
          height: 'auto',
        }}
      />
      {/* Passage highlight overlay — amber (Section 3.4) */}
      {passage && !loading && (
        <div style={{
          position: 'absolute',
          bottom: '8px',
          left: '8px',
          right: '8px',
          padding: '6px 8px',
          background: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: 'var(--r-sm)',
          fontSize: 'var(--size-xs)',
          color: 'var(--warning)',
          fontFamily: 'var(--font-mono)',
          lineHeight: 1.4,
        }}>
          "{passage.slice(0, 120)}{passage.length > 120 ? '…' : ''}"
        </div>
      )}
    </div>
  );
}
