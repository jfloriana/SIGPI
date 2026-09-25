// Datos de demostración de SIGPI. Idempotente: vacía las tablas y vuelve a cargar todo.
// Fase 1: roles y usuarios. Fase 2: datos maestros (categorías, productos con su inventario inicial,
// clientes y proveedores). Los pedidos y órdenes de compra se agregan en fases siguientes.
import bcrypt from "bcrypt";
import { config } from "../src/config.ts";
import { prisma } from "../src/db.ts";
import { auditar } from "../src/services/auditoria.ts";
import { ROLES } from "../src/utils/roles.ts";
import { CATEGORIAS, PRODUCTOS, PROVEEDORES, generarClientes } from "./datos-maestros.ts";

export const CLAVE_DEMO = "Demo2026!";

export const USUARIOS_DEMO = [
  { nombre: "Rosa Quispe Vargas", email: "admin@distrinorte.pe", rol: ROLES.ADMIN },
  { nombre: "Carlos Mendoza Ríos", email: "gerente@distrinorte.pe", rol: ROLES.GERENTE },
  { nombre: "Luis Paredes Castillo", email: "vendedor1@distrinorte.pe", rol: ROLES.VENDEDOR },
  { nombre: "Ana Villanueva Soto", email: "vendedor2@distrinorte.pe", rol: ROLES.VENDEDOR },
  { nombre: "Jorge Alvarado Díaz", email: "almacen@distrinorte.pe", rol: ROLES.ALMACENERO },
] as const;

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
}

export async function sembrar() {
  await vaciar();

  const roles = new Map<string, number>();
  for (const nombre of Object.values(ROLES)) {
    const rol = await prisma.rol.create({ data: { nombre } });
    roles.set(nombre, rol.id);
  }

  const hashClave = await bcrypt.hash(CLAVE_DEMO, config.rondasBcrypt);
  for (const u of USUARIOS_DEMO) {
    const creado = await prisma.usuario.create({
      data: { nombre: u.nombre, email: u.email, hashClave, rolId: roles.get(u.rol)! },
    });
    await auditar(prisma, {
      usuarioId: null,
      accion: "CREAR",
      entidad: "Usuario",
      entidadId: creado.id,
      despues: { nombre: u.nombre, email: u.email, rol: u.rol, origen: "Carga inicial" },
    });
  }

  await sembrarMaestros();
}

/** Fecha del inventario inicial: 95 días atrás a las 08:00 (hora de Lima), antes de cualquier pedido de demo. */
export function fechaInventarioInicial(): Date {
  const fecha = new Date(Date.now() - 95 * 86_400_000);
  fecha.setUTCHours(13, 0, 0, 0); // 08:00 en America/Lima (UTC-5)
  return fecha;
}

async function sembrarMaestros() {
  const categorias = await prisma.categoria.createManyAndReturn({
    data: CATEGORIAS.map((nombre) => ({ nombre })),
  });
  const idCategoria = new Map(categorias.map((c) => [c.nombre, c.id]));

  const productos = await prisma.producto.createManyAndReturn({
    data: PRODUCTOS.map(({ categoria, ...p }) => ({ ...p, categoriaId: idCategoria.get(categoria)! })),
  });

  // El stock inicial queda respaldado por una ENTRADA: stock = suma de movimientos (kardex cuadrado).
  const almacenero = await prisma.usuario.findUniqueOrThrow({ where: { email: "almacen@distrinorte.pe" } });
  const fecha = fechaInventarioInicial();
  await prisma.movInventario.createMany({
    data: productos
      .filter((p) => p.stock > 0)
      .map((p) => ({
        productoId: p.id,
        tipo: "ENTRADA",
        cantidad: p.stock,
        stockResultante: p.stock,
        motivo: "Inventario inicial",
        usuarioId: almacenero.id,
        fecha,
      })),
  });

  await prisma.cliente.createMany({ data: generarClientes() });
  await prisma.proveedor.createMany({ data: PROVEEDORES });
}

// Ejecutar solo cuando se llama como script (no al importarlo desde las pruebas).
if (process.argv[1]?.endsWith("seed.ts")) {
  sembrar()
    .then(() => console.log(`Datos de demostración cargados. Contraseña de todos los usuarios: ${CLAVE_DEMO}`))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
