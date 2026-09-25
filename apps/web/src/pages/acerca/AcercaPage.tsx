import { ArrowUpRight, FlaskConical } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { useUsuario } from "../../auth/AuthContext";
import { NOMBRE_ROL, type Rol } from "../../auth/roles";
import { Encabezado } from "../../components/Encabezado";
import { menuDe } from "../../layout/menu";
import { CAPAS, CONCEPTOS, HERRAMIENTAS, MATRIZ, ROLES_MATRIZ, type Concepto, type Pantalla } from "./contenido";

function EnlacePantalla({ pantalla, permitidas }: { pantalla: Pantalla; permitidas: Set<string> }) {
  if (permitidas.has(pantalla.ruta)) {
    return (
      <Link
        to={pantalla.ruta}
        className="inline-flex min-h-11 items-center gap-1 font-medium text-marino underline decoration-marino-200 hover:decoration-marino sm:min-h-0"
      >
        {pantalla.etiqueta}
        <ArrowUpRight aria-hidden className="size-3.5" />
      </Link>
    );
  }
  return (
    <span className="text-slate-600">
      {pantalla.etiqueta} <span className="text-xs">(no disponible para su rol)</span>
    </span>
  );
}

function Fila({ termino, children }: { termino: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-slate-100 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm font-medium text-slate-600">{termino}</dt>
      <dd className="min-w-0 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

function MatrizPermisos({ rol }: { rol: Rol }) {
  return (
    <div className="relative mt-5 overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <caption className="sr-only">Matriz de permisos por módulo y rol (resumen de la especificación)</caption>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
            <th scope="col" className="px-3 py-2">
              Módulo
            </th>
            {ROLES_MATRIZ.map((r) => (
              <th key={r} scope="col" className={`px-3 py-2 ${r === rol ? "bg-marino-50 text-marino" : ""}`}>
                {NOMBRE_ROL[r]}
                {r === rol && <span className="block text-xs font-medium tracking-normal normal-case">su rol</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MATRIZ.map((m) => (
            <tr key={m.modulo} className="border-b border-slate-100 align-top last:border-0">
              <th scope="row" className="px-3 py-2 text-left font-medium text-slate-900">
                {m.modulo}
              </th>
              {ROLES_MATRIZ.map((r) => (
                <td key={r} className={`px-3 py-2 ${r === rol ? "bg-marino-50/60" : ""}`}>
                  {m.permisos[r] ?? (
                    <span className="text-slate-400">
                      <span aria-hidden>—</span>
                      <span className="sr-only">Sin acceso</span>
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeccionConcepto({ c, rol, permitidas }: { c: Concepto; rol: Rol; permitidas: Set<string> }) {
  return (
    <section id={c.id} aria-labelledby={`${c.id}-titulo`} className="scroll-mt-6 border-t border-slate-200 pt-8 pb-2">
      <h2 id={`${c.id}-titulo`} className="text-xl font-semibold tracking-tight text-balance text-slate-900">
        {c.titulo}
      </h2>
      <div className="mt-3 max-w-[70ch] space-y-3 text-base leading-relaxed text-slate-700">
        {c.texto.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
      </div>
      {c.nota && (
        <p className="mt-3 max-w-[70ch] rounded-lg bg-ambar-50 px-3 py-2 text-sm text-ambar-800">
          <span className="font-semibold">Aclaración: </span>
          {c.nota}
        </p>
      )}
      {c.extra === "matriz" && <MatrizPermisos rol={rol} />}

      <dl className="mt-5 max-w-[80ch]">
        <Fila termino="Dónde se ve">
          {c.pantallas.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {c.pantallas.map((p) => (
                <li key={p.ruta + p.etiqueta}>
                  <EnlacePantalla pantalla={p} permitidas={permitidas} />
                </li>
              ))}
            </ul>
          )}
          {c.otroLugar && <p className={c.pantallas.length ? "mt-1 text-slate-600" : ""}>{c.otroLugar}</p>}
        </Fila>
        <Fila termino="Reglas">
          <ul className="space-y-1">
            {c.reglas.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Fila>
        <Fila termino="Pruebas">
          {c.pruebas.length === 0 ? (
            <p className="text-slate-600">Sin prueba automatizada propia (ver aclaración).</p>
          ) : (
            <ul className="space-y-1.5">
              {c.pruebas.map((p) => (
                <li key={p.nombre} className="flex gap-2">
                  <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0 text-teal-700" />
                  <span className="min-w-0">
                    «{p.nombre.replaceAll("%s", "…")}»{" "}
                    <code className="text-xs whitespace-nowrap text-slate-500">{p.archivo}</code>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Fila>
      </dl>
    </section>
  );
}

export default function AcercaPage() {
  const { rol } = useUsuario();
  const permitidas = new Set(menuDe(rol).map((o) => o.ruta));

  return (
    <>
      <Encabezado
        titulo="Acerca del sistema"
        descripcion="SIGPI es la instancia funcional del informe «Planificación y diseño del sistema de información» para DistriNorte S.A.C., empresa ficticia. Esta página explica qué concepto del curso demuestra cada módulo, dónde verlo, qué regla lo implementa y qué prueba automatizada lo respalda."
      />

      <div className="lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10">
        <nav aria-label="En esta página" className="mb-6 lg:mb-0">
          <div className="lg:sticky lg:top-6">
            <p className="text-sm font-semibold text-slate-900">En esta página</p>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm lg:block lg:space-y-1">
              {[{ id: "arquitectura", titulo: "Arquitectura en capas" }, ...CONCEPTOS].map((c) => (
                <li key={c.id}>
                  <a href={`#${c.id}`} className="inline-flex min-h-11 items-center text-slate-700 hover:text-marino hover:underline lg:min-h-8">
                    {c.titulo}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <article className="min-w-0">
          <section id="arquitectura" aria-labelledby="arquitectura-titulo" className="scroll-mt-6 pb-8">
            <h2 id="arquitectura-titulo" className="text-xl font-semibold tracking-tight text-slate-900">
              Arquitectura en capas
            </h2>
            <p className="mt-3 max-w-[70ch] text-base leading-relaxed text-slate-700">
              El sistema separa tres capas. La presentación solo habla con la API por HTTP y nunca con la base; la lógica concentra
              todas las reglas y es la única que escribe datos; la capa de datos se puede cambiar de motor sin tocar las otras dos.
            </p>
            <div className="relative mt-5 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[40rem] border-collapse text-sm">
                <caption className="sr-only">Capas del sistema, su responsabilidad y tecnologías con versión</caption>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
                    <th scope="col" className="px-3 py-2">
                      Capa
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Responsabilidad
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Tecnologías y versiones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CAPAS.map((c) => (
                    <tr key={c.capa} className="border-b border-slate-100 align-top last:border-0">
                      <th scope="row" className="px-3 py-2.5 text-left font-semibold whitespace-nowrap text-marino">
                        {c.capa}
                      </th>
                      <td className="px-3 py-2.5 text-slate-700">{c.responsabilidad}</td>
                      <td className="px-3 py-2.5 text-slate-700">{c.tecnologias}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 max-w-[70ch] text-sm text-slate-600">{HERRAMIENTAS}</p>
          </section>

          {CONCEPTOS.map((c) => (
            <SeccionConcepto key={c.id} c={c} rol={rol} permitidas={permitidas} />
          ))}
        </article>
      </div>
    </>
  );
}
