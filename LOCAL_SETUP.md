# HidroVista: ejecución local

1. Copia `.env.example` a `.env.local` y asigna las credenciales del proyecto Supabase **Represas**.
2. En Supabase Auth configura `http://localhost:3000` como Site URL y agrega `http://localhost:3000/auth/confirm` y `http://localhost:3000/reset-password` a Redirect URLs.
3. Instala dependencias con `npm install` y ejecuta `npm run dev`.

La landing es pública. Registro, inicio de sesión, confirmación, recuperación de contraseña y el tablero usan Supabase Auth.

## Agente HidroVista

1. Aplica `supabase/migrations/20260805220000_agent_conversation_history.sql` únicamente al proyecto Supabase **Represas**.
2. Define `OPENAI_API_KEY` en el entorno del servidor o en `.env.local`. Nunca uses `NEXT_PUBLIC_OPENAI_API_KEY`.
3. Para incluir forecasts de caudal, configura `GEOGLOWS_FORECAST_URL` y los cinco `GEOGLOWS_REACH_ID_*` de [`.env.example`](.env.example). Para la estimación independiente de Coca Codo Sinclair a 3 horas, configura las cinco URLs `INAMHI_CCS_*_URL`.

Sin esas fuentes opcionales el agente sigue mostrando la telemetría CELEC y la demanda CENACE, e indicará explícitamente qué pronósticos no están disponibles.

## Datos y límites

- CELEC aporta telemetría de energía, caudal y unidades activas directamente desde los endpoints ORDS documentados. `CELEC_ORDS_BASE_URL` es opcional y sólo sirve para un proxy autorizado o pruebas.
- CENACE aporta el contexto nacional actual por distribuidora en MW; es un snapshot HTML preliminar, no una API histórica.
- Los datos no publicados se conservan como ausentes; nunca se convierten en cero.

La documentación de fuentes y metodología está en `presentacion/README.md`.
