import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.dirname(fileURLToPath(import.meta.url));
function sources(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory()
      ? sources(full)
      : /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.')
        ? [full]
        : [];
  });
}
describe('browser package boundaries', () => {
  it('keeps runtime imports browser-safe and free of internal cycles', () => {
    const configRoot = path.resolve(root, '../../config/src');
    const files = [...sources(root), ...sources(configRoot)];
    const edges = new Map<string, string[]>();
    const forbidden = new Set([
      ...builtinModules,
      ...builtinModules.map(name => `node:${name}`),
      'electron',
      '@self-review/core',
    ]);
    const errors: string[] = [];
    for (const file of files) {
      const parsed = ts.createSourceFile(
        file,
        fs.readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true
      );
      const imports: string[] = [];
      const visit = (node: ts.Node) => {
        if (
          ts.isExportDeclaration(node) &&
          !node.isTypeOnly &&
          node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier)
        )
          imports.push(node.moduleSpecifier.text);
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          const clause = node.importClause;
          const typeOnly =
            clause?.isTypeOnly ||
            (clause?.namedBindings &&
              ts.isNamedImports(clause.namedBindings) &&
              !clause.name &&
              clause.namedBindings.elements.every(binding => binding.isTypeOnly));
          if (!typeOnly) imports.push(node.moduleSpecifier.text);
        }
        if (
          ts.isCallExpression(node) &&
          node.expression.kind === ts.SyntaxKind.ImportKeyword &&
          ts.isStringLiteral(node.arguments[0])
        )
          imports.push(node.arguments[0].text);
        ts.forEachChild(node, visit);
      };
      visit(parsed);
      const dependencies: string[] = [];
      for (const specifier of imports) {
        if (forbidden.has(specifier) || specifier.startsWith('@self-review/core/'))
          errors.push(`${path.relative(root, file)} imports ${specifier}`);
        if (!specifier.startsWith('.')) continue;
        const target = path.resolve(path.dirname(file), specifier);
        if (!target.startsWith(root + path.sep) && !target.startsWith(configRoot + path.sep))
          errors.push(`${file} crosses package boundary: ${specifier}`);
        const resolved = [
          target,
          target + '.ts',
          target + '.tsx',
          path.join(target, 'index.ts'),
        ].find(candidate => files.includes(candidate));
        if (resolved) dependencies.push(resolved);
      }
      edges.set(file, dependencies);
    }
    const visited = new Set<string>();
    const active = new Set<string>();
    function walk(file: string) {
      if (active.has(file)) {
        errors.push(`Runtime import cycle: ${path.relative(root, file)}`);
        return;
      }
      if (visited.has(file)) return;
      active.add(file);
      edges.get(file)?.forEach(walk);
      active.delete(file);
      visited.add(file);
    }
    files.forEach(walk);
    expect(errors).toEqual([]);
  });
});
