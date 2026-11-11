import { useMemo } from 'react';
import { useLocalization } from '../../packages/react/src/localization/LocalizationContext';
import { createDesktopLocalization } from '../shared/localization';

export function useDesktopLocalization() {
  const { locale, direction, messages } = useLocalization();
  return useMemo(
    () => createDesktopLocalization({ locale, direction, messages }),
    [locale, direction, messages]
  );
}
