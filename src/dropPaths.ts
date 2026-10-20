// The page cannot name a dropped path. The preload asks the OS for each File.
export function pathsFromDrop(
  files: { length: number; [index: number]: unknown },
  pathForFile: (file: unknown) => string,
): string[] {
  const paths: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const path = pathForFile(files[i]);
    if (path) paths.push(path);
  }
  return paths;
}
