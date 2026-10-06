// src/components/upload/ProcessingQueue.tsx
// Animated list of FileCards — Section 3.3
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useFileStore } from '@/store/useFileStore';
import { FileCard } from '@/components/upload/FileCard';
import { STAGGER_CHILDREN, STAGGER_ITEM } from '@/lib/variants';
import type { Document, UploadingFile } from '@/types';

export function ProcessingQueue() {
  const uploadingFiles = useFileStore((s) => s.uploadingFiles);
  const documents      = useFileStore((s) => s.documents);

  const hasItems = uploadingFiles.length > 0 || documents.length > 0;

  if (!hasItems) return null;

  return (
    <div style={{ marginTop: '16px' }}>
      <p
        style={{
          fontSize: 'var(--size-xs)',
          color: 'var(--text-3)',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: '8px',
        }}
      >
        {uploadingFiles.length + documents.length} file
        {uploadingFiles.length + documents.length !== 1 ? 's' : ''}
      </p>

      <motion.div
        variants={STAGGER_CHILDREN}
        initial="initial"
        animate="animate"
        style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
      >
        <AnimatePresence initial={false}>
          {/* Uploading files first */}
          {uploadingFiles.map((f: UploadingFile) => (
            <motion.div key={f.id} variants={STAGGER_ITEM}>
              <FileCard item={f} />
            </motion.div>
          ))}

          {/* Processed docs */}
          {documents.map((doc: Document) => (
            <motion.div key={doc.id} variants={STAGGER_ITEM}>
              <FileCard item={doc} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
