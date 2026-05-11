#!/usr/bin/env bash
# release.sh — One-Shot Release-Pipeline für GrowBuddy
# Usage: bash scripts/release.sh 1.3.60 "Commit message subject"
# Macht: clean Vite-Build → cap:sync → Gradle assembleRelease → ADB install/push → git commit/tag/push
#
# Token-Spar-Idee: statt 6+ Bash-Calls pro Release nur 1 Call.

set -e

VERSION="${1:?Usage: bash scripts/release.sh <version> <commit-subject>}"
SUBJECT="${2:?Usage: bash scripts/release.sh <version> <commit-subject>}"

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ADB="${LOCALAPPDATA:-$HOME/AppData/Local}/Android/Sdk/platform-tools/adb.exe"
DEVICE="192.168.2.62:5555"
APK="$PROJECT_DIR/android/app/build/outputs/apk/release/app-release.apk"
KEYSTORE="$PROJECT_DIR/keystore/growbuddy-release.jks"

cd "$PROJECT_DIR"

# 1. Version-Bump (package.json + build.gradle)
echo "→ Version-Bump auf $VERSION"
PREV_VERSION=$(grep -oP '"version":\s*"\K[^"]+' package.json)
PREV_CODE=$(grep -oP 'versionCode \K\d+' android/app/build.gradle)
NEW_CODE=$((PREV_CODE + 1))
sed -i "s/\"version\": \"$PREV_VERSION\"/\"version\": \"$VERSION\"/" package.json
sed -i "s/versionCode $PREV_CODE/versionCode $NEW_CODE/" android/app/build.gradle
sed -i "s/versionName \"$PREV_VERSION\"/versionName \"$VERSION\"/" android/app/build.gradle

# 2. Clean Vite-Build (vermeidet Cache-Bug wie v1.3.55)
echo "→ Clean Vite-Build"
rm -rf build/ .svelte-kit/output/
npm run cap:sync >/dev/null 2>&1

# 3. Gradle Release-APK
echo "→ Gradle assembleRelease"
(cd android && ./gradlew assembleRelease \
  -PGROWBUDDY_KEYSTORE_FILE="$KEYSTORE" \
  -PGROWBUDDY_KEYSTORE_PASSWORD=growbuddy2026 \
  -PGROWBUDDY_KEY_ALIAS=growbuddy \
  -PGROWBUDDY_KEY_PASSWORD=growbuddy2026) >/dev/null 2>&1

# 4. ADB install + push + cleanup vorherige APK
echo "→ ADB install + push"
"$ADB" connect "$DEVICE" >/dev/null 2>&1 || true
"$ADB" -s "$DEVICE" install -r "$APK" >/dev/null
"$ADB" -s "$DEVICE" shell "am force-stop app.growbuddy.de"
"$ADB" -s "$DEVICE" shell "monkey -p app.growbuddy.de -c android.intent.category.LAUNCHER 1" >/dev/null 2>&1
"$ADB" -s "$DEVICE" push "$APK" "//sdcard/Download/GrowBuddy-$VERSION.apk" >/dev/null
"$ADB" -s "$DEVICE" shell "rm -f //sdcard/Download/GrowBuddy-$PREV_VERSION.apk" >/dev/null 2>&1

# 5. Git commit + tag + push (alles in einem)
echo "→ Git commit + tag v$VERSION"
git add -A
git commit -m "v$VERSION: $SUBJECT" >/dev/null
git push >/dev/null 2>&1
git tag "v$VERSION"
git push origin "v$VERSION" >/dev/null 2>&1

echo "✓ v$VERSION released (versionCode $NEW_CODE) — Device + GitHub aktuell"
