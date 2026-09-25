// Datos maestros de demostración (ficticios y deterministas): categorías, productos, clientes y proveedores.
// Sin marcas reales. Los RUC/DNI son válidos en formato pero inventados.
import type { Unidad, Zona } from "../src/utils/validadores.ts";

export const CATEGORIAS = [
  "Arroz y menestras",
  "Aceites",
  "Azúcar",
  "Lácteos",
  "Fideos",
  "Bebidas",
  "Limpieza",
  "Conservas",
] as const;

export interface ProductoSemilla {
  codigo: string;
  nombre: string;
  unidad: Unidad;
  precio: string;
  stock: number;
  stockMinimo: number;
  categoria: (typeof CATEGORIAS)[number];
}

type Fila = [codigo: string, nombre: string, unidad: Unidad, precio: string, stock: number, stockMinimo: number];

// Los marcados con «alerta» quedan con stock <= stockMinimo (7 productos).
const PRODUCTOS_POR_CATEGORIA: Record<(typeof CATEGORIAS)[number], Fila[]> = {
  "Arroz y menestras": [
    ["ARR-001", "Arroz extra superior saco 50 kg", "SACO", "185.00", 120, 30],
    ["ARR-002", "Arroz superior saco 50 kg", "SACO", "165.00", 90, 25],
    ["ARR-003", "Arroz añejo bolsa 5 kg", "PAQ", "22.50", 200, 50],
    ["ARR-004", "Arroz extra bolsa 1 kg", "UND", "4.60", 600, 150],
    ["ARR-005", "Frejol canario bolsa 1 kg", "UND", "9.80", 18, 40], // alerta
    ["ARR-006", "Lenteja bebé bolsa 1 kg", "UND", "7.20", 150, 40],
    ["ARR-007", "Arveja partida bolsa 500 g", "UND", "3.50", 220, 60],
    ["ARR-008", "Garbanzo bolsa 500 g", "UND", "5.40", 130, 30],
  ],
  Aceites: [
    ["ACE-001", "Aceite vegetal botella 1 L", "UND", "9.90", 480, 120],
    ["ACE-002", "Aceite vegetal caja 12 x 1 L", "CAJA", "112.00", 60, 15],
    ["ACE-003", "Aceite vegetal bidón 5 L", "UND", "46.50", 12, 20], // alerta
    ["ACE-004", "Aceite de girasol botella 900 ml", "UND", "11.20", 160, 40],
    ["ACE-005", "Aceite de oliva botella 500 ml", "UND", "24.90", 45, 10],
    ["ACE-006", "Aceite vegetal botella 200 ml", "UND", "2.60", 300, 80],
    ["ACE-007", "Manteca vegetal bloque 1 kg", "UND", "8.40", 70, 20],
  ],
  Azúcar: [
    ["AZU-001", "Azúcar rubia saco 50 kg", "SACO", "175.00", 80, 20],
    ["AZU-002", "Azúcar blanca saco 50 kg", "SACO", "195.00", 40, 15],
    ["AZU-003", "Azúcar rubia bolsa 1 kg", "UND", "3.90", 700, 200],
    ["AZU-004", "Azúcar blanca bolsa 1 kg", "UND", "4.40", 350, 100],
    ["AZU-005", "Azúcar rubia bolsa 5 kg", "PAQ", "18.90", 25, 30], // alerta
    ["AZU-006", "Endulzante en sobres caja x 100", "CAJA", "12.50", 60, 15],
    ["AZU-007", "Chancaca granulada bolsa 500 g", "UND", "4.20", 90, 20],
  ],
  Lácteos: [
    ["LAC-001", "Leche evaporada entera lata 400 g", "UND", "4.10", 1200, 300],
    ["LAC-002", "Leche evaporada entera caja 48 latas", "CAJA", "188.00", 40, 10],
    ["LAC-003", "Leche evaporada light lata 400 g", "UND", "4.30", 60, 80], // alerta
    ["LAC-004", "Leche condensada lata 393 g", "UND", "6.20", 240, 60],
    ["LAC-005", "Leche UHT entera caja 1 L", "UND", "5.20", 300, 80],
    ["LAC-006", "Yogur bebible sabor fresa botella 1 L", "UND", "7.50", 80, 25],
    ["LAC-007", "Mantequilla con sal barra 200 g", "UND", "8.90", 70, 20],
    ["LAC-008", "Leche en polvo entera bolsa 400 g", "UND", "15.80", 55, 15],
  ],
  Fideos: [
    ["FID-001", "Fideo spaghetti bolsa 500 g", "UND", "3.40", 800, 200],
    ["FID-002", "Fideo tallarín bolsa 500 g", "UND", "3.40", 650, 200],
    ["FID-003", "Fideo canuto bolsa 250 g", "UND", "1.90", 400, 100],
    ["FID-004", "Fideo codito bolsa 250 g", "UND", "1.90", 380, 100],
    ["FID-005", "Fideo cabello de ángel bolsa 250 g", "UND", "1.80", 90, 100], // alerta
    ["FID-006", "Fideo spaghetti caja 20 x 500 g", "CAJA", "64.00", 45, 10],
    ["FID-007", "Fideo tornillo bolsa 500 g", "UND", "3.60", 260, 60],
  ],
  Bebidas: [
    ["BEB-001", "Gaseosa sabor cola botella 3 L", "UND", "8.50", 300, 80],
    ["BEB-002", "Gaseosa sabor cola paquete 6 x 500 ml", "PAQ", "13.50", 150, 40],
    ["BEB-003", "Agua de mesa sin gas botella 625 ml", "UND", "1.20", 900, 200],
    ["BEB-004", "Agua de mesa bidón 7 L", "UND", "9.50", 100, 25],
    ["BEB-005", "Néctar de durazno caja 1 L", "UND", "4.80", 180, 50],
    ["BEB-006", "Bebida rehidratante botella 500 ml", "UND", "2.90", 240, 60],
    ["BEB-007", "Gaseosa sabor naranja botella 1.5 L", "UND", "5.50", 30, 30], // alerta (igual al mínimo)
    ["BEB-008", "Refresco en polvo sabor maracuyá caja x 30 sobres", "CAJA", "25.00", 70, 15],
  ],
  Limpieza: [
    ["LIM-001", "Detergente en polvo bolsa 4 kg", "UND", "32.90", 120, 30],
    ["LIM-002", "Detergente en polvo bolsa 900 g", "UND", "8.50", 260, 60],
    ["LIM-003", "Lejía botella 1 L", "UND", "3.20", 400, 100],
    ["LIM-004", "Jabón de lavar ropa barra 210 g", "UND", "2.40", 500, 120],
    ["LIM-005", "Lavavajilla en pasta pote 900 g", "UND", "6.90", 150, 40],
    ["LIM-006", "Papel higiénico paquete 24 rollos", "PAQ", "29.90", 8, 15], // alerta
    ["LIM-007", "Limpiatodo aroma lavanda botella 900 ml", "UND", "5.40", 170, 40],
    ["LIM-008", "Esponja lavavajilla paquete x 3", "PAQ", "3.90", 210, 50],
  ],
  Conservas: [
    ["CON-001", "Atún en trozos en aceite lata 170 g", "UND", "5.90", 600, 150],
    ["CON-002", "Atún en trozos caja 48 latas", "CAJA", "270.00", 20, 5],
    ["CON-003", "Filete de caballa en aceite lata 170 g", "UND", "4.90", 350, 80],
    ["CON-004", "Sardina en salsa de tomate lata 425 g", "UND", "6.50", 210, 50],
    ["CON-005", "Durazno en almíbar lata 820 g", "UND", "9.20", 110, 30],
    ["CON-006", "Choclo desgranado lata 300 g", "UND", "4.60", 95, 25],
    ["CON-007", "Grated de pescado lata 170 g", "UND", "3.50", 140, 40],
  ],
};

export const PRODUCTOS: ProductoSemilla[] = Object.entries(PRODUCTOS_POR_CATEGORIA).flatMap(([categoria, filas]) =>
  filas.map(([codigo, nombre, unidad, precio, stock, stockMinimo]) => ({
    codigo,
    nombre,
    unidad,
    precio,
    stock,
    stockMinimo,
    categoria: categoria as ProductoSemilla["categoria"],
  })),
);

// ---------------------------------------------------------------------------------------------
// Clientes: generados con un PRNG con semilla fija (mulberry32) → siempre los mismos 80.

export function mulberry32(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const digitos = (rnd: () => number, n: number) =>
  Array.from({ length: n }, () => Math.floor(rnd() * 10)).join("");

/** Dígito verificador del RUC (módulo 11 de SUNAT), para que los RUC inventados luzcan reales. */
export function digitoVerificadorRuc(diez: string): number {
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(diez[i]), 0);
  const r = 11 - (suma % 11);
  return r === 10 ? 0 : r === 11 ? 1 : r;
}

const ruc = (prefijo: "10" | "20", ocho: string) => {
  const diez = prefijo + ocho;
  return diez + digitoVerificadorRuc(diez);
};

const NOMBRES_COMERCIALES = [
  "San Martín", "Santa Rosa", "El Sol", "Los Andes", "La Esquina", "Doña Carmen", "Don Lucho", "El Paisa",
  "Mi Barrio", "La Económica", "Virgen de la Puerta", "Los Pinos", "El Progreso", "La Familia", "Mi Tiendita",
  "El Ahorro", "San Judas", "Las Flores", "El Trébol", "La Bendición", "Los Mellizos", "El Buen Precio",
  "Santa Ana", "La Perla del Norte", "El Encanto", "Nueva Aurora", "Los Olivos", "San Pedro", "El Pino",
  "Mi Casita", "La Victoria", "Los Laureles", "La Primavera", "El Rosal", "Las Palmeras", "El Faro", "Rosita",
  "Don Pancho", "Doña Julia", "Los Hermanos", "La Canasta", "Santa Inés", "El Paraíso", "Las Brisas",
  "Los Girasoles", "El Mirador", "San Isidro", "La Alborada", "El Carmen", "Doña Meche", "El Norteño",
  "La Huerta", "Los Álamos", "Santa Lucía", "Don Beto", "La Moderna", "El Surtidor", "Mi Despensa",
  "La Estrella", "Don Manuel", "Las Gardenias", "El Molino", "La Cosecha", "Doña Rosa", "El Cruce",
  "Los Cerezos", "San Antonio", "La Unión", "El Recreo", "Las Lomas", "Don Julio", "La Tradición",
  "El Portal", "Santa Clara", "Los Robles", "Mi Esperanza", "Don Tito", "La Chacra", "El Bosque", "Las Dunas",
];

const TIPOS_EMPRESA = ["Minimarket", "Comercial", "Autoservicio", "Distribuidora", "Multiservicios"];
const SUFIJOS_EMPRESA = ["S.A.C.", "E.I.R.L.", "S.R.L."];
const TIPOS_BODEGA = ["Bodega", "Abarrotes", "Tienda"];
const NOMBRES = [
  "María", "José", "Carmen", "Luis", "Rosa", "Juan", "Ana", "Pedro", "Julia", "Jorge", "Elena", "Miguel",
  "Teresa", "Víctor", "Gladys", "Raúl", "Norma", "César", "Patricia", "Walter",
];
const APELLIDOS = [
  "Rojas", "Vega", "Chávez", "Salazar", "Luján", "Castillo", "Paredes", "Gutiérrez", "Alvarado", "Rodríguez",
  "Sánchez", "Mendoza", "Cruz", "Zavaleta", "Rebaza", "Plasencia", "Ruiz", "Valderrama", "Guevara", "Cabrera",
];

const CALLES: Record<Zona, string[]> = {
  Centro: ["Jr. Pizarro", "Jr. Gamarra", "Jr. Bolívar", "Jr. Orbegoso", "Jr. Ayacucho", "Jr. Estete", "Av. España"],
  Norte: [
    "Av. América Norte",
    "Urb. El Molino, Calle Los Tulipanes",
    "Urb. Santa María, Av. Perú",
    "Urb. Los Naranjos, Calle Las Gardenias",
    "Av. Túpac Amaru",
  ],
  Sur: [
    "Av. América Sur",
    "Urb. San Andrés, Calle Los Cedros",
    "Urb. Monserrate, Calle Los Olmos",
    "Av. Fátima",
    "Urb. Palermo, Jr. Túpac Yupanqui",
  ],
  "La Esperanza": [
    "Av. José Gabriel Condorcanqui",
    "Sector Jerusalén, Calle Los Ángeles",
    "Wichanzao, Calle Santa Rosa",
    "Av. Tahuantinsuyo",
    "Manuel Arévalo, Calle 12",
  ],
  "El Porvenir": [
    "Av. Sánchez Carrión",
    "Jr. Unión",
    "Río Seco, Calle Las Begonias",
    "Av. Pumacahua",
    "Alto Trujillo, Calle Los Jazmines",
  ],
  "Víctor Larco": [
    "Av. Larco",
    "Urb. Buenos Aires, Calle Los Pinos",
    "Urb. La Merced, Calle Las Magnolias",
    "Av. Húsares de Junín",
    "Urb. Vista Alegre, Av. Dos de Mayo",
  ],
};

const ZONAS_ORDEN: Zona[] = ["Centro", "Norte", "Sur", "La Esperanza", "El Porvenir", "Víctor Larco"];

export interface ClienteSemilla {
  tipoDoc: "RUC" | "DNI";
  numDoc: string;
  razonSocial: string;
  direccion: string;
  telefono: string | null;
  zona: Zona;
  activo: boolean;
}

export function generarClientes(cantidad = 80): ClienteSemilla[] {
  const rnd = mulberry32(20260924);
  const usados = new Set<string>();
  const clientes: ClienteSemilla[] = [];

  for (let i = 0; i < cantidad; i++) {
    const grupo = i % 16; // 0–5: RUC 20 (empresas) · 6–10: RUC 10 (personas con negocio) · 11–15: DNI
    const zona = ZONAS_ORDEN[i % ZONAS_ORDEN.length];
    const comercial = NOMBRES_COMERCIALES[i % NOMBRES_COMERCIALES.length];
    const persona = `${NOMBRES[Math.floor(rnd() * NOMBRES.length)]} ${APELLIDOS[Math.floor(rnd() * APELLIDOS.length)]} ${
      APELLIDOS[Math.floor(rnd() * APELLIDOS.length)]
    }`;

    let tipoDoc: "RUC" | "DNI";
    let numDoc: string;
    let razonSocial: string;
    do {
      if (grupo <= 5) {
        tipoDoc = "RUC";
        numDoc = ruc("20", "6" + digitos(rnd, 7));
        razonSocial = `${TIPOS_EMPRESA[i % TIPOS_EMPRESA.length]} ${comercial} ${SUFIJOS_EMPRESA[i % SUFIJOS_EMPRESA.length]}`;
      } else if (grupo <= 10) {
        tipoDoc = "RUC";
        numDoc = ruc("10", "4" + digitos(rnd, 7)); // RUC 10 = 10 + DNI + verificador
        razonSocial = `Bodega ${comercial} - ${persona}`;
      } else {
        tipoDoc = "DNI";
        numDoc = "4" + digitos(rnd, 7);
        razonSocial = `${TIPOS_BODEGA[i % TIPOS_BODEGA.length]} ${comercial}`;
      }
    } while (usados.has(numDoc));
    usados.add(numDoc);

    const calles = CALLES[zona];
    const direccion = `${calles[Math.floor(rnd() * calles.length)]} ${100 + Math.floor(rnd() * 1400)}`;
    const conTelefono = i % 7 !== 3;
    const telefono = conTelefono ? `9${digitos(rnd, 2)} ${digitos(rnd, 3)} ${digitos(rnd, 3)}` : null;

    clientes.push({ tipoDoc, numDoc, razonSocial, direccion, telefono, zona, activo: i !== 38 && i !== 71 });
  }
  return clientes;
}

export const PROVEEDORES = [
  { ruc: ruc("20", "60481237"), razonSocial: "Agroindustrias Valle Moche S.A.C.", telefono: "044 481 237" },
  { ruc: ruc("20", "60593318"), razonSocial: "Alimentos Costa Norte S.A.C.", telefono: "044 593 318" },
  { ruc: ruc("20", "60712045"), razonSocial: "Química Hogar Trujillo E.I.R.L.", telefono: "949 712 045" },
];
