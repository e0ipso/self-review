import React from 'react';
import { useLocalization } from '../localization/LocalizationContext';
import { useOutputPath } from '../context/ConfigContext';
import { useAdapter } from '../context/ReviewAdapterContext';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import TruncatedPath from './TruncatedPath';

export default function OutputPathControl() {
  const { t } = useLocalization();
  const { outputPathInfo, setOutputPathInfo } = useOutputPath();
  const adapter = useAdapter();
  const handleChangeOutputPath = async () => {
    if (!adapter?.changeOutputPath) return;
    const result = await adapter.changeOutputPath();
    if (result) setOutputPathInfo(result);
  };
  return (
    <>
      {/* Output Path Footer */}
      {outputPathInfo.resolvedOutputPath && (
        <>
          <Separator />
          <div className='px-3 py-2 space-y-1'>
            <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
              <span className='font-medium'>{t('Output:')}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TruncatedPath
                    path={outputPathInfo.resolvedOutputPath}
                    className='cursor-default'
                  />
                </TooltipTrigger>
                <TooltipContent side='right' className='max-w-sm'>
                  <p className='font-mono text-xs break-all'>{outputPathInfo.resolvedOutputPath}</p>
                </TooltipContent>
              </Tooltip>
              {outputPathInfo.outputPathWritable ? (
                <CheckCircle2 className='h-3.5 w-3.5 text-green-500 shrink-0' />
              ) : (
                <AlertCircle className='h-3.5 w-3.5 text-red-500 shrink-0' />
              )}
              {/* Only offered when the host can actually change the path. */}
              {adapter?.changeOutputPath && (
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-6 px-2 text-xs ms-auto'
                  onClick={handleChangeOutputPath}
                >
                  {t('Change...')}
                </Button>
              )}
            </div>
            {!outputPathInfo.outputPathWritable && (
              <p className='text-xs text-red-500'>{t('Path not writable')}</p>
            )}
          </div>
        </>
      )}
    </>
  );
}
