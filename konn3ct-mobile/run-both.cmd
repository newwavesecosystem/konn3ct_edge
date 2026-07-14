@echo off
:: ===========================================
:: Konn3ct Mobile - Dual Device Runner
:: ===========================================
:: Usage (run from CMD):
::   run-both.cmd              (start both devices)
::   run-both.cmd 1            (Android 10 only - same as npx expo run:android)
::   run-both.cmd 2            (Android 14 only - uses pre-built APK)
::   run-both.cmd build        (rebuild universal APK then start both)
::
:: NOTE: Android 14's wireless debug port changes
:: on each reconnect. Run "adb devices" to check
:: and update DEV_A14 below if the port changed.
:: ===========================================

:: ---- Device config (UPDATE PORTS IF NEEDED) ----
set DEV_A10=192.168.43.68:5555
set DEV_A14=192.168.43.110:34957
set APP_ID=com.konn3ct.mobile
set ACTIVITY=%APP_ID%/.MainActivity
set APK_PATH=C:\rn\android\app\build\outputs\apk\debug\app-debug.apk

:: ---- Short path setup (needed for Windows 260-char limit) ----
if not exist "C:\rn" (
    mklink /J C:\rn "%~dp0"
    echo [OK] Created short path: C:\rn
) else (
    echo [OK] Short path C:\rn already exists
)

cd /d C:\rn

:: ---- Route ----
if "%1"=="build" goto rebuild
if "%1"=="2" goto a14_only
if "%1"=="1" goto a10_only

:: ============================================
:: START BOTH DEVICES
:: ============================================

echo.
echo ============================================
echo  Checking connected devices...
echo ============================================
adb devices -l
echo.

:: Check APK exists
if not exist "%APK_PATH%" (
    echo [!] No universal APK found. Building first...
    goto rebuild
)

:: Step 1: Disconnect Android 14 so Expo only targets Android 10
echo [1/5] Temporarily disconnecting Android 14...
adb disconnect %DEV_A14%
timeout /t 2 /nobreak >nul

:: Step 2: Run on Android 10 using expo run:android (opens in new window)
echo.
echo ============================================
echo  [2/5] Running on Android 10 (Infinix X655C)
echo        Using npx expo run:android
echo        (opens in new window)
echo ============================================
echo.
start "Android 10 - Expo Dev Build" cmd /k "cd /d C:\rn && npx expo run:android --port 8081"

echo.
echo  *** WAIT for the app to fully load on your Android 10 phone ***
echo  *** Then press any key to continue ***
echo.
pause

:: Step 3: Reconnect Android 14
echo.
echo [3/5] Reconnecting Android 14...
adb connect %DEV_A14%
timeout /t 3 /nobreak >nul

:: Step 4: Install + port forward on Android 14
echo.
echo ============================================
echo  [4/5] Installing APK on Android 14
echo        Infinix X6525D (%DEV_A14%)
echo ============================================
echo.
adb -s %DEV_A14% install -r "%APK_PATH%"
adb -s %DEV_A14% reverse tcp:8081 tcp:8081

:: Step 5: Launch app on Android 14
echo.
echo [5/5] Launching app on Android 14...
adb -s %DEV_A14% shell am force-stop %APP_ID%
adb -s %DEV_A14% shell am start -n %ACTIVITY%

echo.
echo ============================================
echo  DONE! Both devices are now running.
echo  Both connect to Metro on port 8081.
echo  Code changes update BOTH phones live.
echo ============================================
echo.
pause
goto end

:: ============================================
:: ANDROID 10 ONLY (same as npx expo run:android)
:: ============================================
:a10_only
echo.
echo Starting on Android 10 - Infinix X655C (%DEV_A10%)...
echo This works exactly like: npx expo run:android
echo.
npx expo run:android --port 8081
goto end

:: ============================================
:: ANDROID 14 ONLY (requires Metro already running)
:: ============================================
:a14_only
echo.
echo Starting Android 14 - Infinix X6525D (%DEV_A14%)...
echo.

:: Check if Metro is already running on 8081
netstat -an | findstr "LISTENING" | findstr ":8081" >nul
if errorlevel 1 (
    echo [!] Metro is NOT running on port 8081.
    echo     Start Android 10 first with: run-both.cmd 1
    echo     Then run this command in another terminal.
    pause
    goto end
)

echo Metro is running. Installing and launching...
adb -s %DEV_A14% install -r "%APK_PATH%"
adb -s %DEV_A14% reverse tcp:8081 tcp:8081
adb -s %DEV_A14% shell am force-stop %APP_ID%
adb -s %DEV_A14% shell am start -n %ACTIVITY%
echo.
echo App launched on Android 14!
pause
goto end

:: ============================================
:: REBUILD APK (both architectures)
:: ============================================
:rebuild
echo.
echo ============================================
echo  Rebuilding universal APK...
echo  (armeabi-v7a + arm64-v8a)
echo  This may take 10-30 minutes.
echo ============================================
echo.

:: Clean old C++ cache
rmdir /s /q C:\rn\android\app\.cxx 2>nul
rmdir /s /q C:\rn\android\app\build 2>nul

:: Build
cmd /c "cd /d C:\rn\android && gradlew.bat app:assembleDebug -x lint -x test --configure-on-demand --build-cache -PreactNativeDevServerPort=8081 -PreactNativeArchitectures=armeabi-v7a,arm64-v8a"

if errorlevel 1 (
    echo.
    echo [ERROR] Build failed!
    pause
    goto end
)

echo.
echo [OK] Build successful! Installing on both devices...
echo.

:: Install on both devices
adb -s %DEV_A10% install -r "%APK_PATH%"
echo  - Android 10: Installed
adb -s %DEV_A14% install -r "%APK_PATH%"
echo  - Android 14: Installed
echo.
echo Now run: run-both.cmd
echo.
pause
goto end

:end
