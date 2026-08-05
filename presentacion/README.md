# HidroVista — material de presentación

HidroVista es un tablero web para consultar el estado operativo de las principales centrales hidroeléctricas de Ecuador y entender la incertidumbre de sus pronósticos de caudal.

## Contenido

1. [Problema y solución](01-problema-solucion.md)
2. [Arquitectura, fuentes y metodología](02-arquitectura-y-fuentes.md)
3. [Predicciones y validación](03-predicciones-y-validacion.md)
4. [Guion de demo y pitch](04-guion-demo.md)

## Mensaje central

No basta con ver un número de generación: un operador o usuario necesita saber de qué central proviene, cuándo fue actualizado, qué significa su unidad y cuánta confianza merece una predicción. HidroVista reúne telemetría, contexto técnico y pronósticos con sus límites visibles.

## Alcance actual

El prototipo cubre Mazar, Paute-Molino, Sopladora, Minas San Francisco, Agoyán y Coca Codo Sinclair. El acceso está protegido con Supabase Auth; todos los usuarios autenticados ven el mismo tablero operativo.

> Las predicciones se presentan como estimaciones. Nunca deben interpretarse como una instrucción de operación ni como telemetría observada.
