# API de SIGPI – contrato (Fases 1 a 3)

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
  | 409 | `STOCK_INSUFICIENTE` | Pedidos: cantidad > stock al registrar o al despachar. Incluye `productos[]`. |
  | 422 | `TRANSICION_INVALIDA` | Pedidos: cambio de estado que la máquina de estados no permite. |
  | 403 | `SEGREGACION_FUNCIONES` | Pedidos: quien registró el pedido intenta aprobarlo o despacharlo. |
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

## Otros

### `GET /salud` (público)
`200`: `{ "estado": "ok" }`

## Datos de demostración (seed)

- Usuarios (clave `Demo2026!`): `admin@`, `gerente@`, `vendedor1@`, `vendedor2@`, `almacen@distrinorte.pe`.
- 8 categorías, 60 productos (códigos `ARR-`, `ACE-`, `AZU-`, `LAC-`, `FID-`, `BEB-`, `LIM-`, `CON-` + 3 dígitos), 7 en alerta: `ARR-005`, `ACE-003`, `AZU-005`, `LAC-003`, `FID-005`, `BEB-007`, `LIM-006`.
- 80 clientes (30 RUC 20, 25 RUC 10, 25 DNI; repartidos en las 6 zonas; 2 inactivos), 3 proveedores.
- Cada producto tiene un movimiento `ENTRADA` "Inventario inicial" (usuario: almacenero) de 95 días atrás, de modo que stock = suma de movimientos.
