import React from 'react';
import { useLocalization } from '../../localization/LocalizationContext';
import UnifiedView, { type UnifiedViewProps } from './UnifiedView';
import SplitView from './SplitView';

interface RawDiffContentProps extends UnifiedViewProps {
  viewMode: 'split' | 'unified';
}

/** Raw empty states and layout choice share exactly the raw views' interaction contract. */
export function RawDiffContent({ viewMode, ...props }: RawDiffContentProps) {
  const { t } = useLocalization();
  const { file } = props;
  if (file.isBinary)
    return (
      <div className='flex items-center justify-center py-12 text-sm text-muted-foreground'>
        {t('Binary file \u2014 no diff available')}
      </div>
    );
  if (file.hunks.length === 0 && file.contentLoaded !== false)
    return (
      <div className='flex items-center justify-center py-12 text-sm text-muted-foreground'>
        {t('No changes to display')}
      </div>
    );
  const View =
    viewMode === 'split' && file.changeType !== 'added' && file.changeType !== 'deleted'
      ? SplitView
      : UnifiedView;
  return <View {...props} />;
}
