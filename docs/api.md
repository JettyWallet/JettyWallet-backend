# Contrato de la API

Acuerdo entre backend y frontend. **Antes de programar un endpoint, se agrega acá** (request y response) y se comparte con el equipo del front. La documentación interactiva está en `/api-docs`.

## Generales

| Tema | Acuerdo |
|---|---|
| URL base | `/api`. El front configura `VITE_API_URL=/api` en local y en producción: el proxy de Vite (local) y el rewrite de Vercel (producción) lo reenvían al back. Ver "Sesión" abajo |
| Formato | JSON, propiedades en `camelCase` |
| Autenticación | Cookie httpOnly `jetty_session` que setean login y register y borra logout. El front la manda con `credentials: 'include'` y nunca la lee. Vence en 1 hora. Ver "Sesión" abajo |
| Errores | Siempre `{ "message": "texto para el usuario" }` |
| Fechas | ISO 8601 en UTC: `2026-11-23T14:30:00.000Z` |
| Monedas | `ARS`, `COP`, `EUR`, `USD` |
| Montos | Número con hasta 2 decimales, siempre acompañado de su moneda |

### Códigos de estado

| Código | Cuándo |
|---|---|
| `200` / `201` | Éxito (`201` al crear) |
| `400` | Datos inválidos o mal formados |
| `401` | Sin sesión, o sesión inválida o vencida. El front cierra la sesión |
| `403` | Request que modifica datos (POST, PUT, PATCH, DELETE) desde un origen no permitido |
| `404` | Recurso o ruta inexistente |
| `409` | Conflicto (por ejemplo, email ya registrado) |
| `422` | Datos válidos que incumplen una regla de negocio (por ejemplo, saldo insuficiente) |
| `429` | Demasiados pedidos en poco tiempo (por ejemplo, más de 20 búsquedas de usuario por minuto) |
| `500` | Error inesperado del servidor |
| `503` | Un servicio externo no está disponible (por ejemplo, no hay cotización) |

## Endpoints

### Disponibles

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/health` | No | Estado de la API |
| `POST` | `/api/auth/register` | No | Crea el usuario, su billetera y sus saldos (arranca con 1.000 USD). Setea la cookie y responde `201 { user }`: el registro ya inicia la sesión. `409` si el email existe |
| `POST` | `/api/auth/login` | No | Body `{ email, password }`. Setea la cookie y responde `200 { user }`. `401` si las credenciales son incorrectas |
| `POST` | `/api/auth/logout` | No | Borra la cookie. Responde `204` sin cuerpo, haya sesión o no |
| `GET` | `/api/me` | Sí | Responde `200 { id, name, email }`. `401` si no hay sesión, es inválida, venció o el usuario ya no existe |
| `GET` | `/api/wallet/summary` | Sí | Responde `200 WalletSummary` (abajo). Monedas ordenadas por código. Ver notas |
| `GET` | `/api/rates` | No | Responde `200 Rates` (abajo). `503` si alguna moneda no tiene cotización. Ver notas |
| `POST` | `/api/deposits` | Sí | Body `{ currency, amount }`. Responde `201 { transaction, balance }`. `400` si la moneda o el monto son inválidos, `422` si supera el máximo, `503` si no hay cotización para la moneda. Ver notas |
| `POST` | `/api/exchange` | Sí | Body `{ fromCurrency, toCurrency, amount }`. Responde `201 { transaction, balances }`. `400` si los datos son inválidos o las monedas son iguales, `422` si no alcanza el saldo o el monto convertido da 0, `503` si no hay cotización. Ver notas |
| `GET` | `/api/transactions` | Sí | Query opcional `limit`, `before`, `type`, `currency`. Responde `200 Transaction[]`, más recientes primero. `400` si algún parámetro es inválido. Ver notas |
| `GET` | `/api/users/lookup` | Sí | Query `email`. Responde `200 { name, email }` del destinatario de una transferencia. `400` si falta el email o es el propio, `404` si no existe, `429` si se superan 20 búsquedas por minuto. Ver notas |

`user` en register y login tiene la misma forma que `/me`: `{ id, name, email }`.

#### Sesión

- Cookie `jetty_session`: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=3600`, y `Secure` en producción. Sin `Domain`: queda asociada al dominio que la recibe.
- **Producción:** el front llama a `/api/...` en su propio dominio y Vercel lo reenvía a Railway (rewrite en `vercel.json`). `VITE_API_URL=/api`.
- **Local:** el proxy de Vite reenvía `/api` a `http://localhost:3000`. `VITE_API_URL=/api`.
- **CSRF:** además de `SameSite=Lax`, los POST, PUT, PATCH y DELETE con un header `Origin` que no esté en `FRONTEND_URL` responden `403`.
- **Solo cookie:** el header `Authorization: Bearer` no se acepta, y login y register no devuelven el token en el body.

Notas de `/api/wallet/summary`:
- El total lo calcula el front: `Σ amount × usdRates[currency]`. En otra moneda Y: dividir ese total por `usdRates[Y]`.
- `usdRates` es el mismo que devuelve `/api/rates`. Si una moneda nunca tuvo cotización (las APIs externas nunca respondieron), no aparece en `usdRates`: los saldos se muestran igual, pero el total no se puede calcular.
- `change24h` es `0` hasta que haya historial de cotizaciones.

Notas de `/api/rates`:
- `usdRates[X]` = cuántos USD vale 1 unidad de X. Para convertir un monto de X a Y: `monto × usdRates[X] / usdRates[Y]`.
- Se renuevan cada 1 hora, cuando alguien las pide. Si las APIs externas fallan, se devuelve la última cotización guardada con `stale: true`.
- Sirven para mostrar estimaciones. El intercambio usa la cotización del momento en que se ejecuta.

Notas de `/api/deposits`:
- `amount`: número mayor a 0, con hasta 2 decimales. Se manda como número, no como texto.
- **Máximo por depósito: el equivalente a 1.000.000 USD** según la última cotización guardada (el saldo total no tiene límite). En USD es 1.000.000; en otra moneda X es `1.000.000 / usdRates[X]`, truncado a 2 decimales (ej. con 1 USD = 1.600 ARS, el máximo en ARS es 1.600.000.000).
  - El front puede calcularlo con los `usdRates` que ya tiene para avisar antes de enviar, pero **el back es el que decide**: si la cotización cambió entre que el usuario mira y confirma, responde `422` con el máximo actualizado en el mensaje (ej. `"El monto máximo por depósito es 1.600.000.000 ARS (equivale a 1.000.000 USD)"`).
  - Si las APIs externas fallan, usa la última cotización guardada. Si la moneda nunca tuvo cotización, responde `503`.
- `currency`: `ARS`, `COP`, `EUR` o `USD` (acepta minúsculas).
- `transaction` tiene la forma de `Transaction` (abajo) con `type: 'deposit'` y `fromCurrency` / `fromAmount` en `null`. `balance` es el saldo de esa moneda después del depósito: sirve para actualizar la pantalla sin volver a pedir el summary.
- **Doble clic:** cada request es un depósito nuevo. El front deshabilita el botón hasta recibir la respuesta.

Notas de `/api/exchange`:
- `amount` está en `fromCurrency`, con las mismas reglas que el depósito (mayor a 0, hasta 2 decimales), pero **sin máximo**: el límite es el saldo disponible.
- Lo recibido es `amount × cotización`, **truncado** a 2 decimales (nunca se redondea hacia arriba). Si da 0 (ej. 1 COP → USD), responde `422`.
- Usa la cotización del momento en que se ejecuta, de la misma tabla que `/api/rates`: lo recibido coincide con la estimación, salvo que las cotizaciones se renueven entre que el usuario mira y confirma. Si las APIs externas fallan, usa la última guardada.
- `transaction` tiene `type: 'exchange'`. `balances` trae los saldos nuevos de las dos monedas, primero el de origen: sirven para actualizar la pantalla sin volver a pedir el summary.
- Sin comisión por ahora.
- **Doble clic:** cada request es un intercambio nuevo. El front deshabilita el botón hasta recibir la respuesta.

Notas de `/api/transactions`:
- Responde un **array plano** de `Transaction` (abajo), más recientes primero. Solo los movimientos de la billetera de la sesión.
- `limit`: entero entre 1 y 100. Por defecto, 20. El dashboard usa `?limit=5`.
- **Paginación por cursor ("Cargar más"):** para la página siguiente, mandar en `before` el `id` del último movimiento recibido: `?limit=20&before=<id>`. Si llegan menos movimientos que `limit`, no hay más. No se repiten ni se saltean movimientos aunque entren nuevos mientras el usuario mira el historial. `400` si `before` no es un movimiento de la billetera.
- **Filtros opcionales** (se pueden combinar entre sí y con `before`):
  - `type`: `deposit`, `exchange`, `transfer_in` o `transfer_out`.
  - `currency`: movimientos donde **entra o sale** esa moneda (ej. `?currency=USD` incluye un intercambio USD → EUR). Acepta minúsculas.
- `description` trae un texto para mostrar: `"Saldo de bienvenida"`, `"Depósito"`, `"Intercambio"` y, cuando estén las transferencias, `"Transferencia a Bruno Gil"` / `"Transferencia de Ana Pérez"`.

Notas de `/api/users/lookup`:
- Sirve para mostrar el nombre del destinatario antes de confirmar una transferencia: `GET /api/users/lookup?email=bruno@mail.com` → `200 { "name": "Bruno Gil", "email": "bruno@mail.com" }`. Nunca devuelve el id ni otros datos.
- El email se normaliza (sin espacios, en minúsculas): `" BRUNO@mail.com "` encuentra a `bruno@mail.com`. Conviene encodearlo en la URL (`encodeURIComponent`).
- Errores (siempre `{ message }`):
  - `400` `"Ingresá un email para buscar"`: falta el parámetro o está vacío.
  - `400` `"No podés transferirte a vos mismo"`: es el email de la sesión.
  - `404` `"No existe un usuario con ese email"`.
  - `429` `"Demasiadas búsquedas, probá en un minuto"`: más de 20 búsquedas por minuto del mismo usuario. Evita que se use para adivinar qué emails están registrados. El front busca al confirmar el email (botón o al salir del campo), no en cada tecla.
- Encontrar al usuario no reserva nada: la transferencia vuelve a validar el destinatario.

### Contrato definido (en desarrollo)

Endpoints con el contrato acordado pero todavía no disponibles: el front puede armar la pantalla con esta forma.

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/api/transfers` | Sí | Body `{ email, currency, amount }`. Responde `201 { transaction, balance }`. `400` si los datos son inválidos o el email es el propio, `404` si no existe el destinatario, `422` si no alcanza el saldo. Ver notas |

Notas de `/api/transfers`:
- Transfiere a otro usuario de Jetty, identificado por su **email**. Antes de confirmar, el front muestra el nombre del destinatario con `/api/users/lookup`.
- Request:
  ```json
  { "email": "bruno@mail.com", "currency": "ARS", "amount": 5000 }
  ```
  - `email`: se normaliza igual que en el lookup (sin espacios, en minúsculas).
  - `currency`: `ARS`, `COP`, `EUR` o `USD` (acepta minúsculas).
  - `amount`: mismas reglas que el depósito (mayor a 0, hasta 2 decimales, como número), pero **sin máximo**: el límite es el saldo disponible, igual que en el intercambio.
- **La moneda no cambia:** si se envían ARS, llegan ARS. Si el usuario no tiene saldo suficiente en esa moneda, primero tiene que hacer un intercambio o un depósito.
- Sin comisión.
- Response `201`, con la misma forma que el depósito:
  ```json
  {
      "transaction": {
          "id": "…",
          "type": "transfer_out",
          "fromCurrency": "ARS",
          "fromAmount": 5000,
          "toCurrency": "ARS",
          "toAmount": 5000,
          "description": "Transferencia a Bruno Gil",
          "createdAt": "2026-11-28T14:30:00.000Z"
      },
      "balance": { "currency": "ARS", "amount": 45000 }
  }
  ```
  - `transaction` es el movimiento de quien envía (`transfer_out`). `balance` es su saldo de esa moneda después de la transferencia: sirve para actualizar la pantalla sin volver a pedir el summary.
  - Quien recibe ve en su historial un `transfer_in` con `description: "Transferencia de Ana Pérez"`.
  - En `/api/transactions`, `type=transfer_out` y `type=transfer_in` filtran enviadas y recibidas.
- Errores (siempre `{ message }`):
  - `400`: email, moneda o monto inválidos.
  - `400` `"No podés transferirte a vos mismo"`: es el email de la sesión (mismo mensaje que el lookup).
  - `404` `"No existe un usuario con ese email"` (mismo mensaje que el lookup).
  - `422` `"No tenés saldo suficiente en ARS para esta transferencia"`.
- Las dos partes (débito, crédito y los dos movimientos) se guardan juntas: si algo falla, no se mueve nada.
- Después de confirmar, se envía un mail a quien envía y otro a quien recibe. Si el mail falla, la transferencia no se deshace.
- **Doble clic:** cada request es una transferencia nueva. El front deshabilita el botón hasta recibir la respuesta.

### Planificados

Las formas de respuesta salen de lo que el front ya consume (`src/types/` del repo del front).

| Método | Ruta | Auth | Fase | Respuesta |
|---|---|---|---|---|
| `GET` | `/api/currencies` | No | 2 | Monedas disponibles |
| — | `/api/savings-goals/...` | Sí | 4 | Metas de ahorro |

### Tipos que espera el front

```ts
interface User {
    id: string
    name: string
    email: string
}

interface WalletSummary {
    balances: { currency: CurrencyCode; amount: number }[]
    usdRates: Record<CurrencyCode, number> // cuántos USD vale 1 unidad de cada moneda
    change24h: number                      // variación del total en 24 h, en %
}

interface Rates {
    base: 'USD'
    usdRates: Record<CurrencyCode, number> // cuántos USD vale 1 unidad de cada moneda
    updatedAt: string                      // ISO, cotización más vieja de la lista
    stale: boolean                         // true si no se pudieron renovar (más de 1 h)
}

interface Transaction {
    id: string
    type: 'deposit' | 'exchange' | 'transfer_in' | 'transfer_out'
    fromCurrency: CurrencyCode | null      // null en depósitos
    toCurrency: CurrencyCode
    fromAmount: number | null              // null en depósitos
    toAmount: number
    description: string | null             // texto para mostrar, ej. "Saldo de bienvenida", "Transferencia a Bruno Gil"
    createdAt: string                      // ISO
}
```
