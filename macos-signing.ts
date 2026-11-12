import type { ForgeConfig } from '@electron-forge/shared-types';
import { resolve } from 'node:path';

type SigningConfig = Pick<NonNullable<ForgeConfig['packagerConfig']>, 'osxSign' | 'osxNotarize'>;

/** Explicit release mode fails closed. Ordinary development and Linux need no Apple credentials. */
export function macosSigningOptions(
  platform = process.platform,
  environment: Readonly<Record<string, string | undefined>> = process.env
): SigningConfig {
  if (environment.SELF_REVIEW_MAC_RELEASE !== '1') return {};
  if (platform !== 'darwin') throw new Error('macOS release signing requires macOS.');
  const required = (name: string): string => {
    const value = environment[name];
    if (!value?.trim()) throw new Error(`macOS release requires ${name}.`);
    return value;
  };
  const identity = required('APPLE_SIGNING_IDENTITY');
  if (!identity.startsWith('Developer ID Application: '))
    throw new Error('macOS release requires a Developer ID Application identity.');
  return {
    osxSign: {
      identity,
      keychain: required('APPLE_SIGNING_KEYCHAIN'),
      type: 'distribution',
      preAutoEntitlements: false,
      optionsForFile: () => ({
        hardenedRuntime: true,
        entitlements: resolve(__dirname, 'assets/entitlements.darwin.plist'),
      }),
    },
    osxNotarize: {
      appleId: required('APPLE_ID'),
      appleIdPassword: required('APPLE_APP_SPECIFIC_PASSWORD'),
      teamId: required('APPLE_TEAM_ID'),
    },
  };
}
