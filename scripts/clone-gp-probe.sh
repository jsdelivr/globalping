#!/bin/bash

set -euo pipefail
IFS=$'\n\t'

CURRENT_BRANCH=${CURRENT_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}

# Checkout and sync the branch if the directory exists, otherwise clone the repository
if [ -d "test/e2e/globalping-probe" ]; then
	cd test/e2e/globalping-probe || exit
	git add .
	git reset --hard "@{u}"
	git fetch
	git checkout "$CURRENT_BRANCH" || git checkout master
	git reset --hard "@{u}"
else
	git clone -b "$CURRENT_BRANCH" https://github.com/jsdelivr/globalping-probe.git test/e2e/globalping-probe || git clone https://github.com/jsdelivr/globalping-probe.git test/e2e/globalping-probe
	cd test/e2e/globalping-probe || exit
fi

# Install dependencies
npm install

cd ../../../ || exit
