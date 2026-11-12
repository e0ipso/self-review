// Browser-safe endpoint decoders. Check consumed DTO fields without pruning
// extension metadata or adding source, hunk, line or byte limits.
import type {
  AppConfig,
  DiffHunk,
  DiffLoadPayload,
  ExpandContextResponse,
  GuideLoadPayload,
  ImageLoadResult,
  ResumeLoadPayload,
} from '@self-review/types';
import type { ConfigApiResponse } from './adapter';
import { isRecord } from './json-client';
import { ServeRequestError } from './request-error';

type Check = (value: unknown) => boolean;
const string: Check = value => typeof value === 'string';
const boolean: Check = value => typeof value === 'boolean';
const number: Check = value => typeof value === 'number' && Number.isFinite(value);
const array =
  (check: Check): Check =>
  value =>
    Array.isArray(value) && value.every(check);
const nullable =
  (check: Check): Check =>
  value =>
    value === null || check(value);
const oneOf =
  (...values: string[]): Check =>
  value =>
    typeof value === 'string' && values.includes(value);
function fields(required: Record<string, Check>, optional: Record<string, Check> = {}): Check {
  const requiredFields = Object.entries(required);
  const optionalFields = Object.entries(optional);
  return value =>
    isRecord(value) &&
    requiredFields.every(([key, check]) => check(value[key])) &&
    optionalFields.every(([key, check]) => value[key] === undefined || check(value[key]));
}
const strings = array(string);
const changeType = oneOf('added', 'modified', 'deleted', 'renamed', 'copied');
const lineRange = fields({ side: oneOf('old', 'new'), start: number, end: number });
const suggestion = fields({ originalCode: string, proposedCode: string });
const attachment = fields({ id: string, fileName: string, mediaType: string });
const reply = fields(
  { id: string, body: string },
  { author: string, remoteId: string, attachments: array(attachment) }
);
const comment = fields(
  {
    id: string,
    filePath: string,
    lineRange: nullable(lineRange),
    body: string,
    category: string,
    suggestion: nullable(suggestion),
  },
  {
    author: string,
    remoteId: string,
    orphaned: boolean,
    severity: oneOf('critical', 'major', 'minor', 'info'),
    confidence: oneOf('high', 'medium', 'low'),
    attachments: array(attachment),
    replies: array(reply),
  }
);
const line = fields({
  type: oneOf('context', 'addition', 'deletion'),
  content: string,
  oldLineNumber: nullable(number),
  newLineNumber: nullable(number),
});
const hunk = fields({
  header: string,
  oldStart: number,
  oldLines: number,
  newStart: number,
  newLines: number,
  lines: array(line),
});
const hunks = array(hunk);
const file = fields(
  { oldPath: string, newPath: string, changeType, isBinary: boolean, hunks },
  {
    isUntracked: boolean,
    contentLoaded: boolean,
    omittedReason: string,
  }
);
const source: Check = value => {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case 'git':
      return string(value.gitDiffArgs) && string(value.repository);
    case 'directory':
    case 'file':
      return string(value.sourcePath);
    case 'welcome':
    case 'loading':
      return true;
    default:
      return false;
  }
};
const remote = fields({
  remoteUrl: string,
  remoteBaseSha: string,
  remoteHeadSha: string,
  remoteForge: oneOf('github', 'gitlab'),
  threadSyncAvailable: boolean,
  temporaryClone: boolean,
});
const diff = fields(
  { files: array(file), source },
  { isLargePayload: boolean, diagnostics: strings, remote }
);
const guideFile = fields({ path: string }, { description: string });
const guideGroup = fields(
  { name: string, implicit: boolean, files: array(guideFile) },
  { rationale: string }
);
const guide = fields({ groups: array(guideGroup) }, { overview: string });
const output = fields({ resolvedOutputPath: string, outputPathWritable: boolean });
const configFields: Record<keyof AppConfig, Check> = {
  theme: oneOf('light', 'dark', 'system'),
  diffView: oneOf('split', 'unified'),
  fontSize: number,
  outputFormat: string,
  outputFile: string,
  ignore: strings,
  categories: array(fields({ name: string, description: string, color: string })),
  defaultDiffArgs: string,
  showUntracked: boolean,
  showUntrackedExplicit: boolean,
  wordWrap: boolean,
  maxFiles: number,
  maxTotalLines: number,
  guideFile: string,
};
const { guideFile: optionalGuideFile, ...requiredConfig } = configFields;
const config = fields(requiredConfig, { guideFile: optionalGuideFile });
const resumed = fields(
  { comments: array(comment) },
  {
    viewedFiles: strings,
    importDiagnostics: strings,
    remoteDrift: fields({ recordedHeadSha: string, liveHeadSha: string, drifted: boolean }),
  }
);

function decoder<T>(endpoint: string, check: Check): (value: unknown) => T {
  return value => {
    if (!check(value))
      throw new ServeRequestError(`Malformed response from ${endpoint}`, {
        status: 200,
        code: 'malformed-read-response',
      });
    return value as T;
  };
}
export interface DiffApiResponse {
  diff: DiffLoadPayload;
  guide: GuideLoadPayload | null;
}
export const decodeDiffResponse = decoder<DiffApiResponse | null>(
  '/api/diff',
  nullable(fields({ diff, guide: nullable(guide) }))
);
export const decodeConfigResponse = decoder<ConfigApiResponse | null>(
  '/api/config',
  nullable(fields({ config, outputPathInfo: nullable(output) }))
);
export const decodeResumeResponse = decoder<ResumeLoadPayload | null>(
  '/api/resume',
  nullable(resumed)
);
export const decodeFileResponse = decoder<DiffHunk[] | null>('/api/file', nullable(hunks));
export const decodeContextResponse = decoder<ExpandContextResponse | null>(
  '/api/expand-context',
  nullable(fields({ hunks, totalLines: number }))
);
export const decodeImageResponse = decoder<ImageLoadResult>(
  '/api/image',
  value => fields({ dataUri: string })(value) || fields({ error: string })(value)
);
