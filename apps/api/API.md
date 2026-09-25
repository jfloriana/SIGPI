# API de SIGPI – contrato (Fases 1 a 5)

Base: `http://localhost:3000/api`. Cuerpos y respuestas en JSON (UTF-8).

## Convenciones generales

- **Autenticación**: todas las rutas salvo `POST /auth/login` y `GET /salud` exigen `Authorization: Bearer <token>`. Sin token o con token inválido → `401 NO_AUTENTICADO`. El rol se relee de la base en cada petición.
- **Autorización**: rol no permitido → `403 ACCESO_DENEGADO`.
- **Errores** (siempre este formato):
  ```json
  { "error": { "codigo": "VALIDACION", "mensaje": "Revise los datos ingresados", "campos": { "numDoc": "El RUC debe tener 11 dígitos y empezar con 10 o 20" } } }
  ```
  `campos` es opcional: `{ nombreDelCampo: mensaje }` (un mensaje por campo, para mostrar junto al input). Un error sobre el cuerpo completo usa la clave `"_"`.

  | HTTP | `codigo` | Cuándo |
  |---|---|---|
  | 400 | `VALIDACION` | Cuerpo o query inválidos (Zod). Siempre con `campos`. |
  | 400 | `JSON_INVALIDO` | El cuerpo no es JSON válido. |
  | 401 | `NO_AUTENTICADO` / `CREDENCIALES_INCORRECTAS` | Sin sesión / login fallido. |
  | 403 | `ACCESO_DENEGADO` | El rol no puede hacer la operación. |
  | 404 | `NO_ENCONTRADO` | El id no existe. |
  | 404 | `RUTA_NO_ENCONTRADA` | La ruta no existe. |
  | 409 | `DUPLICADO` | Valor único repetido. Con `campos.<campo>`. |
  | 422 | `OPERACION_NO_PERMITIDA` | Regla de negocio (p. ej., el admin intenta desactivarse). Con `campos`. |
  | 422 | `CAMPO_NO_EDITABLE` | Se envió `stock` a productos. Con `campos.stock`. |
  | 409 | `STOCK_INSUFICIENTE` | Pedidos (registro o despacho) o ajuste negativo que dejaría stock < 0. Incluye `productos[]`. |
  | 422 | `TRANSICION_INVALIDA` | Pedidos u órdenes de compra: cambio de estado que la máquina de estados no permite. |
  | 403 | `SEGREGACION_FUNCIONES` | Pedidos: quien registró el pedido intenta aprobarlo o despacharlo. |
  | 413 | `CUERPO_DEMASIADO_GRANDE` | El cuerpo JSON supera 200 KB. |
  | 423 | `CUENTA_BLOQUEADA` | Login con cuenta bloqueada (incluye `bloqueadoHasta`). |
  | 500 | `ERROR_INTERNO` | Error inesperado. |

- **Listas paginadas**: `GET ?page=&pageSize=` (enteros; `page` ≥ 1, por defecto 1; `pageSize` 1–100, por defecto 20; fuera de rango → 400). Respuesta:
  ```json
  { "datos": [ /* objetos */ ], "total": 80, "page": 1, "pageSize": 20 }
  ```
  `total` = total de filas que cumplen los filtros (no solo la página). Para combos/desplegables use `pageSize=100`.
- **Detalle** `GET /:id` → el objeto. **Crear** `POST` → `201` con el objeto. **Editar** `PATCH /:id` → `200` con el objeto actualizado. `:id` no numérico → `400 VALIDACION` (`campos.id`).
- **PATCH** es parcial: envíe solo los campos que cambian. Un PATCH sin ningún campo reconocido → `400` (`campos._ = "No se envió ningún cambio"`). Los campos desconocidos se ignoran (salvo `stock` en productos).
- **Desactivar** = `PATCH { "activo": false }` (no hay DELETE). Reactivar = `PATCH { "activo": true }`.
- **Filtros booleanos** en query: exactamente `true` o `false` (otro valor → 400).
- **`buscar`**: texto libre (máx. 100 caracteres), sin distinguir mayúsculas (en SQLite solo para letras sin tilde).
- **Dinero**: los importes salen como **string** con 2 decimales (`"185.00"`). Al enviar, se acepta número (`12.5`) o string (`"12.50"`), > 0, máximo 2 decimales, máximo `999999.99`.
- **Fechas**: ISO 8601 en UTC (`"2026-09-24T13:00:00.000Z"`); el frontend las muestra en `America/Lima`.
- **Bitácora**: cada POST/PATCH exitoso de maestros crea exactamente un registro (`CREAR`, `EDITAR` o `DESACTIVAR`) con `antes`/`despues`. Un PATCH con `activo: false` se registra como `DESACTIVAR` (aunque traiga otros cambios); cualquier otro PATCH, incluida la reactivación, como `EDITAR`.

### Catálogos fijos

| Nombre | Valores |
|---|---|
| Roles | `ADMIN`, `GERENTE`, `VENDEDOR`, `ALMACENERO` |
| Zonas | `Centro`, `Norte`, `Sur`, `La Esperanza`, `El Porvenir`, `Víctor Larco` (con tilde) |
| Unidades | `UND`, `CAJA`, `SACO`, `PAQ` |
| Tipos de documento | `RUC`, `DNI` |

### Reglas de validación (mensajes que devuelve la API)

| Campo | Regla | Mensaje |
|---|---|---|
| RUC | 11 dígitos, empieza con `10` o `20` | `El RUC debe tener 11 dígitos y empezar con 10 o 20` |
| DNI | exactamente 8 dígitos | `El DNI debe tener exactamente 8 dígitos` |
| clave | ≥ 8 caracteres, al menos una letra y un número (máx. 72) | `La contraseña debe tener al menos 8 caracteres` / `La contraseña debe incluir al menos una letra y un número` |
| telefono | opcional; 6–20 caracteres entre dígitos, espacios, `+ ( ) -`; `""` o `null` → sin teléfono | `Teléfono no válido` |
| precio | > 0, máx. 2 decimales | `Ingrese un importe válido con máximo 2 decimales` / `El importe debe ser mayor que 0` |
| stockMinimo | entero ≥ 0 (número JSON, no string) | `No puede ser negativo` / `Debe ser un número entero` |
| codigo (producto) | 3–20 letras, números o guiones; se guarda en MAYÚSCULAS | `Código no válido: …` |
| textos | se recortan espacios; mínimos: nombre de usuario 3, razón social 3, dirección 5, nombre de producto 3, nombre de categoría 3 | `Ingrese … (mínimo N caracteres)` |

---

## Permisos (resumen)

| Endpoint | ADMIN | GERENTE | VENDEDOR | ALMACENERO |
|---|---|---|---|---|
| `GET /usuarios`, `GET /usuarios/:id` | ✔ | ✔ | 403 | 403 |
| `POST /usuarios`, `PATCH /usuarios/:id` | ✔ | 403 | 403 | 403 |
| `GET /clientes`, `GET /clientes/:id` | ✔ | ✔ | ✔ | ✔ |
| `POST /clientes` | ✔ | 403 | ✔ | 403 |
| `PATCH /clientes/:id` | ✔ | 403 | ✔ (sin `activo`: 403 si lo envía) | 403 |
| `GET /categorias`, `GET /categorias/:id` | ✔ | ✔ | ✔ | ✔ |
| `POST /categorias`, `PATCH /categorias/:id` | ✔ | 403 | 403 | 403 |
| `GET /productos`, `GET /productos/:id` | ✔ | ✔ | ✔ | ✔ |
| `POST /productos`, `PATCH /productos/:id` | ✔ | 403 | 403 | 403 |
| `GET /proveedores`, `GET /proveedores/:id` | ✔ | ✔ | 403 | ✔ |
| `POST /proveedores` | ✔ | ✔ | 403 | 403 |
| `PATCH /proveedores/:id` | ✔ | 403 | 403 | 403 |
| `GET /pedidos`, `GET /pedidos/:id` | ✔ (todos) | ✔ (todos) | ✔ (solo los suyos) | ✔ (aprobados, despachados, entregados) |
| `POST /pedidos` | 403 | 403 | ✔ | 403 |
| `POST /pedidos/:id/aprobar` | 403 | ✔ | 403 | 403 |
| `POST /pedidos/:id/despachar`, `/entregar` | 403 | 403 | 403 | ✔ |
| `POST /pedidos/:id/anular` | 403 | ✔ | ✔ (suyos en REGISTRADO) | 403 |
| `GET /inventario/kardex/:productoId`, `GET /inventario/alertas` | ✔ | ✔ | 403 | ✔ |
| `POST /inventario/ajustes` | ✔ | 403 | 403 | ✔ |
| `GET /ordenes-compra`, `GET /ordenes-compra/:id` | ✔ | ✔ | 403 | ✔ (solo APROBADA y RECIBIDA) |
| `POST /ordenes-compra`, `POST /ordenes-compra/sugerida` | ✔ | ✔ | 403 | 403 |
| `POST /ordenes-compra/:id/aprobar` | 403 | ✔ | 403 | 403 |
| `POST /ordenes-compra/:id/recepcionar` | 403 | 403 | 403 | ✔ |
| `POST /ordenes-compra/:id/anular` | ✔ | ✔ | 403 | 403 |
| `GET /reportes/tablero` | ✔ (TOTAL) | ✔ (TOTAL) | ✔ (PROPIO) | ✔ (STOCK) |
| `GET /reportes/ventas.csv` | ✔ | ✔ | ✔ (solo lo suyo) | 403 |
| `GET /bitacora`, `/bitacora/filtros`, `/bitacora/:id` | ✔ | ✔ | 403 | 403 |

---

## Autenticación

### `POST /auth/login` (público)
Cuerpo: `{ "email": "admin@distrinorte.pe", "clave": "Demo2026!" }` (el email se normaliza a minúsculas).

`200`:
```json
{
  "token": "eyJhbGciOi...",
  "usuario": { "id": 1, "nombre": "Rosa Quispe Vargas", "email": "admin@distrinorte.pe", "rol": "ADMIN", "activo": true, "creadoEn": "2026-09-24T13:00:00.000Z" }
}
```
Errores: `400 VALIDACION`, `401 CREDENCIALES_INCORRECTAS` (mismo mensaje si el correo no existe), `423 CUENTA_BLOQUEADA` con `error.bloqueadoHasta` (ISO) y mensaje `Cuenta bloqueada por intentos fallidos hasta las HH:MM`, `429 DEMASIADOS_INTENTOS`.

### `GET /auth/me` (todos)
`200`: `{ "usuario": { /* misma forma que en login */ } }`

---

## Usuarios

Objeto **Usuario** (nunca incluye `hashClave` ni la contraseña):
```json
{
  "id": 3,
  "nombre": "Luis Paredes Castillo",
  "email": "vendedor1@distrinorte.pe",
  "rol": "VENDEDOR",
  "activo": true,
  "bloqueado": false,
  "bloqueadoHasta": null,
  "creadoEn": "2026-09-24T13:00:00.000Z"
}
```
- `bloqueado`: `true` si `bloqueadoHasta` es futuro (cuenta bloqueada por intentos fallidos). `bloqueadoHasta` puede ser una fecha pasada (bloqueo vencido) → `bloqueado: false`.

### `GET /usuarios` — ADMIN, GERENTE
Query: `page`, `pageSize`, `buscar` (nombre o email), `rol` (`ADMIN|GERENTE|VENDEDOR|ALMACENERO`), `rolId` (número; alternativa a `rol`), `activo` (`true|false`). Orden: nombre ascendente.
`200`: `{ "datos": [Usuario, …], "total": 5, "page": 1, "pageSize": 20 }`

### `GET /usuarios/:id` — ADMIN, GERENTE
`200`: Usuario. `404` si no existe.

### `POST /usuarios` — ADMIN
```json
{ "nombre": "Pedro Nuevo", "email": "pedro@distrinorte.pe", "clave": "Clave2026", "rol": "VENDEDOR" }
```
`201`: Usuario. Errores: `400` (`campos.nombre|email|clave|rol`), `409 DUPLICADO` con `campos.email` = `"Ya existe un usuario con ese correo"`.

### `PATCH /usuarios/:id` — ADMIN
Todos opcionales (al menos uno):
```json
{ "nombre": "Nuevo nombre", "rol": "GERENTE", "activo": false, "clave": "OtraClave1", "desbloquear": true }
```
- `clave`: restablece la contraseña (mismas reglas que al crear).
- `desbloquear`: solo acepta `true`; pone `intentosFallidos = 0` y `bloqueadoHasta = null`.
- El email **no** se edita.
- El admin sobre **sí mismo**: `activo: false` → `422 OPERACION_NO_PERMITIDA` (`campos.activo`); `rol` distinto de `ADMIN` → `422 OPERACION_NO_PERMITIDA` (`campos.rol`).

`200`: Usuario actualizado. Bitácora: `DESACTIVAR` si `activo: false`, si no `EDITAR` (la contraseña nunca se guarda; queda `despues.claveRestablecida: true`).

---

## Clientes

Objeto **Cliente**:
```json
{
  "id": 1,
  "tipoDoc": "RUC",
  "numDoc": "20632214287",
  "razonSocial": "Minimarket San Martín S.A.C.",
  "direccion": "Av. España 711",
  "telefono": "954 813 752",
  "zona": "Centro",
  "activo": true
}
```
`telefono` puede ser `null`.

### `GET /clientes` — todos los roles
Query: `page`, `pageSize`, `buscar` (razón social o número de documento, coincidencia parcial), `zona` (valor exacto del catálogo; URL-encode `V%C3%ADctor%20Larco`), `activo` (`true|false`; sin él devuelve activos e inactivos). Orden: razón social ascendente.
`200`: `{ "datos": [Cliente, …], "total": 80, "page": 1, "pageSize": 20 }`

> Para el buscador de clientes del **Nuevo pedido** use `activo=true`.

### `GET /clientes/:id` — todos los roles
`200`: Cliente.

### `POST /clientes` — ADMIN, VENDEDOR
```json
{ "tipoDoc": "RUC", "numDoc": "20611122233", "razonSocial": "Minimarket Prueba S.A.C.", "direccion": "Jr. Pizarro 123", "telefono": "944 111 222", "zona": "Centro" }
```
`telefono` opcional. `numDoc` se valida según `tipoDoc` y el error queda en `campos.numDoc`.
`201`: Cliente (`activo: true`). Errores: `400`, `409 DUPLICADO` con `campos.numDoc` = `"Ya existe un cliente con ese número de documento"`.

### `PATCH /clientes/:id` — ADMIN, VENDEDOR
Campos opcionales: `tipoDoc`, `numDoc`, `razonSocial`, `direccion`, `telefono` (`""`/`null` lo borra), `zona`, `activo`.
- `tipoDoc` y `numDoc` se envían **juntos** (si falta uno → 400 en el que falta).
- `activo` solo lo puede enviar ADMIN: si un VENDEDOR lo envía (con cualquier valor) → `403 ACCESO_DENEGADO` y no se guarda nada.

`200`: Cliente. Errores: `400`, `403`, `404`, `409` (`campos.numDoc`).

---

## Categorías

Objeto **Categoría**:
```json
{ "id": 2, "nombre": "Aceites", "numProductos": 7 }
```
`numProductos` cuenta todos los productos de la categoría (activos e inactivos). Las categorías no tienen estado activo/inactivo.

### `GET /categorias` — todos los roles
Query: `page`, `pageSize`, `buscar` (nombre). Orden: nombre ascendente.
`200`: `{ "datos": [Categoría, …], "total": 8, "page": 1, "pageSize": 20 }`

### `GET /categorias/:id` — todos los roles
`200`: Categoría.

### `POST /categorias` — ADMIN
`{ "nombre": "Snacks" }` → `201`: Categoría (`numProductos: 0`). Duplicado (sin distinguir mayúsculas) → `409` con `campos.nombre`.

### `PATCH /categorias/:id` — ADMIN
`{ "nombre": "Snacks y golosinas" }` (obligatorio) → `200`: Categoría. `409` si el nombre ya existe.

---

## Productos

Objeto **Producto**:
```json
{
  "id": 1,
  "codigo": "ARR-001",
  "nombre": "Arroz extra superior saco 50 kg",
  "unidad": "SACO",
  "precio": "185.00",
  "stock": 120,
  "stockMinimo": 30,
  "activo": true,
  "enAlerta": false,
  "categoria": { "id": 1, "nombre": "Arroz y menestras" }
}
```
- `precio`: **string** con 2 decimales.
- `enAlerta`: `stock <= stockMinimo` (calculado; se calcula igual para inactivos).
- `stock` es de **solo lectura**: cambia únicamente con movimientos de inventario (entradas, despachos, ajustes; fases siguientes).

### `GET /productos` — todos los roles
Query:
- `page`, `pageSize`
- `buscar`: nombre o código (parcial).
- `categoriaId`: número.
- `alerta`: `true` → solo productos con `stock <= stockMinimo`; `false` → solo los que no están en alerta. Con `alerta=true` y sin `activo`, **solo se devuelven activos**.
- `activo`: `true|false` (sin él, activos e inactivos, salvo el caso anterior).

Orden: código ascendente.
`200`: `{ "datos": [Producto, …], "total": 60, "page": 1, "pageSize": 20 }`

> Tarjeta/tabla de alertas: `GET /productos?alerta=true&pageSize=100`. Buscador del Nuevo pedido: `GET /productos?activo=true&buscar=…`.

### `GET /productos/:id` — todos los roles
`200`: Producto.

### `POST /productos` — ADMIN
```json
{ "codigo": "BEB-099", "nombre": "Agua tónica botella 500 ml", "unidad": "UND", "precio": "3.50", "stockMinimo": 10, "categoriaId": 6 }
```
- Se crea con `stock: 0` (el stock se carga con una entrada de inventario). Si el cuerpo trae `stock` → `422 CAMPO_NO_EDITABLE`.
- `codigo` se guarda en mayúsculas (`"beb-099"` → `"BEB-099"`).

`201`: Producto. Errores: `400` (`campos.precio|stockMinimo|unidad|codigo|categoriaId`; categoría inexistente → `campos.categoriaId = "La categoría no existe"`), `409 DUPLICADO` con `campos.codigo`, `422`.

### `PATCH /productos/:id` — ADMIN
Campos opcionales: `codigo`, `nombre`, `unidad`, `precio`, `stockMinimo`, `categoriaId`, `activo`.
Si el cuerpo contiene `stock` (con cualquier valor) → `422`:
```json
{ "error": { "codigo": "CAMPO_NO_EDITABLE", "mensaje": "El stock no se edita aquí: cambia solo con movimientos de inventario (entradas, despachos y ajustes)", "campos": { "stock": "El stock no se edita aquí: …" } } }
```
y no se guarda ningún otro cambio. `200`: Producto.

---

## Proveedores

Objeto **Proveedor**:
```json
{ "id": 1, "ruc": "20604812373", "razonSocial": "Agroindustrias Valle Moche S.A.C.", "telefono": "044 481 237" }
```
`telefono` puede ser `null`. Los proveedores no tienen estado activo/inactivo (el esquema no lo contempla).

### `GET /proveedores` — ADMIN, GERENTE, ALMACENERO
Query: `page`, `pageSize`, `buscar` (razón social o RUC). Orden: razón social ascendente.
`200`: `{ "datos": [Proveedor, …], "total": 3, "page": 1, "pageSize": 20 }`

### `GET /proveedores/:id` — ADMIN, GERENTE, ALMACENERO
`200`: Proveedor.

### `POST /proveedores` — ADMIN, GERENTE
`{ "ruc": "20612345678", "razonSocial": "Proveedora de Prueba S.A.C.", "telefono": "044 000 000" }` (`telefono` opcional)
`201`: Proveedor. Errores: `400` (`campos.ruc` con el mensaje de RUC), `409 DUPLICADO` con `campos.ruc` = `"Ya existe un proveedor con ese RUC"`.

### `PATCH /proveedores/:id` — ADMIN
Campos opcionales: `ruc`, `razonSocial`, `telefono` (`""`/`null` lo borra). `200`: Proveedor.

---

## Pedidos

### Estados y transiciones (regla 6)

```
REGISTRADO ──aprobar──▶ APROBADO ──despachar──▶ DESPACHADO ──entregar──▶ ENTREGADO
     │                      │
     └──────anular──────────┴──▶ ANULADO
```
Cualquier otra transición → `422 TRANSICION_INVALIDA` con el mensaje exacto `No se puede pasar de <ESTADO_ACTUAL> a <ESTADO_DESTINO>` (p. ej., `No se puede pasar de ENTREGADO a APROBADO`). No trae `campos`.

### Permisos por acción

| Acción | Quién | Estado de origen | Notas |
|---|---|---|---|
| Registrar (`POST /pedidos`) | VENDEDOR | — | Queda como vendedor del pedido. |
| `aprobar` | GERENTE | REGISTRADO | 403 `SEGREGACION_FUNCIONES` si el gerente es quien lo registró. |
| `despachar` | ALMACENERO | APROBADO | 403 `SEGREGACION_FUNCIONES` si el almacenero es quien lo registró. |
| `entregar` | ALMACENERO | DESPACHADO | |
| `anular` | GERENTE | REGISTRADO o APROBADO | Motivo obligatorio. |
| `anular` | VENDEDOR | Solo **sus** pedidos en REGISTRADO | Suyo en APROBADO → 403 `ACCESO_DENEGADO` («Solo puede anular sus pedidos en estado REGISTRADO»). |
| — | ADMIN | — | Solo consulta: toda acción → 403. |

Orden de validación en cada acción: rol (403) → visibilidad (403) → máquina de estados (422) → restricción del vendedor y segregación (403).

**No calcule los botones en el frontend**: use `acciones` del detalle, que aplica la misma lógica que los endpoints.

### Visibilidad

| Rol | Ve |
|---|---|
| ADMIN, GERENTE | Todos los pedidos. |
| VENDEDOR | Solo los suyos (se ignora `vendedorId`). Detalle de otro vendedor → 403. |
| ALMACENERO | Solo APROBADO, DESPACHADO y ENTREGADO. Detalle de un REGISTRADO o ANULADO → 403. |

### Objeto **PedidoFila** (lista)
```json
{
  "id": 12,
  "codigo": "PED-000012",
  "fecha": "2026-09-24T15:20:11.000Z",
  "estado": "APROBADO",
  "condicionPago": "CONTADO",
  "total": "58.40",
  "cliente": { "id": 1, "razonSocial": "Minimarket San Martín S.A.C.", "zona": "Centro" },
  "vendedor": { "id": 3, "nombre": "Luis Paredes Castillo" },
  "numLineas": 2
}
```

### Objeto **PedidoDetalle**
```json
{
  "id": 12,
  "codigo": "PED-000012",
  "fecha": "2026-09-24T15:20:11.000Z",
  "estado": "DESPACHADO",
  "condicionPago": "CREDITO",
  "total": "58.40",
  "cliente": { "id": 1, "tipoDoc": "RUC", "numDoc": "20632214287", "razonSocial": "Minimarket San Martín S.A.C.", "direccion": "Av. España 711", "telefono": "954 813 752", "zona": "Centro" },
  "vendedor": { "id": 3, "nombre": "Luis Paredes Castillo" },
  "aprobadoPor": { "id": 2, "nombre": "Carlos Mendoza Ríos" },
  "aprobacionAutomatica": false,
  "despachadoPor": { "id": 5, "nombre": "Jorge Alvarado Díaz" },
  "fechaAprobacion": "2026-09-24T15:30:00.000Z",
  "fechaDespacho": "2026-09-24T16:02:45.000Z",
  "fechaEntrega": null,
  "motivoAnulacion": null,
  "lineas": [
    { "id": 30, "producto": { "id": 9, "codigo": "ACE-001", "nombre": "Aceite vegetal botella 1 L", "unidad": "UND" }, "cantidad": 3, "precioUnit": "9.90", "subtotal": "29.70" },
    { "id": 31, "producto": { "id": 24, "codigo": "LAC-001", "nombre": "Leche evaporada entera lata 400 g", "unidad": "UND" }, "cantidad": 7, "precioUnit": "4.10", "subtotal": "28.70" }
  ],
  "historial": [
    {
      "id": 101, "accion": "CREAR", "usuario": { "id": 3, "nombre": "Luis Paredes Castillo" }, "fecha": "2026-09-24T15:20:11.000Z",
      "antes": null,
      "despues": {
        "codigo": "PED-000012", "estado": "REGISTRADO", "cliente": { "id": 1, "razonSocial": "Minimarket San Martín S.A.C." },
        "condicionPago": "CREDITO", "total": "58.40",
        "lineas": [
          { "productoId": 9, "codigo": "ACE-001", "cantidad": 3, "precioUnit": "9.90", "subtotal": "29.70" },
          { "productoId": 24, "codigo": "LAC-001", "cantidad": 7, "precioUnit": "4.10", "subtotal": "28.70" }
        ]
      }
    },
    {
      "id": 102, "accion": "CAMBIO_ESTADO", "usuario": { "id": 2, "nombre": "Carlos Mendoza Ríos" }, "fecha": "2026-09-24T15:30:00.000Z",
      "antes": { "estado": "REGISTRADO" }, "despues": { "estado": "APROBADO", "aprobacion": "MANUAL" }
    },
    {
      "id": 103, "accion": "CAMBIO_ESTADO", "usuario": { "id": 5, "nombre": "Jorge Alvarado Díaz" }, "fecha": "2026-09-24T16:02:45.000Z",
      "antes": { "estado": "APROBADO" },
      "despues": { "estado": "DESPACHADO", "movimientos": [
        { "productoId": 9, "codigo": "ACE-001", "cantidad": 3, "stockResultante": 477 },
        { "productoId": 24, "codigo": "LAC-001", "cantidad": 7, "stockResultante": 1193 }
      ] }
    }
  ],
  "acciones": ["entregar"]
}
```
- `total`, `precioUnit` y `subtotal` son strings con 2 decimales. `precioUnit` es el precio del producto **al registrar** y no cambia si después se modifica el precio del producto.
- `aprobadoPor` es `null` si el pedido aún no está aprobado **o** si se aprobó automáticamente; para distinguirlos use `aprobacionAutomatica` (`true` = contado ≤ S/ 2 000, aprobado por el sistema al registrar).
- `despachadoPor`, `fechaAprobacion`, `fechaDespacho`, `fechaEntrega` y `motivoAnulacion` son `null` hasta que ocurre el evento.
- `historial`: registros de bitácora del pedido en orden cronológico, para la línea de tiempo «quién y cuándo». `usuario` puede ser `null`. En los cambios de estado, `antes` es `{ "estado": "<anterior>" }`. Formas de `despues`:
  - `CREAR`: el pedido registrado (ejemplo arriba).
  - `CAMBIO_ESTADO`, aprobación automática: `{ "estado": "APROBADO", "aprobacion": "AUTOMATICA", "regla": "Contado con total ≤ S/ 2 000" }` (usuario = el vendedor).
  - `CAMBIO_ESTADO`, aprobación manual: `{ "estado": "APROBADO", "aprobacion": "MANUAL" }`.
  - `CAMBIO_ESTADO`, despacho: `{ "estado": "DESPACHADO", "movimientos": [{ productoId, codigo, cantidad, stockResultante }] }`.
  - `CAMBIO_ESTADO`, entrega: `{ "estado": "ENTREGADO" }`.
  - `ANULAR`: `{ "estado": "ANULADO", "motivo": "…" }`.
- `acciones`: subconjunto, en este orden, de `["aprobar", "despachar", "entregar", "anular"]` con lo que **el usuario actual** puede hacer ahora. Queda vacío cuando no puede hacer nada (p. ej., ADMIN, o un pedido ENTREGADO o ANULADO).

### `GET /pedidos` — todos los roles (según la visibilidad)
Query:
- `page`, `pageSize`
- `estado`: `REGISTRADO|APROBADO|DESPACHADO|ENTREGADO|ANULADO`
- `desde`, `hasta`: fechas `AAAA-MM-DD` en hora de Lima; `hasta` es **inclusive** (cubre todo ese día). Otro formato, o `hasta` anterior a `desde` → 400 (`campos.desde` / `campos.hasta`).
- `vendedorId`, `clienteId`: números (`vendedorId` se ignora si quien consulta es VENDEDOR).
- `buscar`: código del pedido (acepta minúsculas o parte del código, p. ej. `ped-000012` o `12`) o razón social del cliente.
- `orden`: `recientes` (por defecto, los más recientes primero) o `antiguedad` (los más antiguos primero). Para la **cola de despacho**: `?estado=APROBADO&orden=antiguedad`.

`200`: `{ "datos": [PedidoFila, …], "total": 3, "page": 1, "pageSize": 20 }`

### `GET /pedidos/:id` — todos los roles (según la visibilidad)
`200`: PedidoDetalle. `403` si el usuario no puede verlo, `404` si no existe.

### `POST /pedidos` — VENDEDOR
```json
{ "clienteId": 1, "condicionPago": "CONTADO", "lineas": [ { "productoId": 9, "cantidad": 3 }, { "productoId": 24, "cantidad": 7 } ] }
```
- `condicionPago`: `CONTADO` o `CREDITO`. `cantidad`: entero > 0. Entre 1 y 50 líneas, sin repetir producto.
- **El total lo calcula el servidor** con el precio vigente; se ignoran `total`, `precioUnit` o `subtotal` si vienen en el cuerpo.
- El stock **no** se descuenta al registrar (se descuenta al despachar), pero cada cantidad debe ser ≤ al stock actual.
- Regla 7: `CONTADO` con total ≤ `2000.00` → el pedido nace **APROBADO** (`aprobacionAutomatica: true`); `CREDITO`, o total > 2000 → queda **REGISTRADO** y lo aprueba el gerente.

`201`: PedidoDetalle (con las `acciones` del vendedor).

Errores:
- `400 VALIDACION`: `campos.clienteId` (falta, o «El cliente no existe o está inactivo»), `campos.condicionPago`, `campos.lineas` («El pedido debe tener al menos una línea» / «No repita el mismo producto en dos líneas»), `campos["lineas.<i>.cantidad"]` y `campos["lineas.<i>.productoId"]` («El producto no existe o está inactivo»). `<i>` es la posición de la línea en el arreglo enviado, contando desde 0.
- `409 STOCK_INSUFICIENTE`:
  ```json
  { "error": {
      "codigo": "STOCK_INSUFICIENTE",
      "mensaje": "Stock insuficiente para Frejol canario bolsa 1 kg (ARR-005): stock disponible 18, solicitado 20",
      "campos": { "lineas.1.cantidad": "Stock disponible: 18" },
      "productos": [ { "productoId": 5, "codigo": "ARR-005", "nombre": "Frejol canario bolsa 1 kg", "stockDisponible": 18, "solicitado": 20 } ]
  } }
  ```
  Si faltan varios productos, `productos` trae uno por cada línea con problema y el mensaje los separa con `; `. No se crea nada.

### `POST /pedidos/:id/aprobar` — GERENTE
Sin cuerpo. `200`: PedidoDetalle. Errores: `403` (rol, visibilidad o `SEGREGACION_FUNCIONES`), `404`, `422 TRANSICION_INVALIDA`.

### `POST /pedidos/:id/despachar` — ALMACENERO
Sin cuerpo. **Atómico**: descuenta el stock de todas las líneas, crea un movimiento `SALIDA` por línea (motivo `Despacho PED-000012`, referencia `PED-000012`, con `stockResultante`) y pasa el pedido a DESPACHADO. Si alguna línea ya no tiene stock → `409 STOCK_INSUFICIENTE` y **no cambia nada**. Este 409 no trae `campos`, y `productos` contiene el primer producto que falló. El stock nunca queda negativo: dos despachos simultáneos no pueden consumir el mismo stock ni despachar dos veces el mismo pedido (el segundo recibe 409 o 422).
`200`: PedidoDetalle. Errores: `403`, `404`, `409`, `422`.

### `POST /pedidos/:id/entregar` — ALMACENERO
Sin cuerpo. `200`: PedidoDetalle. Errores: `403`, `404`, `422`.

### `POST /pedidos/:id/anular` — GERENTE y VENDEDOR (ver permisos)
```json
{ "motivo": "Cliente canceló por teléfono" }
```
`motivo`: de 10 a 300 caracteres (se recortan los espacios). Si falta o es corto → `400` con `campos.motivo` («El motivo debe tener al menos 10 caracteres»).
`200`: PedidoDetalle con `estado: "ANULADO"` y `motivoAnulacion`. Errores: `400`, `403`, `404`, `422` (p. ej., `No se puede pasar de DESPACHADO a ANULADO`).

### Bitácora de pedidos
Cada operación deja un registro, dentro de la misma transacción: registrar → `CREAR` (más un `CAMBIO_ESTADO` si se aprueba automáticamente); aprobar, despachar y entregar → `CAMBIO_ESTADO`; anular → `ANULAR`. Las operaciones rechazadas no dejan registro.

---

## Inventario

El stock de un producto **solo** cambia con movimientos. Tipos de movimiento:

| Tipo | Signo | Origen |
|---|---|---|
| `ENTRADA` | + | Recepción de una orden de compra, o entrada manual (`POST /inventario/ajustes`). |
| `SALIDA` | − | Solo por despacho de pedidos (no se registra a mano). |
| `AJUSTE_POSITIVO` | + | Ajuste manual (sobrante de conteo, etc.). |
| `AJUSTE_NEGATIVO` | − | Ajuste manual (merma, rotura, etc.); nunca deja el stock < 0. |

Objeto **Movimiento**:
```json
{
  "id": 61,
  "fecha": "2026-09-24T17:05:12.000Z",
  "tipo": "AJUSTE_NEGATIVO",
  "cantidad": 5,
  "stockResultante": 475,
  "motivo": "Botellas rotas",
  "referencia": null,
  "usuario": { "id": 5, "nombre": "Jorge Alvarado Díaz" }
}
```
`stockResultante` es el stock del producto inmediatamente después de ese movimiento. `referencia` puede ser `null`; en despachos y recepciones es el código (`PED-000123`, `OC-000010`).

Objeto **ProductoInventario**:
```json
{ "id": 9, "codigo": "ACE-001", "nombre": "Aceite vegetal botella 1 L", "unidad": "UND", "stock": 498, "stockMinimo": 120, "enAlerta": false }
```

### `GET /inventario/kardex/:productoId` — ADMIN, GERENTE, ALMACENERO
Query: `page`, `pageSize`, `desde`, `hasta` (`AAAA-MM-DD` en hora de Lima, `hasta` inclusive), `tipo` (`ENTRADA|SALIDA|AJUSTE_POSITIVO|AJUSTE_NEGATIVO`).

`200`:
```json
{
  "producto": { "id": 9, "codigo": "ACE-001", "nombre": "Aceite vegetal botella 1 L", "unidad": "UND", "stock": 498, "stockMinimo": 120, "enAlerta": false },
  "resumen": { "entradas": 500, "salidas": 0, "ajustesPositivos": 3, "ajustesNegativos": 5, "saldoCalculado": 498, "cuadra": true },
  "datos": [ Movimiento, … ],
  "total": 4,
  "page": 1,
  "pageSize": 20
}
```
- `datos`: movimientos que cumplen los filtros, **los más recientes primero**. Para mostrar el kardex en orden cronológico, invierta la página. El saldo de cada fila es `stockResultante`.
- `total`/`page`/`pageSize` se refieren a los movimientos filtrados.
- `resumen` se calcula siempre sobre **todos** los movimientos del producto, sin filtros ni paginación: `saldoCalculado = entradas + ajustesPositivos − salidas − ajustesNegativos`, y `cuadra = (saldoCalculado === producto.stock)`.

Errores: `400` (id, fechas o `tipo` inválidos), `403` (VENDEDOR), `404` (producto inexistente).

### `GET /inventario/alertas` — ADMIN, GERENTE, ALMACENERO
Productos **activos** con `stock <= stockMinimo` (regla 18), del más crítico al menos crítico (`stock / stockMinimo` ascendente; empate por código). No está paginado.

`200`:
```json
{
  "datos": [
    {
      "id": 5, "codigo": "ARR-005", "nombre": "Frejol canario bolsa 1 kg", "unidad": "UND",
      "stock": 18, "stockMinimo": 40, "enAlerta": true, "precio": "9.80",
      "categoria": { "id": 1, "nombre": "Arroz y menestras" },
      "cantidadSugerida": 62
    }
  ],
  "total": 7
}
```
`cantidadSugerida = stockMinimo × 2 − stock`. El VENDEDOR recibe `403`: para ver alertas usa `GET /productos?alerta=true`.

### `POST /inventario/ajustes` — ADMIN, ALMACENERO
```json
{ "productoId": 9, "tipo": "AJUSTE_NEGATIVO", "cantidad": 5, "motivo": "Botellas rotas", "referencia": "ACTA-12" }
```
- `tipo`: `ENTRADA`, `AJUSTE_POSITIVO` o `AJUSTE_NEGATIVO` (`SALIDA` → 400).
- `cantidad`: entero > 0.
- `motivo`: obligatorio, de 5 a 200 caracteres (regla 10).
- `referencia`: opcional, máximo 60 caracteres; `""` o `null` → sin referencia.
- Se permite ajustar productos inactivos.

`201`:
```json
{ "movimiento": Movimiento, "producto": ProductoInventario }
```
En la bitácora queda un registro `AJUSTE` (entidad `Producto`) con `antes: { stock }` y `despues: { stock, tipo, cantidad, motivo, referencia, movimientoId }`.

Errores:
- `400 VALIDACION`: `campos.productoId` («El producto no existe»), `campos.tipo`, `campos.cantidad`, `campos.motivo` («El motivo debe tener al menos 5 caracteres»).
- `403`: GERENTE o VENDEDOR.
- `409 STOCK_INSUFICIENTE` si un ajuste negativo dejaría el stock < 0. No cambia nada:
  ```json
  { "error": {
      "codigo": "STOCK_INSUFICIENTE",
      "mensaje": "Stock insuficiente para Frejol canario bolsa 1 kg (ARR-005): stock disponible 18, solicitado 19",
      "campos": { "cantidad": "Stock disponible: 18" },
      "productos": [ { "productoId": 5, "codigo": "ARR-005", "nombre": "Frejol canario bolsa 1 kg", "stockDisponible": 18, "solicitado": 19 } ]
  } }
  ```

---

## Órdenes de compra

### Estados y transiciones

```
PENDIENTE ──aprobar──▶ APROBADA ──recepcionar──▶ RECIBIDA
    │                     │
    └──────anular─────────┴──▶ ANULADA
```
Cualquier otra transición → `422 TRANSICION_INVALIDA` con el mensaje `No se puede pasar de <ACTUAL> a <DESTINO>` (p. ej., `No se puede pasar de RECIBIDA a ANULADA`).

| Acción | Quién | Estado de origen |
|---|---|---|
| Crear (`POST /ordenes-compra`) | ADMIN, GERENTE | — (nace PENDIENTE) |
| Propuesta sugerida | ADMIN, GERENTE | — |
| `aprobar` | **Solo GERENTE** (segregación: el ADMIN no aprueba) | PENDIENTE |
| `recepcionar` | Solo ALMACENERO | APROBADA |
| `anular` | GERENTE, ADMIN | PENDIENTE o APROBADA |

**Visibilidad:** ADMIN y GERENTE ven todas las órdenes. El ALMACENERO solo ve las APROBADAS y RECIBIDAS; una PENDIENTE o ANULADA le da 403, también al intentar recepcionarla. El VENDEDOR no tiene acceso (403 en todo).

Orden de validación: rol (403) → visibilidad (403) → máquina de estados (422). Los botones deben salir de `acciones` del detalle.

### Objeto **OrdenFila** (lista)
```json
{
  "id": 3,
  "codigo": "OC-000003",
  "fecha": "2026-09-24T18:00:00.000Z",
  "estado": "PENDIENTE",
  "proveedor": { "id": 1, "ruc": "20604812373", "razonSocial": "Agroindustrias Valle Moche S.A.C." },
  "numLineas": 2,
  "total": "56.50"
}
```
`total` = Σ (`cantidad × costoUnit`), como string con 2 decimales.

### Objeto **OrdenDetalle**
```json
{
  "id": 3,
  "codigo": "OC-000003",
  "fecha": "2026-09-24T18:00:00.000Z",
  "estado": "APROBADA",
  "proveedor": { "id": 1, "ruc": "20604812373", "razonSocial": "Agroindustrias Valle Moche S.A.C.", "telefono": "044 481 237" },
  "creadoPor": { "id": 2, "nombre": "Carlos Mendoza Ríos" },
  "motivoAnulacion": null,
  "total": "56.50",
  "lineas": [
    {
      "id": 7,
      "producto": { "id": 9, "codigo": "ACE-001", "nombre": "Aceite vegetal botella 1 L", "unidad": "UND", "stock": 480, "stockMinimo": 120 },
      "cantidad": 3,
      "costoUnit": "7.90",
      "subtotal": "23.70"
    }
  ],
  "historial": [
    { "id": 120, "accion": "CREAR", "usuario": { "id": 2, "nombre": "Carlos Mendoza Ríos" }, "fecha": "2026-09-24T18:00:00.000Z", "antes": null,
      "despues": { "codigo": "OC-000003", "estado": "PENDIENTE", "proveedor": { "id": 1, "razonSocial": "Agroindustrias Valle Moche S.A.C." }, "total": "56.50",
                   "lineas": [ { "productoId": 9, "codigo": "ACE-001", "cantidad": 3, "costoUnit": "7.90" } ] } },
    { "id": 121, "accion": "CAMBIO_ESTADO", "usuario": { "id": 2, "nombre": "Carlos Mendoza Ríos" }, "fecha": "2026-09-24T18:10:00.000Z",
      "antes": { "estado": "PENDIENTE" }, "despues": { "estado": "APROBADA" } }
  ],
  "acciones": ["recepcionar"]
}
```
- `producto.stock` es el stock **actual** del producto, no el del momento de la orden.
- `creadoPor`: quien creó la orden. Se toma de la bitácora porque la tabla no guarda el creador; puede ser `null`.
- `motivoAnulacion`: se toma del registro `ANULAR` de la bitácora (el esquema no tiene esa columna). Es `null` si la orden no está anulada.
- `historial`: bitácora de la orden en orden cronológico. Formas de `despues`: `CREAR` (arriba); `CAMBIO_ESTADO` → `{ "estado": "APROBADA" }`; `RECEPCION` → `{ "estado": "RECIBIDA", "movimientos": [{ productoId, codigo, cantidad, stockResultante }] }`; `ANULAR` → `{ "estado": "ANULADA", "motivo": "…" }`. En los cambios, `antes` es `{ "estado": "<anterior>" }`.
- `acciones`: subconjunto, en este orden, de `["aprobar", "recepcionar", "anular"]` que el usuario actual puede ejecutar ahora.

### `GET /ordenes-compra` — ADMIN, GERENTE, ALMACENERO (según la visibilidad)
Query: `page`, `pageSize`, `estado` (`PENDIENTE|APROBADA|RECIBIDA|ANULADA`), `proveedorId`, `desde`, `hasta` (`AAAA-MM-DD` en hora de Lima, `hasta` inclusive). Orden: las más recientes primero.
`200`: `{ "datos": [OrdenFila, …], "total": 2, "page": 1, "pageSize": 20 }`

### `GET /ordenes-compra/:id` — ADMIN, GERENTE, ALMACENERO (según la visibilidad)
`200`: OrdenDetalle. `403` si no puede verla, `404` si no existe.

### `POST /ordenes-compra/sugerida` — ADMIN, GERENTE
Devuelve una **propuesta que no se guarda**: no crea la orden ni escribe en la bitácora. Sirve para precargar el formulario de nueva orden; el gerente elige el proveedor y puede editar cantidades y costos antes de crearla con `POST /ordenes-compra`.

Cuerpo (todo opcional; también puede enviarse vacío):
```json
{ "proveedorId": 1, "productoIds": [5, 9] }
```
- Sin `productoIds`: incluye todos los productos activos en alerta (`stock <= stockMinimo`).
- Con `productoIds`: incluye exactamente esos productos (activos), estén o no en alerta.
- `cantidad = stockMinimo × 2 − stock` (regla 18), con un mínimo de 1 (un producto que no está en alerta daría ≤ 0).
- `costoUnit` = **80 % del precio de venta**, redondeado a 2 decimales. Es un **supuesto del demo**, confirmado por el usuario: no hay costos de compra reales, así que el costo se estima y el gerente puede editarlo. La respuesta lo indica en `supuestoCosto`, y el README debe decirlo.

`200`:
```json
{
  "proveedor": { "id": 1, "ruc": "20604812373", "razonSocial": "Agroindustrias Valle Moche S.A.C." },
  "supuestoCosto": "Costo unitario = 80 % del precio de venta (supuesto del demo; editable)",
  "lineas": [
    {
      "producto": { "id": 5, "codigo": "ARR-005", "nombre": "Frejol canario bolsa 1 kg", "unidad": "UND", "stock": 18, "stockMinimo": 40, "precio": "9.80" },
      "cantidad": 62,
      "costoUnit": "7.84",
      "subtotal": "486.08"
    }
  ],
  "total": "486.08"
}
```
`proveedor` es `null` si no se envió `proveedorId`. Las `lineas` van ordenadas por código de producto y pueden estar vacías si no hay alertas.
Errores: `400` (`campos.proveedorId` «El proveedor no existe»; `campos.productoIds` «Productos inexistentes o inactivos: …»), `403`.

### `POST /ordenes-compra` — ADMIN, GERENTE
```json
{ "proveedorId": 1, "lineas": [ { "productoId": 5, "cantidad": 62, "costoUnit": "7.84" }, { "productoId": 9, "cantidad": 10, "costoUnit": 7.9 } ] }
```
- De 1 a 60 líneas, sin repetir producto; los productos deben estar activos.
- `cantidad`: entero > 0. `costoUnit`: > 0 con máximo 2 decimales (acepta número o string).
- La orden nace **PENDIENTE**.

`201`: OrdenDetalle. En la bitácora queda un `CREAR`.
Errores: `400 VALIDACION` (`campos.proveedorId` «El proveedor no existe»; `campos.lineas` «La orden debe tener al menos una línea» / «No repita el mismo producto en dos líneas»; `campos["lineas.<i>.cantidad"]`, `campos["lineas.<i>.costoUnit"]`, `campos["lineas.<i>.productoId"]` «El producto no existe o está inactivo»), `403`.

### `POST /ordenes-compra/:id/aprobar` — GERENTE
Sin cuerpo. PENDIENTE → APROBADA. `200`: OrdenDetalle. En la bitácora queda un `CAMBIO_ESTADO`. Errores: `403` (incluido el ADMIN), `404`, `422`.

### `POST /ordenes-compra/:id/recepcionar` — ALMACENERO
Sin cuerpo. APROBADA → RECIBIDA (regla 9), todo en una sola transacción:
- suma la cantidad de cada línea al stock del producto;
- crea un movimiento `ENTRADA` por línea (motivo `Recepción OC-000003`, referencia `OC-000003`, con `stockResultante`);
- deja en la bitácora un registro `RECEPCION` con los movimientos.

Dos recepciones simultáneas de la misma orden solo suman una vez: la segunda recibe `422`.
`200`: OrdenDetalle. Errores: `403`, `404`, `422`.

### `POST /ordenes-compra/:id/anular` — GERENTE, ADMIN
```json
{ "motivo": "Proveedor sin stock disponible" }
```
`motivo`: de 10 a 300 caracteres. Solo desde PENDIENTE o APROBADA. `200`: OrdenDetalle con `estado: "ANULADA"` y `motivoAnulacion`. En la bitácora queda un `ANULAR` con el motivo.
Errores: `400` (`campos.motivo`), `403`, `404`, `422`.

---

## Reportes

### Qué cuenta como venta
- Solo los pedidos en estado **DESPACHADO** o **ENTREGADO** cuentan como venta.
- La **fecha de la venta es `fechaDespacho`**, no la de registro: la mercadería sale del almacén al despachar. Un pedido registrado el día 1 y despachado el día 3 suma al día 3.
- Los ANULADOS, REGISTRADOS y APROBADOS no suman ventas.
- Excepción: `pedidosPorEstado` cuenta **todos** los pedidos por su fecha de **registro**.

### Período (`desde`, `hasta`)
- Fechas `AAAA-MM-DD` en hora de Lima, ambas inclusive.
- **Por defecto: los últimos 30 días incluyendo hoy** (`desde = hoy − 29`).
- Con solo `desde`: hasta hoy. Con solo `hasta`: los 30 días que terminan ese día.
- Máximo 366 días (si se excede → `400`, `campos.desde`). `hasta` anterior a `desde` → `400` (`campos.hasta`). Otro formato → `400`.

### Alcance por rol (decisión confirmada)

| Rol | `alcance` | Qué incluye |
|---|---|---|
| ADMIN, GERENTE | `TOTAL` | Todo. |
| VENDEDOR | `PROPIO` | Todas las métricas filtradas a **sus** pedidos. `ventasPorVendedor` contiene solo a él (aunque tenga 0). `productosEnAlerta` va vacío. |
| ALMACENERO | `STOCK` | Solo `productosEnAlerta` (completo). `ventasTotales`, `numPedidos` y `ticketPromedio` son `null`; las demás listas van vacías. |

### `GET /reportes/tablero` — todos los roles (según el alcance)
Query: `desde`, `hasta`.

`200` (alcance `TOTAL`; listas abreviadas):
```json
{
  "alcance": "TOTAL",
  "periodo": { "desde": "2026-08-27", "hasta": "2026-09-25" },
  "ventasTotales": "551.00",
  "numPedidos": 3,
  "ticketPromedio": "183.67",
  "pedidosPorEstado": [
    { "estado": "REGISTRADO", "cantidad": 1 },
    { "estado": "APROBADO", "cantidad": 1 },
    { "estado": "DESPACHADO", "cantidad": 2 },
    { "estado": "ENTREGADO", "cantidad": 1 },
    { "estado": "ANULADO", "cantidad": 0 }
  ],
  "ventasPorDia": [
    { "fecha": "2026-08-27", "total": "0.00", "pedidos": 0 },
    { "fecha": "2026-09-25", "total": "181.00", "pedidos": 2 }
  ],
  "top10Productos": [
    { "productoId": 1, "codigo": "ARR-001", "nombre": "Arroz extra superior saco 50 kg", "cantidad": 2, "total": "370.00" }
  ],
  "ventasPorVendedor": [
    { "vendedorId": 4, "nombre": "Ana Villanueva Soto", "total": "370.00", "pedidos": 1 },
    { "vendedorId": 3, "nombre": "Luis Paredes Castillo", "total": "181.00", "pedidos": 2 }
  ],
  "ventasPorZona": [
    { "zona": "Centro", "total": "551.00", "pedidos": 3 },
    { "zona": "Norte", "total": "0.00", "pedidos": 0 }
  ],
  "productosEnAlerta": [
    { "id": 5, "codigo": "ARR-005", "nombre": "Frejol canario bolsa 1 kg", "stock": 18, "stockMinimo": 40, "cantidadSugerida": 62 }
  ]
}
```
- Todos los montos son **strings con 2 decimales** y se calculan con `Decimal`.
- `ventasTotales`: suma de `total` de las ventas del período. `numPedidos`: número de ventas.
- `ticketPromedio = ventasTotales / numPedidos`, redondeado a 2 decimales; `"0.00"` si no hay ventas.
- `pedidosPorEstado`: siempre los 5 estados, en el orden del flujo, con 0 si no hay pedidos.
- `ventasPorDia`: **un elemento por cada día del período**, en orden ascendente y con ceros los días sin ventas (listo para el gráfico de líneas).
- `top10Productos`: hasta 10 productos, ordenados por **monto vendido** (`total`) descendente; empates por cantidad y luego por código. `cantidad` son las unidades vendidas.
- `ventasPorVendedor`: solo vendedores con ventas en el período, de mayor a menor monto (en alcance `PROPIO`, solo él).
- `ventasPorZona`: siempre las 6 zonas, de mayor a menor monto (empates en el orden del catálogo).
- `productosEnAlerta`: igual que `GET /inventario/alertas`, del más crítico al menos crítico, con `cantidadSugerida = stockMinimo × 2 − stock`.

Errores: `400` (período inválido), `401`.

### `GET /reportes/ventas.csv` — ADMIN, GERENTE, VENDEDOR (el vendedor, solo lo suyo)
Query: `desde`, `hasta` (mismas reglas y valores por defecto que el tablero). ALMACENERO → `403`.

Respuesta `200`:
- `Content-Type: text/csv; charset=utf-8`
- `Content-Disposition: attachment; filename="ventas_2026-08-27_2026-09-25.csv"` (usa las fechas del período ya resuelto).
- Formato para Excel en español: empieza con BOM UTF-8 (`EF BB BF`), separador `;`, fin de línea `CRLF`, y el archivo termina en `CRLF`.
- Una fila por venta (DESPACHADO o ENTREGADO), ordenadas por fecha de despacho ascendente.

```
Código;Fecha despacho;Cliente;Documento;Zona;Vendedor;Condición;Estado;Total
PED-000001;2026-09-25 10:42;Minimarket San Martín S.A.C.;RUC 20632214287;Centro;Luis Paredes Castillo;CONTADO;DESPACHADO;99.00
```
- `Fecha despacho`: `AAAA-MM-DD HH:mm` en hora de Lima.
- `Documento`: `<tipoDoc> <numDoc>`.
- `Total`: punto decimal y 2 decimales, sin separador de miles.
- Escape: un campo que contiene `;`, `"` o un salto de línea va entre comillas y sus comillas se duplican.
- Protección contra inyección de fórmulas: un texto que empieza con `=`, `+`, `-`, `@`, tabulador o retorno de carro se antepone con `'`. Ejemplo: la razón social `=Bodega "La; Unión"` sale como `"'=Bodega ""La; Unión"""`.

Para descargar desde el frontend: `fetch` con el header `Authorization`, luego `blob()` y un enlace temporal. Un `<a href>` directo no envía el token.

---

## Bitácora (solo lectura)

La bitácora **no se puede crear, editar ni borrar por la API** (regla 17). Los registros los crea el servidor dentro de la transacción de cada operación. `POST`, `PUT`, `PATCH` y `DELETE` sobre `/bitacora` o `/bitacora/:id` responden `404 RUTA_NO_ENCONTRADA` (para ADMIN y GERENTE; los demás roles reciben 403 antes).

Objeto **RegistroBitacora**:
```json
{
  "id": 42,
  "fecha": "2026-09-25T15:02:11.000Z",
  "usuario": { "id": 5, "nombre": "Jorge Alvarado Díaz", "email": "almacen@distrinorte.pe" },
  "accion": "AJUSTE",
  "entidad": "Producto",
  "entidadId": "9",
  "detalle": {
    "antes": { "stock": 480 },
    "despues": { "stock": 482, "tipo": "AJUSTE_POSITIVO", "cantidad": 2, "motivo": "Sobrante en conteo", "referencia": null, "movimientoId": 61 }
  },
  "ip": "::ffff:127.0.0.1"
}
```
- `usuario` es `null` en los registros de la carga inicial y en los `LOGIN_FALLIDO` con un correo inexistente.
- `entidadId` es **string** (o `null`).
- `detalle` ya viene parseado: `{ antes, despues }`. Cualquiera de los dos puede ser `null` (p. ej., `antes` en un CREAR). Nunca contiene contraseñas ni hashes.
- `ip` puede ser `null`.
- Valores de `accion`: `LOGIN_OK`, `LOGIN_FALLIDO`, `CREAR`, `EDITAR`, `DESACTIVAR`, `CAMBIO_ESTADO`, `ANULAR`, `AJUSTE`, `RECEPCION`.
- Valores de `entidad` en uso: `Usuario`, `Cliente`, `Categoria`, `Producto`, `Proveedor`, `Pedido`, `OrdenCompra`.

### `GET /bitacora` — ADMIN, GERENTE
Query:
- `page`, `pageSize`
- `usuarioId` (número)
- `entidad` (texto exacto, p. ej. `Pedido`)
- `entidadId` (texto exacto, p. ej. `12`)
- `accion` (uno de los valores anteriores; otro → 400)
- `desde`, `hasta` (`AAAA-MM-DD` en hora de Lima, `hasta` inclusive)

Orden: los más recientes primero.
`200`: `{ "datos": [RegistroBitacora, …], "total": 9, "page": 1, "pageSize": 20 }`

> Historial de un registro concreto: `?entidad=Pedido&entidadId=12`. El detalle de pedidos y de órdenes de compra ya trae su `historial`.

### `GET /bitacora/filtros` — ADMIN, GERENTE
Valores distintos presentes en la bitácora, ordenados alfabéticamente, para los desplegables:
```json
{ "entidades": ["Cliente", "Producto", "Usuario"], "acciones": ["AJUSTE", "CREAR", "EDITAR", "LOGIN_FALLIDO", "LOGIN_OK"] }
```

### `GET /bitacora/:id` — ADMIN, GERENTE
`200`: RegistroBitacora. `404` si no existe, `400` si el id no es numérico.

VENDEDOR y ALMACENERO → `403` en todas las rutas de bitácora.

---

## Otros

### `GET /salud` (público)
`200`: `{ "estado": "ok" }`

## Datos de demostración (seed)

`npm run setup` vacía la base y la recarga completa en ~1.5 s. Es idempotente: se puede ejecutar varias veces. Los datos son deterministas (PRNG con semilla fija) y las fechas son relativas al momento de la carga.

**Maestros**
- Usuarios (clave `Demo2026!`): `admin@`, `gerente@`, `vendedor1@`, `vendedor2@` y `almacen@distrinorte.pe`. Dados de alta 96 días atrás.
- 8 categorías y 60 productos genéricos, con códigos `ARR-`, `ACE-`, `AZU-`, `LAC-`, `FID-`, `BEB-`, `LIM-` y `CON-` seguidos de 3 dígitos.
- 80 clientes ficticios: 30 con RUC 20, 25 con RUC 10 y 25 con DNI, repartidos en las 6 zonas; 2 están inactivos.
- 3 proveedores: Agroindustrias Valle Moche (arroz, azúcar y fideos), Alimentos Costa Norte (aceites, lácteos, bebidas y conservas) y Química Hogar Trujillo (limpieza).

**Historial de los últimos 90 días (hasta hoy, hora de Lima)**
- **~300 pedidos** de vendedor1 y vendedor2 a clientes activos:
  - Registrados de lunes a sábado entre 8:00 y 19:00, con 1 a 8 líneas.
  - Cantidades acordes a la unidad y unos 30 % a crédito.
  - Se generaron con la **misma lógica que los servicios**: total en el servidor, aprobación automática de la regla 7 (contado ≤ S/ 2 000), la aprobación manual la hace el gerente y quien registra nunca aprueba ni despacha.
- **Estados:**
  - Los pedidos con más de 10 días están ENTREGADOS, salvo unos 6 % ANULADOS con motivo.
  - Los últimos días quedan pendientes para la demostración: unos **3 REGISTRADOS** a crédito (esperan la aprobación del gerente), **5 APROBADOS** (en la cola de despacho) y **4 DESPACHADOS** (por entregar).
  - El stock actual alcanza para aprobar y despachar todos los pendientes.
- **Fechas:** aprobación, despacho y entrega son posteriores al registro. Las ventas se reparten en casi todos los días hábiles, así que el tablero de 30 días muestra actividad diaria.
- **Órdenes de compra:**
  - ~9 RECIBIDAS de reposición, cada una con sus movimientos `ENTRADA` «Recepción OC-…».
  - **1 APROBADA** por recibir (ARR-005, AZU-005 y FID-005).
  - **1 PENDIENTE** de aprobar (LIM-006).
  - Los costos son el 80 % del precio (supuesto del demo).
- **Inventario:**
  - Cada producto parte de un `ENTRADA` «Inventario inicial» 95 días atrás.
  - Cada despacho crea una `SALIDA` «Despacho PED-…» por línea y cada recepción una `ENTRADA`, todas con su `stockResultante`.
  - El stock nunca fue negativo; al registrar cada pedido había stock suficiente; y **stock = suma de movimientos** en todos los productos.
- **Alertas al final: 7 productos**: `ARR-005`, `ACE-003` (Aceite vegetal bidón 5 L, **12 / 20**, el dato que usa la landing), `AZU-005`, `LAC-003`, `FID-005`, `BEB-007` y `LIM-006`. ACE-003, LAC-003 y BEB-007 no tienen orden en curso, así que sirven para demostrar «Generar orden de compra sugerida».
- **Bitácora (~1 500 registros):**
  - El CREAR de cada usuario y, por cada pedido, su CREAR, sus CAMBIO_ESTADO (con `antes`/`despues`) y su ANULAR si corresponde.
  - Por cada orden de compra: CREAR, aprobación y RECEPCION.
  - Un `LOGIN_OK` por usuario y día con actividad (el ADMIN, los lunes).
  - Todos con la fecha simulada e `ip: null`.

Los códigos (`PED-000123`, `OC-000010`) derivan del id, así que no empiezan necesariamente en 1 después de varias cargas.
