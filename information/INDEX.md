# Índice de información

| Archivo | Contenido |
|---|---|
| [ENDPOINTS.md](ENDPOINTS.md) | Resumen comparativo de las fuentes CELEC y CENACE: cobertura, unidades (MW, MWh, GWh, m³/s), uso recomendado y enlaces al detalle técnico. |
| [CELEC_ENDPOINTS.md](CELEC_ENDPOINTS.md) | API ORDS de CELEC: endpoints, códigos por central, `mrid` de unidades/caudal/cota, rango histórico, ejemplos `curl` y `fetch`, y notas de validación con CENACE. |
| [CENACE_ENDPOINTS.md](CENACE_ENDPOINTS.md) | Análisis de las cinco pestañas del tablero CENACE, campos, unidades, snapshots observados, estructura HTML/Plotly y la conclusión de que no expone un endpoint JSON histórico reutilizable. |
| [HIDROELECTRICAS_ECUADOR.md](HIDROELECTRICAS_ECUADOR.md) | Contexto y referencia sobre las hidroeléctricas de Ecuador incorporado al proyecto. |
| [PREDICTION_VALIDATION.md](PREDICTION_VALIDATION.md) | Backtest independiente de la ecuación de predicción de Coca Codo Sinclair descrita en `inu/PREDICTIONS.md`, contrastada contra caudales históricos de CELEC. |

## Material auxiliar no versionado

La carpeta `trash/` está ignorada por Git y conserva evidencia descargada y
scripts temporales de verificación, por ejemplo el HTML de CENACE, el bundle
de CELEC y los backtests de predicciones. No es parte de la aplicación ni de
la documentación de producto.
