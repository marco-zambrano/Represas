# Validación retrospectiva de predicciones

## Alcance

Se analizó `/home/zezenta/Desktop/Coding/inu/PREDICTIONS.md` y se ejecutó una
prueba independiente de la ecuación de **Coca Codo Sinclair (CCS) a 3 horas**.
Es el único modelo del documento que puede reproducirse íntegramente con las
fuentes históricas aún expuestas por INAMHI y CELEC.

No se reentrenó ningún coeficiente. Se usó literalmente la ecuación publicada:

```text
Q_CCS(t+3) = 219.53·H0719(t) + 115.85·H0728(t)
             - 7.86·M1124(t-9) + 42.80·M5247(t-6)
             + 0.50·M5124(t-6) - 47.79
```

## Método de backtest

1. Para cada hora de emisión `t`, se tomaron exclusivamente nivel de Quijos
   (H0719), nivel de Salado (H0728) y las lluvias requeridas con sus lags.
2. Se calculó la predicción para `t + 3 h`.
3. Sólo después se contrastó contra `pointValues?mrid=100037` de CELEC, el
   caudal observado de CCS en la hora objetivo.
4. Como línea base, se predijo el valor de `t + 3 h` usando simplemente el
   caudal real de la hora `t` (persistencia).

La muestra disponible fue del 06 al 14 de julio de 2026; incluye **215 pares
válidos**. La limitación temporal viene de INAMHI: el endpoint público expone
una ventana rodante de datos recientes y no aceptó una consulta histórica
arbitraria con fecha explícita.

## Resultado

| Método | N | MAE (m³/s) | RMSE (m³/s) | Sesgo (m³/s) | Pearson r |
|---|---:|---:|---:|---:|---:|
| Ecuación de `PREDICTIONS.md` | 215 | 38.63 | 64.46 | -30.70 | 0.935 |
| Persistencia `Q(t)` | 215 | 54.13 | 75.09 | +0.20 | 0.849 |

El caudal real promedio de la muestra fue 475.01 m³/s. Por tanto, el MAE del
modelo equivale a **8.13%** del promedio y mejora el MAE de persistencia en
**28.6%**. El resultado respalda que la predicción es útil para tendencia y
corto plazo, pero no para prometer una cifra exacta: el peor error de la
muestra fue 266.12 m³/s en la predicción emitida 2026-07-12 17:00Z para el
objetivo 20:00Z.

## Comparación con lo afirmado en el documento fuente

`PREDICTIONS.md` reporta MAE 27.2 m³/s y `r=0.939`. La reproducción obtuvo
una correlación prácticamente igual (`r=0.935`), pero un MAE mayor (38.63
m³/s). Esto es razonable para una ventana distinta y corta; no demuestra ni
refuta por sí solo el MAE original. Para certificar el valor publicado se
necesita el dataset de entrenamiento/validación original y una separación
temporal explícita entre entrenamiento y prueba.

## Conclusión operativa

La ecuación CCS supera de forma clara a usar el último caudal conocido y sí
resulta cercana al histórico CELEC en el horizonte de 3 horas. Debe mostrarse
como **pronóstico con incertidumbre**, no como telemetría. Para producir una
validación continua, conservar diariamente los insumos de INAMHI y el valor
posterior de CELEC antes de que la ventana pública rote.

## Evidencia reproducible

Los archivos no versionados en `trash/` son:

- `backtest_ccs_predictions.py`: implementación del backtest.
- `ccs_backtest_predictions_2026-07.csv`: 215 predicciones y observaciones.
- `ccs_backtest_predictions_2026-07.metrics.txt`: métricas calculadas.

El script usa `verify=False` a nivel de contexto SSL únicamente porque las
fuentes públicas analizadas presentan una cadena de certificado no confiable
para el entorno local. No reutilizar esa práctica para servicios propios.
