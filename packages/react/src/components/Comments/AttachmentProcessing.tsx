import React, { createContext, useContext } from 'react';
import type { ImageIngestion } from '../../hooks/useImageAttachments';
import { useLocalization } from '../../localization/LocalizationContext';
import { Button } from '../ui/button';

export const AttachmentProcessingContext = createContext<ImageIngestion | null>(null);
export const useAttachmentProcessing = () => useContext(AttachmentProcessingContext);

export function AttachmentProcessingStatus({ ingestion }: { ingestion: ImageIngestion }) {
  const { t } = useLocalization();
  const reasons = {
    size: 'Image exceeds the 10 MiB file limit.',
    dimensions: 'Image exceeds the 16 megapixel or 8192 pixel dimension limit.',
    format: 'Use PNG, JPEG, GIF, WebP, BMP or ICO with a readable raster header.',
    decode: 'Image could not be decoded.',
  } as const;
  return (
    <div className='px-3 text-xs'>
      {ingestion.selectionError && (
        <p role='alert'>
          {t('Choose at most {count} images totaling at most {size} MiB.', { count: 8, size: 30 })}
        </p>
      )}
      {ingestion.jobs.map(job => (
        <div key={job.id} className='flex items-center gap-2 py-1'>
          <span role={job.status === 'error' ? 'alert' : 'status'}>
            {job.status === 'error'
              ? t('Attachment failed: {name}. {detail}', {
                  name: 'name' in job.file ? job.file.name : t('Pasted image'),
                  detail: t(reasons[job.error ?? 'decode']),
                })
              : t('Preparing attachment: {name}', {
                  name: 'name' in job.file ? job.file.name : t('Pasted image'),
                })}
          </span>
          {job.status === 'error' && (
            <Button size='sm' variant='outline' onClick={() => ingestion.retry(job.id)}>
              {t('Retry')}
            </Button>
          )}
          <Button size='sm' variant='ghost' onClick={() => ingestion.dismiss(job.id)}>
            {t('Dismiss')}
          </Button>
        </div>
      ))}
    </div>
  );
}
