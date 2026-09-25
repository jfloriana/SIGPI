// Datos de demostración de SIGPI. Idempotente: vacía las tablas y vuelve a cargar todo.
// Fase 1: roles y usuarios. El volumen completo (productos, clientes, pedidos…) se agrega en la Fase 6.
import bcrypt from "bcrypt";
import { config } from "../src/config.ts";
import { prisma } from "../src/db.ts";
import { auditar } from "../src/services/auditoria.ts";
import { ROLES } from "../src/utils/roles.ts";

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
