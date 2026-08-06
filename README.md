# HidroVista

HidroVista es un tablero web para explorar la operación hidroeléctrica de Ecuador a partir de fuentes públicas. Centraliza telemetría, caudal, energía, unidades activas, pronósticos hidrológicos y demanda eléctrica nacional en una interfaz autenticada.

El proyecto está pensado como una herramienta de visualización y apoyo al análisis. No sustituye los sistemas operativos oficiales ni debe utilizarse como una instrucción de despacho.

## Qué permite hacer

- Consultar el panorama de centrales hidroeléctricas.
- Seleccionar una central y revisar sus series observadas por día o por rango de hasta 31 días.
- Visualizar energía, caudal y unidades activas conservando las unidades publicadas por la fuente.
- Comparar observaciones de CELEC con pronósticos de caudal de GEOGLOWS.
- Consultar el pronóstico independiente de Coca Codo Sinclair a tres horas cuando existen todos sus insumos de INAMHI.
- Consultar la demanda nacional publicada por CENACE y su distribución por empresa eléctrica.
- Diferenciar datos observados, pronósticos, snapshots preliminares y datos no publicados.
- Usar registro, inicio de sesión, confirmación y recuperación de contraseña mediante Supabase Auth.

## Centrales incluidas

- Mazar
- Paute-Molino
- Sopladora
- Minas San Francisco
- Coca Codo Sinclair

## Fuentes de datos

| Fuente | Uso en la aplicación |
| --- | --- |
| CELEC | Energía, caudal y unidades activas por central mediante endpoints ORDS públicos. |
| CENACE | Snapshot de demanda nacional/distribuidoras y contexto de producción de Coca Codo Sinclair. |
| GEOGLOWS | Pronóstico de caudal por tramo de río. |
| INAMHI | Niveles y lluvia que alimentan el modelo de caudal de Coca Codo Sinclair. |

Las fuentes no se mezclan silenciosamente: cada respuesta conserva el origen, la fecha de consulta, la unidad y los avisos de disponibilidad. Un valor ausente se mantiene como `null`; no se convierte en cero.

## Requisitos

- Node.js compatible con el proyecto.
- npm.
- Un proyecto de Supabase con Auth habilitado.
- Variables de entorno de Supabase.
- Opcionalmente, URLs configuradas para GEOGLOWS e INAMHI.

## Ejecución local

1. Instala las dependencias:

   ```bash
   npm install
   ```

2. Copia `.env.example` como `.env.local` y configura:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   CELEC utiliza su endpoint público por defecto. Solo configura `CELEC_ORDS_BASE_URL` si necesitas un proxy autorizado o un entorno de pruebas. Las variables opcionales de GEOGLOWS e INAMHI están descritas en [`.env.example`](.env.example) y en [`LOCAL_SETUP.md`](LOCAL_SETUP.md).

3. En Supabase Auth configura `http://localhost:3000` como Site URL y agrega:

   - `http://localhost:3000/auth/confirm`
   - `http://localhost:3000/reset-password`

4. Inicia el servidor:

   ```bash
   npm run dev
   ```

5. Abre [http://localhost:3000](http://localhost:3000).

La landing es pública. El registro, inicio de sesión y dashboard requieren autenticación.

## Scripts

```bash
npm run dev        # servidor de desarrollo
npm run build      # compilación de producción
npm run start      # servidor de producción
npm run lint       # ESLint
npm run typecheck  # TypeScript sin emitir archivos
npm test           # pruebas con Node Test Runner y tsx
```

## Rutas principales

- `/` — landing pública.
- `/login` — inicio de sesión.
- `/register` — registro.
- `/forgot-password` — recuperación de contraseña.
- `/dashboard` — panorama hidroeléctrico.
- `/dashboard/demanda-nacional` — demanda nacional y mapa por áreas.
- `/dashboard/agente` — chat privado con análisis contextual de las cinco centrales.
- `/api/telemetry` — telemetría y pronósticos para una central autenticada.
- `/api/national-demand` — snapshot de demanda de CENACE.
- `/api/agent/conversations` — historial de conversaciones autenticadas.
- `/api/agent/chat` — respuesta del Agente HidroVista con evidencia actual.

## Modelo de Coca Codo Sinclair

Cuando INAMHI publica todos los insumos requeridos, HidroVista calcula un pronóstico de caudal a tres horas usando niveles de los ríos Quijos y Salado y lluvias con rezagos. La validación retrospectiva documentada contiene 215 pares válidos:

- MAE: `38,63 m³/s`
- RMSE: `64,46 m³/s`
- Sesgo: `-30,70 m³/s`
- Correlación de Pearson: `0,935`

El resultado se presenta como señal de tendencia con incertidumbre, no como telemetría ni como valor operativo garantizado. El detalle metodológico está en [`information/PREDICTION_VALIDATION.md`](information/PREDICTION_VALIDATION.md).

## Agente HidroVista

La sección **Agente HidroVista** permite conversar sobre el estado actual de Mazar, Paute-Molino, Sopladora, Minas San Francisco y Coca Codo Sinclair, sus pronósticos de caudal y la demanda nacional.

- Conserva conversaciones por usuario mediante Supabase y políticas RLS.
- Consulta las fuentes actuales en cada respuesta y guarda la evidencia estructurada empleada.
- Distingue telemetría CELEC, forecast GEOGLOWS, estimación INAMHI de Coca Codo Sinclair y snapshot CENACE.
- No emite alertas ni instrucciones operativas; comunica datos ausentes y limitaciones de fuente.

Para habilitarlo localmente, define `OPENAI_API_KEY` en `.env.local`. Es una variable exclusiva del servidor: nunca debe llevar el prefijo `NEXT_PUBLIC_` ni subirse al repositorio. Antes de usar el historial, aplica [`supabase/migrations/20260805220000_agent_conversation_history.sql`](supabase/migrations/20260805220000_agent_conversation_history.sql) al proyecto Supabase **Represas**.

## Documentación

- [`TECHNICAL_CONTEXT.md`](TECHNICAL_CONTEXT.md) — arquitectura, tecnologías, flujo de datos, modelos y decisiones técnicas.
- [`LOCAL_SETUP.md`](LOCAL_SETUP.md) — configuración local y límites conocidos.
- [`information/INDEX.md`](information/INDEX.md) — índice de documentación de fuentes y endpoints.
- [`presentacion/`](presentacion/) — problema, solución, arquitectura, validación y guion de demostración.

## Limitaciones conocidas

- CENACE publica en este flujo un snapshot HTML operativo; no se trata como una API histórica JSON.
- La disponibilidad y ventana histórica de INAMHI es limitada.
- Los endpoints públicos pueden cambiar, quedar temporalmente fuera de servicio o publicar datos incompletos.
- Las cifras de CELEC y CENACE pueden representar períodos, definiciones o cortes distintos; no se sustituyen unas por otras automáticamente.
- Coca Codo Sinclair se trata como una central a filo de agua en la interfaz actual; no se infiere una cota de embalse donde la fuente no la publica.

## Estado del proyecto

Prototipo funcional orientado a demostración y análisis exploratorio. Incluye un agente conversacional con historial privado y evidencia por respuesta; una evolución futura podría registrar forecasts y observaciones históricas para validación continua.
