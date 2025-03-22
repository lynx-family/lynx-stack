#!/bin/bash

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/../../../../.."

# Compile TypeScript files
echo "Compiling TypeScript files..."
cd "$PROJECT_ROOT" && npx tsc -p packages/web-platform/web-elements/tsconfig.json

# Start the server
echo "Starting server..."
node "$SCRIPT_DIR/serve-example.js" 
