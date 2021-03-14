#!/usr/bin/env bash

# For more info about the 'set' command, see
# https://www.gnu.org/software/bash/manual/bash.html#The-Set-Builtin
set -e
set -u

ROOT_DIR=$(cd "$(dirname "$0")/.."; pwd -P)
OUTFILE="${1:-}"

cd $ROOT_DIR
[[ ! -d ./bin ]] && mkdir ./bin

# Build the binary.
[[ -e ./bin/vim-doge ]] && rm ./bin/vim-doge
npx caxa --directory $ROOT_DIR/build --command "{{caxa}}/node_modules/.bin/node" "{{caxa}}/index.js" --output "./bin/vim-doge"

# Archive the binary.
if [[ "$OUTFILE" != "" ]]; then
  OUTFILE="$OUTFILE.tar.gz"
  cd $ROOT_DIR/bin
  rm -f ./*.tar.gz
  echo "==> Archiving $ROOT_DIR/bin/vim-doge -> $ROOT_DIR/bin/$OUTFILE"
  tar -czf "$OUTFILE" vim-doge
fi

echo "🎉  Done building vim-doge binaries"
