#!/usr/bin/env bash
# Build the Rust provenance engine to WASM and drop it into the extension.
set -euo pipefail

cd "$(dirname "$0")"

# Requires: rustup target add wasm32-unknown-unknown && wasm-pack installed.
# `--target nodejs` emits CommonJS glue the VS Code extension can `require()`
# directly (no bundler). On Windows without MSVC, build via the GNU toolchain:
#   RUSTUP_TOOLCHAIN=stable-x86_64-pc-windows-gnu ./build.sh
wasm-pack build --target nodejs --out-dir ../extension/wasm --release

echo "WASM built -> extension/wasm"
