import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/db.ts";
import { sembrarBase } from "../prisma/seed.ts";
import { app, tokenDe, tokenRapido } from "./helpers.ts";

type Rol = "ADMIN" | "GERENTE" | "VENDEDOR" | "ALMACENERO";
const EMAIL: Record<Rol, string> = {
  ADMIN: "admin@distrinorte.pe",
  GERENTE: "gerente@distrinorte.pe",
  VENDEDOR: "vendedor1@distrinorte.pe",
  ALMACENERO: "almacen@distrinorte.pe",
};

let tokens: Record<Rol, string>;

beforeEach(async () => {
  await sembrarBase();
  tokens = {
    ADMIN: await tokenRapido(EMAIL.ADMIN),
    GERENTE: await tokenRapido(EMAIL.GERENTE),
    VENDEDOR: await tokenRapido(EMAIL.VENDEDOR),
    ALMACENERO: await tokenRapido(EMAIL.ALMACENERO),
  };
});

const auth = (rol: Rol) => ({ Authorization: `Bearer ${tokens[rol]}` });
const get = (rol: Rol, url: string) => request(app).get(url).set(auth(rol));
const post = (rol: Rol, url: string, body: object) => request(app).post(url).set(auth(rol)).send(body);
const patch = (rol: Rol, url: string, body: object) => request(app).patch(url).set(auth(rol)).send(body);

async function ultimoIdBitacora() {
  return (await prisma.bitacora.aggregate({ _max: { id: true } }))._max.id ?? 0;
}
async function bitacoraDesde(id: number) {
  return prisma.bitacora.findMany({ where: { id: { gt: id } }, orderBy: { id: "asc" } });
}

/** Ejecuta una operación y verifica que deja exactamente un registro de bitácora con la acción esperada. */
async function conUnRegistro<T>(accion: string, entidad: string, operacion: () => Promise<T>) {
  const desde = await ultimoIdBitacora();
  const resultado = await operacion();
  const nuevos = await bitacoraDesde(desde);
  expect(nuevos.map((b) => `${b.accion} ${b.entidad}`)).toEqual([`${accion} ${entidad}`]);
  const detalle = JSON.parse(nuevos[0].detalle);
  expect(detalle).toHaveProperty("antes");
  expect(detalle).toHaveProperty("despues");
  return { resultado, registro: nuevos[0], detalle };
}

async function sinRegistros(operacion: () => Promise<unknown>) {
  const desde = await ultimoIdBitacora();
  await operacion();
  expect(await bitacoraDesde(desde)).toHaveLength(0);
}

const clienteNuevo = {
  tipoDoc: "RUC",
  numDoc: "20611122233",
  razonSocial: "Minimarket Prueba S.A.C.",
  direccion: "Jr. Pizarro 123",
  telefono: "944 111 222",
  zona: "Centro",
};

// ---------------------------------------------------------------------------------------------

describe("Usuarios", () => {
  it("ADMIN y GERENTE ven la lista; VENDEDOR y ALMACENERO reciben 403", async () => {
    const res = await get("ADMIN", "/api/usuarios");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 5, page: 1, pageSize: 20 });
    expect(res.body.datos[0]).toEqual({
      id: expect.any(Number),
      nombre: expect.any(String),
      email: expect.any(String),
      rol: expect.any(String),
      activo: true,
      bloqueado: false,
      bloqueadoHasta: null,
      creadoEn: expect.any(String),
    });
    expect((await get("GERENTE", "/api/usuarios")).status).toBe(200);
    expect((await get("VENDEDOR", "/api/usuarios")).status).toBe(403);
    expect((await get("ALMACENERO", "/api/usuarios")).status).toBe(403);
    expect((await request(app).get("/api/usuarios")).status).toBe(401);
  });

  it("filtra por texto, rol y estado", async () => {
    const vendedores = await get("ADMIN", "/api/usuarios?rol=VENDEDOR");
    expect(vendedores.body.total).toBe(2);
    const rol = await prisma.rol.findUniqueOrThrow({ where: { nombre: "VENDEDOR" } });
    expect((await get("ADMIN", `/api/usuarios?rolId=${rol.id}`)).body.total).toBe(2);
    expect((await get("ADMIN", "/api/usuarios?buscar=rosa")).body.datos[0].email).toBe(EMAIL.ADMIN);
    expect((await get("ADMIN", "/api/usuarios?activo=false")).body.total).toBe(0);
  });

  it("ninguna respuesta de usuarios contiene hashClave", async () => {
    const respuestas = [
      await get("ADMIN", "/api/usuarios"),
      await get("GERENTE", "/api/usuarios?pageSize=100"),
    ];
    const id = respuestas[0].body.datos[0].id;
    respuestas.push(await get("ADMIN", `/api/usuarios/${id}`));
    respuestas.push(
      await post("ADMIN", "/api/usuarios", { nombre: "Nuevo Usuario", email: "nuevo@distrinorte.pe", clave: "Clave2026", rol: "VENDEDOR" }),
    );
    respuestas.push(await patch("ADMIN", `/api/usuarios/${respuestas[3].body.id}`, { nombre: "Nuevo Usuario Dos" }));
    for (const r of respuestas) {
      expect(r.status).toBeLessThan(300);
      expect(JSON.stringify(r.body)).not.toMatch(/hashClave|\$2[aby]\$/);
    }
  });

  it("ADMIN crea un usuario (un CREAR en bitácora) y el nuevo usuario puede entrar", async () => {
    const { resultado: res, detalle } = await conUnRegistro("CREAR", "Usuario", () =>
      post("ADMIN", "/api/usuarios", { nombre: "Pedro Nuevo", email: "Pedro@DistriNorte.pe", clave: "Clave2026", rol: "VENDEDOR" }),
    );
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: "pedro@distrinorte.pe", rol: "VENDEDOR", activo: true });
    expect(JSON.stringify(detalle)).not.toContain("Clave2026");
    expect(await tokenDe("pedro@distrinorte.pe", "Clave2026")).toEqual(expect.any(String));
  });

  it("GERENTE no puede crear ni editar usuarios", async () => {
    await sinRegistros(async () => {
      const cuerpo = { nombre: "X Y Z", email: "x@distrinorte.pe", clave: "Clave2026", rol: "VENDEDOR" };
      expect((await post("GERENTE", "/api/usuarios", cuerpo)).status).toBe(403);
      const vendedor = await prisma.usuario.findUniqueOrThrow({ where: { email: EMAIL.VENDEDOR } });
      expect((await patch("GERENTE", `/api/usuarios/${vendedor.id}`, { nombre: "Otro" })).status).toBe(403);
    });
  });

  it("rechaza email duplicado (409) y contraseña débil (400)", async () => {
    const dup = await post("ADMIN", "/api/usuarios", { nombre: "Otra Persona", email: "ADMIN@distrinorte.pe", clave: "Clave2026", rol: "ADMIN" });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toMatchObject({ codigo: "DUPLICADO", campos: { email: expect.any(String) } });

    const debil = await post("ADMIN", "/api/usuarios", { nombre: "Otra Persona", email: "otra@distrinorte.pe", clave: "abcdefgh", rol: "ADMIN" });
    expect(debil.status).toBe(400);
    expect(debil.body.error.campos).toHaveProperty("clave");

    const rolMalo = await post("ADMIN", "/api/usuarios", { nombre: "Otra Persona", email: "otra@distrinorte.pe", clave: "Clave2026", rol: "JEFE" });
    expect(rolMalo.status).toBe(400);
    expect(rolMalo.body.error.campos).toHaveProperty("rol");
  });

  it("desactivar registra DESACTIVAR y reactivar registra EDITAR", async () => {
    const v = await prisma.usuario.findUniqueOrThrow({ where: { email: EMAIL.VENDEDOR } });
    const { resultado, detalle } = await conUnRegistro("DESACTIVAR", "Usuario", () =>
      patch("ADMIN", `/api/usuarios/${v.id}`, { activo: false }),
    );
    expect(resultado.status).toBe(200);
    expect(resultado.body.activo).toBe(false);
    expect(detalle).toEqual({ antes: { activo: true }, despues: { activo: false } });

    const { resultado: re } = await conUnRegistro("EDITAR", "Usuario", () =>
      patch("ADMIN", `/api/usuarios/${v.id}`, { activo: true }),
    );
    expect(re.body.activo).toBe(true);
  });

  it("un admin no puede desactivarse ni quitarse el rol ADMIN (422)", async () => {
    const admin = await prisma.usuario.findUniqueOrThrow({ where: { email: EMAIL.ADMIN } });
    await sinRegistros(async () => {
      const desactivar = await patch("ADMIN", `/api/usuarios/${admin.id}`, { activo: false });
      expect(desactivar.status).toBe(422);
      expect(desactivar.body.error.campos).toHaveProperty("activo");
      const cambiarRol = await patch("ADMIN", `/api/usuarios/${admin.id}`, { rol: "GERENTE" });
      expect(cambiarRol.status).toBe(422);
      expect(cambiarRol.body.error.campos).toHaveProperty("rol");
    });
    // Sí puede editar su nombre.
    expect((await patch("ADMIN", `/api/usuarios/${admin.id}`, { nombre: "Rosa Quispe" })).status).toBe(200);
  });

  it("cambia el rol de otro usuario", async () => {
    const v = await prisma.usuario.findUniqueOrThrow({ where: { email: EMAIL.VENDEDOR } });
    const res = await patch("ADMIN", `/api/usuarios/${v.id}`, { rol: "ALMACENERO" });
    expect(res.body.rol).toBe("ALMACENERO");
  });

  it("desbloquea una cuenta y restablece la contraseña sin guardarla en la bitácora", async () => {
    const v = await prisma.usuario.update({
      where: { email: EMAIL.VENDEDOR },
      data: { intentosFallidos: 3, bloqueadoHasta: new Date(Date.now() + 10 * 60_000) },
    });
    expect((await get("ADMIN", `/api/usuarios/${v.id}`)).body.bloqueado).toBe(true);

    const { resultado, registro } = await conUnRegistro("EDITAR", "Usuario", () =>
      patch("ADMIN", `/api/usuarios/${v.id}`, { desbloquear: true, clave: "NuevaClave1" }),
    );
    expect(resultado.body).toMatchObject({ bloqueado: false, bloqueadoHasta: null });
    expect(registro.detalle).not.toContain("NuevaClave1");
    expect(JSON.parse(registro.detalle).despues).toMatchObject({ claveRestablecida: true, intentosFallidos: 0 });

    expect(await tokenDe(EMAIL.VENDEDOR, "NuevaClave1")).toEqual(expect.any(String));
  });

  it("PATCH vacío → 400; id inexistente → 404", async () => {
    expect((await patch("ADMIN", "/api/usuarios/999999", { nombre: "Alguien" })).status).toBe(404);
    expect((await get("ADMIN", "/api/usuarios/abc")).status).toBe(400);
    const admin = await prisma.usuario.findUniqueOrThrow({ where: { email: EMAIL.ADMIN } });
    expect((await patch("ADMIN", `/api/usuarios/${admin.id}`, {})).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------------------------

describe("Clientes", () => {
  it("todos los roles ven clientes, con paginación", async () => {
    for (const rol of ["ADMIN", "GERENTE", "VENDEDOR", "ALMACENERO"] as const) {
      expect((await get(rol, "/api/clientes")).status).toBe(200);
    }
    const p1 = await get("VENDEDOR", "/api/clientes");
    expect(p1.body).toMatchObject({ total: 80, page: 1, pageSize: 20 });
    expect(p1.body.datos).toHaveLength(20);

    const p3 = await get("VENDEDOR", "/api/clientes?page=3&pageSize=30");
    expect(p3.body).toMatchObject({ total: 80, page: 3, pageSize: 30 });
    expect(p3.body.datos).toHaveLength(20);

    const todos = await get("VENDEDOR", "/api/clientes?pageSize=100");
    expect(new Set(todos.body.datos.map((c: { id: number }) => c.id)).size).toBe(80);

    expect((await get("VENDEDOR", "/api/clientes?pageSize=101")).status).toBe(400);
  });

  it("busca por razón social o número de documento y filtra por zona y estado", async () => {
    const cliente = await prisma.cliente.findFirstOrThrow({ where: { tipoDoc: "RUC" }, orderBy: { id: "asc" } });
    const porDoc = await get("VENDEDOR", `/api/clientes?buscar=${cliente.numDoc}`);
    expect(porDoc.body.datos.map((c: { id: number }) => c.id)).toContain(cliente.id);

    const palabra = cliente.razonSocial.split(" ")[1];
    const porNombre = await get("VENDEDOR", `/api/clientes?pageSize=100&buscar=${encodeURIComponent(palabra.toLowerCase())}`);
    expect(porNombre.body.datos.map((c: { id: number }) => c.id)).toContain(cliente.id);

    const zona = await get("VENDEDOR", `/api/clientes?zona=${encodeURIComponent("Víctor Larco")}&pageSize=100`);
    expect(zona.body.total).toBeGreaterThan(0);
    expect(zona.body.datos.every((c: { zona: string }) => c.zona === "Víctor Larco")).toBe(true);

    expect((await get("VENDEDOR", "/api/clientes?zona=Miraflores")).status).toBe(400);
    expect((await get("VENDEDOR", "/api/clientes?activo=false")).body.total).toBe(2);
  });

  it("VENDEDOR crea clientes (un CREAR); GERENTE y ALMACENERO no pueden", async () => {
    const { resultado } = await conUnRegistro("CREAR", "Cliente", () => post("VENDEDOR", "/api/clientes", clienteNuevo));
    expect(resultado.status).toBe(201);
    expect(resultado.body).toEqual({ id: expect.any(Number), ...clienteNuevo, activo: true });

    await sinRegistros(async () => {
      expect((await post("GERENTE", "/api/clientes", { ...clienteNuevo, numDoc: "20611122234" })).status).toBe(403);
      expect((await post("ALMACENERO", "/api/clientes", { ...clienteNuevo, numDoc: "20611122234" })).status).toBe(403);
    });
  });

  it("valida RUC/DNI según el tipo con el error en numDoc", async () => {
    const malRuc = await post("ADMIN", "/api/clientes", { ...clienteNuevo, numDoc: "30611122233" });
    expect(malRuc.status).toBe(400);
    expect(malRuc.body.error.campos.numDoc).toBe("El RUC debe tener 11 dígitos y empezar con 10 o 20");

    const malDni = await post("ADMIN", "/api/clientes", { ...clienteNuevo, tipoDoc: "DNI", numDoc: "1234567" });
    expect(malDni.body.error.campos.numDoc).toBe("El DNI debe tener exactamente 8 dígitos");

    const okDni = await post("ADMIN", "/api/clientes", { ...clienteNuevo, tipoDoc: "DNI", numDoc: "71234567" });
    expect(okDni.status).toBe(201);

    const malaZona = await post("ADMIN", "/api/clientes", { ...clienteNuevo, zona: "Lima" });
    expect(malaZona.body.error.campos).toHaveProperty("zona");
  });

  it("numDoc duplicado → 409 con campos.numDoc (al crear y al editar)", async () => {
    const existente = await prisma.cliente.findFirstOrThrow({ orderBy: { id: "asc" } });
    const res = await post("VENDEDOR", "/api/clientes", { ...clienteNuevo, tipoDoc: existente.tipoDoc, numDoc: existente.numDoc });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ codigo: "DUPLICADO", campos: { numDoc: expect.any(String) } });

    const otro = await prisma.cliente.findFirstOrThrow({ where: { id: { not: existente.id }, tipoDoc: existente.tipoDoc } });
    const edit = await patch("ADMIN", `/api/clientes/${otro.id}`, { tipoDoc: existente.tipoDoc, numDoc: existente.numDoc });
    expect(edit.status).toBe(409);
  });

  it("VENDEDOR edita (EDITAR con antes/después) pero no puede activar ni desactivar (403)", async () => {
    const c = await prisma.cliente.findFirstOrThrow({ orderBy: { id: "asc" } });
    const { resultado, detalle } = await conUnRegistro("EDITAR", "Cliente", () =>
      patch("VENDEDOR", `/api/clientes/${c.id}`, { telefono: "955 000 111" }),
    );
    expect(resultado.body.telefono).toBe("955 000 111");
    expect(detalle.antes.telefono).toBe(c.telefono);
    expect(detalle.despues.telefono).toBe("955 000 111");

    await sinRegistros(async () => {
      expect((await patch("VENDEDOR", `/api/clientes/${c.id}`, { activo: false })).status).toBe(403);
      expect((await patch("VENDEDOR", `/api/clientes/${c.id}`, { activo: true, razonSocial: "Otro nombre" })).status).toBe(403);
      expect((await patch("GERENTE", `/api/clientes/${c.id}`, { razonSocial: "Otro nombre" })).status).toBe(403);
    });
    expect((await prisma.cliente.findUniqueOrThrow({ where: { id: c.id } })).activo).toBe(true);
  });

  it("ADMIN desactiva (DESACTIVAR) y reactiva (EDITAR)", async () => {
    const c = await prisma.cliente.findFirstOrThrow({ where: { activo: true } });
    await conUnRegistro("DESACTIVAR", "Cliente", () => patch("ADMIN", `/api/clientes/${c.id}`, { activo: false }));
    await conUnRegistro("EDITAR", "Cliente", () => patch("ADMIN", `/api/clientes/${c.id}`, { activo: true }));
  });

  it("exige enviar tipo y número de documento juntos al editar", async () => {
    const c = await prisma.cliente.findFirstOrThrow({ where: { tipoDoc: "RUC" } });
    const res = await patch("ADMIN", `/api/clientes/${c.id}`, { numDoc: "12345678" });
    expect(res.status).toBe(400);
    expect(res.body.error.campos).toHaveProperty("tipoDoc");
  });
});

// ---------------------------------------------------------------------------------------------

describe("Categorías", () => {
  it("todos los roles ven las categorías con su conteo de productos", async () => {
    for (const rol of ["ADMIN", "GERENTE", "VENDEDOR", "ALMACENERO"] as const) {
      expect((await get(rol, "/api/categorias")).status).toBe(200);
    }
    const res = await get("VENDEDOR", "/api/categorias");
    expect(res.body.total).toBe(8);
    const suma = res.body.datos.reduce((a: number, c: { numProductos: number }) => a + c.numProductos, 0);
    expect(suma).toBe(await prisma.producto.count());
    expect(res.body.datos[0]).toEqual({ id: expect.any(Number), nombre: "Aceites", numProductos: 7 });
  });

  it("solo ADMIN crea y edita; nombre duplicado → 409", async () => {
    const { resultado } = await conUnRegistro("CREAR", "Categoria", () => post("ADMIN", "/api/categorias", { nombre: "Snacks" }));
    expect(resultado.status).toBe(201);
    expect(resultado.body).toMatchObject({ nombre: "Snacks", numProductos: 0 });

    await conUnRegistro("EDITAR", "Categoria", () =>
      patch("ADMIN", `/api/categorias/${resultado.body.id}`, { nombre: "Snacks y golosinas" }),
    );

    const dup = await post("ADMIN", "/api/categorias", { nombre: "aceites" });
    expect(dup.status).toBe(409);
    expect(dup.body.error.campos).toHaveProperty("nombre");

    await sinRegistros(async () => {
      expect((await post("GERENTE", "/api/categorias", { nombre: "Otra" })).status).toBe(403);
      expect((await post("VENDEDOR", "/api/categorias", { nombre: "Otra" })).status).toBe(403);
      expect((await patch("ALMACENERO", `/api/categorias/${resultado.body.id}`, { nombre: "Otra" })).status).toBe(403);
    });
  });
});

// ---------------------------------------------------------------------------------------------

describe("Productos", () => {
  it("todos los roles ven productos con categoría, precio string y enAlerta", async () => {
    for (const rol of ["ADMIN", "GERENTE", "VENDEDOR", "ALMACENERO"] as const) {
      expect((await get(rol, "/api/productos")).status).toBe(200);
    }
    const res = await get("VENDEDOR", "/api/productos?buscar=ARR-001");
    expect(res.body.total).toBe(1);
    expect(res.body.datos[0]).toEqual({
      id: expect.any(Number),
      codigo: "ARR-001",
      nombre: "Arroz extra superior saco 50 kg",
      unidad: "SACO",
      precio: "185.00",
      stock: 120,
      stockMinimo: 30,
      activo: true,
      enAlerta: false,
      categoria: { id: expect.any(Number), nombre: "Arroz y menestras" },
    });
  });

  it("filtra por texto (sin distinguir mayúsculas) y categoría", async () => {
    const aceites = await get("VENDEDOR", "/api/productos?buscar=ACEITE&pageSize=100");
    expect(aceites.body.total).toBeGreaterThan(0);
    const cat = await prisma.categoria.findUniqueOrThrow({ where: { nombre: "Lácteos" } });
    const lacteos = await get("VENDEDOR", `/api/productos?categoriaId=${cat.id}&pageSize=100`);
    expect(lacteos.body.total).toBe(8);
    expect(lacteos.body.datos.every((p: { categoria: { id: number } }) => p.categoria.id === cat.id)).toBe(true);
  });

  it("alerta=true devuelve exactamente los productos activos con stock <= stockMinimo", async () => {
    const todos = await prisma.producto.findMany({ where: { activo: true } });
    const esperados = todos.filter((p) => p.stock <= p.stockMinimo).map((p) => p.codigo).sort();
    expect(esperados.length).toBeGreaterThanOrEqual(6);

    const res = await get("ALMACENERO", "/api/productos?alerta=true&pageSize=100");
    expect(res.status).toBe(200);
    expect(res.body.datos.map((p: { codigo: string }) => p.codigo).sort()).toEqual(esperados);
    expect(res.body.datos.every((p: { enAlerta: boolean }) => p.enAlerta)).toBe(true);
    expect(res.body.total).toBe(esperados.length);

    const sinAlerta = await get("ALMACENERO", "/api/productos?alerta=false&pageSize=100");
    expect(sinAlerta.body.total).toBe(todos.length - esperados.length);
    expect(sinAlerta.body.datos.some((p: { enAlerta: boolean }) => p.enAlerta)).toBe(false);

    // Un producto desactivado sale de las alertas.
    const primero = await prisma.producto.findUniqueOrThrow({ where: { codigo: esperados[0] } });
    await patch("ADMIN", `/api/productos/${primero.id}`, { activo: false });
    expect((await get("ALMACENERO", "/api/productos?alerta=true")).body.total).toBe(esperados.length - 1);
  });

  it("ADMIN crea un producto con stock 0 (un CREAR); los demás roles reciben 403", async () => {
    const cat = await prisma.categoria.findUniqueOrThrow({ where: { nombre: "Bebidas" } });
    const cuerpo = { codigo: "beb-099", nombre: "Agua tónica botella 500 ml", unidad: "UND", precio: 3.5, stockMinimo: 10, categoriaId: cat.id };
    const { resultado } = await conUnRegistro("CREAR", "Producto", () => post("ADMIN", "/api/productos", cuerpo));
    expect(resultado.status).toBe(201);
    expect(resultado.body).toMatchObject({ codigo: "BEB-099", precio: "3.50", stock: 0, enAlerta: true, categoria: { nombre: "Bebidas" } });

    await sinRegistros(async () => {
      for (const rol of ["GERENTE", "VENDEDOR", "ALMACENERO"] as const) {
        expect((await post(rol, "/api/productos", { ...cuerpo, codigo: "BEB-098" })).status).toBe(403);
        expect((await patch(rol, `/api/productos/${resultado.body.id}`, { nombre: "Otro nombre" })).status).toBe(403);
      }
    });
  });

  it("código duplicado → 409; precio inválido y categoría inexistente → 400", async () => {
    const cat = await prisma.categoria.findFirstOrThrow();
    const base = { codigo: "ARR-001", nombre: "Duplicado", unidad: "UND", precio: "1.00", stockMinimo: 0, categoriaId: cat.id };
    const dup = await post("ADMIN", "/api/productos", base);
    expect(dup.status).toBe(409);
    expect(dup.body.error.campos).toHaveProperty("codigo");

    const precio = await post("ADMIN", "/api/productos", { ...base, codigo: "X-001", precio: "12.345" });
    expect(precio.status).toBe(400);
    expect(precio.body.error.campos).toHaveProperty("precio");
    const cero = await post("ADMIN", "/api/productos", { ...base, codigo: "X-001", precio: 0 });
    expect(cero.body.error.campos).toHaveProperty("precio");
    const minimo = await post("ADMIN", "/api/productos", { ...base, codigo: "X-001", stockMinimo: -1 });
    expect(minimo.body.error.campos).toHaveProperty("stockMinimo");

    const sinCat = await post("ADMIN", "/api/productos", { ...base, codigo: "X-001", categoriaId: 999999 });
    expect(sinCat.status).toBe(400);
    expect(sinCat.body.error.campos).toHaveProperty("categoriaId");

    const otro = await prisma.producto.findUniqueOrThrow({ where: { codigo: "ARR-002" } });
    expect((await patch("ADMIN", `/api/productos/${otro.id}`, { codigo: "arr-001" })).status).toBe(409);
  });

  it("el stock no se edita por PATCH ni se fija al crear (422) y nada cambia", async () => {
    const p = await prisma.producto.findUniqueOrThrow({ where: { codigo: "ARR-001" } });
    await sinRegistros(async () => {
      const res = await patch("ADMIN", `/api/productos/${p.id}`, { stock: 999, nombre: "Otro nombre" });
      expect(res.status).toBe(422);
      expect(res.body.error).toMatchObject({ codigo: "CAMPO_NO_EDITABLE", campos: { stock: expect.any(String) } });

      const crear = await post("ADMIN", "/api/productos", {
        codigo: "X-002", nombre: "Con stock", unidad: "UND", precio: "1.00", stockMinimo: 0, categoriaId: p.categoriaId, stock: 50,
      });
      expect(crear.status).toBe(422);
    });
    const despues = await prisma.producto.findUniqueOrThrow({ where: { id: p.id } });
    expect(despues).toMatchObject({ stock: p.stock, nombre: p.nombre });
  });

  it("editar precio registra EDITAR con antes/después; desactivar registra DESACTIVAR", async () => {
    const p = await prisma.producto.findUniqueOrThrow({ where: { codigo: "ACE-001" } });
    const { resultado, detalle } = await conUnRegistro("EDITAR", "Producto", () =>
      patch("ADMIN", `/api/productos/${p.id}`, { precio: "10.5" }),
    );
    expect(resultado.body.precio).toBe("10.50");
    expect(detalle.antes.precio).toBe("9.90");
    expect(detalle.despues.precio).toBe("10.50");

    const { resultado: des } = await conUnRegistro("DESACTIVAR", "Producto", () =>
      patch("ADMIN", `/api/productos/${p.id}`, { activo: false }),
    );
    expect(des.body.activo).toBe(false);
    expect((await get("VENDEDOR", "/api/productos?activo=false")).body.total).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------

describe("Proveedores", () => {
  it("ADMIN, GERENTE y ALMACENERO ven; VENDEDOR recibe 403", async () => {
    const res = await get("ALMACENERO", "/api/proveedores");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.datos[0]).toEqual({ id: expect.any(Number), ruc: expect.any(String), razonSocial: expect.any(String), telefono: expect.any(String) });
    expect((await get("GERENTE", `/api/proveedores/${res.body.datos[0].id}`)).status).toBe(200);
    expect((await get("VENDEDOR", "/api/proveedores")).status).toBe(403);
  });

  it("GERENTE crea (un CREAR); ALMACENERO no; RUC validado y único", async () => {
    const cuerpo = { ruc: "20612345678", razonSocial: "Proveedora de Prueba S.A.C." };
    const { resultado } = await conUnRegistro("CREAR", "Proveedor", () => post("GERENTE", "/api/proveedores", cuerpo));
    expect(resultado.status).toBe(201);
    expect(resultado.body).toEqual({ id: expect.any(Number), ...cuerpo, telefono: null });

    await sinRegistros(async () => {
      expect((await post("ALMACENERO", "/api/proveedores", { ...cuerpo, ruc: "20612345679" })).status).toBe(403);
      const dup = await post("ADMIN", "/api/proveedores", cuerpo);
      expect(dup.status).toBe(409);
      expect(dup.body.error.campos).toHaveProperty("ruc");
      const malo = await post("ADMIN", "/api/proveedores", { ...cuerpo, ruc: "12345678" });
      expect(malo.status).toBe(400);
      expect(malo.body.error.campos.ruc).toBe("El RUC debe tener 11 dígitos y empezar con 10 o 20");
    });
  });

  it("solo ADMIN edita (EDITAR); GERENTE recibe 403", async () => {
    const p = await prisma.proveedor.findFirstOrThrow();
    await sinRegistros(async () => {
      expect((await patch("GERENTE", `/api/proveedores/${p.id}`, { telefono: "044 000 000" })).status).toBe(403);
    });
    const { resultado } = await conUnRegistro("EDITAR", "Proveedor", () =>
      patch("ADMIN", `/api/proveedores/${p.id}`, { telefono: "" }),
    );
    expect(resultado.body.telefono).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------

describe("Datos de demostración", () => {
  it("el stock de cada producto cuadra con la suma de sus movimientos", async () => {
    const productos = await prisma.producto.findMany({ include: { movimientos: true } });
    expect(productos.length).toBeGreaterThanOrEqual(55);
    for (const p of productos) {
      const suma = p.movimientos.reduce(
        (a, m) => a + (m.tipo === "ENTRADA" || m.tipo === "AJUSTE_POSITIVO" ? m.cantidad : -m.cantidad),
        0,
      );
      expect(suma, p.codigo).toBe(p.stock);
    }
    const almacenero = await prisma.usuario.findUniqueOrThrow({ where: { email: EMAIL.ALMACENERO } });
    const movs = await prisma.movInventario.findMany();
    expect(movs.every((m) => m.tipo === "ENTRADA" && m.motivo === "Inventario inicial" && m.usuarioId === almacenero.id)).toBe(true);
  });

  it("sembrar() es idempotente", async () => {
    await sembrarBase();
    expect(await prisma.cliente.count()).toBe(80);
    expect(await prisma.categoria.count()).toBe(8);
    expect(await prisma.proveedor.count()).toBe(3);
    expect(await prisma.bitacora.count()).toBe(5);
  });
});
