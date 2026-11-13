import { expect, it } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import { macosSigningOptions } from '../../macos-signing';

const credentials = {
  SELF_REVIEW_MAC_RELEASE: '1',
  APPLE_SIGNING_IDENTITY: 'Developer ID Application: Example (TEAM)',
  APPLE_SIGNING_KEYCHAIN: '/temporary/signing.keychain-db',
  APPLE_ID: 'example@example.test',
  APPLE_APP_SPECIFIC_PASSWORD: 'test-only',
  APPLE_TEAM_ID: 'TEAM',
};
it('leaves unsigned development usable and requires complete credentials for macOS releases', () => {
  expect(macosSigningOptions('linux', {})).toEqual({});
  expect(macosSigningOptions('darwin', {})).toEqual({});
  expect(() => macosSigningOptions('linux', credentials)).toThrow(/requires macOS/);
  for (const name of Object.keys(credentials).filter(name => name !== 'SELF_REVIEW_MAC_RELEASE')) {
    expect(() => macosSigningOptions('darwin', { ...credentials, [name]: '' })).toThrow(name);
  }
  expect(() =>
    macosSigningOptions('darwin', { ...credentials, APPLE_SIGNING_IDENTITY: '-' })
  ).toThrow(/Developer ID/);
  const options = macosSigningOptions('darwin', credentials);
  expect(options.osxNotarize).toEqual({
    appleId: credentials.APPLE_ID,
    appleIdPassword: credentials.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: credentials.APPLE_TEAM_ID,
  });
  expect(options.osxSign).toMatchObject({
    identity: credentials.APPLE_SIGNING_IDENTITY,
    keychain: credentials.APPLE_SIGNING_KEYCHAIN,
    preAutoEntitlements: false,
  });
  if (!options.osxSign || options.osxSign === true)
    throw new Error('Missing signing configuration');
  const perFile = options.osxSign.optionsForFile!('Self Review.app');
  expect(perFile.hardenedRuntime).toBe(true);
  expect(readFileSync(perFile.entitlements as string, 'utf8')).toContain(
    'com.apple.security.cs.allow-jit'
  );
  expect(readFileSync(perFile.entitlements as string, 'utf8')).not.toMatch(
    /camera|audio|usb|disable-library|unsigned-executable/
  );
});

interface Step {
  name?: string;
  run?: string;
  uses?: string;
  env?: Record<string, string>;
  if?: string;
}
const workflow = parse(readFileSync(resolve('.github/workflows/release-darwin.yml'), 'utf8')) as {
  jobs: { build: { steps: Step[] }; upload: { needs: string } };
};
const steps = workflow.jobs.build.steps;
const verification =
  steps.find(step => step.name === 'Verify the archive contents')?.run ?? 'exit 99';
it('builds without Apple credentials and verifies archives before making them available to upload', () => {
  expect(steps.find(step => step.name === 'Build unsigned macOS package')?.run).toBe(
    'npm run make'
  );
  expect(steps.some(step => step.env?.SELF_REVIEW_MAC_RELEASE === '1')).toBe(false);
  expect(JSON.stringify(steps)).not.toContain('secrets.APPLE_');
  const verifyAt = steps.findIndex(step => step.run === verification);
  const uploadAt = steps.findIndex(step => step.uses?.startsWith('actions/upload-artifact@'));
  expect(verifyAt).toBeGreaterThan(0);
  expect(uploadAt).toBeGreaterThan(verifyAt);
  expect(steps[uploadAt].if).toBeUndefined();
  expect(workflow.jobs.upload.needs).toBe('build');
  for (const step of steps.filter(step => step.run)) {
    expect(spawnSync('bash', ['-n'], { input: step.run, encoding: 'utf8' }).status).toBe(0);
  }
});

it.each([
  'valid',
  'missing-archive',
  'missing-application',
  'multiple-applications',
  'missing-executable',
  'non-executable',
  'ditto',
  'plutil',
])('validates unsigned archive contents: %s', fixture => {
  const root = mkdtempSync(join(tmpdir(), 'macos-archive-'));
  try {
    mkdirSync(join(root, 'bin'));
    mkdirSync(join(root, 'out/make/zip/darwin/arm64'), { recursive: true });
    if (fixture !== 'missing-archive') {
      writeFileSync(join(root, 'out/make/zip/darwin/arm64/app.zip'), 'controlled archive');
    }
    const app = join(root, 'fixture/Self Review.app/Contents');
    mkdirSync(join(app, 'MacOS'), { recursive: true });
    writeFileSync(join(app, 'Info.plist'), 'controlled plist');
    if (fixture !== 'missing-executable') {
      writeFileSync(join(app, 'MacOS/Self Review'), '#!/bin/sh\nexit 0\n', {
        mode: fixture === 'non-executable' ? 0o600 : 0o700,
      });
    }
    for (const tool of ['ditto', 'plutil']) {
      writeFileSync(
        join(root, 'bin', tool),
        `#!/bin/bash
set -e
if [ "$FIXTURE" = "${tool}" ]; then exit 1; fi
${
  tool === 'ditto'
    ? `mkdir -p "$4"
if [ "$FIXTURE" != 'missing-application' ]; then cp -R "$FIXTURE_APPS/Self Review.app" "$4/"; fi
if [ "$FIXTURE" = 'multiple-applications' ]; then mkdir -p "$4/Other.app"; fi`
    : 'test -f "$6"\nprintf "Self Review\\n"'
}
`,
        { mode: 0o700 }
      );
    }
    const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', verification], {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${root}/bin:${process.env.PATH}`,
        RUNNER_TEMP: root,
        FIXTURE: fixture,
        FIXTURE_APPS: join(root, 'fixture'),
      },
      encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(fixture === 'valid' ? 0 : 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
