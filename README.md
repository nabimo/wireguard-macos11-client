# WireGuard Mac — Electron + Nuxt MVP

A minimal WireGuard GUI targeting macOS 11+.

## What it does

- Import one or more `.conf` files.
- Import a `.zip` containing any number of `.conf` files, including nested folders.
- Validate that imported files look like WireGuard profiles.
- Store imported profiles under the app's private application-data directory.
- Connect/disconnect through `wg-quick`.
- Ask macOS for administrator authorization using the native authorization dialog.
- Keep Node APIs out of the Nuxt renderer using Electron preload + contextBridge.

## Important

This MVP does **not** implement WireGuard itself. It expects `wg-quick` to be available.

For development on macOS:

```bash
brew install wireguard-tools
```

Then:

```bash
npm install
npm run dev
```

The app will ask for administrator authorization when connecting.

## macOS 11 compatibility

Electron 38+ dropped macOS 11 support. This project intentionally pins Electron 37.3.1 so the packaged GUI can run on Big Sur. Do not blindly upgrade Electron without checking the minimum macOS version.

## ZIP format

Example:

```text
servers.zip
├── Germany.conf
├── Netherlands.conf
└── Europe/
    ├── France.conf
    └── Finland.conf
```

All `.conf` files are discovered recursively. Non-`.conf` files are ignored.

## Production TODO

For a production VPN product, replace the `wg-quick`/admin-dialog approach with a properly installed privileged helper or native Network Extension where appropriate. Add code signing/notarization, secure profile storage, crash handling, kill-switch policy, DNS leak protection, connection monitoring, and an explicit permission/privilege model.
