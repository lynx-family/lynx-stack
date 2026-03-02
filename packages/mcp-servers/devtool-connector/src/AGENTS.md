# Connector Design Document

## 1. Context & Goals

The new Connector is designed to address stability issues in the previous long-lived connection solution. The core idea is to adopt a stateless short-lived connection design, bypass higher-level wrappers, and directly control the lifecycle of the underlying connections.

### Key Objectives

- **Stability first**: Use short-lived connections to avoid the fragility of long-lived ones.
- **Stateless design**: Each request (for example a CDP request) runs its own `connect -> send -> receive -> close` flow.
- **Cross-platform**: Provide a unified abstraction for Android (ADB) and iOS (Usbmuxd).

## 2. Architecture Layering

The Connector adopts a layered architecture to separate concerns:

### Transport layer

- **Responsibility**: Establish raw byte-stream channels, without awareness of higher-level protocols.
- **Implementation**:
  - `AndroidTransport` (Android): Based on `@yume-chan/adb`, uses `adb shell nc` to create a tunnel directly to the device port.
  - `iOSTransport` (iOS): Based on `usbmux-client`, uses `createDeviceTunnel` to connect directly to the device port.
- **Interface**: Provides primitive operations such as `connect` and `listDevices`.

### Protocol layer

- **Responsibility**: Handle Peertalk framing and CDP message encoding/decoding.
- **Components**:
  - `MessageToPeertalkTransformStream`: Message -> Peertalk frame.
  - `PeertalkToMessageTransformStream`: Peertalk frame -> Message.
- **Characteristics**: Pure functional transforms, stateless.

### Connector layer (core)

- **Responsibility**: Expose a unified interface and coordinate the Transport and Protocol layers.
- **Implementation**: `Connector` class in `src/index.ts`.
- **Mechanics**:
  - **Short-lived requests**: Each call to `sendMessageWithTransport` establishes a new connection, transfers data, and then closes the connection immediately.
  - **Device/client discovery**:
    - Android: Scan ports 8901-8910 and send an `Initialize` handshake message to confirm the presence of a Client.
    - All results are snapshots of the current moment.

## 3. Core Concepts

In the stateless model, the lifecycle of core objects changes:

- **Device**: A physical device, discovered dynamically via low-level tools (ADB/Usbmuxd).
- **Client**: A listening port of `debug-router` on the device (for example 8901-8910).
  - **Dynamic nature**: We no longer hold client objects for a long time; instead, we scan ports and use Initialize/Register handshakes to confirm their existence.
  - **Identifier**: `ClientId` contains the device ID and port number.
- **Session**: A page/view session. Only fetched via `ListSession` when needed and treated as a temporary snapshot.

## 4. Code Structure

- `src/index.ts`: Connector layer. Main entry, manages all transports.
- `src/transport/transport.ts`: Transport interface definition.
- `src/transport/android.ts`: `AndroidTransport` implementation.
- `src/transport/ios.ts`: `iOSTransport` implementation.
- `src/streams/peertalk.ts` / `src/streams/cdp.ts`: Protocol layer stream transformers.
- `src/types.ts`: Core type definitions.

## 5. Development Guide

- **Adding a new transport**: Implement the `Transport` interface and register it in the `Connector`.
- **Debugging**: Use `DEBUG=devtool-mcp-server:connector*` to enable detailed logs.
- **Notes**: Any new APIs should prefer short-lived connection implementations and avoid introducing persistent state dependencies.

## 6. API & Usage Examples

The Connector is the single entry point for upper-layer tools to communicate with devices.

### 6.1 Initialization

```typescript
import { AndroidTransport } from './transport/android.js';
import { Connector } from './index.js';
import { iOSTransport } from './transport/ios.js';

// Initialize the Connector with support for both Android and iOS
const connector = new Connector([
  new AndroidTransport(),
  new iOSTransport(),
]);
```

### 6.2 Device discovery and connection

```typescript
// 1. Get all connected devices (Android + iOS)
const devices = await connector.listDevices();
// Output: [{ id: "emulator-5554", os: "Android" }, { id: "00008101-...", os: "iOS" }]

// 2. Get all active debug clients on a device (debug-router ports)
// Note: this automatically scans device ports and performs a handshake check
const clients = await connector.listClients();
// Output: [{ id: "emulator-5554:8901", info: { ... } }, ...]
```

### 6.3 Sending CDP commands

This is the most common operation. Because connections are short-lived, each call is atomic.

```typescript
const clientId = 'emulator-5554:8901';

// 1. Get the list of sessions (pages) under a client
const sessions = await connector.sendListSessionMessage(clientId);
if (sessions.length > 0) {
  const sessionId = sessions[0].session_id;

  // 2. Send a CDP command (for example, fetch the DOM)
  const result = await connector.sendCDPMessage(
    clientId,
    sessionId,
    'DOM.getDocument',
    { depth: -1 },
  );
  console.log(result);
}
```

### 6.4 App control

```typescript
const deviceId = 'emulator-5554';

// List installed debuggable apps
const apps = await connector.listAvailableApps(deviceId);

// Open an app
await connector.openApp(deviceId, 'com.lynx.explorer');
```
