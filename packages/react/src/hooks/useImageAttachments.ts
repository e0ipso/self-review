import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Attachment } from '@self-review/types';
import { useOptionalSnapshotKey, useOptionalApplySession } from '../context/ReviewContext';
import { ImageAttachmentError, processImageFile } from '../utils/image-utils';

export const ATTACHMENT_MAX_COUNT = 8;
export const ATTACHMENT_MAX_TOTAL_BYTES = 30 * 1024 * 1024;
export interface ImageJob {
  id: number;
  file: File | Blob;
  status: 'queued' | 'processing' | 'error';
  error?: ImageAttachmentError['code'];
}
interface Options {
  onAttach: (attachments: Attachment[]) => void;
  attachments?: Attachment[];
  owner?: string;
  onProcessingChange?: (pending: boolean) => void;
  process?: typeof processImageFile;
}

/** One decoder per composer; paste, drop and picker share results, limits and ownership. */
export function useImageAttachments({ process = processImageFile, ...options }: Options) {
  const snapshot = useOptionalSnapshotKey();
  const session = useOptionalApplySession();
  const callbacks = useRef({ ...options, isCurrent: session?.isCurrentSession });
  callbacks.current = { ...options, isCurrent: session?.isCurrentSession };
  const owner = useMemo(
    () => ({
      controller: new AbortController(),
      jobs: [] as ImageJob[],
      running: false,
      nextId: 0,
      delivered: [] as Attachment[],
    }),
    [snapshot, options.owner, process]
  );
  const currentOwner = useRef<typeof owner | null>(owner);
  currentOwner.current = owner;
  const [jobs, setJobs] = useState<ImageJob[]>([]);
  const [selectionError, setSelectionError] = useState(false);
  useLayoutEffect(() => {
    if (options.attachments) owner.delivered = [];
  }, [options.attachments, owner]);
  const current = () =>
    currentOwner.current === owner &&
    !owner.controller.signal.aborted &&
    (callbacks.current.isCurrent?.() ?? true);
  const publish = () => {
    if (!current()) return;
    setJobs([...owner.jobs]);
    callbacks.current.onProcessingChange?.(owner.jobs.some(job => job.status !== 'error'));
  };
  useLayoutEffect(() => {
    if (owner.controller.signal.aborted) owner.controller = new AbortController();
    currentOwner.current = owner;
    setJobs([]);
    setSelectionError(false);
    return () => {
      owner.controller.abort();
      owner.jobs = [];
      owner.running = false;
      if (currentOwner.current === owner) currentOwner.current = null;
      callbacks.current.onProcessingChange?.(false);
    };
  }, [owner]);

  const drain = async () => {
    if (owner.running || !current()) return;
    owner.running = true;
    const controller = owner.controller;
    const active = () => current() && controller === owner.controller;
    try {
      let job: ImageJob | undefined;
      while (active() && (job = owner.jobs.find(item => item.status === 'queued'))) {
        const id = job.id;
        owner.jobs = owner.jobs.map(item =>
          item.id === id ? { ...item, status: 'processing' } : item
        );
        publish();
        try {
          const attachment = await process(job.file, controller.signal);
          if (!active()) return;
          if (!owner.jobs.some(item => item.id === id)) continue;
          owner.jobs = owner.jobs.filter(item => item.id !== id);
          owner.delivered.push(attachment);
          callbacks.current.onAttach([attachment]);
        } catch (error) {
          if (!active()) return;
          owner.jobs = owner.jobs.map(item =>
            item.id === id
              ? {
                  ...item,
                  status: 'error',
                  error: error instanceof ImageAttachmentError ? error.code : 'decode',
                }
              : item
          );
        }
        publish();
      }
    } finally {
      if (controller === owner.controller) owner.running = false;
    }
  };
  const enqueue = (files: (File | Blob)[]) => {
    if (!current() || !files.length) return;
    const acknowledged = callbacks.current.attachments ?? [];
    const attached = [
      ...acknowledged,
      ...owner.delivered.filter(item => !acknowledged.some(existing => existing.id === item.id)),
    ];
    const bytes =
      attached.reduce((sum, item) => sum + (item.data?.byteLength ?? 0), 0) +
      owner.jobs.reduce((sum, item) => sum + item.file.size, 0) +
      files.reduce((sum, file) => sum + file.size, 0);
    if (
      attached.length + owner.jobs.length + files.length > ATTACHMENT_MAX_COUNT ||
      bytes > ATTACHMENT_MAX_TOTAL_BYTES
    ) {
      setSelectionError(true);
      return;
    }
    setSelectionError(false);
    owner.jobs.push(
      ...files.map(file => ({ file, id: ++owner.nextId, status: 'queued' as const }))
    );
    publish();
    void drain();
  };
  const retry = (id: number) => {
    if (!current()) return;
    owner.jobs = owner.jobs.map(job =>
      job.id === id && job.status === 'error' ? { ...job, status: 'queued', error: undefined } : job
    );
    publish();
    void drain();
  };
  const dismiss = (id: number) => {
    owner.jobs = owner.jobs.filter(job => job.id !== id);
    publish();
  };
  return {
    enqueue,
    retry,
    dismiss,
    jobs,
    selectionError,
    pending: jobs.some(job => job.status !== 'error'),
  };
}
export type ImageIngestion = ReturnType<typeof useImageAttachments>;
