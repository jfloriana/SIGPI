import { describe, expect, it } from "vitest";
import { z } from "zod";
import { digitoVerificadorRuc, generarClientes, PRODUCTOS, PROVEEDORES } from "../prisma/datos-maestros.ts";
import { paginacionSchema } from "../src/utils/paginacion.ts";
import {
  claveSchema,
  dineroSchema,
  dniSchema,
  documentoSchema,
  enteroNoNegativoSchema,
  rucSchema,
  unidadSchema,
  zonaSchema,
} from "../src/utils/validadores.ts";

const errorDe = (schema: z.ZodType, valor: unknown) => {
  const r = schema.safeParse(valor);
  return r.success ? null : r.error.issues[0].message;
};

describe("RUC y DNI (regla 1 · prueba obligatoria 1)", () => {
  it.each(["20123456789", "10456789012", " 20600000001 "])("acepta el RUC %s", (ruc) => {
    expect(rucSchema.safeParse(ruc).success).toBe(true);
  });

  it.each([
    ["2012345678", "10 dígitos"],
    ["201234567890", "12 dígitos"],
    ["15123456789", "empieza con 15"],
    ["30123456789", "empieza con 30"],
    ["2012345678A", "contiene letras"],
    ["", "vacío"],
  ])("rechaza el RUC %s (%s) con mensaje en español", (ruc) => {
    expect(errorDe(rucSchema, ruc)).toBe("El RUC debe tener 11 dígitos y empezar con 10 o 20");
  });

  it.each(["12345678", "00000001"])("acepta el DNI %s", (dni) => {
    expect(dniSchema.safeParse(dni).success).toBe(true);
  });

  it.each(["1234567", "123456789", "1234567A", ""])("rechaza el DNI %s", (dni) => {
    expect(errorDe(dniSchema, dni)).toBe("El DNI debe tener exactamente 8 dígitos");
  });

  it("valida el número según el tipo de documento y pone el error en numDoc", () => {
    expect(documentoSchema.safeParse({ tipoDoc: "RUC", numDoc: "20123456789" }).success).toBe(true);
    expect(documentoSchema.safeParse({ tipoDoc: "DNI", numDoc: "12345678" }).success).toBe(true);

    const dniComoRuc = documentoSchema.safeParse({ tipoDoc: "RUC", numDoc: "12345678" });
    expect(dniComoRuc.success).toBe(false);
    expect(dniComoRuc.error!.issues[0].path).toEqual(["numDoc"]);

    const rucComoDni = documentoSchema.safeParse({ tipoDoc: "DNI", numDoc: "20123456789" });
    expect(rucComoDni.error!.issues[0]).toMatchObject({ path: ["numDoc"], message: expect.stringMatching(/DNI/) });

    expect(documentoSchema.safeParse({ tipoDoc: "CE", numDoc: "12345678" }).success).toBe(false);
  });
});

describe("Importes, enteros y catálogos", () => {
  it("normaliza el dinero a string con 2 decimales", () => {
    expect(dineroSchema.parse(12.5)).toBe("12.50");
    expect(dineroSchema.parse("4")).toBe("4.00");
    expect(dineroSchema.parse(" 185.00 ")).toBe("185.00");
    expect(dineroSchema.parse("0.01")).toBe("0.01");
  });

  it.each([0, -1, "0.00", "12.345", "abc", "1e3", 0.1 + 0.2, 1_000_000, null])("rechaza el importe %s", (v) => {
    expect(dineroSchema.safeParse(v).success).toBe(false);
  });

  it("acepta enteros ≥ 0 y rechaza negativos y decimales", () => {
    expect(enteroNoNegativoSchema.safeParse(0).success).toBe(true);
    expect(enteroNoNegativoSchema.safeParse(15).success).toBe(true);
    expect(errorDe(enteroNoNegativoSchema, -1)).toBe("No puede ser negativo");
    expect(errorDe(enteroNoNegativoSchema, 1.5)).toBe("Debe ser un número entero");
    expect(enteroNoNegativoSchema.safeParse("5").success).toBe(false);
  });

  it("solo acepta las zonas y unidades definidas", () => {
    expect(zonaSchema.safeParse("Víctor Larco").success).toBe(true);
    expect(zonaSchema.safeParse("Miraflores").success).toBe(false);
    expect(unidadSchema.safeParse("SACO").success).toBe(true);
    expect(unidadSchema.safeParse("KG").success).toBe(false);
  });

  it("exige contraseña de 8+ caracteres con letra y número", () => {
    expect(claveSchema.safeParse("Clave2026").success).toBe(true);
    expect(errorDe(claveSchema, "Ab1")).toMatch(/8 caracteres/);
    expect(errorDe(claveSchema, "solo-letras")).toMatch(/letra y un número/);
    expect(errorDe(claveSchema, "12345678")).toMatch(/letra y un número/);
  });
});

describe("Paginación", () => {
  it("usa 20 por defecto y limita a 100", () => {
    expect(paginacionSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(paginacionSchema.parse({ page: "3", pageSize: "50" })).toEqual({ page: 3, pageSize: 50 });
    expect(paginacionSchema.safeParse({ pageSize: "101" }).success).toBe(false);
    expect(paginacionSchema.safeParse({ page: "0" }).success).toBe(false);
    expect(paginacionSchema.safeParse({ page: "abc" }).success).toBe(false);
  });
});

describe("Datos de demostración", () => {
  it("son deterministas y pasan las mismas validaciones que la API", () => {
    const a = generarClientes();
    expect(a).toEqual(generarClientes());
    expect(a).toHaveLength(80);
    expect(new Set(a.map((c) => c.numDoc)).size).toBe(80);
    for (const c of a) {
      expect(documentoSchema.safeParse(c).success, c.numDoc).toBe(true);
      expect(zonaSchema.safeParse(c.zona).success).toBe(true);
    }
    expect(new Set(a.map((c) => c.zona)).size).toBe(6);
    expect(a.some((c) => c.tipoDoc === "DNI")).toBe(true);
    expect(a.some((c) => c.numDoc.startsWith("10"))).toBe(true);
    expect(a.some((c) => c.numDoc.startsWith("20"))).toBe(true);
    for (const p of PROVEEDORES) expect(rucSchema.safeParse(p.ruc).success).toBe(true);
  });

  it("los RUC inventados llevan dígito verificador de módulo 11", () => {
    for (const c of generarClientes().filter((c) => c.tipoDoc === "RUC")) {
      expect(Number(c.numDoc[10])).toBe(digitoVerificadorRuc(c.numDoc.slice(0, 10)));
    }
  });

  it("tiene ~60 productos, códigos únicos, precios válidos y 6–8 en alerta", () => {
    expect(PRODUCTOS.length).toBeGreaterThanOrEqual(55);
    expect(PRODUCTOS.length).toBeLessThanOrEqual(65);
    expect(new Set(PRODUCTOS.map((p) => p.codigo)).size).toBe(PRODUCTOS.length);
    for (const p of PRODUCTOS) expect(dineroSchema.parse(p.precio)).toBe(p.precio);
    const enAlerta = PRODUCTOS.filter((p) => p.stock <= p.stockMinimo).length;
    expect(enAlerta).toBeGreaterThanOrEqual(6);
    expect(enAlerta).toBeLessThanOrEqual(8);
  });
});
