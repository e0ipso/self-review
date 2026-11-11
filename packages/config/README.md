# @self-review/config

Browser-safe default configuration shared by the Node loader and React providers. It imports only
shared types and performs no I/O. `createDefaultConfig()` returns a mutable `AppConfig` with its own
ignore array, category array and category objects. `cloneConfig(config)` copies that same nested
structure before a consumer retains caller-supplied configuration.

The internal template is frozen. The exported `DEFAULT_CONFIG`, `DEFAULT_CATEGORIES`,
`DEFAULT_IGNORE_PATTERNS` and numeric defaults preserve the existing React compatibility values and
types. The object and array exports remain mutable at runtime, but factories never read those
snapshots, so changing them does not change future configurations.

Core and React import this package's source relatively, as the desktop workspace does, and tsup
bundles that browser-safe source into each published package. Their runtime output does not depend
on React for configuration or require this package to have been built first during development. This
package also publishes ESM, CommonJS and declarations for direct consumers. The root package build
orders types, config, core, then React; package type checks include config.
