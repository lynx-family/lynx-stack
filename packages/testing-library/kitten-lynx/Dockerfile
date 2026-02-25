FROM ubuntu:24.04

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies required for Android SDK and Emulator
RUN apt-get update && apt-get install -y \
  openjdk-17-jdk \
  wget \
  unzip \
  git \
  curl \
  cpu-checker \
  qemu-kvm \
  libvirt-daemon-system \
  libvirt-clients \
  bridge-utils \
  socat \
  && rm -rf /var/lib/apt/lists/*

# Set up Android SDK environment variables
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=${PATH}:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${ANDROID_HOME}/emulator

# Download and install Android command line tools
RUN mkdir -p ${ANDROID_HOME}/cmdline-tools && \
  cd ${ANDROID_HOME}/cmdline-tools && \
  wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O cmdline-tools.zip && \
  unzip -q cmdline-tools.zip && \
  rm cmdline-tools.zip && \
  mv cmdline-tools latest

# Accept licenses and install required SDK components
RUN yes | sdkmanager --licenses && \
  sdkmanager "platform-tools" "platforms;android-34" "emulator" "system-images;android-34;google_apis;x86_64"

# Create Android Virtual Device (AVD)
RUN echo "no" | avdmanager create avd -n test_device -k "system-images;android-34;google_apis;x86_64" --device "pixel" --force

# Download Lynx Explorer APK
RUN curl -L -o /opt/LynxExplorer.apk https://github.com/lynx-family/lynx/releases/download/3.6.0/LynxExplorer-noasan-release.apk

# Add startup script
COPY start-emulator.sh /start-emulator.sh
RUN chmod +x /start-emulator.sh

# Expose ADB port
EXPOSE 5555

ENTRYPOINT ["/start-emulator.sh"]
