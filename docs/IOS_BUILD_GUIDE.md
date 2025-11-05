# iOS Build Guide

This guide explains how to build Mikrod Util for iOS, both locally and in CI/CD.

## Quick Start (Local Builds)

### Prerequisites
- **macOS** computer (required for iOS development)
- **Xcode 14+** ([Download from App Store](https://apps.apple.com/app/xcode/id497799835))
- **CocoaPods** (will be installed automatically)
- **Node.js 20+**

### First-Time Setup

```bash
# Install dependencies
npm install

# Install CocoaPods dependencies
npm run ios:pods

# This runs:
# cd ios && bundle exec pod install
```

### Build for Simulator (Development)

```bash
# Quick run in simulator
npm run ios

# Or build without running
npm run ios:build
```

This will:
- Build for iOS Simulator
- Use Debug configuration
- No code signing required
- Opens in Xcode Simulator

### Build for Device (Testing/Release)

```bash
# Build archive for device
npm run ios:build:device
```

**Requirements:**
- Apple Developer account ($99/year)
- Valid provisioning profile
- Code signing certificate

This will:
- Build for physical iOS device
- Create archive in `ios/build/mikrodutil.xcarchive`
- Ready for export to IPA

## Manual Build Commands

### Simulator Build

```bash
cd ios

xcodebuild -workspace mikrodutil.xcworkspace \
  -scheme mikrodutil \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 15,OS=latest' \
  clean build
```

### Device Archive

```bash
cd ios

xcodebuild -workspace mikrodutil.xcworkspace \
  -scheme mikrodutil \
  -configuration Release \
  -sdk iphoneos \
  -archivePath build/mikrodutil.xcarchive \
  archive
```

### Export IPA

```bash
cd ios

xcodebuild -exportArchive \
  -archivePath build/mikrodutil.xcarchive \
  -exportPath build \
  -exportOptionsPlist exportOptions.plist
```

## GitHub Actions (Automated Builds)

### Current Status

❌ **Not Available on Free Tier**

GitHub Actions iOS builds require macOS runners, which are only available on:
- GitHub Pro ($4/month)
- GitHub Team ($4/user/month)
- GitHub Enterprise

### Your Current iOS Workflow

Your repository includes a pre-configured iOS workflow at `.github/workflows/ios-build.yml` that will automatically activate when you:

1. Upgrade to GitHub Pro/Team
2. Set up a self-hosted macOS runner

The workflow will then:
- Build on every push to main/develop
- Create IPA on tags (v*)
- Upload to TestFlight (if configured)

### Alternative CI Services (Free iOS Builds)

If you don't want to pay for GitHub Pro, consider these free alternatives:

#### 1. Codemagic (Recommended for React Native)

**Free Tier:**
- 500 build minutes/month
- macOS build machines included
- Easy React Native setup

**Setup:**
1. Sign up at [codemagic.io](https://codemagic.io)
2. Connect your GitHub repository
3. Codemagic auto-detects React Native projects
4. Configure build settings in UI or `codemagic.yaml`

**Sample codemagic.yaml:**
```yaml
workflows:
  ios-workflow:
    name: iOS Workflow
    max_build_duration: 60
    environment:
      node: 20
      xcode: latest
    scripts:
      - name: Install dependencies
        script: |
          npm install
          cd ios && pod install
      - name: Build
        script: |
          xcodebuild -workspace ios/mikrodutil.xcworkspace \
            -scheme mikrodutil \
            -sdk iphoneos \
            -configuration Release \
            archive
    artifacts:
      - ios/build/*.ipa
```

#### 2. Bitrise

**Free Tier:**
- 200 builds/month
- Good React Native support
- 30-minute build time limit

**Setup:**
1. Sign up at [bitrise.io](https://bitrise.io)
2. Add your repository
3. Select "React Native" project type
4. Use pre-built iOS workflow

#### 3. CircleCI

**Free Tier:**
- 6,000 build minutes/month
- macOS builds included
- Professional CI features

**Setup:**
1. Sign up at [circleci.com](https://circleci.com)
2. Add your repository
3. Create `.circleci/config.yml`

**Sample config.yml:**
```yaml
version: 2.1

jobs:
  build-ios:
    macos:
      xcode: 15.0.0
    steps:
      - checkout
      - restore_cache:
          keys:
            - yarn-{{ checksum "package.json" }}
      - run:
          name: Install dependencies
          command: |
            npm install
            cd ios && pod install
      - run:
          name: Build iOS
          command: |
            xcodebuild -workspace ios/mikrodutil.xcworkspace \
              -scheme mikrodutil \
              -sdk iphonesimulator \
              build
      - save_cache:
          key: yarn-{{ checksum "package.json" }}
          paths:
            - node_modules

workflows:
  build:
    jobs:
      - build-ios
```

## Self-Hosted macOS Runner (Free on GitHub)

If you have a Mac that can stay online, you can use it as a GitHub Actions runner.

### Setup Self-Hosted Runner

1. **Go to GitHub repository Settings:**
   ```
   Settings → Actions → Runners → New self-hosted runner
   ```

2. **Select macOS and follow the instructions:**
   ```bash
   # Download runner
   mkdir actions-runner && cd actions-runner
   curl -o actions-runner-osx.tar.gz -L \
     https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-osx-x64-2.311.0.tar.gz
   tar xzf ./actions-runner-osx.tar.gz

   # Configure
   ./config.sh --url https://github.com/mikro-design/mikrod_util --token YOUR_TOKEN

   # Install as service (runs at startup)
   ./svc.sh install
   ./svc.sh start
   ```

3. **Update your iOS workflow:**

   In `.github/workflows/ios-build.yml`, change:
   ```yaml
   runs-on: macos-14  # GitHub hosted (paid)
   ```

   To:
   ```yaml
   runs-on: self-hosted  # Your Mac
   ```

### Requirements for Self-Hosted Runner

- Mac running macOS 11+
- Xcode installed
- CocoaPods installed
- Must stay online to process builds
- Good internet connection

## Code Signing Setup

### For Local Development

You need:
1. Apple Developer account
2. Development certificate
3. Development provisioning profile

**Auto-sign in Xcode:**
1. Open `ios/mikrodutil.xcworkspace` in Xcode
2. Select project → Signing & Capabilities
3. Check "Automatically manage signing"
4. Select your Team

### For App Store Distribution

You need:
1. Apple Developer account ($99/year)
2. Distribution certificate
3. App Store provisioning profile
4. App Store Connect API key (for automation)

**Generate Certificates:**
1. Go to [developer.apple.com/account/resources/certificates](https://developer.apple.com/account/resources/certificates)
2. Create "iOS Distribution" certificate
3. Download and install in Keychain

**Export for CI:**
```bash
# Export certificate from Keychain
# Right-click → Export → Save as .p12

# Encode for GitHub secrets
cat Certificates.p12 | base64 > cert.base64

# Encode provisioning profile
cat YourProfile.mobileprovision | base64 > profile.base64
```

**Add to GitHub Secrets:**
- `IOS_CERTIFICATE_BASE64` - Contents of cert.base64
- `IOS_CERTIFICATE_PASSWORD` - Password you set for .p12
- `IOS_PROVISION_PROFILE_BASE64` - Contents of profile.base64

## Troubleshooting

### Error: "No such module 'React'"

**Solution:**
```bash
cd ios
bundle exec pod install
cd ..
npm run ios
```

### Error: "Command PhaseScriptExecution failed"

**Solution:**
```bash
# Clean build folder
cd ios
xcodebuild clean
cd ..

# Rebuild
npm run ios
```

### Error: "Unable to boot simulator"

**Solution:**
```bash
# Kill simulator processes
killall Simulator

# Open simulator manually
open -a Simulator

# Then try again
npm run ios
```

### Error: "Code signing required"

**Solution for simulator:**
```bash
# Simulator builds don't need signing
npm run ios:build
```

**Solution for device:**
- Open Xcode
- Select your development team
- Xcode will fix signing automatically

### Error: "Ruby gem bundler not found"

**Solution:**
```bash
gem install bundler
cd ios
bundle install
cd ..
```

## Build Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run ios` | Run in iOS Simulator |
| `npm run ios:build` | Build for Simulator (no code sign) |
| `npm run ios:build:device` | Build archive for device |
| `npm run ios:pods` | Install/update CocoaPods |
| `./scripts/build-ios.sh` | Direct script access |
| `./scripts/build-ios.sh release device` | Build release for device |

## iOS Workflow Status

Your iOS workflow (`.github/workflows/ios-build.yml`) is:
- ✅ Created and configured
- ✅ Ready to use when you have macOS runner
- ⏸️ Waiting for macOS runner (GitHub Pro or self-hosted)

**What it will do when activated:**
- Build on every push
- Create IPA on tags
- Upload to TestFlight (optional)
- Run tests

## Next Steps

**For Development (Now):**
```bash
npm run ios  # Run in simulator
```

**For Testing on Device (Requires Apple Developer):**
```bash
npm run ios:build:device
```

**For CI/CD:**
Choose one:
1. Upgrade to GitHub Pro ($4/month) - easiest
2. Set up self-hosted runner - free but requires Mac
3. Use Codemagic/Bitrise/CircleCI - free tier available

## Resources

- [React Native iOS Setup](https://reactnative.dev/docs/environment-setup)
- [Xcode Documentation](https://developer.apple.com/documentation/xcode)
- [CocoaPods Guides](https://guides.cocoapods.org/)
- [Apple Developer Portal](https://developer.apple.com/)
- [GitHub Actions macOS Runners](https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners)

---

**Summary:**
- ✅ Local builds work now (if you have a Mac)
- ✅ iOS workflow is ready and waiting
- ⏸️ CI builds need macOS runner (paid or self-hosted)
- 💡 Free alternatives available (Codemagic, Bitrise, CircleCI)
