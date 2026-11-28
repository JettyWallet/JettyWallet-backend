# Contrato de la API

Acuerdo entre backend y frontend. **Antes de programar un endpoint, se agrega acá** (request y response) y se comparte con el equipo del front. La documentación interactiva está en `/api-docs`.

## Generales

| Tema | Acuerdo |
|---|---|
| URL base | `/api`. El front configura `VITE_API_URL`: `http://localhost:3000/api` en local y `https://jettywallet-backend-production.up.railway.app/api` en producción |
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
| `500` | Error inesperado del servidor |

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
- `description` trae un texto para mostrar: `"Saldo de bienvenida"`, `"Depósito"`, `"Intercambio"`.

### Planificados

Las formas de respuesta salen de lo que el front ya consume (`src/types/` del repo del front).

| Método | Ruta | Auth | Fase | Respuesta |
|---|---|---|---|---|
| `GET` | `/api/currencies` | No | 2 | Monedas disponibles |
| `POST` | `/api/transfers` | Sí | 3 | Transferencia a otro usuario (por email o número de cuenta) |
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
    description: string | null             // texto para mostrar, ej. "Saldo de bienvenida"
    createdAt: string                      // ISO
}
```
