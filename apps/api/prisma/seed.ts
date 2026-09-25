// Datos de demostración de SIGPI. Idempotente: vacía las tablas y vuelve a cargar todo.
//
// - Base (siempre): roles, usuarios, categorías, 60 productos con su inventario inicial, 80 clientes, 3 proveedores.
// - Historial (por defecto; `sembrar({ historial: false })` lo omite): ~300 pedidos y ~11 órdenes de compra de
//   los últimos 90 días, con sus movimientos de inventario y su bitácora, simulados con la misma lógica de
//   negocio que los servicios (ver datos-historicos.ts). Las pruebas de reglas de negocio usan la base sola,
//   para partir de un estado controlado; tests/seed.test.ts valida el historial completo.
import bcrypt from "bcrypt";
import { config } from "../src/config.ts";
import { prisma } from "../src/db.ts";
import { esSqlite } from "../src/urlBaseDatos.ts";
import { bitacoraLoginOk } from "../src/modules/auth/service.ts";
import { bitacoraOrden, codigoOrden, motivoRecepcion } from "../src/modules/compras/service.ts";
import { bitacoraPedido, codigoPedido, motivoDespacho } from "../src/modules/pedidos/service.ts";
import { filaBitacora, type DatosAuditoria } from "../src/services/auditoria.ts";
import { ROLES } from "../src/utils/roles.ts";
import { generarHistorial, type Historial, type ProveedorSim } from "./datos-historicos.ts";
import { CATEGORIAS, PRODUCTOS, PROVEEDORES, generarClientes } from "./datos-maestros.ts";

export const CLAVE_DEMO = "Demo2026!";

export const USUARIOS_DEMO = [
  { nombre: "Rosa Quispe Vargas", email: "admin@distrinorte.pe", rol: ROLES.ADMIN },
  { nombre: "Carlos Mendoza Ríos", email: "gerente@distrinorte.pe", rol: ROLES.GERENTE },
  { nombre: "Luis Paredes Castillo", email: "vendedor1@distrinorte.pe", rol: ROLES.VENDEDOR },
  { nombre: "Ana Villanueva Soto", email: "vendedor2@distrinorte.pe", rol: ROLES.VENDEDOR },
  { nombre: "Jorge Alvarado Díaz", email: "almacen@distrinorte.pe", rol: ROLES.ALMACENERO },
] as const;

/** Categorías que abastece cada proveedor (mismo orden que PROVEEDORES). */
const CATEGORIAS_PROVEEDOR: string[][] = [
  ["Arroz y menestras", "Azúcar", "Fideos"],
  ["Aceites", "Lácteos", "Bebidas", "Conservas"],
  ["Limpieza"],
];

async function vaciar() {
  // Orden inverso a las dependencias.
  await prisma.bitacora.deleteMany();
  await prisma.movInventario.deleteMany();
  await prisma.detalleOrdenCompra.deleteMany();
  await prisma.ordenCompra.deleteMany();
  await prisma.detallePedido.deleteMany();
  await prisma.pedido.deleteMany();
  await prisma.producto.deleteMany();
  await prisma.categoria.deleteMany();
  await prisma.proveedor.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.rol.deleteMany();
  await reiniciarContadores();
}

/** Reinicia los autoincrementos para que cada carga produzca los mismos ids y códigos (PED-000001…). */
async function reiniciarContadores() {
  if (esSqlite(config.databaseUrl)) {
    // La tabla existe solo si alguna tabla con AUTOINCREMENT ya recibió filas.
    const existe = await prisma.$queryRawUnsafe<unknown[]>("SELECT name FROM sqlite_master WHERE name = 'sqlite_sequence'");
    if (existe.length) await prisma.$executeRawUnsafe("DELETE FROM sqlite_sequence");
    return;
  }
  const tablas = ["Bitacora", "MovInventario", "DetalleOrdenCompra", "OrdenCompra", "DetallePedido", "Pedido", "Producto", "Categoria", "Proveedor", "Cliente", "Usuario", "Rol"];
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tablas.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

/** Fecha del inventario inicial: 95 días atrás a las 08:00 (hora de Lima), antes de cualquier pedido de demo. */
export function fechaInventarioInicial(ahora = new Date()): Date {
  const fecha = new Date(ahora.getTime() - 95 * 86_400_000);
  fecha.setUTCHours(13, 0, 0, 0); // 08:00 en America/Lima (UTC-5)
  return fecha;
}

/** Alta de usuarios y maestros: 96 días atrás cuando hay historial (antes de todo), o ahora. */
function fechaCargaInicial(ahora: Date): Date {
  const fecha = new Date(ahora.getTime() - 96 * 86_400_000);
  fecha.setUTCHours(13, 0, 0, 0);
  return fecha;
}

type FilaBitacora = ReturnType<typeof filaBitacora>;

export async function sembrar(opciones: { historial?: boolean; ahora?: Date } = {}) {
  const conHistorial = opciones.historial ?? true;
  const ahora = opciones.ahora ?? new Date();
  const fechaAlta = conHistorial ? fechaCargaInicial(ahora) : undefined;
  const bitacora: FilaBitacora[] = [];

  await vaciar();

  const roles = new Map<string, number>();
  for (const nombre of Object.values(ROLES)) {
    const rol = await prisma.rol.create({ data: { nombre } });
    roles.set(nombre, rol.id);
  }

  const hashClave = await bcrypt.hash(CLAVE_DEMO, config.rondasBcrypt);
  const usuarios = new Map<string, number>();
  for (const u of USUARIOS_DEMO) {
    const creado = await prisma.usuario.create({
      data: { nombre: u.nombre, email: u.email, hashClave, rolId: roles.get(u.rol)!, ...(fechaAlta && { creadoEn: fechaAlta }) },
    });
    usuarios.set(u.email, creado.id);
    bitacora.push(
      filaBitacora(
        {
          usuarioId: null,
          accion: "CREAR",
          entidad: "Usuario",
          entidadId: creado.id,
          despues: { nombre: u.nombre, email: u.email, rol: u.rol, origen: "Carga inicial" },
        },
        fechaAlta,
      ),
    );
  }

  // Maestros.
  const categorias = await prisma.categoria.createManyAndReturn({ data: CATEGORIAS.map((nombre) => ({ nombre })) });
  const idCategoria = new Map(categorias.map((c) => [c.nombre, c.id]));
  const nombreCategoria = new Map(categorias.map((c) => [c.id, c.nombre]));
  const productos = await prisma.producto.createManyAndReturn({
    data: PRODUCTOS.map(({ categoria, ...p }) => ({ ...p, categoriaId: idCategoria.get(categoria)! })),
  });
  await prisma.cliente.createMany({ data: generarClientes() });
  const proveedores = await prisma.proveedor.createManyAndReturn({ data: PROVEEDORES });

  const almacenero = usuarios.get("almacen@distrinorte.pe")!;
  let historial: Historial | null = null;
  if (conHistorial) {
    const clientes = await prisma.cliente.findMany({ where: { activo: true }, orderBy: { id: "asc" } });
    const porRuc = new Map(proveedores.map((p) => [p.ruc, p]));
    historial = generarHistorial({
      ahora,
      productos: productos.map((p) => ({ ...p, categoria: nombreCategoria.get(p.categoriaId)! })),
      clientes: clientes.map((c) => ({ id: c.id, razonSocial: c.razonSocial })),
      proveedores: PROVEEDORES.map((p, i): ProveedorSim => {
        const fila = porRuc.get(p.ruc)!;
        return { id: fila.id, razonSocial: fila.razonSocial, categorias: CATEGORIAS_PROVEEDOR[i] };
      }),
      actores: {
        vendedores: [usuarios.get("vendedor1@distrinorte.pe")!, usuarios.get("vendedor2@distrinorte.pe")!],
        gerente: usuarios.get("gerente@distrinorte.pe")!,
        almacenero,
        admin: usuarios.get("admin@distrinorte.pe")!,
      },
    });
  }

  // Inventario inicial: una ENTRADA por producto que respalda el stock (stock = suma de movimientos).
  const fechaInicial = fechaInventarioInicial(ahora);
  await prisma.movInventario.createMany({
    data: productos
      .map((p) => ({ p, cantidad: historial ? historial.inicial.get(p.id)! : p.stock }))
      .filter(({ cantidad }) => cantidad > 0)
      .map(({ p, cantidad }) => ({
        productoId: p.id,
        tipo: "ENTRADA",
        cantidad,
        stockResultante: cantidad,
        motivo: "Inventario inicial",
        usuarioId: almacenero,
        fecha: fechaInicial,
      })),
  });

  if (historial) bitacora.push(...(await insertarHistorial(historial)));

  // La bitácora se inserta al final, en orden cronológico (los ids siguen el tiempo).
  bitacora.sort((a, b) => (a.fecha?.getTime() ?? ahora.getTime()) - (b.fecha?.getTime() ?? ahora.getTime()));
  await prisma.bitacora.createMany({ data: bitacora });
}

/** Inserta pedidos, órdenes y movimientos del historial; devuelve sus filas de bitácora. */
async function insertarHistorial(h: Historial): Promise<FilaBitacora[]> {
  const bitacora: FilaBitacora[] = [];
  const auditar = (fecha: Date, datos: DatosAuditoria) => bitacora.push(filaBitacora({ ip: null, ...datos }, fecha));

  // Pedidos: se insertan en orden cronológico con un código temporal; el definitivo sale del id (PED-000123).
  const insertados = await prisma.pedido.createManyAndReturn({
    data: h.pedidos.map((p) => ({
      codigo: `TMP-SEED-${p.indice}`,
      clienteId: p.cliente.id,
      vendedorId: p.vendedorId,
      fecha: p.fecha,
      estado: p.estado,
      condicionPago: p.condicionPago,
      total: p.total,
      motivoAnulacion: p.motivoAnulacion,
      aprobadoPorId: p.aprobadoPorId,
      despachadoPorId: p.despachadoPorId,
      fechaAprobacion: p.fechaAprobacion,
      fechaDespacho: p.fechaDespacho,
      fechaEntrega: p.fechaEntrega,
    })),
    select: { id: true, codigo: true },
  });
  const idPedido = new Map(insertados.map((r) => [Number(r.codigo.slice("TMP-SEED-".length)), r.id]));
  await prisma.$transaction(
    [...idPedido].map(([, id]) => prisma.pedido.update({ where: { id }, data: { codigo: codigoPedido(id) } })),
  );
  await prisma.detallePedido.createMany({
    data: h.pedidos.flatMap((p) =>
      p.lineas.map((l) => ({
        pedidoId: idPedido.get(p.indice)!,
        productoId: l.productoId,
        cantidad: l.cantidad,
        precioUnit: l.precioUnit,
        subtotal: l.subtotal,
      })),
    ),
  });

  // Órdenes de compra.
  const ocInsertadas = await prisma.ordenCompra.createManyAndReturn({
    data: h.ordenes.map((o) => ({ codigo: `TMP-SEED-${o.indice}`, proveedorId: o.proveedor.id, estado: o.estado, fecha: o.fecha })),
    select: { id: true, codigo: true },
  });
  const idOrden = new Map(ocInsertadas.map((r) => [Number(r.codigo.slice("TMP-SEED-".length)), r.id]));
  await prisma.$transaction(
    [...idOrden].map(([, id]) => prisma.ordenCompra.update({ where: { id }, data: { codigo: codigoOrden(id) } })),
  );
  await prisma.detalleOrdenCompra.createMany({
    data: h.ordenes.flatMap((o) =>
      o.lineas.map((l) => ({ ordenId: idOrden.get(o.indice)!, productoId: l.productoId, cantidad: l.cantidad, costoUnit: l.costoUnit })),
    ),
  });

  // Movimientos (SALIDA por despacho, ENTRADA por recepción) con el stock resultante simulado.
  const almacenero = h.pedidos.find((p) => p.despachadoPorId)?.despachadoPorId
    ?? h.ordenes.flatMap((o) => o.eventos).find((e) => e.tipo === "RECEPCION")?.usuarioId;
  const referencia = (m: Historial["movimientos"][number]) =>
    m.origen.tipo === "PEDIDO" ? codigoPedido(idPedido.get(m.origen.indice)!) : codigoOrden(idOrden.get(m.origen.indice)!);
  await prisma.movInventario.createMany({
    data: h.movimientos.map((m) => ({
      productoId: m.productoId,
      tipo: m.tipo,
      cantidad: m.cantidad,
      stockResultante: m.stockResultante,
      motivo: m.origen.tipo === "PEDIDO" ? motivoDespacho(referencia(m)) : motivoRecepcion(referencia(m)),
      referencia: referencia(m),
      usuarioId: almacenero!,
      fecha: m.fecha,
    })),
  });

  // Bitácora de pedidos: los mismos registros que producen los servicios.
  const movimientosDe = (tipo: "PEDIDO" | "ORDEN", indice: number, codigoDe: (productoId: number) => string) =>
    h.movimientos
      .filter((m) => m.origen.tipo === tipo && m.origen.indice === indice)
      .map((m) => ({ productoId: m.productoId, codigo: codigoDe(m.productoId), cantidad: m.cantidad, stockResultante: m.stockResultante }));

  for (const p of h.pedidos) {
    const id = idPedido.get(p.indice)!;
    const codigo = codigoPedido(id);
    const base = { entidad: "Pedido", entidadId: id };
    const codigoProducto = (productoId: number) => p.lineas.find((l) => l.productoId === productoId)!.codigo;
    for (const e of p.eventos) {
      const contenido =
        e.tipo === "CREAR"
          ? bitacoraPedido.crear({ codigo, cliente: p.cliente, condicionPago: p.condicionPago, total: p.total, lineas: p.lineas })
          : e.tipo === "APROBACION_AUTO"
            ? bitacoraPedido.aprobacionAutomatica()
            : e.tipo === "APROBACION"
              ? bitacoraPedido.aprobacion(e.estadoPrevio)
              : e.tipo === "DESPACHO"
                ? bitacoraPedido.despacho(e.estadoPrevio, movimientosDe("PEDIDO", p.indice, codigoProducto))
                : e.tipo === "ENTREGA"
                  ? bitacoraPedido.entrega(e.estadoPrevio)
                  : bitacoraPedido.anulacion(e.estadoPrevio, e.motivo!);
      auditar(e.fecha, { usuarioId: e.usuarioId, ...base, ...contenido });
    }
  }

  for (const o of h.ordenes) {
    const id = idOrden.get(o.indice)!;
    const codigo = codigoOrden(id);
    const base = { entidad: "OrdenCompra", entidadId: id };
    const codigoProducto = (productoId: number) => o.lineas.find((l) => l.productoId === productoId)!.codigo;
    for (const e of o.eventos) {
      const contenido =
        e.tipo === "CREAR"
          ? bitacoraOrden.crear({ codigo, proveedor: o.proveedor, lineas: o.lineas })
          : e.tipo === "APROBACION"
            ? bitacoraOrden.aprobacion(e.estadoPrevio)
            : bitacoraOrden.recepcion(e.estadoPrevio, movimientosDe("ORDEN", o.indice, codigoProducto));
      auditar(e.fecha, { usuarioId: e.usuarioId, ...base, ...contenido });
    }
  }

  for (const l of h.logins) {
    auditar(l.fecha, { usuarioId: l.usuarioId, entidad: "Usuario", entidadId: l.usuarioId, ...bitacoraLoginOk(0) });
  }
  return bitacora;
}

/** Solo la base (sin pedidos ni órdenes): estado controlado para las pruebas de reglas de negocio. */
export const sembrarBase = () => sembrar({ historial: false });

// Ejecutar solo cuando se llama como script (no al importarlo desde las pruebas).
if (process.argv[1]?.endsWith("seed.ts")) {
  const inicio = Date.now();
  sembrar()
    .then(() =>
      console.log(
        `Datos de demostración cargados en ${((Date.now() - inicio) / 1000).toFixed(1)} s. Contraseña de todos los usuarios: ${CLAVE_DEMO}`,
      ),
    )
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
