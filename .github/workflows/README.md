# CI/CD Workflows

This directory contains GitHub Actions workflows for automated testing, building, and deployment of Mikrod Util.

## Workflows

### 1. CI (`ci.yml`)
**Triggers**: Push to `main`, `develop`, or `claude/**` branches; Pull requests to `main` or `develop`

**Jobs**:
- TypeScript type checking
- ESLint code quality checks
- Prettier formatting validation
- Jest unit tests with coverage
- Coverage upload to Codecov

**Status Badge**: Add to README.md
```markdown
![CI](https://github.com/YOUR_ORG/mikrod_util/workflows/CI/badge.svg)
```

### 2. Android Build (`android-build.yml`)
**Triggers**: Push to `main`/`develop`, tags `v*`, pull requests, manual dispatch

**Jobs**:
- **android-build**: Builds debug and unsigned release APKs
- **android-release-signed**: Builds signed APK + AAB for Google Play (tags only)

**Artifacts**:
- `app-debug.apk` (30 days retention)
- `app-release-unsigned.apk` (90 days, main branch only)
- `app-release.apk` (signed, 90 days, tags only)
- `app-release.aab` (Google Play bundle, 90 days, tags only)

**Requirements for Signed Builds**:
Set these GitHub secrets in repository settings:
```
ANDROID_KEYSTORE_BASE64      # Base64-encoded release.keystore
KEYSTORE_PASSWORD            # Keystore password
KEY_ALIAS                    # Key alias
KEY_PASSWORD                 # Key password
```

**Generate Keystore**:
```bash
# 1. Create keystore (run once)
keytool -genkey -v -keystore release.keystore -alias mikrod-util \
  -keyalg RSA -keysize 2048 -validity 10000

# 2. Encode as base64
cat release.keystore | base64 > keystore.base64

# 3. Copy contents of keystore.base64 to ANDROID_KEYSTORE_BASE64 secret
```

### 3. iOS Build (`ios-build.yml`)
**Triggers**: Push to `main`/`develop`, tags `v*`, pull requests, manual dispatch

**Jobs**:
- **ios-build**: Builds debug for iOS Simulator
- **ios-release**: Builds signed IPA and uploads to TestFlight (tags only)

**Artifacts**:
- `ios-build-logs` (on failure, 7 days)
- `ios-release-ipa` (90 days, tags only)

**Requirements for Signed Builds**:
Set these GitHub secrets:
```
IOS_CERTIFICATE_BASE64           # Base64-encoded .p12 certificate
IOS_CERTIFICATE_PASSWORD         # Certificate password
IOS_PROVISION_PROFILE_BASE64     # Base64-encoded provisioning profile
APPLE_API_KEY_ID                 # App Store Connect API Key ID
APPLE_API_ISSUER_ID              # App Store Connect Issuer ID
APPLE_API_KEY_BASE64             # Base64-encoded App Store Connect API key
```

**Export Certificates from Keychain**:
```bash
# 1. Export certificate from Keychain as .p12
# In Keychain Access: Right-click cert → Export → .p12 format

# 2. Encode as base64
cat Certificates.p12 | base64 > cert.base64

# 3. Encode provisioning profile
cat profile.mobileprovision | base64 > profile.base64

# 4. Create App Store Connect API key at:
# https://appstoreconnect.apple.com/access/api
# Download .p8 file and encode:
cat AuthKey_XXXXXXXX.p8 | base64 > apikey.base64
```

## Setup Instructions

### 1. Enable GitHub Actions
- Go to repository **Settings** → **Actions** → **General**
- Set **Actions permissions** to "Allow all actions"
- Set **Workflow permissions** to "Read and write permissions"

### 2. Configure Secrets (Optional for Signed Builds)
Navigate to **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

**Android Signing**:
1. `ANDROID_KEYSTORE_BASE64` - Your keystore file (base64)
2. `KEYSTORE_PASSWORD` - Keystore password
3. `KEY_ALIAS` - Key alias
4. `KEY_PASSWORD` - Key password

**iOS Signing**:
1. `IOS_CERTIFICATE_BASE64` - Distribution certificate (base64)
2. `IOS_CERTIFICATE_PASSWORD` - Certificate password
3. `IOS_PROVISION_PROFILE_BASE64` - Provisioning profile (base64)

**iOS TestFlight Upload** (optional):
1. `APPLE_API_KEY_ID` - App Store Connect API Key ID
2. `APPLE_API_ISSUER_ID` - App Store Connect Issuer ID
3. `APPLE_API_KEY_BASE64` - API key file (base64)

### 3. Update android/app/build.gradle (for signing)
Add to `android/app/build.gradle`:
```gradle
android {
    ...
    signingConfigs {
        release {
            if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
                storeFile file(MYAPP_UPLOAD_STORE_FILE)
                storePassword MYAPP_UPLOAD_STORE_PASSWORD
                keyAlias MYAPP_UPLOAD_KEY_ALIAS
                keyPassword MYAPP_UPLOAD_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            ...
            signingConfig signingConfigs.release
        }
    }
}
```

### 4. Create iOS exportOptions.plist
Create `ios/exportOptions.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>teamID</key>
    <string>YOUR_TEAM_ID</string>
    <key>uploadSymbols</key>
    <true/>
    <key>compileBitcode</key>
    <false/>
</dict>
</plist>
```

## Triggering Workflows

### Manual Trigger
```bash
# Via GitHub CLI
gh workflow run android-build.yml
gh workflow run ios-build.yml
```

Or use the **Actions** tab → Select workflow → **Run workflow**

### Automatic Triggers
- **Push to main/develop**: Runs CI + builds debug artifacts
- **Pull request**: Runs CI only
- **Push tag `v*`**: Runs all workflows + creates GitHub release
  ```bash
  git tag v1.0.0
  git push origin v1.0.0
  ```

## Downloading Artifacts
1. Navigate to **Actions** tab
2. Click on a completed workflow run
3. Scroll to **Artifacts** section
4. Download APK/IPA files

## Troubleshooting

### Android Build Fails
- Check Java version is 17
- Verify `android/gradlew` is executable: `chmod +x android/gradlew`
- Check `android/gradle/wrapper/gradle-wrapper.properties` for correct Gradle version

### iOS Build Fails
- Verify workspace name matches: `ios/mikrodutil.xcworkspace`
- Check scheme name in Xcode: Product → Scheme → Manage Schemes
- Ensure CocoaPods are up to date: `cd ios && bundle exec pod install`
- For signing issues, verify certificate + provisioning profile validity

### CI Tests Fail
- Run locally: `npm test`
- Check Node version: `node -v` (should be 20+)
- Clear caches: `npm ci` (clean install)

### Secrets Not Working
- Verify secret names match exactly (case-sensitive)
- Check base64 encoding has no line breaks: `base64 -w 0` (Linux) or `base64 -b 0` (macOS)
- Ensure secrets are set at repository level (not environment level)

## Best Practices

### Branch Protection
Set up branch protection for `main`:
1. **Settings** → **Branches** → **Add rule**
2. Branch name pattern: `main`
3. Enable:
   - Require status checks to pass before merging
   - Require branches to be up to date before merging
   - Select status checks: `Lint & Test`

### Release Process
```bash
# 1. Merge to main
git checkout main
git pull origin main

# 2. Bump version
npm version patch  # or minor, or major

# 3. Push tag
git push origin main --tags

# 4. GitHub Actions builds signed releases
# 5. Go to Releases tab → Edit draft release → Publish
```

### Code Coverage
Enable Codecov:
1. Sign up at https://codecov.io
2. Add repository
3. Badge will auto-update on PRs

## Resources
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [React Native CI/CD Guide](https://reactnative.dev/docs/publishing-to-app-store)
- [Fastlane for React Native](https://docs.fastlane.tools/getting-started/cross-platform/react-native/)
