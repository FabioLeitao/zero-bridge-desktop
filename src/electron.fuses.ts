// Electron fuse configuration scaffold for S23a.
// Fuses will be applied during packaging (S23c). Keep as documentation for now.

export const fuses = {
  // When packaging, enable:
  // "ElectronFuse" = true
  enableSquirrel: false,
  nodeOptions: "no-deprecation",
  enableNodeOptionsEnvironmentVariable: false,
  enableNodeCliInspectArguments: false,
  enableElectronRunAsNode: false,
  enableSecureSystemAPI: true,

  // Hardening we require
  disableBlinkFeatures: ["Auxclick", "Translate"],
  allowFileAccessFromFileUrls: false,
  allowFileAccessFromFileUrlsInIsolatedWorld: false,
};
