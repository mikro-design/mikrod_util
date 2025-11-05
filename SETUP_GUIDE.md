# CI/CD Setup Guide

This guide walks you through setting up the complete CI/CD pipeline for Mikrod Util.

## Step 1: Create Pull Request

### Option A: Using GitHub Web Interface
1. Go to: https://github.com/mikro-design/mikrod_util/pull/new/claude/analyze-code-add-ci-011CUpc7Me6c5SsMGxZSPxSa
2. Set base branch to `main` (or create it if this is the first PR)
3. Title: "Add comprehensive code analysis and CI/CD pipeline"
4. Body:
   ```markdown
   ## Summary
   This PR adds comprehensive code analysis and a complete CI/CD pipeline for Mikrod Util.

   ## Changes
   - 📊 **Code Analysis** (ANALYSIS.md): 800+ line comparison with industrial OT/IoT solutions
   - 🔄 **CI/CD Pipeline**: 5 GitHub Actions workflows (CI, Android, iOS, Security, Dependencies)
   - 📱 **Build Automation**: Debug and release builds for Android/iOS
   - 🔒 **Security Scanning**: CodeQL, npm audit, secret detection
   - 📚 **Documentation**: Updated README with features, setup, and roadmap
   - ⚙️ **iOS Configuration**: exportOptions.plist template

   ## Analysis Highlights
   - **Rating**: 7.5/10 for industrial use
   - **Cost**: Free (smartphone) vs $100-$5000 (dedicated hardware)
   - **Gateway Mode**: Rivals industrial IoT gateways
   - **BLE Parsing**: Excellent protocol decoding (iBeacon, manufacturer data)

   ## CI/CD Features
   - ✅ Linting, type checking, unit tests
   - ✅ Android APK/AAB builds
   - ✅ iOS simulator and release builds
   - ✅ Security scanning (CodeQL, TruffleHog)
   - ✅ Automated dependency updates
   - ✅ Build artifacts (30-90 day retention)

   ## Next Steps After Merge
   1. Configure GitHub Actions secrets (for signed releases)
   2. Review first CI run
   3. Set up branch protection rules
   4. Enable Codecov (optional)

   ## Documentation
   - See [ANALYSIS.md](ANALYSIS.md) for detailed code analysis
   - See [.github/workflows/README.md](.github/workflows/README.md) for CI/CD setup
   ```
5. Click "Create Pull Request"

### Option B: Using GitHub CLI (if available)
```bash
gh pr create \
  --title "Add comprehensive code analysis and CI/CD pipeline" \
  --body "See commit message for details" \
  --base main \
  --head claude/analyze-code-add-ci-011CUpc7Me6c5SsMGxZSPxSa
```

## Step 2: Enable GitHub Actions

### 2.1 Check Actions Status
1. Go to repository **Settings** → **Actions** → **General**
2. Ensure **Actions permissions** is set to:
   - ✅ "Allow all actions and reusable workflows"
3. Set **Workflow permissions** to:
   - ✅ "Read and write permissions"
   - ✅ "Allow GitHub Actions to create and approve pull requests"
4. Click **Save**

### 2.2 Verify Workflows
1. Go to **Actions** tab in your repository
2. You should see workflows start running after PR creation
3. Expected workflows:
   - ✅ **CI** (lint, test, type check)
   - ✅ **Android Build** (debug APK)
   - ⏭️ **iOS Build** (skipped - requires macOS runner)
   - ✅ **Security Scan** (CodeQL, npm audit)

## Step 3: Review First CI Run

### 3.1 Monitor Workflow Execution
1. Click on **Actions** tab
2. Click on the workflow run (e.g., "CI #1")
3. Monitor job execution:
   - **Lint & Test**: Should complete in ~2-3 minutes
   - **Android Build**: Should complete in ~5-10 minutes
   - **Security Scan**: Should complete in ~3-5 minutes

### 3.2 Expected Results
- ✅ **CI**: All checks pass (lint, test, type check)
- ✅ **Android Build**: Produces `app-debug.apk` artifact
- ⚠️ **iOS Build**: Will fail (requires macOS runner - only available on paid plans or self-hosted)
- ✅ **Security Scan**: Reports any vulnerabilities

### 3.3 Download Build Artifacts
1. Go to completed workflow run
2. Scroll to **Artifacts** section
3. Download `app-debug.apk` (available for 30 days)
4. Test on Android device/emulator

## Step 4: Configure Secrets (Optional - For Signed Releases)

Signed releases are only needed for production app distribution. You can skip this for development.

### 4.1 Android Signing Setup

#### Generate Keystore (First Time Only)
```bash
# Navigate to android directory
cd android

# Generate release keystore
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore release.keystore \
  -alias mikrod-util \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# You'll be prompted for:
# - Keystore password (save this!)
# - Key password (save this!)
# - Your name and organization details
```

#### Encode Keystore as Base64
```bash
# Encode keystore
cat release.keystore | base64 -w 0 > keystore.base64

# Copy the contents of keystore.base64
cat keystore.base64
```

#### Add Secrets to GitHub
1. Go to repository **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add the following secrets:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `ANDROID_KEYSTORE_BASE64` | Contents of `keystore.base64` | Base64-encoded keystore |
| `KEYSTORE_PASSWORD` | Your keystore password | Password from keytool |
| `KEY_ALIAS` | `mikrod-util` | Key alias from keytool |
| `KEY_PASSWORD` | Your key password | Key password from keytool |

#### Update build.gradle
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

### 4.2 iOS Signing Setup (Advanced)

iOS signing requires an Apple Developer account ($99/year).

#### Prerequisites
- Apple Developer account
- Distribution certificate (.p12)
- Provisioning profile (.mobileprovision)
- App Store Connect API key (for TestFlight)

#### Export Certificate from Keychain (macOS)
```bash
# 1. Open Keychain Access on macOS
# 2. Find your distribution certificate
# 3. Right-click → Export → Save as .p12
# 4. Set a password for the .p12 file

# Encode certificate
cat Certificates.p12 | base64 > cert.base64

# Encode provisioning profile
cat YourApp.mobileprovision | base64 > profile.base64

# Encode App Store Connect API key
cat AuthKey_XXXXXXXX.p8 | base64 > apikey.base64
```

#### Add iOS Secrets to GitHub
| Secret Name | Value | Description |
|-------------|-------|-------------|
| `IOS_CERTIFICATE_BASE64` | Contents of `cert.base64` | Distribution certificate |
| `IOS_CERTIFICATE_PASSWORD` | Your .p12 password | Certificate password |
| `IOS_PROVISION_PROFILE_BASE64` | Contents of `profile.base64` | Provisioning profile |
| `APPLE_API_KEY_ID` | From App Store Connect | API Key ID |
| `APPLE_API_ISSUER_ID` | From App Store Connect | Issuer ID |
| `APPLE_API_KEY_BASE64` | Contents of `apikey.base64` | API key file |

#### Update exportOptions.plist
Edit `ios/exportOptions.plist`:
```xml
<key>teamID</key>
<string>YOUR_TEAM_ID</string> <!-- Replace with your Team ID -->
<key>provisioningProfiles</key>
<dict>
    <key>com.yourcompany.mikrodutil</key> <!-- Replace with your bundle ID -->
    <string>Your Provisioning Profile Name</string>
</dict>
```

## Step 5: Set Up Branch Protection (Recommended)

### 5.1 Protect Main Branch
1. Go to **Settings** → **Branches**
2. Click **Add rule**
3. Branch name pattern: `main`
4. Enable:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - Select required checks:
     - ✅ `Lint & Test`
     - ✅ `Build Android APK/AAB`
   - ✅ Require conversation resolution before merging
   - ✅ Do not allow bypassing the above settings
5. Click **Create**

## Step 6: Create Releases

### 6.1 Manual Release Process
```bash
# 1. Ensure you're on main branch
git checkout main
git pull origin main

# 2. Bump version in package.json
npm version patch  # or minor, or major
# This creates a git tag automatically

# 3. Push changes and tags
git push origin main --tags

# 4. GitHub Actions automatically builds signed releases
# 5. Go to GitHub Releases tab
# 6. Edit the draft release created by Actions
# 7. Add release notes and publish
```

### 6.2 What Happens on Tag Push
When you push a tag like `v1.0.0`:
1. **Android Build** workflow runs with signed build job
2. Creates signed APK (`app-release.apk`)
3. Creates AAB bundle for Google Play (`app-release.aab`)
4. Creates draft GitHub Release with artifacts
5. **iOS Build** workflow runs (if secrets configured)
6. Creates signed IPA
7. Uploads to TestFlight (if API key configured)

## Step 7: Optional Integrations

### 7.1 Codecov (Code Coverage)
1. Sign up at https://codecov.io
2. Add your repository
3. Codecov token is auto-detected for public repos
4. For private repos, add `CODECOV_TOKEN` secret
5. Coverage badge auto-updates on PRs

### 7.2 Status Badges (Already in README)
The README already includes status badges:
```markdown
![CI](https://github.com/mikro-design/mikrod_util/workflows/CI/badge.svg)
![Android Build](https://github.com/mikro-design/mikrod_util/workflows/Android%20Build/badge.svg)
![iOS Build](https://github.com/mikro-design/mikrod_util/workflows/iOS%20Build/badge.svg)
![Security Scan](https://github.com/mikro-design/mikrod_util/workflows/Security%20Scan/badge.svg)
```

These will automatically update with build status.

## Troubleshooting

### CI Workflow Fails

**Problem**: `npm ci` fails with package-lock mismatch
**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
git add package-lock.json
git commit -m "fix: update package-lock.json"
git push
```

**Problem**: TypeScript errors
**Solution**:
```bash
# Run locally to see errors
npx tsc --noEmit

# Fix errors and commit
git add .
git commit -m "fix: resolve TypeScript errors"
git push
```

### Android Build Fails

**Problem**: Gradle wrapper not executable
**Solution**: Already fixed in workflow with `chmod +x android/gradlew`

**Problem**: Java version mismatch
**Solution**: Workflow uses Java 17 (correct for React Native 0.81)

**Problem**: Signed build fails even with secrets
**Solution**: Verify secrets are set correctly and check `build.gradle` configuration

### iOS Build Fails

**Problem**: "Could not find workspace"
**Solution**: Update workflow with correct workspace name:
```yaml
# Check actual workspace name
ls ios/*.xcworkspace

# Update in ios-build.yml
-workspace YourActualName.xcworkspace
```

**Problem**: Code signing errors
**Solution**:
- Verify certificate is valid (not expired)
- Check provisioning profile matches bundle ID
- Ensure Team ID is correct in exportOptions.plist

### Security Scan Warnings

**Problem**: npm audit shows vulnerabilities
**Solution**:
```bash
# View vulnerabilities
npm audit

# Fix automatically if possible
npm audit fix

# For breaking changes
npm audit fix --force

# Commit fixes
git add package-lock.json
git commit -m "fix: update vulnerable dependencies"
git push
```

## Quick Reference

### Common Commands
```bash
# Check workflow status
gh workflow list
gh run list --workflow=ci.yml
gh run view <run-id>

# Download artifacts
gh run download <run-id>

# Create release
git tag v1.0.0
git push origin v1.0.0

# View logs
gh run view <run-id> --log
```

### File Locations
- Workflows: `.github/workflows/*.yml`
- CI/CD docs: `.github/workflows/README.md`
- Analysis: `ANALYSIS.md`
- iOS config: `ios/exportOptions.plist`
- Android config: `android/app/build.gradle`

### Important URLs
- Actions: https://github.com/mikro-design/mikrod_util/actions
- Settings: https://github.com/mikro-design/mikrod_util/settings
- Releases: https://github.com/mikro-design/mikrod_util/releases
- Pull Requests: https://github.com/mikro-design/mikrod_util/pulls

## Next Steps After Setup

1. ✅ Merge the CI/CD PR
2. ✅ Watch first CI run complete
3. ✅ Download and test debug APK
4. 📱 Test app on physical device
5. 🔒 Configure signing for releases (when ready)
6. 🚀 Create first release (v1.0.0)
7. 📊 Review code coverage reports
8. 🔄 Set up automated dependency updates

## Support

If you encounter issues:
1. Check [.github/workflows/README.md](.github/workflows/README.md)
2. Review GitHub Actions logs
3. Search GitHub Actions documentation
4. Open an issue with workflow logs

---

**Note**: Signed releases are optional for development. You can use unsigned debug builds for testing and only set up signing when ready to distribute the app.
