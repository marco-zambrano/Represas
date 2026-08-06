# HidroVista: ejecución local

1. Copia `.env.example` a `.env.local` y asigna las credenciales del proyecto Supabase **Represas**.
2. En Supabase Auth configura `http://localhost:3000` como Site URL y agrega `http://localhost:3000/auth/confirm` y `http://localhost:3000/reset-password` a Redirect URLs.
3. Instala dependencias con `npm install` y ejecuta `npm run dev`.

La landing es pública. Registro, inicio de sesión, confirmación, recuperación de contraseña y el tablero usan Supabase Auth.

## Datos y límites

- CELEC aporta telemetría de energía, caudal y unidades activas directamente desde los endpoints ORDS documentados. `CELEC_ORDS_BASE_URL` es opcional y sólo sirve para un proxy autorizado o pruebas.
- CENACE aporta el contexto nacional actual por distribuidora en MW; es un snapshot HTML preliminar, no una API histórica.
- Los datos no publicados se conservan como ausentes; nunca se convierten en cero.

La documentación de fuentes y metodología está en `presentacion/README.md`.
