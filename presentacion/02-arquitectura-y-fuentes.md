# Arquitectura, fuentes y metodología

## Arquitectura

```text
Usuario autenticado
        │
React + Vite ── Supabase Auth
        │
        ├── CELEC: telemetría por central
        ├── GEOGLOWS: pronósticos de caudal
        └── INAMHI: insumos del modelo CCS a 3 horas
```

El frontend consulta las fuentes cuando el usuario cambia de central o período. Para evitar solicitudes innecesarias, primero obtiene el resumen de las siete centrales y luego carga la telemetría detallada sólo para la central seleccionada.

## Fuentes y qué aporta cada una

| Fuente | Uso en HidroVista | Tipo de dato |
|---|---|---|
| CELEC | Producción, unidades, caudal y cota por central | JSON horario y agregados por período |
| CENACE | Contexto nacional y contraste conceptual | Tablero HTML/Plotly, no API JSON reutilizable |
| GEOGLOWS | Tendencia y pronóstico de caudal para centrales mapeadas | CSV de forecast |
| INAMHI | Niveles y lluvia usados en el modelo CCS | Datos horarios/precipitación |
| CELEC y Wikimedia/medios | Fotografías reales de las centrales | Imagen con atribución enlazada |

## Cómo se descubrieron los endpoints

Los portales oficiales no se trataron como una API de desarrolladores formal con contrato, SDK o documentación pública para integradores. Durante la investigación se usó una herramienta MCP de Chrome para inspeccionar las páginas oficiales, sus solicitudes de red y los datos cargados por el navegador.

- En CELEC se reconstruyeron las solicitudes JSON ORDS que usa el propio portal: rutas, `mrid`, fechas y ventanas UTC.
- En CENACE se comprobó que el tablero entrega el estado en el HTML y en llamadas Plotly embebidas; no apareció una API JSON/XHR histórica parametrizable.
- Los endpoints se consumen con cuidado, conservando unidades, fecha de corte y fuente. No se asume que cifras de CELEC y CENACE sean equivalentes.

## Reglas de interpretación

- `MWh` y `GWh` son energía acumulada; `MW` es potencia instantánea o de curva.
- El caudal se expresa en `m³/s` y la cota en `m s. n. m.`.
- La jornada diaria de CELEC se solicita en UTC y se presenta para Ecuador continental.
- Un valor `null` significa que la muestra aún no fue publicada; no se convierte a cero.

## Transparencia

Las fuentes, fotos y limitaciones se enlazan o explican en la interfaz. El sistema no guarda ni modifica datos de las instituciones fuente.
