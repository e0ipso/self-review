# Homebrew tap: select the Linux artifact by architecture, and stop relying on a libstdc++ symlink only CI creates

Ready to submit to <https://github.com/e0ipso/homebrew-self-review>. Not yet submitted; SR-0031 could
not be finished from this repository, because the tap is a separate repository the drain must not
write to and this container has no Homebrew, no arm64 host and no display.

Drafted against tap `main` at `48c6f8cebf0733bf8cc420cc7b2ce627ab6f901f`, which was HEAD when this
was written (`gh api repos/e0ipso/homebrew-self-review/commits?per_page=5`).

## What is wrong

`Formula/self-review.rb` assumes x86-64 in four places, so an arm64 release artifact alone does not
make `brew install` work on Linux arm64:

- Line 4, the `url` names `Self.Review-linux-x64-<version>.zip` unconditionally.
- Line 24, `source_dir` looks for the extracted directory `Self Review-linux-x64`. An arm64 zip
  unpacks to `Self Review-linux-arm64`, the check fails, `source_dir` falls back to `"."`, and
  `libexec.install Dir["./*"]` then installs the wrapper directory instead of its contents. The
  patchelf call on the next line has no `libexec/self-review` to patch.
- Lines 29 and 30 put the Debian multiarch triplet `x86_64-linux-gnu` on the library path. The
  arm64 triplet is `aarch64-linux-gnu`.
- Lines 37 and 40 run and install `ld-linux-x86-64.so.2` as the interpreter. On arm64 the glibc
  loader is `ld-linux-aarch64.so.1`.

Issue 133 in the app repository reports the failure from a WSL2 Ubuntu 24.04 arm64 host, and its log
tail is the output of the line 37 command.

## The libstdc++.so.6 failure is separate from architecture

Issue 133 ends with `libstdc++.so.6: cannot open shared object file`. Selecting arm64 artifacts does
not answer that, so I measured where the library is needed.

Nothing this project ships needs it. I downloaded the published
`Self.Review-linux-x64-1.43.4.zip` (sha256
`60016c51aac709fb2e38272e17d81f72359d6cd4c0e69ccf395d081b0dcc9122`), found the 8 ELF files in it
(`self-review`, `chrome_crashpad_handler`, `chrome-sandbox`, `libEGL.so`, `libGLESv2.so`,
`libffmpeg.so`, `libvk_swiftshader.so`, `libvulkan.so.1`) and read their dynamic sections. None
declares `libstdc++.so.6` as NEEDED. Electron links its own C++ runtime statically. The app binary
lists 34 NEEDED entries, `libgcc_s.so.1` and `libc.so.6` among them, and no libstdc++.

Homebrew's `patchelf` does need it. I pulled the `x86_64_linux` bottle of patchelf 0.18.0 from
ghcr.io and read `bin/patchelf`:

```
NEEDED  libstdc++.so.6
NEEDED  libgcc_s.so.1
NEEDED  libc.so.6
```

with no RUNPATH and no RPATH entry. Line 37 runs that binary under
`ld-linux-x86-64.so.2 --library-path <explicit list>`, and an explicit `--library-path` replaces the
loader's default search path rather than adding to it. Homebrew keeps `libstdc++.so.6` under
`opt/gcc/lib/gcc/<n>/`, which is not on the list the formula builds. So the loader cannot find it
and patchelf fails before it patches anything.

That is also why tap commit `48c6f8ce` had to symlink
`$HOMEBREW_PREFIX/opt/gcc/lib/gcc/*/libstdc++.so.6` into `$HOMEBREW_PREFIX/lib` in
`.github/workflows/tests.yml`. `$HOMEBREW_PREFIX/lib` is on the formula's list, at line 27, so the
symlink makes CI pass. The formula declares no dependency that provides the library, so a user's
machine gets no such symlink. CI is green on a condition CI itself creates. That is the shape of a
bug that only ever reproduces for users.

What I cannot settle from here: issue 133's log names `/home/linuxbrew/.linuxbrew/bin/clang` as the
process that failed to load libstdc++, not `patchelf`. The reporter pasted the last 15 lines of
`01.ld-linux-x86-64.so.2.log`, so the head of that log, which would name the actual command, is cut
off. The missing-library mechanism above accounts for the error; the identity of the process does
not match it, and only the full log from an arm64 host settles the difference. Check 6 below
captures it.

## Formula change

Replace lines 4 and 5 with per-architecture blocks, and add gcc as a build dependency. Leave
`version` undeclared so `brew audit --strict` keeps parsing it out of the active URL.

```ruby
  # The release workflow publishes one zip per Linux architecture under the
  # artifact contract recorded in .github/workflows/release.yml of the app repo:
  #   Self.Review-linux-<x64|arm64>-<version>.zip
  on_intel do
    url "https://github.com/e0ipso/self-review/releases/download/vX.Y.Z/Self.Review-linux-x64-X.Y.Z.zip"
    sha256 "<x64 sha256>"
  end

  on_arm do
    url "https://github.com/e0ipso/self-review/releases/download/vX.Y.Z/Self.Review-linux-arm64-X.Y.Z.zip"
    sha256 "<arm64 sha256>"
  end
```

Add to the dependency list, in alphabetical order with the rest:

```ruby
  depends_on "gcc" => :build
```

It is a build dependency because only the patchelf run needs libstdc++, and it must be declared
rather than assumed, so an install off CI gets the same library CI hands itself.

Replace the body of `install` down to the `libexec.install` line:

```ruby
  def install
    arch = Hardware::CPU.arm? ? "arm64" : "x64"
    triplet = Hardware::CPU.arm? ? "aarch64-linux-gnu" : "x86_64-linux-gnu"
    loader = Hardware::CPU.arm? ? "ld-linux-aarch64.so.1" : "ld-linux-x86-64.so.2"

    source_dir = Dir.exist?("Self Review-linux-#{arch}") ? "Self Review-linux-#{arch}" : "."
    library_paths = [
      formula_opt_lib("glibc"),
      HOMEBREW_PREFIX/"lib",
      formula_opt_lib("cups"),
      "/lib/#{triplet}",
      "/usr/lib/#{triplet}",
      "/lib64",
      "/usr/lib64",
    ].join(":")
    rpath = ["$ORIGIN", library_paths].join(":")

    # patchelf is a C++ program with no RUNPATH, and an explicit --library-path
    # replaces the loader's search path instead of extending it, so the patchelf
    # run needs the directory holding Homebrew's libstdc++.so.6. Nothing this
    # formula installs links libstdc++, so the runtime wrapper below keeps the
    # shorter list.
    gcc_lib = formula_opt_lib("gcc")
    libstdcxx = Dir.glob("#{gcc_lib}/gcc/*/libstdc++.so.6").min
    odie "the gcc keg has no libstdc++.so.6" if libstdcxx.nil?
    build_library_paths = [File.dirname(libstdcxx), library_paths].join(":")

    libexec.install Dir["#{source_dir}/*"]
    system formula_opt_lib("glibc")/loader,
           "--library-path", build_library_paths,
           formula_opt_bin("patchelf")/"patchelf",
           "--set-interpreter", formula_opt_lib("glibc")/loader,
           "--set-rpath", rpath,
           libexec/"self-review"
```

Lines 44 to 52, the wrapper heredoc, are untouched here on purpose. SR-0042 rewrites those lines to
drop the `cd`, and keeping the two changes apart is what makes it clear which one caused a
regression if one appears. The two edits do not overlap; this one changes what `library_paths`
contains, SR-0042 changes how the wrapper execs.

Once the formula supplies its own libstdc++, the "Install Linux runtime libraries" step in
`.github/workflows/tests.yml` can go. Delete it in the same pull request, otherwise CI keeps hiding
the case the change is meant to fix.

## Release automation change

`.github/workflows/update-homebrew-tap.yml` breaks the two-URL formula, so it has to change in the
same pull request or before it. Two problems, both in the "Update package definitions" step:

- Line 101 is `formula.gsub!(/sha256 "[0-9a-f]{64}"/, %(sha256 "#{linux_sha}"))`, an unbounded
  `gsub!`. With two `sha256` lines in the formula it writes the x64 digest over the arm64 one, and
  the tap then ships a formula that fails checksum verification on arm64 only.
- Lines 34 to 39 resolve one Linux asset name, `Self.Review-linux-x64-${version}.zip`, and lines 53
  to 55 wait for its digest. Neither knows about arm64.

Resolve both Linux assets in the "Prepare tag" step:

```bash
            echo "linux_x64_asset=Self.Review-linux-x64-${version}.zip"
            echo "linux_arm64_asset=Self.Review-linux-arm64-${version}.zip"
```

wait for all three digests in the "Wait for release assets" step, and rewrite each URL and its own
sha256 as a pair rather than by global substitution:

```ruby
          formula_path = "Formula/self-review.rb"
          formula = File.read(formula_path)
          shas = { "x64" => ENV.fetch("LINUX_X64_SHA256"), "arm64" => ENV.fetch("LINUX_ARM64_SHA256") }
          shas.each do |arch, sha|
            url_re = Regexp.escape("url \"https://github.com/e0ipso/self-review/releases/download/v")
            pattern = /#{url_re}[^\/]+\/Self\.Review-linux-#{arch}-[^"]+\.zip"\n(\s*)sha256 "[0-9a-f]{64}"/
            url = "https://github.com/e0ipso/self-review/releases/download/v#{version}/" \
                  "Self.Review-linux-#{arch}-#{version}.zip"
            replacement = %(url "#{url}"\n\\1sha256 "#{sha}")
            raise "no #{arch} url/sha256 pair in #{formula_path}" unless formula.sub!(pattern, replacement)
          end
          File.write(formula_path, formula)
```

The cask rewrite at lines 90 to 93 is unaffected; the cask still has one sha256.

## Sequencing

The tap cannot pin two architectures until a release carries both. As of 2026-09-10 no release ever
published a Linux arm64 asset. Across all 95 releases,
`gh api --paginate repos/e0ipso/self-review/releases` matches `linux-arm64|aarch64` in zero asset
names, and `arm64|aarch64` only in the 76 `Self.Review-darwin-arm64-*.zip` files. The app
repository's SR-0027 adds `npm run make -- --arch=x64,arm64` to the release workflow, and that
commit is not on `origin/main` yet. So the order is:

1. Land SR-0027 in the app repository and cut a release.
2. Confirm that release carries `Self.Review-linux-arm64-<version>.zip` (check 0 below).
3. Land the automation change in the tap, so the next bump cannot clobber the arm64 digest.
4. Land the formula change, pinned to the release from step 2.

## Checks to run on a Linux arm64 host

The tap has no arm64 runner and this container is x86_64, so every check below needs a real arm64
Linux machine. Checks 5 to 8 also need x86_64 for the no-regression half.

```bash
# 0. The release carries an arm64 Linux zip at all.
gh release view vX.Y.Z --repo e0ipso/self-review --json assets --jq '.assets[].name'
#    expect Self.Review-linux-arm64-X.Y.Z.zip next to the x64 zip

# 1. The sha256 the formula pins comes from the artifact, not by hand.
curl -sSLO https://github.com/e0ipso/self-review/releases/download/vX.Y.Z/Self.Review-linux-arm64-X.Y.Z.zip
sha256sum Self.Review-linux-arm64-X.Y.Z.zip

# 2. The extracted directory name source_dir keys on.
unzip -Z1 Self.Review-linux-arm64-X.Y.Z.zip | awk -F/ '{print $1}' | sort -u
#    expect exactly one line: Self Review-linux-arm64

# 3. Install, with the verbose log kept.
brew tap e0ipso/self-review
brew install -v e0ipso/self-review/self-review 2>&1 | tee /tmp/install-arm64.log

# 4. On any failure, keep the whole Homebrew log, not the 15-line tail issue 133 has.
cat ~/.cache/Homebrew/Logs/self-review/*.log

# 5. No x86-only loader or path survived the install.
prefix="$(brew --prefix)/opt/self-review"
file "$prefix/libexec/self-review"                       # expect ELF 64-bit ... ARM aarch64
readelf -l "$prefix/libexec/self-review" | grep -A1 INTERP  # expect ld-linux-aarch64.so.1
readelf -d "$prefix/libexec/self-review" | grep RUNPATH     # expect aarch64-linux-gnu, no x86_64
grep -c x86_64 "$(brew --prefix)/bin/self-review"        # expect 0

# 6. The libstdc++ question, answered rather than assumed.
readelf -d "$(brew --prefix)/opt/patchelf/bin/patchelf" | grep -E 'NEEDED|RUNPATH'
#    expect NEEDED libstdc++.so.6 and no RUNPATH, matching the x64 bottle
for f in "$prefix"/libexec/*; do
  file -b "$f" | grep -q ELF && { printf '%s ' "$f"; readelf -d "$f" | grep -c 'libstdc++'; }
done
#    expect 0 for every shipped ELF
ls -l "$(brew --prefix)/lib/libstdc++.so.6"
#    expect no such file. If it exists, delete it and rerun check 3: the formula
#    must not depend on a symlink only the tap's CI creates.

# 7. It starts. Needs a display.
brew test self-review
cd "$(mktemp -d)" && git init -q . && self-review

# 8. x64 did not regress: repeat 3, 5, 6 and 7 on an x86_64 Linux host.
```

Report checks 3 to 7 on issue 133 when they pass. Do not close it on artifact selection alone; check
6 is the part the issue actually reported.

## What was verified while drafting this

On an x86_64 dev container with no Homebrew, no Ruby and no arm64 hardware:

- The published x64 artifact was downloaded and its 8 ELF files read with `readelf -d`. None needs
  `libstdc++.so.6`. Its sha256 is `60016c51aac709fb2e38272e17d81f72359d6cd4c0e69ccf395d081b0dcc9122`,
  matching what SR-0042 recorded for the same file.
- Homebrew's `patchelf` 0.18.0 `x86_64_linux` bottle was pulled from ghcr.io and read the same way.
  It needs `libstdc++.so.6` and has no RUNPATH.
- `formula_opt_lib` and `formula_opt_bin` are real Homebrew helpers, defined in
  `Library/Homebrew/utils/path.rb`, so the proposal keeps using them.
- `arm64_linux` bottles exist today for every formula this one depends on, including `gcc`, `glibc`
  and `patchelf`, per `formulae.brew.sh/api/formula/<name>.json`. Adding `depends_on "gcc"` does not
  force a source build on arm64.
- The unbounded `gsub!` bug was reproduced against a two-architecture formula fragment, and the
  pairing rewrite tested against the same fragment. Python stood in for Ruby, since there is no Ruby
  on the drafting host, so the regexes and the pairing are tested and the Ruby itself is unparsed.
  Run `ruby -c` on both files before opening the pull request.
