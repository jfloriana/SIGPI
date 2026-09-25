import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

/**
 * Filtros de una lista guardados en la URL (`?buscar=…&page=2`): sobreviven a recargas,
 * se pueden compartir y el botón «Atrás» los respeta. Cambiar un filtro vuelve a la página 1.
 */
export function useFiltrosUrl<const K extends string>(claves: readonly K[]) {
  const [params, setParams] = useSearchParams();

  const filtros = useMemo(() => {
    const f = {} as Record<K, string>;
    for (const k of claves) f[k] = params.get(k) ?? "";
    return f;
  }, [params]);

  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);

  const setFiltro = useCallback(
    (clave: K, valor: string) =>
      setParams(
        (p) => {
          const n = new URLSearchParams(p);
          if (valor) n.set(clave, valor);
          else n.delete(clave);
          n.delete("page");
          return n;
        },
        { replace: true },
      ),
    [setParams],
  );

  const setPage = useCallback(
    (nueva: number) =>
      setParams((p) => {
        const n = new URLSearchParams(p);
        if (nueva > 1) n.set("page", String(nueva));
        else n.delete("page");
        return n;
      }),
    [setParams],
  );

  return { filtros, setFiltro, page, setPage };
}
