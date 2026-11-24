# Contrato de la API

Acuerdo entre backend y frontend. **Antes de programar un endpoint, se agrega acá** (request y response) y se comparte con el equipo del front. La documentación interactiva está en `/api-docs`.

## Generales

| Tema | Acuerdo |
|---|---|
| URL base | `/api`. El front configura `VITE_API_URL`: `http://localhost:3000/api` en local y `https://jettywallet-backend-production.up.railway.app/api` en producción |
| Formato | JSON, propiedades en `camelCase` |
| Autenticación | Header `Authorization: Bearer <token>` en las rutas protegidas. El token vence en 1 hora. Está planificado pasar a cookie httpOnly después de la Demo 1 |
| Errores | Siempre `{ "message": "texto para el usuario" }` |
| Fechas | ISO 8601 en UTC: `2026-11-23T14:30:00.000Z` |
| Monedas | `ARS`, `COP`, `EUR`, `USD` |
| Montos | Número con hasta 2 decimales, siempre acompañado de su moneda |

### Códigos de estado

| Código | Cuándo |
|---|---|
| `200` / `201` | Éxito (`201` al crear) |
| `400` | Datos inválidos o mal formados |
| `401` | Sin token, token inválido o vencido. El front cierra la sesión |
| `404` | Recurso o ruta inexistente |
| `409` | Conflicto (por ejemplo, email ya registrado) |
| `422` | Datos válidos que incumplen una regla de negocio (por ejemplo, saldo insuficiente) |
| `500` | Error inesperado del servidor |

## Endpoints

### Disponibles

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/health` | No | Estado de la API |
| `POST` | `/api/auth/register` | No | Crea el usuario, su billetera y sus saldos (arranca con 1.000 USD). Responde `201 { token, user }`: el registro ya inicia la sesión. `409` si el email existe |
| `POST` | `/api/auth/login` | No | Body `{ email, password }`. Responde `200 { token, user }`. `401` si las credenciales son incorrectas |
| `GET` | `/api/me` | Sí | Responde `200 { id, name, email }`. `401` si el token falta, es inválido, venció o el usuario ya no existe |

`user` en register y login tiene la misma forma que `/me`: `{ id, name, email }`.

### Planificados

Las formas de respuesta salen de lo que el front ya consume (`src/types/` del repo del front).

| Método | Ruta | Auth | Fase | Respuesta |
|---|---|---|---|---|
| `GET` | `/api/wallet/summary` | Sí | 1 | `WalletSummary` (abajo) |
| `GET` | `/api/transactions?limit=5` | Sí | 1 | `Transaction[]`, más recientes primero |
| `GET` | `/api/currencies` | No | 2 | Monedas disponibles |
| `GET` | `/api/rates` | No | 2 | Cotizaciones vigentes |
| `POST` | `/api/deposits` | Sí | 2 | Depósito simulado |
| `POST` | `/api/exchange` | Sí | 2 | Intercambio entre monedas |
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

interface Transaction {
    id: string
    type: 'deposit' | 'exchange' | 'transfer_in' | 'transfer_out'
    fromCurrency: CurrencyCode | null      // null en depósitos
    toCurrency: CurrencyCode
    fromAmount: number | null              // null en depósitos
    toAmount: number
    createdAt: string                      // ISO
}
```

> El front todavía tiene los tipos `buy` y `sell` en `Transaction`. Quedaron fuera del alcance; hay que avisarles que los reemplacen por `transfer_in` y `transfer_out`.
