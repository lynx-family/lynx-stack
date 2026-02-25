#!/bin/bash
set -e

# Start the Android emulator in headless mode
echo "Starting emulator..."
${ANDROID_HOME}/emulator/emulator -avd test_device -no-window -no-audio -gpu swiftshader_indirect &

# Wait for the emulator to boot
echo "Waiting for emulator to become ready..."
adb wait-for-device
while [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" != "1" ]; do
    sleep 2
done

echo "Emulator is ready."

echo "Installing Lynx Explorer..."
adb install -r /opt/LynxExplorer.apk

echo "Launching Lynx Explorer..."
adb shell monkey -p com.lynx.explorer -c android.intent.category.LAUNCHER 1

# Forward ADB port 5555 to make scrcpy work from the host via port 5556
echo "Setting up ADB port forwarding..."
socat TCP-LISTEN:5556,fork,bind=0.0.0.0 TCP:127.0.0.1:5555 &

# Keep the container running
tail -f /dev/null
