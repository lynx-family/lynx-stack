#!/usr/bin/env bash
set -e

# Logic from original build.mjs:
# if (!process.env.CI || process.env['ECOSYSTEM_CI']) process.exit(0);
if [ -z "$CI" ] || [ -n "$ECOSYSTEM_CI" ]; then
  exit 0
fi

# Check CWD
if [ ! -f "package.json" ] || ! grep -q '"name": "benchx_cli"' package.json; then
  echo "Error: This script must be run from 'packages/lynx/benchx_cli' dir"
  exit 1
fi

LOCKED_VERSION="benchx_cli-202602132156"

# Check if binary is up to date
if [ -f "./dist/bin/benchx_cli" ] && [ -f "./dist/bin/benchx_cli.version" ]; then
  CURRENT_VERSION=$(cat ./dist/bin/benchx_cli.version)
  if [ "$CURRENT_VERSION" == "$LOCKED_VERSION" ]; then
    echo "Binary is up to date"
    exit 0
  fi
fi

# Determine platform and arch
OS="$(uname -s)"
ARCH="$(uname -m)"
ASSET_NAME=""

if [ "$OS" == "Darwin" ]; then
  if [ "$ARCH" == "arm64" ]; then
    ASSET_NAME="benchx_cli_Darwin_arm64.tar.gz"
  else
    echo "Unsupported architecture for Darwin: $ARCH"
    exit 1
  fi
elif [ "$OS" == "Linux" ]; then
  if [ "$ARCH" == "x86_64" ]; then
    ASSET_NAME="benchx_cli_Linux_x86_64.tar.gz"
  else
    echo "Unsupported architecture for Linux: $ARCH"
    exit 1
  fi
else
  echo "Unsupported OS: $OS"
  exit 1
fi

echo "Using locked version: $LOCKED_VERSION"
echo "Downloading new binary..."

rm -rf dist
mkdir -p dist/bin

URL="https://github.com/lynx-community/benchx_cli/releases/download/$LOCKED_VERSION/$ASSET_NAME"
TAR_PATH="./dist/$ASSET_NAME"

echo "Downloading $ASSET_NAME from $URL..."
curl -L --fail --show-error --progress-bar -o "$TAR_PATH" "$URL"

echo "Extracting $ASSET_NAME to ./dist/bin..."
tar -xzf "$TAR_PATH" -C ./dist/bin

rm -f "$TAR_PATH"
echo "$LOCKED_VERSION" > ./dist/bin/benchx_cli.version

echo "Binary downloaded and extracted successfully"
echo "Binary location: $(pwd)/dist/bin/benchx_cli"
