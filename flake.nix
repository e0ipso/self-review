{
  description = "Self Review - GitHub-style PR review UI for local git diffs (Electron app)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      lib = nixpkgs.lib;

      # Derived from srcHashes so a system can never be offered without the
      # release hash that makes it buildable.
      supportedSystems = builtins.attrNames srcHashes;
      forAllSystems = lib.genAttrs supportedSystems;

      packageJson = builtins.fromJSON (builtins.readFile ./package.json);
      packageLockJson = builtins.fromJSON (builtins.readFile ./package-lock.json);

      # Tracks the Electron major that npm actually pins, so the devShell
      # uses the matching nixpkgs Electron binary.
      electronMajor = lib.versions.major packageLockJson.packages."node_modules/electron".version;

      # The architecture token the release workflow puts in the artifact name.
      archForSystem = {
        "x86_64-linux" = "x64";
        "aarch64-linux" = "arm64";
      };

      # The unpacked-directory hash of each system's release artifact, keyed by
      # Nix system. One entry per line so scripts/update-flake-hash.sh rewrites
      # exactly one architecture per run and can never install one
      # architecture's hash under another.
      srcHashes = {
        "x86_64-linux" = "sha256-YAFsUarHCfsuOCcuF9gfcjWdbNTA5pzPOV0IGw3MkSI=";
        # lib.fakeHash written out, because the updater matches a literal
        # sha256 string. scripts/update-flake-hash.sh aarch64-linux replaces it
        # once a release publishes an arm64 artifact.
        "aarch64-linux" = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
      };

      mkSelfReview =
        system:
        let
          pkgs = import nixpkgs { inherit system; config.allowUnfree = true; };
          arch = archForSystem.${system};
        in
        pkgs.stdenv.mkDerivation {
          pname = "self-review";
          version = packageJson.version;

          # Fetches this system's pre-built Linux zip from GitHub Releases.
          # The release workflow publishes one zip per architecture and the
          # update-flake-hash workflow installs each architecture's hash
          # automatically. To update manually, once per system:
          #   scripts/update-flake-hash.sh x86_64-linux
          #   scripts/update-flake-hash.sh aarch64-linux
          #
          # The hash covers the unpacked directory, not the zip bytes, so it
          # only reproduces under the unpacking options set here. The updater
          # prefetches with `--unpack`, which collapses a single archive root
          # the same way stripRoot does.
          src = pkgs.fetchzip {
            url = "https://github.com/e0ipso/self-review/releases/download/v${packageJson.version}/Self.Review-linux-${arch}-${packageJson.version}.zip";
            hash = srcHashes.${system};
            stripRoot = true;
          };

          nativeBuildInputs = with pkgs; [
            autoPatchelfHook
            copyDesktopItems
            makeWrapper
          ];

          # autoPatchelfHook rewrites ELF RPATH entries in $out to point at
          # these nix store paths, replacing the generic-Linux paths baked
          # into the upstream build.
          buildInputs = with pkgs; [
            alsa-lib
            expat
            flac
            glib
            gtk3
            libpulseaudio
            libxkbcommon
            libxslt
            mesa
            nspr
            nss
            pango
            libx11
            libxcb
            libxcomposite
            libxdamage
            libxext
            libxfixes
            libxi
            libxrandr
            libxrender
          ];

          dontBuild = true;
          dontUnpack = true;

          installPhase = ''
            runHook preInstall

            mkdir -p "$out/share/self-review"
            cp -rL "$src/." "$out/share/self-review/"

            makeWrapper "$out/share/self-review/self-review" "$out/bin/self-review" \
              --set ELECTRON_DISABLE_SANDBOX 1 \
              --set CHROME_DEVEL_SANDBOX "$out/share/self-review/chrome-sandbox"

            mkdir -p "$out/share/icons/hicolor/scalable/apps"
            cp ${self}/assets/icon.svg "$out/share/icons/hicolor/scalable/apps/self-review.svg"

            runHook postInstall
          '';

          desktopItems = [
            (pkgs.makeDesktopItem {
              name = "self-review";
              desktopName = "Self Review";
              genericName = "Code Review Tool";
              comment = "GitHub-style PR review UI for local git diffs";
              exec = "self-review";
              icon = "self-review";
              categories = [ "Development" ];
            })
          ];

          meta = {
            description = "GitHub-style PR review UI for local git diffs";
            homepage = "https://github.com/e0ipso/self-review";
            # package.json declares MIT but the LICENSE file is a proprietary
            # revocable license — using unfree pending upstream clarification.
            license = lib.licenses.unfree;
            platforms = supportedSystems;
            mainProgram = "self-review";
          };
        };
    in
    {
      packages = forAllSystems (system: {
        default = mkSelfReview system;
        self-review = mkSelfReview system;
      });

      apps = forAllSystems (system: {
        default = {
          type = "app";
          program = "${self.packages.${system}.default}/bin/self-review";
        };
      });

      devShells = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; config.allowUnfree = true; };
          electronPkg = pkgs."electron_${electronMajor}";
        in
        {
          default = pkgs.mkShell {
            packages = [ pkgs.nodejs_22 ];

            # Makes `npm start` work on NixOS: points the local npm `electron`
            # package at the nixpkgs-patched binary instead of the generic
            # Linux binary npm would download.
            ELECTRON_OVERRIDE_DIST_PATH = "${electronPkg.dist}";
            ELECTRON_DISABLE_SANDBOX = "1";
            CHROME_DEVEL_SANDBOX = "${electronPkg.dist}/chrome-sandbox";
          };
        }
      );

      overlays.default = final: _prev: lib.optionalAttrs (builtins.elem final.system supportedSystems) {
        self-review = self.packages.${final.system}.default;
      };
    };
}
