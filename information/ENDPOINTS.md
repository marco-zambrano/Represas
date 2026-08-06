# Fuentes para el visualizador hidroeléctrico

Este directorio separa el detalle técnico por fuente:

- [CELEC_ENDPOINTS.md](CELEC_ENDPOINTS.md): API JSON/ORDS reutilizable para
  centrales de CELEC. Es la fuente para **series por central**, **unidades
  activas**, **caudal**, **cota** y datos históricos (desde 1983 en el caso
  más antiguo).
- [CENACE_ENDPOINTS.md](CENACE_ENDPOINTS.md): contenido que entrega el tablero
  nacional de CENACE. No expone una API JSON/XHR en esta página: los datos
  viajan embebidos en el HTML y Plotly.

## Qué da cada fuente

| Fuente | Cobertura | Unidades y granularidad | Campos hidroeléctricos |
|---|---|---|---|
| CELEC | Centrales operadas por CELEC: Mazar, Paute-Molino, Sopladora, Minas San Francisco, Agoyán, Manduriacu y Coca Codo Sinclair; además agregado CELEC Sur | Respuesta horaria con `valueedit`; la gráfica de energía se rotula **MWh**. Vistas diaria, mensual, anual y multianual. | Energía por central; conteo de unidades/turbinas en línea; caudal **m³/s**; cota **m s. n. m.** |
| CENACE | Sistema eléctrico nacional (SNI): generación por tecnología, demanda nacional/distribuidoras, importación y exportación. Incluye una clasificación de las principales hidroeléctricas. | Producción en **MWh** en tiempo real, diaria y acumulada mensual; acumulada anual en **GWh**. Curvas de generación y demanda en **MW** (media hora en el HTML analizado). | Producción agregada por hidroeléctrica, pero **no** cota, caudal ni unidades activas. |

## Decisión práctica

Para el mapa de embalses y estado de plantas, usar CELEC como fuente primaria.
Usar CENACE como tablero nacional y contraste contextual. No mezclar los
valores sin etiquetar fuente, fecha de corte y unidad: las fuentes tienen
cobertura, hora de actualización y agregación distintas.

Las pruebas y la captura HTML auxiliar viven en `trash/`; no forman parte de
la integración de la aplicación.

Los ejemplos copiables de request y los formatos exactos de respuesta están
en las secciones «Ejemplos de request y respuesta» de los dos documentos
técnicos.
