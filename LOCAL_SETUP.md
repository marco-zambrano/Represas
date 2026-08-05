# HidroVista: ejecución local

1. Copia `.env.example` a `.env.local` y asigna las credenciales del proyecto Supabase **Represas**.
2. En Supabase Auth configura `http://localhost:3000` como Site URL y agrega `http://localhost:3000/auth/confirm` y `http://localhost:3000/reset-password` a Redirect URLs.
3. Instala dependencias con `npm install` y ejecuta `npm run dev`.

La landing es pública. Registro, inicio de sesión, confirmación, recuperación de contraseña y el tablero usan Supabase Auth.

## Datos y límites

- CELEC aporta telemetría de generación, caudal, cota y unidades activas. Define `CELEC_TELEMETRY_URL` con la ruta pública autorizada antes de esperar muestras reales; la aplicación la consulta desde una ruta interna autenticada.
- GEOGLOWS se usa para pronósticos de caudal cuando se configuren identificadores de tramo. INAMHI provee los insumos del cálculo a 3 horas de Coca Codo Sinclair.
- CENACE aporta contexto nacional. Los pronósticos no son instrucciones operativas y se diferencian visualmente de las observaciones.
- Los datos no publicados se conservan como ausentes; nunca se convierten en cero.

La documentación de fuentes y metodología está en `presentacion/README.md`.
