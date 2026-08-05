# Guion de demo y pitch

## Pitch de 30 segundos

> HidroVista convierte información pública dispersa de las hidroeléctricas ecuatorianas en un tablero claro y autenticado. Unifica telemetría de CELEC, pronósticos de caudal y contexto técnico por central. Lo diferencial no es sólo mostrar números: distingue observación de predicción y explica sus límites, incluyendo un modelo de Coca Codo Sinclair validado contra datos reales.

## Demo de 3 minutos

1. **Acceso** — Iniciar sesión y explicar que el tablero está destinado a usuarios registrados.
2. **Panorama** — Mostrar las siete centrales, sus fotos reales y el total de energía del período.
3. **Filtro** — Cambiar de día a mes o histórico; explicar que cambia la consulta y evita pedir telemetría innecesaria.
4. **Detalle** — Abrir una central y mostrar energía, unidades, caudal, cota y gráfico.
5. **Predicción** — Abrir Coca Codo Sinclair: distinguir la curva GEOGLOWS del modelo CCS a 3 horas y mostrar la advertencia de incertidumbre.
6. **Trazabilidad** — Señalar la fuente de datos, fotografía y las reglas de unidades/UTC.

## Preguntas probables

### ¿Es una API oficial?

No es una API de desarrolladores publicada como producto. Las llamadas se identificaron al analizar el comportamiento de los portales oficiales con Chrome MCP. CELEC expone JSON que usa su propio frontend; CENACE no ofrece una API JSON histórica reutilizable.

### ¿Por qué confiar en la predicción?

No se pide confianza ciega. Se muestran fuente, horizonte y limitación. Para CCS, el modelo fue contrastado contra CELEC y superó la línea base de persistencia en el backtest documentado.

### ¿Qué sigue?

Alertas por umbral, registro de cada forecast para auditoría continua, comparación observado-vs-predicho y una capa de confianza explicable.
