#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "$script_dir/.." && pwd)"
android_studio_jdk="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
android_sdk_dir="$HOME/Library/Android/sdk"
upload_store_file="$HOME/Library/Application Support/Huddle Assistant/huddle-assistant-upload.jks"
keychain_service="com.doubleheelix.huddleassistant.upload-keystore"
keychain_account="DoubleHeelix"

if [[ ! -f "$upload_store_file" ]]; then
  echo "The Huddle Assistant upload keystore is missing."
  exit 1
fi

if [[ ! -d "$android_studio_jdk" ]]; then
  echo "Android Studio's bundled Java runtime is missing."
  exit 1
fi

upload_store_password="$(
  security find-generic-password \
    -a "$keychain_account" \
    -s "$keychain_service" \
    -w
)"

export JAVA_HOME="$android_studio_jdk"
export ANDROID_HOME="$android_sdk_dir"
export HUDDLE_UPLOAD_STORE_FILE="$upload_store_file"
export HUDDLE_UPLOAD_STORE_PASSWORD="$upload_store_password"
export HUDDLE_UPLOAD_KEY_ALIAS="huddle-assistant-upload"
export HUDDLE_UPLOAD_KEY_PASSWORD="$upload_store_password"

cd "$project_dir"
npm run android:sync

cd "$project_dir/android"
./gradlew bundleRelease

echo "Signed Android bundle:"
echo "$project_dir/android/app/build/outputs/bundle/release/app-release.aab"
