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

## 10. Agente conversacional

**Respuesta corta:** existe un solo agente LLM conversacional. Los módulos de contexto, resumen, enfoque y persistencia que lo rodean no son agentes adicionales: son código determinista de la aplicación.

`/dashboard/agente` es una vista cliente de página completa; no es un chatbot flotante. El cliente consulta rutas privadas de Next.js, que validan la sesión Supabase antes de leer o escribir historial y antes de llamar a OpenAI.

- `lib/agent/context.ts` recopila en paralelo telemetría y forecast de las cinco centrales más demanda CENACE. Reutiliza la telemetría ya descargada para no duplicar consultas CELEC.
- `lib/agent/summary.ts` convierte los datos en evidencia compacta: últimas observaciones, cambios porcentuales, horizonte de pronóstico, fuentes y advertencias. Los cambios son descriptivos y no representan alertas.
- `lib/agent/openai.ts` usa la API de Responses con `gpt-5.6-luna`, razonamiento bajo, contexto estructurado y un identificador de seguridad hash del usuario. La clave `OPENAI_API_KEY` solo se lee en servidor y las respuestas de OpenAI no se almacenan en la plataforma (`store: false`).
- La aplicación conserva el historial en `agent_conversations` y `agent_messages`; la evidencia del contexto se guarda junto con cada mensaje del asistente para mantener trazabilidad.

La migración `supabase/migrations/20260805220000_agent_conversation_history.sql` activa RLS. Los usuarios autenticados solo pueden acceder a conversaciones cuyo `user_id` coincide con `auth.uid()` y a mensajes pertenecientes a dichas conversaciones.

### 10.1 Composición y flujo real

La implementación no es multiagente. `lib/agent/openai.ts` realiza una única llamada al modelo `gpt-5.6-luna` mediante la API de Responses, con razonamiento `low`, `max_output_tokens: 1200`, `store: false` y un `safety_identifier` derivado mediante SHA-256 del usuario. No hay herramientas, handoffs, selección dinámica de agentes ni un bucle autónomo.

Los componentes que rodean al modelo tienen responsabilidades distintas:

- `lib/agent/context.ts` es un recolector determinista. Consulta en paralelo la telemetría CELEC de las cinco centrales y la demanda nacional CENACE; luego solicita el forecast de cada central reutilizando la telemetría ya obtenida.
- `lib/agent/summary.ts` es un transformador determinista. Conserva hasta 12 observaciones y hasta 12 muestras de forecast por central, calcula cambios porcentuales, clasifica la dirección del siguiente forecast y propaga fuentes, ausencias y advertencias.
- `lib/agent/focus.ts` es un filtro de presentación. Busca alias de centrales en la pregunta y en la respuesta y agrega `focusPlantIds` a la evidencia guardada. Esto solo decide qué se muestra en el panel de evidencia; el modelo sigue recibiendo el contexto de las cinco centrales.
- `lib/agent/validation.ts` valida el cuerpo de entrada, limita la pregunta a 2.000 caracteres y verifica el UUID de la conversación.
- `app/api/agent/*` contiene la capa HTTP y de persistencia. Valida sesión, crea o recupera conversaciones, guarda el mensaje del usuario, carga hasta 12 mensajes recientes, llama al modelo, guarda la respuesta y la evidencia usada.

El flujo por pregunta es:

```text
Usuario autenticado → /dashboard/agente → POST /api/agent/chat
  → validar sesión y entrada
  → guardar pregunta en Supabase
  → recopilar CELEC + GEOGLOWS + INAMHI/CCS + CENACE en servidor
  → resumir evidencia y cargar historial reciente
  → una llamada a OpenAI Responses
  → enfocar evidencia para la UI y guardar respuesta + evidencia JSON
  → renderizar Markdown, historial y fuentes
```

El modelo recibe instrucciones fijas en español, la evidencia serializada como `CONTEXTO_VERIFICADO`, el historial reciente y la pregunta actual. No consulta Internet ni llama directamente a las fuentes. La aplicación recopila primero los datos y el modelo únicamente redacta una respuesta analítica con base en ellos.

### 10.2 Alcance y límites

- CELEC aporta telemetría observada; los valores no publicados permanecen como `null`.
- GEOGLOWS aporta pronósticos si están configurados el endpoint y el identificador de tramo; puede quedar `unconfigured` o `unavailable`.
- INAMHI alimenta la estimación independiente de Coca Codo Sinclair a tres horas cuando están disponibles las cinco series requeridas; la estimación conserva su disclaimer.
- CENACE aporta el snapshot de demanda nacional y contexto preliminar. `dataAsOf` se conserva separado de `retrievedAt`.
- El agente puede comparar y explicar tendencias, pero no calcula una nueva predicción, no valida precisión histórica en línea, no emite alertas ni entrega instrucciones de despacho, seguridad u operación.
- La evidencia se guarda junto con cada respuesta del asistente, permitiendo reconstruir qué contexto vio la aplicación en ese turno. Las respuestas de OpenAI no se almacenan en OpenAI (`store: false`), pero sí se persiste el texto generado en el historial privado de Supabase.

## 11. Pruebas y verificación

Las pruebas utilizan fixtures locales para evitar depender de red. Cubren parsing y normalización de CELEC, forecast GEOGLOWS, snapshot CENACE, cobertura del mapa provincial, resumen de evidencia del agente y validación de solicitudes de chat.

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## 12. Limitaciones y evolución

- CENACE se consume como snapshot HTML operativo, no como API histórica JSON.
- La ventana pública de INAMHI es limitada y puede rotar.
- Los endpoints públicos pueden cambiar o publicar datos incompletos.
- Las cifras de CELEC y CENACE pueden tener períodos o definiciones diferentes.
- El agente actual analiza el contexto disponible en tiempo de consulta. Un componente predictivo futuro debería registrar forecasts y compararlos posteriormente contra observaciones antes de producir métricas de precisión.
