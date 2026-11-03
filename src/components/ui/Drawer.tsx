'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './Button';

/**
 * Right-side drawer built on <dialog> (native focus trap + Esc + inert background).
 * Opaque surface, left hairline — no blur, no shadow.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="fixed inset-y-0 right-0 left-auto m-0 h-full max-h-none w-full max-w-[640px] border-0 border-l border-rule-strong bg-surface p-0 text-body backdrop:bg-black/80"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-rule bg-surface px-6 py-4">
        <h2 className="label text-fg">{title}</h2>
        <IconButton label="Close" onClick={onClose}>
          <X size={16} strokeWidth={1.5} aria-hidden />
        </IconButton>
      </div>
      <div className="px-6 py-6">{children}</div>
    </dialog>
  );
}
