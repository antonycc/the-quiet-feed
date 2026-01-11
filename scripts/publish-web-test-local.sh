#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2025-2026 Antony Cartwright
#
# Usage: ./scripts/publish-web-test-local.sh <sourceReport> <targetTest>
# e.g. ./scripts/publish-web-test-local.sh target/behaviour-test-results/test-report-submitVatBehaviour.json 'web-test-local'

set -euo pipefail

sourceReport="${1?Missing sourceReport argument}"
sourceTestName=$(jq -r '.testName' "${sourceReport?}")
reportDir=$(dirname "${sourceReport?}")
targetTest="${2:-web-test-local}"

# Determine sed in-place flag: macOS (BSD) requires -i '', GNU sed (Linux) uses -i
if sed --version >/dev/null 2>&1; then
  sedInPlace=(-i)
else
  sedInPlace=(-i '')
fi

targetTestDir="web/public/tests/behaviour-test-results/${targetTest?}/"
targetTestReportDir="web/public/tests/test-reports/${targetTest?}/"
mkdir -p "${targetTestDir?}"
mkdir -p "${targetTestReportDir?}"

# Copy the source report to the web directory
cp -v "${sourceReport?}" "web/public/tests/test-report-${targetTest?}.json"

# Process screenshots
echo "Processing screenshots..."
jq -r '.artifacts.screenshots[]' "web/public/tests/test-report-${targetTest?}.json" 2>/dev/null | while read -r screenshotRelPath; do
  # screenshotRelPath is relative to reportDir, e.g. "screenshots/anonymous-behaviour-test/01-...png"
  # or "anonymous.behaviour-.../test-finished-1.png"

  screenshotFullPath="${reportDir}/${screenshotRelPath}"

  if [[ ! -f "${screenshotFullPath}" ]]; then
    echo "Warning: Screenshot not found: ${screenshotFullPath}"
    continue
  fi

  # Extract just the filename for the clean name
  screenshotBasename=$(basename "${screenshotRelPath}")

  # Strip timestamp patterns like "01-2026-01-11T13-23-25-271Z-" from the filename
  # Pattern: NN-YYYY-MM-DDTHH-MM-SS-MMMZ- where NN is step number
  cleanFilename=$(echo "${screenshotBasename}" | sed -E 's/^[0-9]+-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9]+Z-//')

  # If no timestamp was found, use the original basename
  if [[ "${cleanFilename}" == "${screenshotBasename}" ]]; then
    # Try simpler pattern for other formats
    cleanFilename=$(echo "${screenshotBasename}" | sed -E 's/^[0-9]+-//')
  fi

  echo "Copying: ${screenshotRelPath} -> ${cleanFilename}"
  cp "${screenshotFullPath}" "${targetTestDir}${cleanFilename}"

  # Update the report JSON to use the clean filename
  # Use | as sed delimiter since paths contain /
  sed "${sedInPlace[@]}" "s|${screenshotRelPath}|${cleanFilename}|g" "web/public/tests/test-report-${targetTest?}.json"
done

# Process videos
echo "Processing videos..."
jq -r '.artifacts.videos[]' "web/public/tests/test-report-${targetTest?}.json" 2>/dev/null | while read -r videoFilename; do
  videoFullPath="${reportDir}/${videoFilename}"

  if [[ -f "${videoFullPath}" ]]; then
    echo "Copying video: ${videoFilename}"
    cp "${videoFullPath}" "${targetTestDir}${videoFilename}"
  else
    echo "Warning: Video not found: ${videoFullPath}"
  fi
done

# Replace sourceTestName with targetTest in the report if different
if [[ "${sourceTestName}" != "${targetTest}" ]]; then
  echo "Renaming test: ${sourceTestName} -> ${targetTest}"
  sed "${sedInPlace[@]}" "s|${sourceTestName}|${targetTest}|g" "web/public/tests/test-report-${targetTest?}.json"
fi

# Copy Playwright HTML report if it exists
# [local run variant] Copy target/test-reports/html-report
if [[ -d "target/test-reports/html-report" ]]; then
  echo "Copying Playwright HTML report from target/test-reports/html-report"
  cp -rv "target/test-reports/html-report" "${targetTestReportDir}"
fi

# [GitHub Actions run variant] Copy target/test-reports/${sourceTestName}/html-report
if [[ -d "target/test-reports/${sourceTestName}/html-report" ]]; then
  echo "Copying Playwright HTML report from target/test-reports/${sourceTestName}/html-report"
  cp -rv "target/test-reports/${sourceTestName}/html-report" "${targetTestReportDir}"
fi

echo "Done: web/public/tests/test-report-${targetTest}.json"
