// src/components/upload/DropZone.tsx
// react-dropzone + anime.js marching ants on drag-over — Section 3.3
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';
import { useFileStore } from '@/store/useFileStore';

const FILE_PILLS = ['PDF', 'PPTX', 'DOCX', 'PNG', 'JPG', 'MP3', 'MP4', 'XLSX'];

const ACCEPT_MAP = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'audio/mpeg': ['.mp3'],
  'video/mp4': ['.mp4'],
};

export function DropZone() {
  const uploadFile    = useFileStore((s) => s.uploadFile);
  const [isDragOver, setIsDragOver] = useState(false);
  const svgRectRef    = useRef<SVGRectElement | null>(null);
  const animeRef      = useRef<any>(null);
  const containerRef  = useRef<HTMLDivElement | null>(null);

  // Lazy-load anime.js using the correct entry point
  const getAnime = useCallback(async () => {
    try {
      // animejs v3 entry point
      const mod = await import('animejs');
      return (mod as any).default ?? mod;
    } catch {
      // Fallback: CSS animation via style mutation (no anime.js)
      return null;
    }
  }, []);


  // Start marching ants when dragging
  useEffect(() => {
    let animation: any = null;

    if (isDragOver && svgRectRef.current) {
      getAnime().then((anime) => {
        if (!anime) return;
        animation = anime({
          targets: svgRectRef.current,
          strokeDashoffset: [0, -20],
          duration: 500,
          easing: 'linear',
          loop: true,
        });
        animeRef.current = animation;
      });
    } else {
      animeRef.current?.pause();
    }

    return () => {
      animation?.pause();
    };
  }, [isDragOver, getAnime]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setIsDragOver(false);

      // Ripple animation
      if (containerRef.current) {
        const anime = await getAnime();
        if (anime) {
          const ripple = document.createElement('div');
          ripple.style.cssText = `
            position:absolute; inset:0; margin:auto;
            width:60px; height:60px; border-radius:50%;
            background:var(--accent-dim);
            pointer-events:none;
          `;
          containerRef.current.appendChild(ripple);
          anime({
            targets: ripple,
            scale: [0, 4],
            opacity: [0.6, 0],
            duration: 600,
            easing: 'easeOutQuart',
            complete: () => ripple.remove(),
          });
        }
      }

      for (const file of acceptedFiles) {
        uploadFile(file);
      }
    },
    [uploadFile, getAnime]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: ACCEPT_MAP,
    multiple: true,
    onDragEnter: () => setIsDragOver(true),
    onDragLeave: () => setIsDragOver(false),
  });

  // SVG rect dimensions match the container (180px tall, full width)
  const W = 600;
  const H = 180;
  const DASH = 8;
  const perimeter = 2 * (W + H);

  return (
    <div
      ref={containerRef}
      {...getRootProps()}
      style={{
        position: 'relative',
        width: '100%',
        height: '180px',
        borderRadius: 'var(--r-lg)',
        background: 'var(--bg-surface)',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'background var(--dur-base)',
        ...(isDragOver && { background: 'var(--accent-dim)' }),
      }}
    >
      <input {...getInputProps()} />

      {/* SVG marching ants border */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
      >
        <rect
          ref={svgRectRef}
          x="1"
          y="1"
          width={W - 2}
          height={H - 2}
          rx="11"
          fill="none"
          stroke={isDragOver ? 'var(--accent-light)' : 'var(--border-hover)'}
          strokeWidth={isDragOver ? 1.5 : 1}
          strokeDasharray={`${DASH} ${DASH}`}
          strokeDashoffset="0"
          style={{ transition: 'stroke var(--dur-base)' }}
        />
      </svg>

      {/* Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: '12px',
          pointerEvents: 'none',
          padding: '0 24px',
        }}
      >
        <UploadCloud
          size={28}
          color={isDragOver ? 'var(--accent-light)' : 'var(--text-3)'}
          style={{ transition: 'color var(--dur-base)' }}
        />
        <p
          style={{
            fontSize: 'var(--size-sm)',
            color: isDragOver ? 'var(--accent-light)' : 'var(--text-2)',
            textAlign: 'center',
            transition: 'color var(--dur-base)',
          }}
        >
          Drop PDFs, PPTs, images, audio, Word docs here
        </p>

        {/* File type pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
          {FILE_PILLS.map((ext) => (
            <span
              key={ext}
              style={{
                padding: '2px 8px',
                borderRadius: 'var(--r-full)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-3)',
                fontSize: 'var(--size-xs)',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {ext}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
