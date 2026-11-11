// Pure forge URL and snapshot-ref rules, shared by URL parsing and materialization.
// GitLab is matched first because namespaces can contain arbitrary nested path segments.
import type { ForgeName } from './forge-provider';

interface ForgeDefinition {
  urlPath: RegExp;
  headRef: (number: number) => string;
}

// The number terminates its path segment; suffixes such as /files remain supported.
export const FORGE_DEFINITIONS: Readonly<Record<ForgeName, ForgeDefinition>> = {
  gitlab: {
    urlPath: /^\/(.+)\/([^/]+)\/-\/merge_requests\/(\d+)(?=\/|$)/,
    headRef: number => `refs/merge-requests/${number}/head`,
  },
  github: {
    urlPath: /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?=\/|$)/,
    headRef: number => `refs/pull/${number}/head`,
  },
};
