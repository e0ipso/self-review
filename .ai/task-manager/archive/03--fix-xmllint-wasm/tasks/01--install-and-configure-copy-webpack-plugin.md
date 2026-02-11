---
id: 1
group: "build-config"
dependencies: []
status: "completed"
created: 2026-02-11
skills:
  - webpack-configuration
  - npm-package-management
---
# Install copy-webpack-plugin and Configure Webpack to Copy xmllint.wasm

## Objective
Install `copy-webpack-plugin` as a devDependency and add a `CopyWebpackPlugin` entry to `webpack.main.config.ts` that copies `xmllint.wasm` from `node_modules/xmllint-wasm/` to the `.webpack/main/native_modules/` output directory during build.

## Skills Required
- webpack-configuration: Adding plugins to webpack config
- npm-package-management: Installing npm packages

## Acceptance Criteria
- [ ] `copy-webpack-plugin` is listed in `devDependencies` in `package.json`
- [ ] `webpack.main.config.ts` imports `CopyWebpackPlugin` from `copy-webpack-plugin`
- [ ] `CopyWebpackPlugin` is configured with `from: node_modules/xmllint-wasm/xmllint.wasm` and `to: native_modules/xmllint.wasm`
- [ ] The plugin is added to the `plugins` array in `webpack.main.config.ts` (spreading the existing shared plugins)
- [ ] Build completes without errors (`npm run package` or `electron-forge start`)

## Technical Requirements
- Use `copy-webpack-plugin` (latest version, webpack 5 compatible)
- The `from` path should resolve `xmllint.wasm` from `node_modules/xmllint-wasm/`
- The `to` path should be `native_modules/xmllint.wasm` (relative to webpack output directory)
- Add the plugin to `webpack.main.config.ts` only (not the shared `webpack.plugins.ts`), since xmllint is only used in the main process
- The existing `plugins` import from `./webpack.plugins` must be spread into the new array

## Input Dependencies
None

## Output Artifacts
- Updated `package.json` with `copy-webpack-plugin` in devDependencies
- Updated `webpack.main.config.ts` with CopyWebpackPlugin configuration
- `xmllint.wasm` present at `.webpack/main/native_modules/xmllint.wasm` after build

## Implementation Notes
- Run `npm install --save-dev copy-webpack-plugin` to install
- In `webpack.main.config.ts`, import CopyWebpackPlugin and change `plugins` from directly using the shared array to spreading it plus the new plugin:
  ```ts
  import CopyWebpackPlugin from 'copy-webpack-plugin';
  // ...
  plugins: [
    ...plugins,
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'node_modules/xmllint-wasm/xmllint.wasm',
          to: 'native_modules/xmllint.wasm',
        },
      ],
    }),
  ],
  ```
