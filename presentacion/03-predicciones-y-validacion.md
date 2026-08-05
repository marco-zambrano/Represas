# Predicciones y validación

## Pronósticos por central

HidroVista muestra pronósticos GEOGLOWS para Mazar, Paute-Molino, Sopladora, Minas San Francisco, Agoyán y Coca Codo Sinclair. La interfaz prioriza la serie `high_res` cuando está disponible y utiliza `flow_avg` como alternativa.

## Modelo adicional para Coca Codo Sinclair

Para CCS se calcula además un estimado de caudal a 3 horas usando niveles de los ríos Quijos y Salado, más lluvia con rezagos:

```text
Q_CCS(t+3) = 219.53·H0719(t) + 115.85·H0728(t)
             - 7.86·M1124(t-9) + 42.80·M5247(t-6)
             + 0.50·M5124(t-6) - 47.79
```

El frontend solicita los insumos de INAMHI, busca la última hora que tenga todos los valores necesarios y sólo produce el resultado cuando la ecuación está completamente alimentada. Si falta un insumo, no genera una cifra artificial.

## Evidencia de validación

La validación retrospectiva independiente, sobre 215 pares válidos entre el 6 y el 14 de julio de 2026, comparó la ecuación con el caudal observado CELEC de CCS:

| Método | MAE | RMSE | Sesgo | Pearson r |
|---|---:|---:|---:|---:|
| Ecuación CCS a 3 h | 38.63 m³/s | 64.46 m³/s | -30.70 m³/s | 0.935 |
| Persistencia `Q(t)` | 54.13 m³/s | 75.09 m³/s | +0.20 m³/s | 0.849 |

El modelo mejoró el MAE frente a persistencia en 28.6%. Esto justifica usarlo como señal de tendencia de corto plazo, no como garantía operativa. La interfaz lo etiqueta explícitamente como pronóstico.

## Principios responsables

- No se reentrenaron coeficientes ni se prometen valores exactos.
- La correlación no se presenta como causalidad.
- La ventana histórica pública de INAMHI es limitada; una validación continua requiere conservar diariamente los insumos y la observación posterior de CELEC.
