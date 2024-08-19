interface TerserModule {
  minify(
    code: string,
    config: Record<string, any>,
  ): Promise<{ code: string }>;
}

export async function load(version: string) {
  return getCachedModule(version);
}

export async function transform({ code, config, terser }: {
  code: string;
  config: Record<string, any>;
  terser: TerserModule;
}) {
  const minifiedCode = await terser.minify(code, config);
  return minifiedCode.code.trim();
}

// TODO: Implement cache
async function getCachedModule(version: string): Promise<TerserModule> {
  // for version >= 3.10.1: https://cdn.jsdelivr.net/npm/terser@5.31.5/+esm
  const loaderPath = `https://cdn.jsdelivr.net/npm/terser@${version}/+esm`;
  const { minify } = await import(loaderPath);
  return { minify };
}
