// Shape returned to the renderer. Token material is dropped on purpose.
export interface RendererLaunchView {
  ok: boolean;
  state: string;
  url?: string;
  error?: string;
}

export function rendererLaunchView(input: {
  ok: boolean;
  state: string;
  url?: string;
  error?: string;
  tokenPath?: string;
  token?: string;
}): RendererLaunchView {
  const view: RendererLaunchView = { ok: input.ok, state: input.state };
  if (input.url) view.url = input.url;
  if (input.error) view.error = input.error;
  return view;
}
