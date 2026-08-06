# CENACE: contenido del tablero de Información Operativa

Página analizada:
`https://www.cenace.gob.ec/info-operativa/InformacionOperativa.htm`.

## Resultado de red

Se accionaron las cinco pestañas y se revisó la red. No se generaron
solicitudes `fetch` ni XHR; tampoco hay un endpoint JSON, CSV o API pública
descubierto desde este tablero. La página HTTP entrega todo el estado visible
en el propio HTML: tarjetas, datos Plotly y curvas. Plotly se carga desde CDN,
pero los valores no vienen desde Plotly.

En consecuencia, la URL de la página es un **snapshot HTML actual**, no una
API histórica parametrizable. Se puede descargar/parsing el documento, pero
no pedir por URL otra fecha, central o período. CENACE rotula los datos SCADA
como preliminares y sujetos a revisión/validación.

### Ejemplo de request y formato recibido

```bash
curl -L 'https://www.cenace.gob.ec/info-operativa/InformacionOperativa.htm' \
  -o cenace.html
```

El resultado es **HTML**, no JSON. Las cinco pestañas están en el mismo
documento; los botones sólo cambian cuál bloque `.tab-content` se muestra.
Los números de las tarjetas se ven como HTML y las series están embebidas en
llamadas `Plotly.newPlot`, por ejemplo:

```html
<h3>PRODUCCIÓN ENERGÉTICA (MWh)</h3>
<div class="valor">61 688</div>
<script>
  Plotly.newPlot("…", [{"name":"Hidráulica", "x":["00:00","00:30"], "y":[…]}], …)
</script>
```

No hay una llamada equivalente a `fetch(...).json()` para esta página. Si se
automatiza su lectura, hay que parsear el HTML (tarjetas) o extraer los datos
de Plotly desde el DOM; tratarlo como captura actual, no como servicio de
consulta histórica.

## Pestañas y datos disponibles

| Pestaña | Fecha/corte observado | Totales | Unidad de energía | Curvas |
|---|---|---|---|---|
| Producción tiempo real | 15-07-2026 | Producción total, hidráulica, térmica, renovable, importación, exportación; detalle por hidroeléctrica | MWh | Generación, demanda nacional y composición por fuente en MW; puntos de 30 min en el HTML |
| Demanda tiempo real | 15-07-2026 | Demanda total, demanda anterior, CNEL, resto de empresas | No es energía: MW | Demanda por empresa/distribuidora en MW |
| Información operativa diaria | 14-07-2026 | Misma desagregación de producción y detalle hidro | MWh | Generación/demanda por fuente en MW |
| Acumulada mensual | Julio 2026 hasta 14-07 | Misma desagregación de producción y detalle hidro | MWh | Curva MW y fecha de demanda máxima mensual |
| Acumulada anual | 2026 hasta 14-07 | Misma desagregación de producción y detalle hidro | GWh | Curva MW y fecha de demanda máxima histórica |

La distinción esencial es: **MWh/GWh son energía acumulada del período**;
**MW es potencia instantánea o de la curva**. La página no ofrece cota,
caudal ni conteo de turbinas activas.

## Producción: campos comunes

Las cuatro pestañas de producción muestran las tarjetas:

- Producción total
- Hidráulica
- Térmica
- R. no convencional / renovable
- Importación y exportación

El detalle gráfico separa hidroeléctrica, térmica y renovable. En el bloque
hidro clasifica, según período, las principales centrales: **Coca Codo,
Paute, Sopladora, Delsitanisagua, San Francisco, Agoyán, Minas San Francisco,
Mazar** y, en varias vistas, **Otras Hidro**. CENACE no incluye en ese gráfico
un identificador técnico equivalente al `mrid` de CELEC.

La curva superpone demanda nacional, producción total, hidráulica, térmica,
renovable, importación y exportación. El HTML observado usa una resolución de
30 minutos (`00:00`, `00:30`, …, `23:30`) aunque el eje muestra las horas.

## Snapshot documentado (capturado 15-07-2026)

Estos valores sirven para entender los contenidos de cada pestaña; cambian al
recargar el documento.

### Producción tiempo real — 15-07-2026 — MWh

| Campo | Valor |
|---|---:|
| Producción total | 61 688 |
| Hidráulica | 45 397 |
| Térmica | 15 501 |
| R. no convencional | 662 |
| Exportación | 40 |
| Importación | 38 |

Hidro destacada: Coca Codo 16 026; Paute 8 241; Sopladora 4 582;
Delsitanisagua 2 238; San Francisco 2 202; Agoyán 1 598; Minas San Francisco
1 164; Mazar 1 151 MWh.

### Demanda tiempo real — 15-07-2026 — MW

| Campo | Valor |
|---|---:|
| Demanda total | 4 953 |
| Anterior | 4 824 |
| Demanda CNEL | 3 596 |
| Empresas eléctricas | 1 357 |

Incluye demanda individual de 19 distribuidoras/SNI: EMELNORTE, E.E. Regional
Sur, E.E. Quito, CNEL Los Ríos, CNEL El Oro, ELEPCO, E.E. Riobamba, CNEL
Bolívar, CNEL Manabí, E.E. Ambato, CNEL Esmeraldas, CNEL Santa Elena, CNEL
Guayaquil, CNEL Milagro, CNEL Santo Domingo, CNEL Sucumbíos, E.E. Centro Sur,
E.E. Azogues y CNEL Guayas Los Ríos. La tabla/gráfico entrega MW y porcentaje
de demanda total para cada una.

### Información operativa diaria — 14-07-2026 — MWh

| Campo | Valor |
|---|---:|
| Producción total | 109 313 |
| Hidráulica | 82 415 |
| Térmica | 24 229 |
| R. no convencional | 2 568 |
| Exportación | 104 |
| Importación | 101 |

Hidro destacada: Minas San Francisco 27 880; Mazar 15 762; Agoyán 14 704;
Delsitanisagua 8 496; San Francisco 4 262; Sopladora 3 546; Paute 3 114;
Otras Hidro 2 487; Coca Codo 2 164 MWh.

### Acumulada mensual — julio de 2026 hasta 14-07 — MWh

| Campo | Valor |
|---|---:|
| Producción total | 1 489 582 |
| Hidráulica | 1 260 918 |
| Térmica | 201 878 |
| R. no convencional | 25 141 |
| Exportación | 1 633 |
| Importación | 1 645 |

Hidro destacada: Delsitanisagua 369 461; Mazar 285 302; Agoyán 230 129;
Minas San Francisco 144 441; San Francisco 66 052; Sopladora 49 403; Otras
Hidro 49 304; Paute 35 358; Coca Codo 31 467 MWh. Informa además que la
demanda máxima mensual fue el miércoles 01-07-2026.

### Acumulada anual — 2026 hasta 14-07 — GWh

| Campo | Valor |
|---|---:|
| Producción total | 19 776 |
| Hidráulica | 15 306 |
| Térmica | 4 187 |
| R. no convencional | 143 |
| Exportación | 19 |
| Importación | 139 |

Hidro destacada: Mazar 4 298; Agoyán 3 940; Delsitanisagua 2 796; San
Francisco 1 404; Minas San Francisco 732; Sopladora 685; Paute 560; Otras
Hidro 508; Coca Codo 384 GWh. La pestaña marca como demanda máxima histórica
el martes 30-06-2026.

## Consistencia frente a CELEC

La comparación directa es sólo una comprobación de plausibilidad, no una
unión de datasets. En la fecha de prueba, Mazar, Paute-Molino, Sopladora,
Minas San Francisco y Agoyán resultaron cercanos entre las fuentes, pero no
iguales; Coca Codo fue una discrepancia material. CENACE también contiene
Delsitanisagua y Otras Hidro, que no están en el conjunto de endpoints de
este portal CELEC.

Para una aplicación: mostrar el origen de cada número, usar CENACE para el
panorama nacional y CELEC para telemetría/variables hidráulicas por central.
