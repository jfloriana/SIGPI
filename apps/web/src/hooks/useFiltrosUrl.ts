import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

/**
 * Filtros de una lista guardados en la URL (`?buscar=…&page=2`): sobreviven a recargas,
 * se pueden compartir y el botón «Atrás» los respeta. Cambiar un filtro vuelve a la página 1.
 *
 * Cada cambio parte de la URL actual del navegador (no del último render), así dos cambios
 * seguidos no se pisan.
 */
export function useFiltrosUrl<const K extends string>(claves: readonly K[]) {
  const [params, setParams] = useSearchParams();

  const filtros = useMemo(() => {
    const f = {} as Record<K, string>;
    for (const k of claves) f[k] = params.get(k) ?? "";
    return f;
  }, [params]);

  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);

  /** Cambia varios filtros en un solo paso (valor vacío = quitar). */
  const setFiltros = useCallback(
    (cambios: Partial<Record<K, string>>) => {
      const n = new URLSearchParams(window.location.search);
      for (const [clave, valor] of Object.entries(cambios) as [K, string | undefined][]) {
        if (valor) n.set(clave, valor);
        else n.delete(clave);
      }
      n.delete("page");
      setParams(n, { replace: true });
    },
    [setParams],
  );

  const setFiltro = useCallback((clave: K, valor: string) => setFiltros({ [clave]: valor } as Partial<Record<K, string>>), [setFiltros]);

  /** Quita todos los filtros de esta lista (conserva otros parámetros, p. ej. la pestaña). */
  const limpiar = useCallback(() => {
    const n = new URLSearchParams(window.location.search);
    for (const k of claves) n.delete(k);
    n.delete("page");
    setParams(n, { replace: true });
  }, [setParams]);

  const setPage = useCallback(
    (nueva: number) => {
      const n = new URLSearchParams(window.location.search);
      if (nueva > 1) n.set("page", String(nueva));
      else n.delete("page");
      setParams(n);
    },
    [setParams],
  );

  return { filtros, setFiltro, setFiltros, limpiar, page, setPage };
}
