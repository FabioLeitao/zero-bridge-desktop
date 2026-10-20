// Fuse values applied by electron-builder from package.json build.electronFuses.
// They are not flipped on the npm electron binary used for local dev.

export const electronFuses = {
  runAsNode: false,
  enableCookieEncryption: true,
  enableNodeOptionsEnvironmentVariable: false,
  enableNodeCliInspectArguments: false,
  enableEmbeddedAsarIntegrityValidation: true,
  onlyLoadAppFromAsar: true,
  // This package does not ship browser_v8_context_snapshot.bin. Leaving the
  // fuse on would make the browser process load that missing file.
  loadBrowserProcessSpecificV8Snapshot: false,
  grantFileProtocolExtraPrivileges: false,
} as const;
