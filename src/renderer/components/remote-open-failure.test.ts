import { expect, it, vi } from 'vitest';
import { createDesktopLocalization } from '../../shared/localization';
import { remoteOpenFailure } from './remote-open-failure';

it.each(['en', 'es'])(
  'keeps unknown forge text literal and bounds/redacts diagnostics in %s',
  locale => {
    const t = vi.fn(createDesktopLocalization({ locale }).t);
    const message = 'gh failed: {token_name} <img src=x onerror=alert(1)>';
    expect(remoteOpenFailure(message, t)).toBe(message);
    expect(t).not.toHaveBeenCalled();
    expect(
      remoteOpenFailure('git https://user:password@forge.test/repo?access_token=secret failed', t)
    ).toBe('git https://[redacted]@forge.test/repo?access_token=[redacted] failed');
    expect(remoteOpenFailure('Authorization: Bearer secret', t)).toBe('Authorization: [redacted]');
    expect(remoteOpenFailure('x'.repeat(5000), t)).toHaveLength(2048);
  }
);
it.each(['en', 'es'])('translates only exact application cancellation reasons in %s', locale => {
  const local = createDesktopLocalization({ locale });
  const prefix = 'Opening the PR/MR was cancelled: ';
  for (const reason of [
    'the review window closed',
    'opening the PR/MR took longer than 10 minutes',
    'The desktop operation timed out.',
  ]) {
    expect(remoteOpenFailure(prefix + reason, local.t)).toBe(
      `${local.t('Opening the PR/MR was cancelled.')} ${local.t(reason)}`
    );
  }
  expect(remoteOpenFailure(prefix + 'git clone failed {external}', local.t)).toBe(
    `${local.t('Opening the PR/MR was cancelled.')} git clone failed {external}`
  );
});
it('does not translate an external message merely containing application wording', () => {
  const local = createDesktopLocalization({ locale: 'es' });
  const message = 'Forge says: Review cancelled. {remote_data}';
  expect(remoteOpenFailure(message, local.t)).toBe(message);
});
