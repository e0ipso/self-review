---
type: practice
title: Pin Nix fetchzip hashes to the unpacked directory
description: >-
  A fetchzip hash covers the unpacked tree, never the archive bytes;
  update-flake-hash.sh prefetches with --unpack.
tags:
  - nix
  - packaging
  - flake
  - build
kk_schema_version: 3
kk_id: practice-pin-nix-fetchzip-hashes-to-the-unpacked-directory
kk_derived_from: []
kk_relates_to:
  - practice-upload-release-zips-using-the-makerzip-filenames
kk_depends_on: []
kk_confidence: high
---
The `src = pkgs.fetchzip { ... }` in `flake.nix` pins the hash of the *unpacked* directory, not the hash
of the downloaded archive. Two zips built from identical content differ byte for byte and so hash
differently as archives, while both unpack to the same tree; an archive hash can therefore never satisfy
the check, no matter how many times it is re-prefetched. Tell the two apart with
`nix store prefetch-file --hash-type sha256 --json <url>` run both with and without `--unpack`: the
values differ, and only the `--unpack` one belongs in `flake.nix`. The digest also depends on
`stripRoot`, which is why the flake sets it explicitly instead of leaning on the default.

`scripts/update-flake-hash.sh <nix-system>` is the supported way to refresh it. It prefetches both ways,
refuses to write when they match, rewrites the single `hash = "sha256-...";` line, and then runs
`nix build` on the source derivation so the fixed-output check itself confirms the new hash.

<!-- kk:related:start -->
# Related

- Related: [practice-upload-release-zips-using-the-makerzip-filenames](/engineering/practice-upload-release-zips-using-the-makerzip-filenames.md)
<!-- kk:related:end -->
