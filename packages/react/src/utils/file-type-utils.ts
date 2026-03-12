/**
 * File-type detection utilities for the renderer.
 *
 * NOTE: This is intentionally duplicated from @self-review/core's file-type-utils.ts.
 * @self-review/core has Node-only dependencies (child_process, fs, xmllint-wasm),
 * so @self-review/react cannot import from it without pulling Node code into the
 * browser bundle. These functions are pure string manipulation with no dependencies,
 * making duplication the safest option over cross-package coupling.
 *
 * If you change the logic here, update the copy in packages/core/src/file-type-utils.ts too.
 */

const RASTER_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.ico', '.bmp']);

function getExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filePath.length - 1) return '';
  return filePath.slice(lastDot).toLowerCase();
}

export function isPreviewableImage(filePath: string): boolean {
  return RASTER_IMAGE_EXTENSIONS.has(getExtension(filePath));
}

export function isPreviewableSvg(filePath: string): boolean {
  return getExtension(filePath) === '.svg';
}

export function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    css: 'css',
    json: 'json',
    md: 'markdown',
    sh: 'bash',
    bash: 'bash',
    yml: 'yaml',
    yaml: 'yaml',
    java: 'java',
    go: 'go',
    rs: 'rust',
    sql: 'sql',
    html: 'markup',
    xml: 'markup',
    rb: 'ruby',
    php: 'php',
    twig: 'twig',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    // Config and data formats
    ini: 'ini',
    toml: 'toml',
    csv: 'csv',
    diff: 'diff',
    patch: 'diff',
    // Web and infrastructure
    scss: 'scss',
    sass: 'sass',
    graphql: 'graphql',
    gql: 'graphql',
    conf: 'nginx',
    // Database
    mongodb: 'mongodb',
    // Tooling
    makefile: 'makefile',
    mk: 'makefile',
    mak: 'makefile',
    vim: 'vim',
    vimrc: 'vim',
  };

  // Check for special filenames without extensions
  const filename = filePath.split('/').pop()?.toLowerCase() || '';
  if (filename === 'dockerfile' || filename.startsWith('dockerfile.')) {
    return 'docker';
  }
  if (filename === 'makefile' || filename.startsWith('makefile.')) {
    return 'makefile';
  }
  if (filename.startsWith('.git')) {
    return 'git';
  }
  if (filename === '.vimrc' || filename.startsWith('.vim')) {
    return 'vim';
  }

  return langMap[ext] || 'plaintext';
}
