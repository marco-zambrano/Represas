# Contexto técnico de HidroVista

## 1. Propósito

HidroVista es una aplicación web de observabilidad hidroeléctrica. Convierte fuentes públicas heterogéneas en una lectura común por central y por período, manteniendo visibles la procedencia, la unidad, la fecha de corte y la incertidumbre.

La aplicación combina telemetría observada de centrales, contexto hidrológico y pronósticos de caudal, y demanda eléctrica nacional mediante CENACE. No controla equipos, no modifica datos institucionales y no realiza despacho eléctrico.

## 2. Stack tecnológico

| Capa | Tecnología | Uso |
| --- | --- | --- |
| Framework | Next.js `16.3.0` | App Router, páginas, layouts, endpoints y ejecución server/client. |
| UI | React `19.2.8` | Componentes interactivos y estado del dashboard. |
| Lenguaje | TypeScript `5.9.3` | Tipado estricto y contratos de datos. |
| Estilos | Tailwind CSS `4.3.3` + CSS propio | Layout responsive, tokens visuales y temas. |
| Gráficos | Recharts `3.10.1` | Series de energía, caudal y unidades activas. |
| Autenticación | Supabase Auth, `@supabase/ssr` y `@supabase/supabase-js` | Sesiones, cookies y flujos de autenticación. |
| Parsing | Cheerio `1.2.0` | Extracción de métricas desde el HTML de CENACE. |
| Pruebas | Node Test Runner + `tsx` | Pruebas de fixtures y funciones de datos. |
| Calidad | ESLint 9 + configuración Next.js | Revisión estática. |

## 3. Arquitectura lógica

```text
Usuario autenticado
        |
 Next.js App Router
    /             \
React dashboard   Route Handlers /api/*
    \             /
      Adaptadores de datos
       lib/data/providers.ts
       lib/data/cenace.ts
        /       |        \
     CELEC  GEOGLOWS   INAMHI
  telemetría forecast  insumos CCS
                    \
                     CENACE
              demanda / snapshot CCS
```

La autenticación se valida en el layout del dashboard y en los route handlers. El proxy de Supabase refresca la sesión mediante cookies. Las consultas externas se ejecutan del lado del servidor para centralizar parsing, validación, normalización y manejo de errores.

## 4. Estructura del repositorio

```text
app/                 páginas, auth, dashboard y route handlers
lib/data/            catálogo, tipos y adaptadores de fuentes
lib/supabase/        clientes server, browser y proxy
information/         investigación de endpoints y metodología
presentacion/        problema, solución, validación y demo
tests/               pruebas automatizadas
public/data/         GeoJSON y snapshot de respaldo
```

## 5. Flujo de consulta

1. El usuario selecciona una central y un período.
2. El cliente llama a `/api/telemetry?plant=...`.
3. El servidor valida sesión, central y rango de fechas.
4. `providers.ts` traduce fechas locales de Ecuador a la ventana UTC que espera CELEC.
5. Se consultan en paralelo energía, caudal, unidades activas y, para Coca Codo Sinclair, el KPI adicional de CENACE.
6. Las series se normalizan por timestamp y se conservan los valores `null`.
7. La respuesta incluye observaciones, unidades, fuentes, fecha de recuperación, advertencias y errores.
8. React renderiza tarjetas, series y estados de disponibilidad.

El rango está limitado a 31 días por consulta. La zona de negocio es `America/Guayaquil` y las fechas se expresan como `YYYY-MM-DD`.

## 6. Contratos de datos

`lib/data/types.ts` define los contratos principales:

- `Observation`: timestamp, energía en MWh, potencia compatible en MW, caudal en m³/s y unidades activas.
- `TelemetryResponse`: central, rango, observaciones, unidades, fuentes y advertencias.
- `ForecastObservation`: timestamp, caudal pronosticado y serie (`high_res` o `flow_avg`).
- `CcsThreeHourForecast`: estado, fechas, insumos, resultado, faltantes, validación y disclaimer.
- `SourceStatus`: disponibilidad de cada fuente (`available`, `unconfigured` o `unavailable`).

`lib/data/national-demand-types.ts` separa el snapshot de CENACE de la telemetría de centrales y expresa la demanda en MW.

## 7. Fuentes e integración

### CELEC

Se consumen endpoints ORDS utilizados por el portal de producción e hidrología. El catálogo mantiene códigos y `mrid` explícitos por central. El adaptador consulta energía, caudal y unidades activas y expone fallas parciales como advertencias.

La energía se conserva como MWh porque la fuente la etiqueta así; no se transforma automáticamente a MW. Los datos no publicados permanecen ausentes.

### GEOGLOWS

El forecast se configura por URL y por identificador de tramo. El parser acepta CSV o JSON, prioriza `high_res` y usa `flow_avg` como respaldo. El pronóstico se devuelve separado de la observación CELEC.

### INAMHI

Para Coca Codo Sinclair se solicitan cinco series: dos niveles y tres lluvias. El modelo sólo calcula una predicción si existe una hora con todos los valores y rezagos requeridos. Si falta un insumo, no se imputa una cifra artificial.

### CENACE

CENACE aporta un tablero HTML operativo. `cenace.ts` extrae métricas con Cheerio y puede utilizar un snapshot local de respaldo. La aplicación distingue el `dataAsOf` de CENACE del instante en que HidroVista recuperó la respuesta.

CENACE sirve para contexto nacional y contraste; no sustituye automáticamente una lectura CELEC cuando los valores difieren.

## 8. Predicción y validación

El modelo específico de Coca Codo Sinclair estima el caudal a tres horas:

```text
Q_CCS(t+3) = 219.53·H0719(t) + 115.85·H0728(t)
             - 7.86·M1124(t-9) + 42.80·M5247(t-6)
             + 0.50·M5124(t-6) - 47.79
```

La validación independiente documentada utilizó 215 pares:

| Método | MAE (m³/s) | RMSE (m³/s) | Sesgo (m³/s) | Pearson r |
| --- | ---: | ---: | ---: | ---: |
| Modelo CCS a 3 h | 38,63 | 64,46 | -30,70 | 0,935 |
| Persistencia `Q(t)` | 54,13 | 75,09 | 0,20 | 0,849 |

El modelo mejora el MAE frente a persistencia, pero su ventana de datos es limitada. La interfaz lo etiqueta como pronóstico con incertidumbre, no como garantía operativa.

## 9. Seguridad y disponibilidad

- La landing es pública; el dashboard requiere autenticación.
- `/api/telemetry` valida autenticación antes de consultar fuentes externas.
- Las respuestas de telemetría usan `Cache-Control: private, no-store` y varían por cookie.
- Las claves se toman de variables de entorno.
- Las fuentes se clasifican como `available`, `unconfigured` o `unavailable`.
- Una falla parcial puede conservar una respuesta útil; la UI muestra advertencias.
- Los fallos y ausencias nunca se convierten en valores numéricos.

## 10. Pruebas y verificación

Las pruebas utilizan fixtures locales para evitar depender de red. Cubren parsing y normalización de CELEC, forecast GEOGLOWS, snapshot CENACE y cobertura del mapa provincial.

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## 11. Limitaciones y evolución

- CENACE se consume como snapshot HTML operativo, no como API histórica JSON.
- La ventana pública de INAMHI es limitada y puede rotar.
- Los endpoints públicos pueden cambiar o publicar datos incompletos.
- Las cifras de CELEC y CENACE pueden tener períodos o definiciones diferentes.
- Un agente predictivo futuro debería consumir estas respuestas normalizadas, registrar cada predicción y comparar posteriormente forecast contra observación antes de producir alertas o métricas.

