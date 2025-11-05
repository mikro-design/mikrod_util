#!/bin/bash
# CI/CD Validation Script
# Run this locally to check if CI will pass

set -e

echo "=========================================="
echo "Mikrod Util CI/CD Validation"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track failures
FAILURES=0

# Check Node version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 20 ]; then
    echo -e "${GREEN}✓ Node.js version: $(node -v)${NC}"
else
    echo -e "${RED}✗ Node.js version too old: $(node -v) (need >=20)${NC}"
    FAILURES=$((FAILURES + 1))
fi
echo ""

# Check npm
echo "📦 Checking npm..."
if command -v npm &> /dev/null; then
    echo -e "${GREEN}✓ npm version: $(npm -v)${NC}"
else
    echo -e "${RED}✗ npm not found${NC}"
    FAILURES=$((FAILURES + 1))
fi
echo ""

# Check package.json
echo "📄 Checking package.json..."
if [ -f "package.json" ]; then
    echo -e "${GREEN}✓ package.json exists${NC}"

    # Check required scripts
    if grep -q '"lint"' package.json; then
        echo -e "${GREEN}✓ lint script found${NC}"
    else
        echo -e "${RED}✗ lint script missing${NC}"
        FAILURES=$((FAILURES + 1))
    fi

    if grep -q '"test"' package.json; then
        echo -e "${GREEN}✓ test script found${NC}"
    else
        echo -e "${RED}✗ test script missing${NC}"
        FAILURES=$((FAILURES + 1))
    fi
else
    echo -e "${RED}✗ package.json not found${NC}"
    FAILURES=$((FAILURES + 1))
fi
echo ""

# Check TypeScript config
echo "📝 Checking TypeScript configuration..."
if [ -f "tsconfig.json" ]; then
    echo -e "${GREEN}✓ tsconfig.json exists${NC}"
else
    echo -e "${RED}✗ tsconfig.json not found${NC}"
    FAILURES=$((FAILURES + 1))
fi
echo ""

# Check ESLint config
echo "🔍 Checking ESLint configuration..."
if [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ] || [ -f "eslint.config.js" ]; then
    echo -e "${GREEN}✓ ESLint config exists${NC}"
else
    echo -e "${RED}✗ ESLint config not found${NC}"
    FAILURES=$((FAILURES + 1))
fi
echo ""

# Check Jest config
echo "🧪 Checking Jest configuration..."
if [ -f "jest.config.js" ] || grep -q '"jest"' package.json; then
    echo -e "${GREEN}✓ Jest config exists${NC}"
else
    echo -e "${YELLOW}⚠ Jest config not found (tests may not run)${NC}"
fi
echo ""

# Check workflows
echo "⚙️  Checking GitHub Actions workflows..."
if [ -d ".github/workflows" ]; then
    echo -e "${GREEN}✓ Workflows directory exists${NC}"

    WORKFLOW_COUNT=$(ls -1 .github/workflows/*.yml 2>/dev/null | wc -l)
    echo -e "${GREEN}✓ Found $WORKFLOW_COUNT workflow files${NC}"

    # List workflows
    for workflow in .github/workflows/*.yml; do
        if [ -f "$workflow" ]; then
            WORKFLOW_NAME=$(basename "$workflow")
            echo "  - $WORKFLOW_NAME"
        fi
    done
else
    echo -e "${RED}✗ Workflows directory not found${NC}"
    FAILURES=$((FAILURES + 1))
fi
echo ""

# Check Android setup
echo "🤖 Checking Android configuration..."
if [ -d "android" ]; then
    echo -e "${GREEN}✓ android/ directory exists${NC}"

    if [ -f "android/gradlew" ]; then
        echo -e "${GREEN}✓ Gradle wrapper exists${NC}"

        if [ -x "android/gradlew" ]; then
            echo -e "${GREEN}✓ Gradle wrapper is executable${NC}"
        else
            echo -e "${YELLOW}⚠ Gradle wrapper not executable (CI will fix this)${NC}"
        fi
    else
        echo -e "${RED}✗ Gradle wrapper not found${NC}"
        FAILURES=$((FAILURES + 1))
    fi

    if [ -f "android/app/build.gradle" ]; then
        echo -e "${GREEN}✓ build.gradle exists${NC}"
    else
        echo -e "${RED}✗ build.gradle not found${NC}"
        FAILURES=$((FAILURES + 1))
    fi
else
    echo -e "${RED}✗ android/ directory not found${NC}"
    FAILURES=$((FAILURES + 1))
fi
echo ""

# Check iOS setup
echo "🍎 Checking iOS configuration..."
if [ -d "ios" ]; then
    echo -e "${GREEN}✓ ios/ directory exists${NC}"

    if [ -f "ios/Podfile" ]; then
        echo -e "${GREEN}✓ Podfile exists${NC}"
    else
        echo -e "${RED}✗ Podfile not found${NC}"
        FAILURES=$((FAILURES + 1))
    fi

    if [ -f "Gemfile" ]; then
        echo -e "${GREEN}✓ Gemfile exists${NC}"
    else
        echo -e "${YELLOW}⚠ Gemfile not found (may need for CocoaPods)${NC}"
    fi

    # Check for workspace
    WORKSPACE_COUNT=$(ls -1 ios/*.xcworkspace 2>/dev/null | wc -l)
    if [ "$WORKSPACE_COUNT" -gt 0 ]; then
        WORKSPACE_NAME=$(ls -1 ios/*.xcworkspace | head -1 | xargs basename)
        echo -e "${GREEN}✓ Xcode workspace: $WORKSPACE_NAME${NC}"
    else
        echo -e "${YELLOW}⚠ No Xcode workspace found (run 'pod install')${NC}"
    fi
else
    echo -e "${RED}✗ ios/ directory not found${NC}"
    FAILURES=$((FAILURES + 1))
fi
echo ""

# Try running checks (if dependencies installed)
if [ -d "node_modules" ]; then
    echo "🧪 Running quick validation checks..."

    echo "  Running TypeScript check..."
    if npx tsc --noEmit --pretty 2>&1 | head -20; then
        echo -e "${GREEN}✓ TypeScript check passed${NC}"
    else
        echo -e "${RED}✗ TypeScript check failed (see errors above)${NC}"
        FAILURES=$((FAILURES + 1))
    fi
    echo ""

    echo "  Running ESLint..."
    if npm run lint 2>&1 | head -20; then
        echo -e "${GREEN}✓ ESLint passed${NC}"
    else
        echo -e "${YELLOW}⚠ ESLint found issues (see above)${NC}"
    fi
    echo ""

    echo "  Running Prettier check..."
    if npx prettier --check "**/*.{js,jsx,ts,tsx,json,md}" 2>&1 | head -20; then
        echo -e "${GREEN}✓ Prettier check passed${NC}"
    else
        echo -e "${YELLOW}⚠ Prettier found formatting issues${NC}"
        echo "  Run: npx prettier --write \"**/*.{js,jsx,ts,tsx,json,md}\""
    fi
    echo ""
else
    echo -e "${YELLOW}⚠ node_modules not found - run 'npm install' first${NC}"
    echo "  Skipping TypeScript/ESLint checks"
    echo ""
fi

# Summary
echo "=========================================="
echo "Validation Summary"
echo "=========================================="
if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}✓ All critical checks passed!${NC}"
    echo "Your CI/CD pipeline is ready to run."
    echo ""
    echo "Next steps:"
    echo "  1. Create Pull Request"
    echo "  2. Enable GitHub Actions in repository settings"
    echo "  3. Watch CI run automatically"
    exit 0
else
    echo -e "${RED}✗ Found $FAILURES critical issue(s)${NC}"
    echo "Please fix the issues above before pushing."
    echo ""
    echo "Common fixes:"
    echo "  - Update Node.js: https://nodejs.org/"
    echo "  - Install dependencies: npm install"
    echo "  - Fix TypeScript errors: npx tsc --noEmit"
    echo "  - Fix ESLint errors: npm run lint -- --fix"
    exit 1
fi
