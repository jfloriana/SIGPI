// Contenido de «Acerca del sistema»: qué concepto del curso demuestra cada módulo, con la regla de la
// especificación que lo implementa y la prueba automatizada (apps/api/tests/*.test.ts) que lo respalda.
import type { Rol } from "../../auth/roles";

export interface Pantalla {
  ruta: string;
  etiqueta: string;
}

export interface Prueba {
  archivo: string;
  nombre: string;
}

export interface Concepto {
  id: string;
  titulo: string;
  /** Uno o dos párrafos: qué demuestra y cómo. */
  texto: string[];
  pantallas: Pantalla[];
  /** Si el concepto no se ve en una pantalla, dónde se ve. */
  otroLugar?: string;
  reglas: string[];
  pruebas: Prueba[];
  /** Aclaración honesta (supuestos del demo, límites). */
  nota?: string;
  /** Contenido extra que la página dibuja (matriz de permisos). */
  extra?: "matriz";
}

export const CONCEPTOS: Concepto[] = [
  {
    id: "acceso",
    titulo: "Control de acceso por roles",
    texto: [
      "Cada usuario tiene uno de cuatro roles y cada ruta de la API declara qué roles la pueden usar. El servidor vuelve a leer el rol desde la base en cada petición, así que un cambio de rol surte efecto de inmediato; la interfaz solo oculta lo que el rol no puede hacer.",
      "La segregación de funciones separa a quien registra un pedido de quien lo aprueba y lo despacha: el administrador mantiene maestros y usuarios, pero no aprueba nada.",
    ],
    pantallas: [
      { ruta: "/usuarios", etiqueta: "Usuarios" },
      { ruta: "/pedidos", etiqueta: "Pedidos" },
    ],
    otroLugar: "El menú lateral cambia según el rol con que se inicia sesión.",
    reglas: [
      "Regla 11: quien creó un pedido no puede aprobarlo ni despacharlo, aunque se le cambie el rol.",
      "Regla 12: la cuenta se bloquea 15 minutos tras 5 intentos fallidos.",
      "Regla 13: requireRol en cada ruta; nunca se devuelve hashClave.",
      "Regla 14: CORS limitado, cabeceras con helmet y límite de tasa en el inicio de sesión.",
    ],
    pruebas: [
      { archivo: "auth.test.ts", nombre: "requireRol responde 403 al rol no autorizado y usa el rol vigente en la base" },
      { archivo: "pedidos.test.ts", nombre: "VENDEDOR no puede aprobar ni despachar; ADMIN no aprueba ni anula (403)" },
      { archivo: "pedidos.test.ts", nombre: "un vendedor no ve los pedidos de otro (lista y detalle), aunque pida su vendedorId" },
      { archivo: "pedidos.test.ts", nombre: "segregación: quien registró no aprueba ni despacha aunque se le cambie el rol" },
      { archivo: "auth.test.ts", nombre: "bloquea la cuenta 15 minutos tras 5 intentos fallidos, aun con la clave correcta" },
      { archivo: "maestros.test.ts", nombre: "ninguna respuesta de usuarios contiene hashClave" },
      { archivo: "auth.test.ts", nombre: "aplica cabeceras de seguridad y CORS limitado" },
    ],
    extra: "matriz",
  },
  {
    id: "entrada",
    titulo: "Controles de entrada",
    texto: [
      "Los datos se validan con esquemas Zod en el servidor antes de tocar la base, y los formularios repiten las mismas reglas para avisar antes de enviar. Cada error vuelve con el nombre del campo y un mensaje en español, que la pantalla muestra junto al campo.",
    ],
    pantallas: [
      { ruta: "/clientes", etiqueta: "Clientes" },
      { ruta: "/pedidos/nuevo", etiqueta: "Nuevo pedido" },
      { ruta: "/productos", etiqueta: "Productos" },
      { ruta: "/ajustes", etiqueta: "Ajustes de inventario" },
    ],
    reglas: [
      "Regla 1: RUC de 11 dígitos que empieza con 10 o 20; DNI de exactamente 8 dígitos.",
      "Regla 2: cantidades enteras mayores que 0, precios mayores que 0 y stock mínimo ≥ 0.",
      "Regla 3: un pedido tiene al menos una línea y no repite el mismo producto.",
    ],
    pruebas: [
      { archivo: "validadores.test.ts", nombre: "rechaza el RUC %s (%s) con mensaje en español" },
      { archivo: "validadores.test.ts", nombre: "valida el número según el tipo de documento y pone el error en numDoc" },
      { archivo: "maestros.test.ts", nombre: "valida RUC/DNI según el tipo con el error en numDoc" },
      { archivo: "validadores.test.ts", nombre: "acepta enteros ≥ 0 y rechaza negativos y decimales" },
      { archivo: "pedidos.test.ts", nombre: "valida líneas, productos repetidos, cliente y producto inactivos" },
      { archivo: "auth.test.ts", nombre: "valida la entrada con Zod y responde errores por campo" },
    ],
  },
  {
    id: "procesamiento",
    titulo: "Controles de procesamiento",
    texto: [
      "El servidor decide lo que importa: calcula el total con el precio vigente (el que muestra el celular del vendedor es solo referencial), comprueba el stock al registrar y solo permite los cambios de estado que la máquina de estados admite.",
      "Los pedidos al contado de hasta S/ 2 000 se aprueban solos y la bitácora lo anota como aprobación automática; los de crédito o de mayor monto esperan al gerente.",
    ],
    pantallas: [
      { ruta: "/pedidos/nuevo", etiqueta: "Nuevo pedido" },
      { ruta: "/pedidos", etiqueta: "Pedidos (detalle con línea de tiempo)" },
    ],
    reglas: [
      "Regla 4: el total se calcula en el servidor; se ignora el total enviado.",
      "Regla 5: al registrar, cada cantidad debe ser ≤ stock disponible (si no, 409).",
      "Regla 6: REGISTRADO → APROBADO → DESPACHADO → ENTREGADO; ANULADO solo desde REGISTRADO o APROBADO, con motivo de 10+ caracteres; otra transición, 422.",
      "Regla 7: crédito o total > S/ 2 000 requieren aprobación del gerente.",
    ],
    pruebas: [
      { archivo: "pedidos.test.ts", nombre: "calcula el total en el servidor e ignora total y precioUnit enviados (prueba 2)" },
      { archivo: "pedidos.test.ts", nombre: "cantidad > stock → 409 STOCK_INSUFICIENTE con producto y stock, y no crea nada (prueba 3)" },
      { archivo: "pedidos.test.ts", nombre: "no se puede anular un DESPACHADO ni saltarse estados" },
      { archivo: "pedidos.test.ts", nombre: "anular exige motivo de 10+ caracteres y registra un ANULAR" },
      { archivo: "pedidos.test.ts", nombre: "contado ≤ S/ 2 000 se aprueba automáticamente (CREAR + CAMBIO_ESTADO AUTOMATICA)" },
      { archivo: "pedidos.test.ts", nombre: "contado > S/ 2 000 y crédito quedan REGISTRADOS (solo CREAR)" },
    ],
  },
  {
    id: "acid",
    titulo: "Transacciones ACID",
    texto: [
      "Despachar un pedido y recepcionar una orden de compra son operaciones atómicas: dentro de una sola transacción se verifica el stock, se actualiza, se crea un movimiento por producto, cambia el estado y se escribe la bitácora. Si una línea falla, no cambia nada.",
      "El descuento usa una actualización condicional (solo si el stock alcanza), de modo que dos despachos simultáneos no pueden dejar el stock en negativo. El kardex permite comprobar que el stock de cada producto es la suma de sus movimientos.",
    ],
    pantallas: [
      { ruta: "/despacho", etiqueta: "Cola de despacho" },
      { ruta: "/compras", etiqueta: "Proveedores y compras" },
      { ruta: "/kardex", etiqueta: "Kardex" },
      { ruta: "/ajustes", etiqueta: "Ajustes de inventario" },
    ],
    reglas: [
      "Regla 8: despacho atómico; el stock nunca queda negativo.",
      "Regla 9: la recepción de una orden aprobada suma stock y crea entradas en una sola transacción.",
      "Regla 10: un ajuste exige motivo y uno negativo no puede dejar stock < 0.",
    ],
    pruebas: [
      { archivo: "pedidos.test.ts", nombre: "descuenta stock, crea un movimiento SALIDA por línea y cambia el estado" },
      { archivo: "pedidos.test.ts", nombre: "si una línea no tiene stock, NADA cambia: stock, movimientos, estado ni bitácora" },
      { archivo: "pedidos.test.ts", nombre: "dos despachos concurrentes del mismo stock: solo uno tiene éxito y el stock nunca es negativo" },
      { archivo: "compras.test.ts", nombre: "sugerida → crear → aprobar → recepcionar suma stock, crea ENTRADAS y saca los productos de la alerta" },
      { archivo: "compras.test.ts", nombre: "recepcionar dos veces a la vez solo suma una vez" },
      { archivo: "inventario.test.ts", nombre: "un ajuste negativo que dejaría stock < 0 → 409 y no cambia nada" },
      { archivo: "maestros.test.ts", nombre: "el stock de cada producto cuadra con la suma de sus movimientos" },
    ],
  },
  {
    id: "alertas",
    titulo: "Alertas de stock y orden de compra sugerida",
    texto: [
      "Un producto entra en alerta cuando su stock llega al mínimo. Desde la lista de alertas, el gerente genera una orden de compra sugerida con la cantidad necesaria para reponer, la aprueba y el almacén la recepciona; al subir el stock, el producto sale de la alerta.",
    ],
    pantallas: [
      { ruta: "/alertas", etiqueta: "Alertas de stock" },
      { ruta: "/compras", etiqueta: "Proveedores y compras" },
      { ruta: "/tablero", etiqueta: "Tablero" },
    ],
    reglas: ["Regla 18: alerta cuando stock ≤ stock mínimo; cantidad sugerida = stock mínimo × 2 − stock."],
    nota: "El costo unitario de la orden sugerida se precarga al 80 % del precio de venta y se puede editar. Es un supuesto del demo, no un dato de DistriNorte.",
    pruebas: [
      { archivo: "inventario.test.ts", nombre: "lista los productos activos en alerta, del más crítico al menos, con cantidad sugerida" },
      { archivo: "inventario.test.ts", nombre: "un producto sale de la alerta al reponerlo y los inactivos no aparecen" },
      { archivo: "compras.test.ts", nombre: "propone los productos en alerta con cantidad = mínimo×2 − stock y costo = 80 % del precio, sin guardar nada" },
      { archivo: "maestros.test.ts", nombre: "alerta=true devuelve exactamente los productos activos con stock <= stockMinimo" },
    ],
  },
  {
    id: "tablero",
    titulo: "Tablero gerencial",
    texto: [
      "El tablero resume el período elegido para la toma de decisiones: ventas, número de pedidos, ticket promedio, ventas por día, productos más vendidos, ventas por vendedor y por zona, y los productos en alerta. Solo cuentan como venta los pedidos despachados o entregados.",
      "El alcance depende del rol: gerente y administrador ven el total; el vendedor, solo sus ventas; el almacenero, solo stock y alertas. Las ventas se pueden exportar a CSV.",
    ],
    pantallas: [{ ruta: "/tablero", etiqueta: "Tablero" }],
    reglas: ["Especificación, pantalla 2 y API de reportes: solo DESPACHADO y ENTREGADO cuentan como venta; alcance según el rol."],
    pruebas: [
      { archivo: "reportes.test.ts", nombre: "GERENTE: solo DESPACHADO y ENTREGADO cuentan como venta; ticket = total / número" },
      { archivo: "reportes.test.ts", nombre: "ventasPorDia cubre todos los días del período (con ceros) y usa la fecha de despacho" },
      { archivo: "reportes.test.ts", nombre: "VENDEDOR: alcance PROPIO, métricas solo de sus pedidos y sin alertas" },
      { archivo: "reportes.test.ts", nombre: "ALMACENERO: alcance STOCK, sin métricas de ventas y con todas las alertas" },
      { archivo: "reportes.test.ts", nombre: "tiene BOM UTF-8, separador ;, cabecera fija y una fila por venta" },
    ],
  },
  {
    id: "trazabilidad",
    titulo: "Trazabilidad",
    texto: [
      "Cada inicio de sesión y cada operación crítica deja exactamente un registro en la bitácora, con quién, cuándo y los datos antes y después. El registro se escribe dentro de la misma transacción que la operación: si la operación se revierte, el registro también.",
      "La bitácora es de solo lectura: la API no tiene rutas para editarla ni borrarla. Con ella se reconstruye la historia completa de un pedido.",
    ],
    pantallas: [
      { ruta: "/bitacora", etiqueta: "Bitácora" },
      { ruta: "/pedidos", etiqueta: "Pedidos (línea de tiempo del detalle)" },
    ],
    reglas: [
      "Regla 16: inicios de sesión, altas, ediciones, desactivaciones, cambios de estado, anulaciones, ajustes y recepciones, con antes y después.",
      "Regla 17: la bitácora es de solo lectura.",
    ],
    pruebas: [
      { archivo: "auth.test.ts", nombre: "registra exactamente un LOGIN_OK por entrada exitosa y un LOGIN_FALLIDO por fallo" },
      { archivo: "pedidos.test.ts", nombre: "recorre REGISTRADO → APROBADO → DESPACHADO → ENTREGADO con un registro de bitácora por paso" },
      { archivo: "maestros.test.ts", nombre: "editar precio registra EDITAR con antes/después; desactivar registra DESACTIVAR" },
      { archivo: "bitacora.test.ts", nombre: "no existen POST, PUT, PATCH ni DELETE: responden 404 y nada cambia" },
      { archivo: "bitacora.test.ts", nombre: "ningún router de la API registra una ruta de escritura sobre la bitácora" },
    ],
  },
  {
    id: "datos",
    titulo: "Independencia de datos",
    texto: [
      "El mismo código funciona con SQLite (un archivo local, ideal para exponer sin internet) y con PostgreSQL en Supabase. Para cambiar de motor basta con modificar el provider en prisma/schema.prisma y las variables DATABASE_URL y DIRECT_URL del archivo .env; la aplicación elige el adaptador de Prisma según la URL.",
    ],
    pantallas: [],
    otroLugar: "No tiene pantalla: se ve en apps/api/prisma/schema.prisma, prisma.config.ts y src/db.ts, y los pasos están en el README.",
    reglas: ["Especificación, «Base de datos: dos modos»: una sola base de código; el cambio es solo provider y variables de entorno (informe, sección 5.5)."],
    nota: "No hay una prueba automatizada que cambie de motor: las pruebas corren sobre SQLite (prisma/test.db).",
    pruebas: [],
  },
];

export interface Capa {
  capa: string;
  responsabilidad: string;
  tecnologias: string;
}

/** Versiones exactas de los package.json (y del README). */
export const CAPAS: Capa[] = [
  {
    capa: "Presentación",
    responsabilidad: "Pantallas por rol, formularios que reflejan las reglas, tablero. Solo oculta opciones; no decide.",
    tecnologias: "React 19.3.0 · React Router 7.18.4 · Vite 8.3.1 · Tailwind CSS 4.3.3 · TanStack Query 5.103.2 · Recharts 3.10.1 · lucide-react 1.48.0",
  },
  {
    capa: "Lógica",
    responsabilidad: "API REST: autenticación, permisos por rol, validación, reglas de negocio, transacciones y bitácora.",
    tecnologias: "Node.js ≥ 22.18 · Express 5.2.1 · Zod 4.6.5 · jsonwebtoken 9.0.3 · bcrypt 6.0.0 · helmet 8.3.0 · express-rate-limit 8.7.0",
  },
  {
    capa: "Datos",
    responsabilidad: "Modelo relacional, acceso a la base e integridad; SQLite local o PostgreSQL (Supabase).",
    tecnologias: "Prisma 7.10.0 · adaptadores better-sqlite3 y pg 7.10.0 · SQLite / PostgreSQL",
  },
];

export const HERRAMIENTAS = "TypeScript 7.0.2 en todo el proyecto. Pruebas: Vitest 5.0.1 y Supertest 7.3.0 (API) y Playwright 1.63.0 (extremo a extremo).";

export const ROLES_MATRIZ: Rol[] = ["ADMIN", "GERENTE", "VENDEDOR", "ALMACENERO"];

/** Matriz de permisos de la especificación (resumida). `null` = sin acceso. */
export const MATRIZ: { modulo: string; permisos: Record<Rol, string | null> }[] = [
  { modulo: "Usuarios", permisos: { ADMIN: "Crear, editar, desactivar", GERENTE: "Ver", VENDEDOR: null, ALMACENERO: null } },
  { modulo: "Clientes", permisos: { ADMIN: "Crear, editar, desactivar", GERENTE: "Ver", VENDEDOR: "Crear, editar", ALMACENERO: "Ver" } },
  { modulo: "Categorías y productos", permisos: { ADMIN: "Crear, editar, desactivar", GERENTE: "Ver", VENDEDOR: "Ver", ALMACENERO: "Ver" } },
  {
    modulo: "Pedidos",
    permisos: {
      ADMIN: "Ver todos",
      GERENTE: "Ver todos, aprobar, anular",
      VENDEDOR: "Crear, ver los suyos, anular los suyos en REGISTRADO",
      ALMACENERO: "Ver aprobados y despachados, despachar, entregar",
    },
  },
  { modulo: "Inventario", permisos: { ADMIN: "Kardex, ajustes", GERENTE: "Ver", VENDEDOR: "Ver stock", ALMACENERO: "Kardex, entradas y ajustes" } },
  {
    modulo: "Proveedores y órdenes de compra",
    permisos: { ADMIN: "Crear, editar, anular", GERENTE: "Crear, aprobar, anular", VENDEDOR: null, ALMACENERO: "Recepcionar" },
  },
  { modulo: "Tablero y reportes", permisos: { ADMIN: "Total", GERENTE: "Total", VENDEDOR: "Solo sus ventas", ALMACENERO: "Solo stock y alertas" } },
  { modulo: "Bitácora", permisos: { ADMIN: "Ver", GERENTE: "Ver", VENDEDOR: null, ALMACENERO: null } },
];
