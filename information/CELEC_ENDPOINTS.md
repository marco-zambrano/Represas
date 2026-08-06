# CELEC: API de producción e hidrología

Fuente web: `https://generacioncsr.celec.gob.ec/graficasproduccionCELEC/index`.
API base:

```text
https://generacioncsr.celec.gob.ec:8443/ords/csr
```

Se probaron los dos tipos del portal (**Producción** e **Hidrología**), los
cuatro períodos (diario, mensual, anual y multianual) y la exportación CSV.
El CSV no abre otro endpoint: descarga las series ya obtenidas por el
frontend. Las llamadas descritas devuelven JSON sin token de autenticación.

## Forma de las respuestas y fechas

```json
{
  "items": [
    {"loctimestamp":"2026-07-15T18:00:00Z", "valueedit":85.160367}
  ],
  "count": 24
}
```

- `loctimestamp`: instante UTC.
- `valueedit`: valor de la serie; `null` significa que esa muestra aún no fue
  publicada, no que el valor sea cero.
- El portal manda para un día ecuatoriano continental una ventana
  `06:00Z–05:00Z`. No hardcodear ese desplazamiento: conservar UTC y convertir
  en el cliente.
- Parámetros de las series por punto: `mrid`, `fechaInicio`, `fechaFin` y
  `fecha` (`dd/MM/yyyy HH:mm:ss`).

### Ejemplos de request y respuesta

Con `curl`, consultar la energía diaria de Mazar:

```bash
curl -G 'https://generacioncsr.celec.gob.ec:8443/ords/csr/sardommaz/mazEnerDia' \
  --data-urlencode 'fecha=15/07/2026 00:00:00'
```

La respuesta llega como JSON. Cada elemento es una muestra horaria en UTC y
el campo numérico es `valueedit`:

```json
{
  "items": [
    {"loctimestamp": "2026-07-15T06:00:00Z", "valueedit": 84.995527},
    {"loctimestamp": "2026-07-15T07:00:00Z", "valueedit": 84.996233}
  ],
  "count": 24,
  "hasMore": false
}
```

En JavaScript, consultar caudal de Mazar y extraer una serie para graficar:

```js
const params = new URLSearchParams({
  mrid: '30538', // caudal de Mazar
  fechaInicio: '2026-07-15T06:00:00.000Z',
  fechaFin: '2026-07-16T05:00:00.000Z',
  fecha: '15/07/2026 01:00:00',
});
const response = await fetch(
  `https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValues?${params}`,
);
const { items } = await response.json();
const serie = items
  .filter(({ valueedit }) => valueedit !== null)
  .map(({ loctimestamp, valueedit }) => ({ at: loctimestamp, caudalM3s: valueedit }));
```

Plantilla probada:

```text
GET /ords/csr/sardomcsr/pointValues?mrid={MRID}
  &fechaInicio=2026-07-15T06:00:00.000Z
  &fechaFin=2026-07-16T05:00:00.000Z
  &fecha=15/07/2026%2001:00:00
```

Ejemplo íntegro (unidades en línea de Mazar):

```text
https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValues?mrid=30503&fechaInicio=2026-07-15T06:00:00.000Z&fechaFin=2026-07-16T05:00:00.000Z&fecha=15/07/2026%2001:00:00
```

## Mapeo completo por central

`EnerDia` es la serie de energía/producción horaria que el portal rotula
**MWh**. Los tres `mrid` se consumen con la plantilla `pointValues` anterior.

| Central | Código de API | Energía diaria | Turbinas/unidades activas | Caudal (m³/s) | Cota (m s. n. m.) |
|---|---|---|---:|---:|---:|
| Mazar | `maz` | `/sardommaz/mazEnerDia?fecha={fecha}` | 30503 | 30538 | 30031 |
| Paute-Molino | `mol` | `/sardommol/molEnerDia?fecha={fecha}` | 44822 | 24811 | 24019 |
| Sopladora | `sop` | `/sardomsop/sopEnerDia?fecha={fecha}` | 90503 | 90537 | 90919 |
| Minas San Francisco | `msf` | `/sardommsf/msfEnerDia?fecha={fecha}` | 650503 | 650538 | 650919 |
| Agoyán | `ago` | `/sardomago/agoEnerDia?fecha={fecha}` | 140503 | 140537 | 140031 |
| Manduriacu | `man` | `/sardomman/manEnerDia?fecha={fecha}` | 110503 | 110537 | 110031 |
| Coca Codo Sinclair | `ccs` | `/sardomccs/ccsEnerDia?fecha={fecha}` | 100503 | 100037 | 100540 |

Ejemplo de una URL de caudal: cambiar sólo `mrid` por el de la tabla.

```text
https://generacioncsr.celec.gob.ec:8443/ords/csr/sardomcsr/pointValues?mrid=30538&fechaInicio=2026-07-15T06:00:00.000Z&fechaFin=2026-07-16T05:00:00.000Z&fecha=15/07/2026%2001:00:00
```

## Producción histórica

Cada código de central tiene el mismo conjunto de sufijos, con
`fecha=dd/MM/yyyy HH:mm:ss`:

| Período | Sufijo | Ejemplo de Mazar |
|---|---|---|
| Diario | `EnerDia` | `/sardommaz/mazEnerDia?fecha={fecha}` |
| Mensual | `EnerMes` | `/sardommaz/mazEnerMes?fecha={fecha}` |
| Anual | `EnerAnio` | `/sardommaz/mazEnerAnio?fecha={fecha}` |
| Multianual | `EnerAnios` | `/sardommaz/mazEnerAnios?fecha={fecha}` |

Los `EnerAnios` se consultaron con fecha 15-07-2026. Esta es la cobertura que
realmente respondió la API, no una estimación:

| Central / agregado | Muestras anuales | Primer registro | Último registro probado |
|---|---:|---:|---:|
| Mazar | 17 | 2010 | 2026 |
| Paute-Molino | 44 | 1983 | 2026 |
| Sopladora | 11 | 2016 | 2026 |
| Minas San Francisco | 9 | 2018 | 2026 |
| Agoyán | 11 | 2016 | 2026 |
| Manduriacu | 10 | 2017 | 2026 |
| Coca Codo Sinclair | 11 | 2016 | 2026 |
| CELEC Sur (agregado) | 44 | 1983 | 2026 |

Por tanto, el máximo histórico visible es **44 años calendario (1983–2026)**
para Paute-Molino. Las demás series comienzan según la incorporación de cada
central a este sistema. Al pedir un año futuro, la respuesta puede incluirlo
como posición del período con `null`; filtrar siempre por `valueedit != null`.

## Históricos de turbinas, caudal y cota

Para los mismos `mrid`, el frontend usa estos endpoints (con los cuatro
parámetros de la plantilla):

| Uso | Endpoint |
|---|---|
| Promedio mensual | `/sardomcsr/pointValuesMesAvg` |
| Promedio anual | `/sardomcsr/pointValuesAnioAvg` |
| Promedio multianual | `/sardomcsr/pointValuesAniosAvg` |
| Perfil horario mensual | `/sardomcsr/pointValuesMesH24` |
| Perfil horario anual | `/sardomcsr/pointValuesAnioH24` |
| Perfil horario multianual | `/sardomcsr/pointValuesAniosH24` |

La prueba de `pointValuesAniosAvg` confirmó que los puntos de caudal/cota de
Mazar empiezan en 2010; los de Paute-Molino en 1983; Sopladora y Agoyán en
2016; Minas San Francisco en 2018; y Manduriacu en 2017. La disponibilidad
debe comprobarse por `mrid`, pues la serie de unidades puede iniciar después
de caudal/cota (por ejemplo, Mazar y Paute-Molino: 2013 para unidades).

Ejemplo multianual, que devuelve una muestra por año calendario:

```bash
curl -G 'https://generacioncsr.celec.gob.ec:8443/ords/csr/sardommol/molEnerAnios' \
  --data-urlencode 'fecha=15/07/2026 00:00:00'
```

## Agregados CELEC Sur / cuenca Paute

No son una planta individual, pero aparecen en el portal:

```text
/ords/csr/sardomcsr/csrEnerDia?fecha={fecha}
/ords/csr/sardomcsr/csrEnerMes?fecha={fecha}
/ords/csr/sardomcsr/csrEnerAnio?fecha={fecha}
/ords/csr/sardomcsr/csrEnerAnios?fecha={fecha}

# Caudal de la cuenca del Paute (mrid 24812 usado por el frontend)
/ords/csr/sardomcsr/csrCaudCuenMesAvg
/ords/csr/sardomcsr/csrCaudCuenAnioAvg
/ords/csr/sardomcsr/csrCaudCuenAniosAvg
```

## Validación contra CENACE (15-07-2026)

La suma de las muestras no nulas de CELEC `EnerDia` a la hora de la prueba fue:
Mazar 1160.53, Paute-Molino 7872.65, Sopladora 4684.03, Minas San Francisco
1215.00 y Agoyán 1590.70 MWh. CENACE mostraba para esa fecha valores cercanos
pero no idénticos para las centrales comparables, y 16 026 MWh para Coca Codo
mientras el endpoint CELEC de Coca Codo respondió cero.

Conclusión: usar CENACE para contraste, pero **no** asumir equivalencia
numérica ni rellenar un cero de CELEC con el valor CENACE. Pueden diferir la
fecha de corte, el tratamiento SCADA/preliminar y la cobertura institucional.
