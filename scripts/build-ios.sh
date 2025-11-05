#!/bin/bash
# iOS Local Build Script
# Builds iOS app locally on macOS

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "                    📱 iOS Local Build"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ Error: This script must be run on macOS"
    exit 1
fi

# Check if Xcode is installed
if ! command -v xcodebuild &> /dev/null; then
    echo "❌ Error: Xcode is not installed"
    echo "   Install from: https://apps.apple.com/app/xcode/id497799835"
    exit 1
fi

echo "✅ macOS detected"
echo "✅ Xcode version: $(xcodebuild -version | head -1)"
echo ""

# Check if workspace exists
if [ ! -d "ios/mikrodutil.xcworkspace" ]; then
    echo "⚠️  Xcode workspace not found. Installing CocoaPods dependencies..."
    cd ios

    # Check if bundle is installed
    if ! command -v bundle &> /dev/null; then
        echo "Installing bundler..."
        gem install bundler
    fi

    bundle install
    bundle exec pod install
    cd ..
    echo "✅ CocoaPods dependencies installed"
    echo ""
fi

# Parse arguments
BUILD_TYPE="${1:-debug}"
BUILD_TARGET="${2:-simulator}"

echo "Build configuration:"
echo "  Type: $BUILD_TYPE"
echo "  Target: $BUILD_TARGET"
echo ""

cd ios

if [ "$BUILD_TARGET" == "simulator" ]; then
    echo "🔨 Building for iOS Simulator..."
    echo ""

    xcodebuild -workspace mikrodutil.xcworkspace \
        -scheme mikrodutil \
        -configuration Debug \
        -sdk iphonesimulator \
        -destination 'platform=iOS Simulator,name=iPhone 15,OS=latest' \
        clean build \
        CODE_SIGN_IDENTITY="" \
        CODE_SIGNING_REQUIRED=NO \
        CODE_SIGNING_ALLOWED=NO

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ Simulator build complete!"
    echo ""
    echo "To run in simulator:"
    echo "  npm run ios"
    echo ""
    echo "Or open in Xcode:"
    echo "  open ios/mikrodutil.xcworkspace"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

elif [ "$BUILD_TARGET" == "device" ]; then
    echo "🔨 Building for iOS Device..."
    echo ""
    echo "⚠️  This requires:"
    echo "   • Apple Developer account"
    echo "   • Valid provisioning profile"
    echo "   • Code signing certificate"
    echo ""

    if [ "$BUILD_TYPE" == "release" ]; then
        CONFIG="Release"
    else
        CONFIG="Debug"
    fi

    # Create build directory
    mkdir -p build

    xcodebuild -workspace mikrodutil.xcworkspace \
        -scheme mikrodutil \
        -configuration $CONFIG \
        -sdk iphoneos \
        -archivePath build/mikrodutil.xcarchive \
        archive

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ Device archive complete!"
    echo ""
    echo "Archive location:"
    echo "  ios/build/mikrodutil.xcarchive"
    echo ""
    echo "To export IPA:"
    echo "  xcodebuild -exportArchive \\"
    echo "    -archivePath ios/build/mikrodutil.xcarchive \\"
    echo "    -exportPath ios/build \\"
    echo "    -exportOptionsPlist ios/exportOptions.plist"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

else
    echo "❌ Error: Unknown build target '$BUILD_TARGET'"
    echo "   Valid options: simulator, device"
    exit 1
fi

cd ..
