export function evalNumberByIdWithRuntime<TDef>(
  id: string,
  runtime: {
    hasCache: (id: string) => boolean;
    getCache: (id: string) => number | null | undefined;
    setCache: (id: string, value: number) => void;
    isInProgress: (id: string) => boolean;
    addInProgress: (id: string) => void;
    removeInProgress: (id: string) => void;
    getDefinitionById: (id: string) => TDef | null;
    evalDefinition: (def: TDef, selfNumberId?: string) => number | null;
    onCacheHit: () => void;
  }
): number | null {
  if (runtime.hasCache(id)) {
    runtime.onCacheHit();
    return runtime.getCache(id) ?? null;
  }
  if (runtime.isInProgress(id)) return null;
  const definition = runtime.getDefinitionById(id);
  if (!definition) return null;
  runtime.addInProgress(id);
  const value = runtime.evalDefinition(definition, id);
  runtime.removeInProgress(id);
  // Do not memoize transient nulls.
  if (value !== null) {
    runtime.setCache(id, value);
  }
  return value;
}
