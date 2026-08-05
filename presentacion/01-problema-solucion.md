# Problema y solución

## Problema

La información pública de generación hidroeléctrica está fragmentada: una fuente muestra curvas y totales nacionales, otra expone series por central, y los datos hidrológicos y de pronóstico provienen de sistemas distintos. Esto dificulta responder preguntas simples: ¿qué central está generando?, ¿cómo está su caudal?, ¿qué se espera en las próximas horas?, ¿qué tan confiable es esa respuesta?

## Solución: HidroVista

Una aplicación React autenticada que centraliza la consulta por central y período:

- energía generada, unidades activas, caudal y cota;
- períodos diario, mensual, anual e histórico;
- fotografía y contexto de cada instalación;
- pronóstico de caudal y separación visual entre valor observado y estimado;
- estado de carga, fuente y limitaciones de datos.

## Usuarios

- Personal técnico que necesita una lectura rápida por central.
- Analistas que comparan series de caudal y generación.
- Público interesado en entender la operación hidroeléctrica nacional.

## Diferenciadores de hackathon

1. Convierte fuentes públicas difíciles de usar en una experiencia unificada.
2. No disfraza la incertidumbre: etiqueta pronósticos, fuentes y cobertura.
3. Usa un modelo de corto plazo validado de forma independiente para Coca Codo Sinclair.
4. Está listo para demostrarse sin infraestructura propia de datos: el navegador consulta las fuentes disponibles directamente.

## Métricas de éxito

- Una persona autenticada identifica la central, su caudal y producción en menos de un minuto.
- Cada cifra conserva unidad, fecha/período y procedencia.
- Las predicciones futuras se distinguen claramente de la telemetría CELEC.
