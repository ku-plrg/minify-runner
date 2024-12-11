interface BabelModule {
  transpile(
    code: string,
    config: Record<string, any>,
  ): Promise<{ code: string }>;
}

export async function load(version: string) {
  return getCachedModule(version);
}

export async function transform({ code, config, babel }: {
  code: string;
  config: Record<string, any>;
  babel: BabelModule;
}) {
  const transpiledCode = await babel.transpile(code, config);
  return transpiledCode.code.trim();
}

// TODO: Implement cache
async function getCachedModule(version: string): Promise<BabelModule> {
  // for version >= 7.14.0: https://cdn.jsdelivr.net/npm/@babel/standalone@7.14.0/babel.min.js
  const loaderPath =
    `https://cdn.jsdelivr.net/npm/@babel/standalone@${version}/babel.min.js`;
  const { transpile } = await import(loaderPath);
  return { transpile };
}
