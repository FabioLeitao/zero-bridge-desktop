// Fuse values applied by electron-builder from package.json build.electronFuses.
// They are not flipped on the npm electron binary used for local dev.

export const electronFuses = {
  runAsNode: false,
  enableCookieEncryption: true,
  enableNodeOptionsEnvironmentVariable: false,
  enableNodeCliInspectArguments: false,
  enableEmbeddedAsarIntegrityValidation: true,
  onlyLoadAppFromAsar: true,
  grantFileProtocolExtraPrivileges: false,
} as const;
