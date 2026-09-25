export const ROLES = {
  ADMIN: "ADMIN",
  GERENTE: "GERENTE",
  VENDEDOR: "VENDEDOR",
  ALMACENERO: "ALMACENERO",
} as const;

export type Rol = (typeof ROLES)[keyof typeof ROLES];
