// Runtime composition depends on pure definitions. URL/ref parsing never imports providers.
import { FORGE_DEFINITIONS } from './forge-definitions';
import { createGitHubProvider } from './github-provider';
import { createGitLabProvider } from './gitlab-provider';
import type { ForgeCommandRunner, ForgeName, ForgeProvider } from './forge-provider';

const factories = {
  gitlab: createGitLabProvider,
  github: createGitHubProvider,
} satisfies Record<ForgeName, (runner: ForgeCommandRunner) => ForgeProvider>;

// Derive the order and URL/ref metadata from the same definitions used by pure consumers.
export const FORGE_CATALOG = Object.fromEntries(
  (Object.keys(FORGE_DEFINITIONS) as ForgeName[]).map(forge => [
    forge,
    { ...FORGE_DEFINITIONS[forge], createProvider: factories[forge] },
  ])
) as Readonly<
  Record<
    ForgeName,
    (typeof FORGE_DEFINITIONS)[ForgeName] & {
      createProvider: (runner: ForgeCommandRunner) => ForgeProvider;
    }
  >
>;

export function createForgeProvider(forge: ForgeName, runner: ForgeCommandRunner): ForgeProvider {
  return FORGE_CATALOG[forge].createProvider(runner);
}
