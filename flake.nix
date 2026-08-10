{
  description = "A Nix-flake-based Rust and Node.js development environment";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    fenix = {
      url = "https://flakehub.com/f/nix-community/fenix/0.1";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    sops-nix = {
      url = "github:Mic92/sops-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    git-hooks-nix = {
      url = "github:cachix/git-hooks.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    { self, ... }@inputs:

    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forEachSupportedSystem =
        f:
        inputs.nixpkgs.lib.genAttrs supportedSystems (
          system:
          f {
            inherit system;
            pkgs = import inputs.nixpkgs {
              inherit system;
              overlays = [
                inputs.self.overlays.default
              ];
            };
          }
        );
    in
    {
      overlays.default = final: prev: {
        # Rust Toolchain setup via fenix
        rustToolchain =
          with inputs.fenix.packages.${prev.stdenv.hostPlatform.system};
          combine (
            with stable;
            [
              clippy
              rustc
              cargo
              rustfmt
              rust-src
              targets.wasm32-unknown-unknown.stable.rust-std
            ]
          );

        # Node.js passthrough
        nodejs = prev.nodejs;
      };

      checks = forEachSupportedSystem (
        { pkgs, system }: {
          pre-commit-check = inputs.git-hooks-nix.lib.${system}.run {
            src = ./.;
            package = pkgs.prek;
            hooks = {
              encrypt-env = {
                enable = true;
                name = "Encrypt .env to secrets.env";
                entry = "bash -c 'if [ -f .env ]; then hash=$(${pkgs.coreutils}/bin/sha256sum .env | cut -d\" \" -f1); if [ ! -f .env.sha256 ] || [ \"$(cat .env.sha256 2>/dev/null)\" != \"$hash\" ]; then cp .env secrets.env && ${pkgs.sops}/bin/sops -e -i secrets.env && git add secrets.env && echo \"$hash\" > .env.sha256; fi; fi'";
                pass_filenames = false;
              };
              forbid-env-files = {
                enable = true;
                name = "Prevent committing environment files";
                entry = toString (
                  pkgs.writeShellScript "forbid-env-files" ''
                    echo "Refusing to commit environment file(s):" >&2
                    printf '  - %s\n' "$@" >&2
                    echo "Commit a .env.example, .env.sample, or .env.template file instead." >&2
                    exit 1
                  ''
                );
                files = "(^|/)\\.env($|\\.)";
                excludes = [ "(^|/)\\.env.*\\.(example|sample|template|sha256)$" ];
              };
              oxfmt = {
                enable = true;
                name = "Check formatting with oxfmt";
                entry = "bash -c 'pnpm exec oxfmt --check'";
                pass_filenames = false;
              };
              oxlint = {
                enable = true;
                name = "Lint with oxlint";
                entry = "bash -c 'pnpm exec oxlint -c .oxlintrc.json --type-aware .'";
                pass_filenames = false;
              };
              cargo-fmt = {
                enable = true;
                name = "Check Rust formatting";
                entry = "bash -c 'cargo fmt --check'";
                pass_filenames = false;
              };

              # Built-in hooks
              nixfmt.enable = true;
              clippy.enable = true;
              check-merge-conflicts.enable = true;
              detect-private-keys.enable = true;
              end-of-file-fixer.enable = true;
              trim-trailing-whitespace.enable = true;
              check-added-large-files.enable = true;
            };
          };
        }
      );

      devShells = forEachSupportedSystem (
        { pkgs, system }:
        {
          default = pkgs.mkShell {
            packages =
              with pkgs;
              [
                # Rust
                rustToolchain
                openssl
                pkg-config
                rust-analyzer
                bacon

                # Node.js
                nodejs
                pnpm
                oxfmt
                oxlint

                # Utilities
                just
                sops
                age
                prek
                secretspec
              ]
              ++ lib.optionals stdenv.isDarwin [
                libiconv
              ];

            # Leave buildInputs empty on Darwin so Nix doesn't hijack the SDK
            buildInputs = [ ];

            env = {
              # Required by rust-analyzer
              RUST_SRC_PATH = "${pkgs.rustToolchain}/lib/rustlib/src/rust/library";
            };

            # Automatically creates/activates the uv venv
            shellHook = ''
              # 1. Unset the Nix-injected SDK root so xcrun falls back to the host system
              unset SDKROOT
              unset DEVELOPER_DIR

              # 2. Re-assert the true system binary paths ahead of the Nix sandbox
              export PATH="/usr/bin:/usr/sbin:/usr/local/bin:$PATH"

              echo "Loading Hybrid Rust, Python, and Node.js Dev Environment"

              # Node Setup
              export PATH="$PWD/node_modules/.bin:$PATH"

              # Display versions
              echo "Versions:"
              echo "  rust:   $(cargo --version)"
              echo "  node:   $(node --version)"
              echo "  pnpm:   $(pnpm --version)"

              # Set SecretSpec Defaults
              export SECRETSPEC_PROFILE="development"

              # Validate secrets against secretspec
              if [ -f secrets.yml ] && [ -f secretspec.toml ]; then
                echo "🔍 Validating secrets with secretspec..."
                if sops -d secrets.yml > /dev/null 2>&1; then
                  secretspec check || echo "⚠️ Secret validation failed."
                fi
              fi
            '';
          };
        }
      );
    };
}
