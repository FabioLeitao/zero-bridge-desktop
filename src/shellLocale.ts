export type ShellLocale = "en" | "pt-BR";

export interface ShellStrings {
  show: string;
  quit: string;
  permissionTitle: string;
  permissionBody: (title: string) => string;
}

export function shellLocale(
  env: { LANG?: string; LC_ALL?: string },
  configured?: string,
): ShellLocale {
  if (configured === "pt-BR" || configured === "en") return configured;
  const lang = env.LC_ALL || env.LANG || "";
  if (lang.toLowerCase().startsWith("pt")) return "pt-BR";
  return "en";
}

export function shellStrings(locale: ShellLocale): ShellStrings {
  if (locale === "pt-BR") {
    return {
      show: "Mostrar zero-bridge",
      quit: "Sair",
      permissionTitle: "permissão do zero-bridge",
      permissionBody: (title) => `Permissão pedida: ${title}`,
    };
  }
  return {
    show: "Show zero-bridge",
    quit: "Quit",
    permissionTitle: "zero-bridge permission",
    permissionBody: (title) => `Permission requested: ${title}`,
  };
}
