# Readest Codebase Cleanup Plan
## Removing Mobile/Desktop-Specific Code for Web-Only Reader

### Overview
This plan outlines the removal of mobile (Android/iOS) and desktop (macOS/Windows/Linux) specific code to create a clean web-only ebook reader that can be used as a foundation for custom projects.

---

## Phase 1: Platform-Specific Directories and Files

### 1.1 Remove Mobile-Specific Rust Code
**Files to delete:**
- `src-tauri/src/android/` (entire directory)
  - `eink.rs` - E-ink display support for Android
  - `mod.rs` - Android module initialization

**Impact:** Removes Android-specific native implementations

### 1.2 Remove Desktop-Specific Rust Code
**Files to delete:**
- `src-tauri/src/macos/` (entire directory)
  - `apple_auth.rs` - Apple Sign-In
  - `safari_auth.rs` - Safari OAuth
  - `system_dictionary.rs` - macOS system dictionary
  - `traffic_light.rs` - macOS window traffic lights
  - `window.rs` - macOS window management
  - `menu.rs` - macOS menu bar
  - `os_version.rs` - macOS version detection
- `src-tauri/src/windows/` (entire directory)
  - `mod.rs` - Windows-specific code (currently empty but reserved)

**Impact:** Removes platform-specific window management and OS integrations

### 1.3 Remove Platform-Specific Plugins
**Directories to delete:**
- `src-tauri/plugins/tauri-plugin-native-bridge/android/` - Android native bridge
- `src-tauri/plugins/tauri-plugin-native-bridge/ios/` - iOS native bridge

**Impact:** Removes mobile-specific native implementations

---

## Phase 2: TypeScript/JavaScript Platform-Specific Code

### 2.1 Remove Mobile-Specific Hooks and Services
**Files to delete:**
- `src/hooks/useAndroidFilePicker.ts` - Android file picker integration
- `src/services/biometric.ts` - Biometric authentication (mobile-only)

**Files to modify:**
- `src/hooks/useFileSelector.ts` - Remove Android/iOS-specific logic (content:// URIs, SAF picker)
- `src/hooks/useSafeAreaInsets.ts` - Remove mobile safe area logic, keep web CSS fallback
- `src/services/nativeAppService.ts` - Remove mobile-specific flags and implementations

### 2.2 Remove Desktop-Specific UI Components
**Files to delete:**
- `src/components/WindowButtons.tsx` - Window minimize/maximize/close buttons
- `src/hooks/useTrafficLight.ts` - macOS traffic light positioning
- `src/store/trafficLightStore.ts` - Traffic light state management

**Files to modify:**
- Remove window button imports and usage from:
  - `src/app/auth/page.tsx`
  - `src/app/library/components/LibraryHeader.tsx`
  - `src/app/reader/components/HeaderBar.tsx`
  - `src/app/user/components/Header.tsx`
  - `src/app/opds/components/Navigation.tsx`

### 2.3 Remove Device Control Features (Mobile-Only)
**Files to delete:**
- `src/store/deviceStore.ts` - Volume keys, back key, screen brightness, haptics
- `src/hooks/useScreenBrightness.ts` - Screen brightness control
- `src/hooks/useBrightnessGesture.ts` - Brightness gesture control
- `src/hooks/useSwipeToDismiss.ts` - Mobile swipe-to-dismiss

**Files to modify:**
- Remove device control imports from:
  - `src/components/settings/ControlPanel.tsx`
  - `src/app/reader/components/footerbar/ColorPanel.tsx`
  - `src/components/settings/PageTurnerSettings.tsx`

### 2.4 Remove Mobile-Specific File Operations
**Files to modify:**
- `src/services/nativeAppService.ts` - Remove:
  - `saveImageToGallery()` method
  - Content URI handling
  - Mobile-specific directory selection
  - Android SAF file picker logic

- `src/types/system.ts` - Remove mobile-specific flags:
  - `hasSafeAreaInset`
  - `hasHaptics`
  - `hasOrientationLock`
  - `hasScreenBrightness`
  - `hasAmbientLightSensor`
  - `isMobileApp`
  - `isAndroidApp`
  - `isIOSApp`

### 2.5 Remove Desktop-Specific Features
**Files to modify:**
- `src/services/nativeAppService.ts` - Remove:
  - `hasWindowBar`
  - `hasContextMenu`
  - `hasRoundedWindow`
  - `hasTrafficLight`
  - `hasUpdater`
  - `isDesktopApp`
  - `isMacOSApp`
  - `isWindowsApp`
  - `isLinuxApp`
  - `isAppImage`
  - `isPortableApp`
  - Window management methods

- `src/types/system.ts` - Remove desktop-specific flags from `AppService` interface

---

## Phase 3: In-App Purchase (IAP) and Payment Systems

### 3.1 Remove Mobile IAP Integrations
**Directories to delete:**
- `src/libs/payment/iap/` (entire directory)
  - `apple/` - Apple IAP
  - `google/` - Google Play IAP
  - `client.ts` - IAP client
  - `notifications.ts` - IAP notifications
  - `server.ts` - IAP server verification
  - `telemetry.ts` - IAP telemetry
  - `types.ts` - IAP types
  - `utils.ts` - IAP utilities
  - `verifier.ts` - IAP verifier

**API routes to delete:**
- `src/app/api/apple/` (entire directory)
- `src/app/api/google/` (entire directory)

**Files to modify:**
- `src/hooks/useAvailablePlans.ts` - Remove IAP-specific logic
- `src/app/user/page.tsx` - Remove IAP-related UI
- `src/app/user/subscription/success/page.tsx` - Remove IAP success handling
- `src/components/settings/AIPanel.tsx` - Remove IAP-related settings

**Impact:** Removes all mobile app store payment integrations

### 3.2 Keep Stripe for Web
**Keep:**
- `src/libs/payment/stripe/` - Stripe web payments
- `src/libs/payment/storage.ts` - Payment storage (used by Stripe)

---

## Phase 4: Build and Deployment Infrastructure

### 4.1 Remove Mobile Build Scripts
**Files to delete:**
- `scripts/release-google-play.sh`
- `scripts/validate-google-play-listing.sh`
- `scripts/release-ios-appstore.sh`
- `scripts/fix-ios-appstore-appgroup.sh`
- `scripts/verify-ios-appstore-entitlements.sh`
- `scripts/test-android.sh`
- `scripts/release-mac-appstore.sh`
- `scripts/generate-apple-client-secret.mjs`

**Directory to delete:**
- `fastlane/` (entire directory) - Mobile app store deployment

### 4.2 Remove Desktop Build Configuration
**Files to delete:**
- `src-tauri/tauri.macos-nonestore.conf.json`
- `src-tauri/tauri.windows.conf.json`
- `src-tauri/tauri.appstore.conf.json`
- `src-tauri/nsis/` (Windows installer)
- `src-tauri/icons/` (Desktop app icons)

### 4.3 Remove Tauri-Specific Configuration
**Files to delete:**
- `src-tauri/` (entire directory) - Remove all Tauri/Rust backend
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `src-tauri/build.rs`
- `src-tauri/tauri.conf.json`
- `src-tauri/Info.plist`
- `src-tauri/Info-ios.plist`
- `src-tauri/capabilities/`
- `src-tauri/permissions/`
- `src-tauri/profiles/`

**Impact:** Removes entire desktop/mobile native backend

### 4.4 Update Package.json Scripts
**File to modify:** `apps/readest-app/package.json`

**Scripts to remove:**
```json
"dev": "dotenv -e .env.tauri -- next dev",
"build": "dotenv -e .env.tauri -- next build",
"start": "dotenv -e .env.tauri -- next start",
"dev-android": "...",
"dev-ios": "...",
"dev-ios-sim": "...",
"dev-macos": "...",
"build-tauri": "...",
"build-win-x64": "...",
"build-win-arm64": "...",
"build-linux-x64": "...",
"build-macos-universial": "...",
"build-macos-universial-appstore": "...",
"build-ios": "...",
"build-ios-appstore": "...",
"release-macos-universial-appstore": "...",
"release-ios-appstore": "...",
"submit-appstore-ios": "...",
"submit-appstore-macos": "...",
"release-google-play": "...",
"validate-google-play": "...",
"tauri": "tauri",
"tauri:dev:test": "...",
"tauri:build:test": "...",
"fmt:check": "cargo fmt -p Readest --check",
"clippy:check": "cargo clippy -p Readest --no-deps -- -D warnings",
"test:rust": "cargo test -p Readest --lib"
```

**Scripts to keep/modify:**
```json
"dev-web": "dotenv -e .env.web -- next dev",
"build-web": "dotenv -e .env.web -- next build",
"start-web": "dotenv -e .env.web -- next start",
"test": "dotenv -e .env -e .env.test.local -- vitest",
"test:browser": "dotenv -e .env -e .env.test.local -- vitest run --config vitest.browser.config.mts",
"test:e2e:web": "playwright test",
"test:e2e:web:headed": "playwright test --headed --workers=1 --trace on",
"test:e2e:web:ui": "playwright test --ui",
"test:e2e:web:report": "playwright show-report"
```

**Dependencies to remove from package.json:**
- All `@tauri-apps/*` packages
- `@choochmeque/tauri-plugin-sharekit-api`
- `tauri-plugin-device-info-api`
- `@googleapis/androidpublisher`
- `app-store-server-api`
- `stripe` (keep @stripe/react-stripe-js and @stripe/stripe-js for web)

---

## Phase 5: Environment Configuration

### 5.1 Remove Platform-Specific Environment Files
**Files to delete:**
- `.env.tauri`
- `.env.tauri.example`
- `.env.web.example` (keep .env.web as template)

### 5.2 Remove Platform-Specific Config Files
**Files to delete:**
- `vitest.android.config.mts`
- `vitest.tauri.config.mts`
- `vitest.tauri.setup.ts`
- `wdio.conf.ts` (WebdriverIO for mobile E2E)
- `scripts/test-tauri.sh`

---

## Phase 6: Type System and Service Layer

### 6.1 Simplify AppService Interface
**File to modify:** `src/types/system.ts`

**Remove from AppService interface:**
```typescript
hasTrafficLight: boolean;
hasWindow: boolean;
hasWindowBar: boolean;
hasContextMenu: boolean;
hasRoundedWindow: boolean;
hasSafeAreaInset: boolean;
hasHaptics: boolean;
hasUpdater: boolean;
hasOrientationLock: boolean;
hasScreenBrightness: boolean;
hasAmbientLightSensor: boolean;
hasIAP: boolean;
isMobile: boolean;
isAppDataSandbox: boolean;
isMobileApp: boolean;
isAndroidApp: boolean;
isIOSApp: boolean;
isMacOSApp: boolean;
isLinuxApp: boolean;
isWindowsApp: boolean;
isPortableApp: boolean;
isDesktopApp: boolean;
isAppImage: boolean;
isEink: boolean;
canCustomizeRootDir: boolean;
canReadExternalDir: boolean;
distChannel: DistChannel;
storefrontRegionCode: string | null;
```

**Keep:**
```typescript
osPlatform: OsPlatform; // Will always be 'unknown' for web
appPlatform: AppPlatform; // Will always be 'web'
supportsCanvasContext2DFilter: boolean;
supportsViewTransitionsAPI: boolean;
supportsViewTransitionGroup: boolean;
isOnlineCatalogsAccessible: boolean;
```

**Remove methods:**
- `allowPathsInScopes?`
- `saveImageToGallery`
- All platform-specific file operations

### 6.2 Remove NativeAppService
**File to delete:** `src/services/nativeAppService.ts`

**Keep:** `src/services/webAppService.ts` as the primary service

### 6.3 Simplify Environment Detection
**File to modify:** `src/services/environment.ts`

**Remove:**
- `isTauriAppPlatform()` function
- Platform-specific OS detection

**Keep:**
- Web-only environment detection

---

## Phase 7: UI Components and Styling

### 7.1 Remove Platform-Specific UI Components
**Components to delete:**
- `src/components/WindowButtons.tsx`
- `src/components/UpdaterWindow.tsx` (Desktop updater)

**Components to modify:**
- Remove platform-specific conditional rendering from all components
- Remove safe area inset logic from CSS (keep web viewport meta tag handling)
- Remove e-ink specific CSS classes (keep if you want e-ink web support)

### 7.2 Remove Platform-Specific Styling
**File to modify:** `src/styles/globals.css`

**Remove:**
- `[data-eink='true']` specific styles (optional - keep if you want e-ink web support)
- Safe area inset CSS variables (keep web viewport units)

---

## Phase 8: Tests

### 8.1 Remove Platform-Specific Tests
**Test files to delete:**
- `vitest.android.config.mts`
- `vitest.tauri.config.mts`
- `wdio.conf.ts`
- `__tests__/hooks/useAndroidFilePicker.test.tsx`
- `__tests__/services/biometric.test.ts`
- `__tests__/services/native-app-service-*.test.ts`
- `__tests__/utils/hardwareKeys.test.ts`
- `__tests__/store/device-store.test.ts`
- `__tests__/store/traffic-light-store.test.ts`
- `__tests__/components/WindowButtons.test.tsx`
- `__tests__/components/UpdaterWindow.test.tsx`
- All tests in `__tests__/android/` directory
- All tests with `.android.test.ts`, `.ios.test.ts`, `.tauri.test.ts` suffixes

### 8.2 Keep Web-Only Tests
**Keep:**
- `vitest.config.mts` (web unit tests)
- `vitest.browser.config.mts` (browser tests)
- `playwright.config.ts` (web E2E tests)
- All web-specific test files

---

## Phase 9: Documentation and Metadata

### 9.1 Remove Platform-Specific Documentation
**Files to delete:**
- `data/metainfo/` (Linux AppStream metadata)
- `data/icons/` (Desktop app icons)
- `data/screenshots/` (Platform-specific screenshots)
- `fastlane/` metadata directories

### 9.2 Update README
**File to modify:** `README.md`

**Remove:**
- Platform-specific download links
- Platform-specific badges
- Platform-specific build instructions
- Mobile app store badges
- Desktop installation instructions

**Update:**
- Focus on web deployment
- Update build instructions for web-only
- Update feature list to remove platform-specific features

### 9.3 Remove Root-Level Platform Files
**Files to delete:**
- `Dockerfile` (Desktop container)
- `.dockerignore`
- `docker/` directory
- `ops/` directory (NixOS configs)

---

## Phase 10: Monorepo Cleanup

### 10.1 Remove Unnecessary Apps
**Directories to consider:**
- `apps/readest-calibre-plugin/` - Keep if you want Calibre integration
- `apps/readest.koplugin/` - Keep if you want KOReader integration

### 10.2 Remove Unnecessary Packages
**Directories to review:**
- `packages/tao/` - Desktop window library (remove)
- `packages/swift-rs/` - Swift bindings (remove)
- Keep packages used by web: `foliate-js`, `js-mdict`, `qcms`, `simplecc-wasm`

### 10.3 Update Root Package.json
**File to modify:** `package.json` (root)

**Remove scripts:**
- `"tauri": "pnpm --filter @readest/readest-app tauri"`
- Any Tauri-related scripts

**Keep:**
- Web-related scripts
- Linting and formatting scripts

---

## Phase 11: Safe Area Insets (Decision Point)

### Option A: Remove Completely
**If you don't care about mobile web browsers:**
- Delete `src/hooks/useSafeAreaInsets.ts`
- Delete `src/utils/insets.ts`
- Remove safe area CSS from `src/styles/globals.css`
- Remove safe area logic from all components

### Option B: Keep for Mobile Web
**If you want to support mobile web browsers:**
- Keep `src/hooks/useSafeAreaInsets.ts` but simplify to web-only
- Keep CSS environment variable fallback
- Remove native bridge calls
- Remove iPadOS special handling

---

## Phase 12: E-Ink Support (Decision Point)

### Option A: Remove Completely
**If you don't care about e-ink devices:**
- Remove `[data-eink='true']` CSS from `src/styles/globals.css`
- Remove e-ink detection logic
- Remove e-ink-specific test files

### Option B: Keep for Web E-Ink
**If you want to support e-ink web browsers:**
- Keep e-ink CSS classes
- Remove native e-ink detection (keep CSS media queries or manual toggle)
- Keep as a user-selectable theme option

---

## Summary of What Remains

### Core Web Reader Features (Kept)
- ✅ Multi-format book support (EPUB, PDF, MOBI, FB2, CBZ, TXT, MD)
- ✅ Reading interface with scroll/page modes
- ✅ Annotations and highlights
- ✅ Bookmarks
- ✅ Dictionary/Wikipedia lookup
- ✅ TTS (text-to-speech)
- ✅ Translation (DeepL, Yandex)
- ✅ Library management
- ✅ OPDS/Calibre integration
- ✅ Custom fonts and themes
- ✅ Keyboard shortcuts
- ✅ Search within books
- ✅ Reading statistics
- ✅ Cloud sync (via existing providers)
- ✅ Web-only file picker
- ✅ Local storage (IndexedDB/localStorage)
- ✅ Stripe web payments

### Removed Features
- ❌ Mobile apps (Android/iOS)
- ❌ Desktop apps (macOS/Windows/Linux)
- ❌ Native window management
- ❌ Biometric authentication
- ❌ Mobile IAP (App Store/Play Store)
- ❌ Hardware key interception (volume/back)
- ❌ Screen brightness control
- ❌ Haptics
- ❌ Orientation lock
- ❌ Native file system access
- ❌ Desktop updater
- ❌ Platform-specific integrations (Apple Sign-In, Safari OAuth, etc.)
- ❌ Discord rich presence
- ❌ Native TTS engines
- ❌ System dictionary integration

---

## Implementation Order

1. **Start with infrastructure** (Phase 4-6) - Remove build configs and Tauri
2. **Then remove services** (Phase 2-3) - Clean up business logic
3. **Then remove UI** (Phase 7) - Clean up components
4. **Then remove tests** (Phase 8) - Clean up test suite
5. **Finally cleanup documentation** (Phase 9-10) - Update docs and metadata

---

## Post-Cleanup Verification

After cleanup, verify:
1. ✅ Web dev server starts (`pnpm dev-web`)
2. ✅ Web build succeeds (`pnpm build-web`)
3. ✅ Web tests pass (`pnpm test`, `pnpm test:browser`)
4. ✅ No Tauri imports remain in TypeScript
5. ✅ No platform-specific conditionals remain
6. ✅ Package.json has no Tauri dependencies
7. ✅ All platform-specific files are removed

---

## Estimated Impact

- **Lines of code removed:** ~15,000-20,000
- **Dependencies removed:** ~30-40 packages
- **Build time reduction:** Significant (no Rust compilation)
- **Bundle size reduction:** Moderate (removes platform-specific code)
- **Maintenance burden:** Greatly reduced (single platform to support)

---

## Notes

1. **Backup First:** Create a git branch or backup before starting cleanup
2. **Incremental Cleanup:** Consider doing this in phases with testing after each phase
3. **Web Service:** Ensure `webAppService.ts` has all necessary functionality before deleting `nativeAppService.ts`
4. **Stripe:** Keep Stripe for web payments unless you have alternative payment solution
5. **Calibre/KOReader:** Decide if you want to keep these integrations
6. **Safe Areas:** Decide based on mobile web browser support needs
7. **E-Ink:** Decide based on e-ink device support needs
