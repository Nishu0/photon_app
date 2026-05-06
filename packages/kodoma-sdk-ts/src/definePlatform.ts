import type { PlatformDef, PlatformNarrower, PlatformProviderConfig } from "./types";

export function definePlatform<TName extends string, TConfig extends object, TClient, TExtra extends object = Record<string, never>>(
  name: TName,
  def: Omit<PlatformDef<TName, TConfig, TClient, TExtra>, "name" | "configDefault"> & {
    configDefault?: TConfig;
    static?: Record<string, unknown>;
  }
): PlatformNarrower<TName, TConfig, TClient, TExtra> & Readonly<Record<string, unknown>> {
  const definition: PlatformDef<TName, TConfig, TClient, TExtra> = {
    name,
    configDefault: (def.configDefault ?? {}) as TConfig,
    lifecycle: def.lifecycle,
    events: def.events,
    actions: def.actions,
    static: def.static
  };

  const narrowed: PlatformNarrower<TName, TConfig, TClient, TExtra> = {
    config(config?: Partial<TConfig>): PlatformProviderConfig<TName, TConfig, TClient, TExtra> {
      return {
        __tag: "KodamaProviderConfig",
        __name: name,
        __definition: definition,
        config: { ...definition.configDefault, ...(config ?? {}) }
      };
    }
  };

  return Object.assign(narrowed, def.static ?? {});
}
