# ============================================================
# run-both.ps1 - Build & deploy to Physical Device + Emulator
# Run from: C:\rn
# ============================================================

$ANDROID_DIR = "C:\rn\android"
$APK_PATH    = "$ANDROID_DIR\app\build\outputs\apk\debug\app-debug.apk"
$PACKAGE     = "com.onegov.govmeeting"
$ACTIVITY    = ".MainActivity"
$METRO_PORT  = 8081

# ─── Detect Devices ─────────────────────────────────────────
Write-Host "`n🔍 Detecting connected devices..." -ForegroundColor Cyan
$devices = adb devices | Select-String "device$" | ForEach-Object { ($_ -split "\s+")[0] }

$physicalDevice = $devices | Where-Object { $_ -notlike "emulator-*" } | Select-Object -First 1
$emulator       = $devices | Where-Object { $_ -like "emulator-*" }    | Select-Object -First 1

if (-not $physicalDevice) { Write-Host "⚠️  No physical device found." -ForegroundColor Yellow }
else                       { Write-Host "📱 Physical device : $physicalDevice" -ForegroundColor Green }

if (-not $emulator)        { Write-Host "⚠️  No emulator found."       -ForegroundColor Yellow }
else                       { Write-Host "🖥️  Emulator        : $emulator" -ForegroundColor Green }

if (-not $physicalDevice -and -not $emulator) {
    Write-Host "`n❌ No devices detected. Connect a device or start an emulator first." -ForegroundColor Red
    exit 1
}

# ─── Build ──────────────────────────────────────────────────
Write-Host "`n🔨 Building APK (arm64-v8a, armeabi-v7a, x86, x86_64)..." -ForegroundColor Cyan
Push-Location $ANDROID_DIR
.\gradlew.bat assembleDebug
$buildResult = $LASTEXITCODE
Pop-Location

if ($buildResult -ne 0) {
    Write-Host "`n❌ Build failed. Fix the errors above and try again." -ForegroundColor Red
    exit 1
}
Write-Host "`n✅ Build successful!" -ForegroundColor Green

# ─── Install & Launch ───────────────────────────────────────
function Deploy {
    param($serial, $label)
    Write-Host "`n📦 Installing on $label ($serial)..." -ForegroundColor Cyan
    adb -s $serial install -r $APK_PATH
    if ($LASTEXITCODE -eq 0) {
        Write-Host "🚀 Launching on $label..." -ForegroundColor Green
        adb -s $serial shell am start -n "$PACKAGE/$ACTIVITY"
    } else {
        Write-Host "❌ Install failed on $label." -ForegroundColor Red
    }
}

if ($physicalDevice) { Deploy $physicalDevice "Physical Device" }
if ($emulator)       { Deploy $emulator       "Pixel 9 Emulator" }

# ─── Start Metro in a separate window ───────────────────────
Write-Host "`n⚡ Starting Metro Bundler in a new window..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\rn'; npx expo start --port $METRO_PORT"

# ─── Wait for Metro to be ready ─────────────────────────────
Write-Host "⏳ Waiting for Metro to start on port $METRO_PORT..." -ForegroundColor Yellow
$timeout = 30
$elapsed = 0
do {
    Start-Sleep -Seconds 2
    $elapsed += 2
    $open = Test-NetConnection -ComputerName localhost -Port $METRO_PORT -WarningAction SilentlyContinue
} while (-not $open.TcpTestSucceeded -and $elapsed -lt $timeout)

if (-not $open.TcpTestSucceeded) {
    Write-Host "⚠️  Metro did not start in time. Run 'adb reverse tcp:8081 tcp:8081' manually after it starts." -ForegroundColor Yellow
} else {
    Write-Host "✅ Metro is running!" -ForegroundColor Green
}

# ─── ADB Reverse (tunnel Metro to each device) ──────────────
Write-Host "`n🔁 Setting up ADB reverse port forwarding..." -ForegroundColor Cyan

if ($physicalDevice) {
    adb -s $physicalDevice reverse tcp:$METRO_PORT tcp:$METRO_PORT
    Write-Host "✅ Physical device tunnelled to Metro (port $METRO_PORT)" -ForegroundColor Green
}

if ($emulator) {
    adb -s $emulator reverse tcp:$METRO_PORT tcp:$METRO_PORT
    Write-Host "✅ Emulator tunnelled to Metro (port $METRO_PORT)" -ForegroundColor Green
}

Write-Host "`n🎉 Both devices are ready! Press R in the Metro window to reload." -ForegroundColor Green
