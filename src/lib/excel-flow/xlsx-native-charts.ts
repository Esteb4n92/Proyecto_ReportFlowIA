// Inyección de gráficos NATIVOS de Excel en un workbook generado por exceljs.
//
// exceljs (v4) no soporta crear gráficos. Para que el analista reciba gráficos
// editables (que se actualizan al cambiar los datos), generamos las tablas con
// exceljs y luego post-procesamos el .xlsx (que es un zip OOXML) inyectando las
// partes DrawingML: xl/charts/chartN.xml + xl/drawings/drawing1.xml + sus rels
// + la referencia <drawing> en la hoja + los Override en [Content_Types].xml.
import JSZip from 'jszip'

export type NativeChartType = 'bar' | 'line' | 'pie' | 'area' | 'scatter'

export interface NativeChartSeries {
  /** referencia a la celda con el nombre de la serie, ej. "'Gráficos'!$B$3" */
  nameRef: string
  /** referencia al rango de valores (eje Y), ej. "'Gráficos'!$B$4:$B$8" */
  valRef: string
  /** referencia al rango del eje X (solo 'scatter'), ej. "'Gráficos'!$A$4:$A$8" */
  xRef?: string
  /** color de la serie en hex sin '#', ej. "3B82F6" */
  color: string
}

export interface NativeChartSpec {
  type: NativeChartType
  title: string
  /** referencia al rango de categorías (eje X / etiquetas) */
  catRef: string
  series: NativeChartSeries[]
  /** colores por categoría (solo pie), hex sin '#' */
  pointColors?: string[]
  /** anclaje en la hoja, en índices 0-based de columna/fila */
  anchor: { fromCol: number; fromRow: number; toCol: number; toRow: number }
}

const C_NS = 'http://schemas.openxmlformats.org/drawingml/2006/chart'
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const XDR_NS = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing'
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function seriesXml(s: NativeChartSeries, idx: number, catRef: string, withColorAsLine: boolean): string {
  const fill = `<c:spPr>${
    withColorAsLine
      ? `<a:ln w="28575"><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill></a:ln>`
      : `<a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill>`
  }</c:spPr>`
  const marker = withColorAsLine ? '<c:marker><c:symbol val="none"/></c:marker>' : ''
  return (
    `<c:ser>` +
    `<c:idx val="${idx}"/><c:order val="${idx}"/>` +
    `<c:tx><c:strRef><c:f>${esc(s.nameRef)}</c:f></c:strRef></c:tx>` +
    fill +
    marker +
    `<c:cat><c:strRef><c:f>${esc(catRef)}</c:f></c:strRef></c:cat>` +
    `<c:val><c:numRef><c:f>${esc(s.valRef)}</c:f></c:numRef></c:val>` +
    `</c:ser>`
  )
}

function pieSeriesXml(s: NativeChartSeries, catRef: string, pointColors: string[]): string {
  const dPts = pointColors
    .map(
      (color, i) =>
        `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/>` +
        `<c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></c:spPr></c:dPt>`
    )
    .join('')
  return (
    `<c:ser><c:idx val="0"/><c:order val="0"/>` +
    `<c:tx><c:strRef><c:f>${esc(s.nameRef)}</c:f></c:strRef></c:tx>` +
    dPts +
    `<c:cat><c:strRef><c:f>${esc(catRef)}</c:f></c:strRef></c:cat>` +
    `<c:val><c:numRef><c:f>${esc(s.valRef)}</c:f></c:numRef></c:val>` +
    `</c:ser>`
  )
}

// Serie de dispersión: marcadores en pares X/Y, sin línea.
function scatterSeriesXml(s: NativeChartSeries, idx: number): string {
  return (
    `<c:ser>` +
    `<c:idx val="${idx}"/><c:order val="${idx}"/>` +
    `<c:tx><c:strRef><c:f>${esc(s.nameRef)}</c:f></c:strRef></c:tx>` +
    `<c:spPr><a:ln w="19050"><a:noFill/></a:ln></c:spPr>` +
    `<c:marker><c:symbol val="circle"/><c:size val="6"/>` +
    `<c:spPr><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr></c:marker>` +
    `<c:xVal><c:numRef><c:f>${esc(s.xRef ?? s.valRef)}</c:f></c:numRef></c:xVal>` +
    `<c:yVal><c:numRef><c:f>${esc(s.valRef)}</c:f></c:numRef></c:yVal>` +
    `</c:ser>`
  )
}

function plotXml(spec: NativeChartSpec): string {
  const catAx =
    `<c:catAx><c:axId val="111"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
    `<c:delete val="0"/><c:axPos val="b"/><c:crossAx val="222"/></c:catAx>`
  const valAx =
    `<c:valAx><c:axId val="222"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
    `<c:delete val="0"/><c:axPos val="l"/><c:crossAx val="111"/></c:valAx>`

  if (spec.type === 'pie') {
    const colors = spec.pointColors ?? spec.series.map((s) => s.color)
    return (
      `<c:plotArea><c:layout/><c:pieChart><c:varyColors val="1"/>` +
      pieSeriesXml(spec.series[0], spec.catRef, colors) +
      `<c:firstSliceAng val="0"/></c:pieChart></c:plotArea>`
    )
  }

  if (spec.type === 'scatter') {
    const sers = spec.series.map((s, i) => scatterSeriesXml(s, i)).join('')
    // ambos ejes son numéricos (valAx), no categórico
    const xAx =
      `<c:valAx><c:axId val="111"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
      `<c:delete val="0"/><c:axPos val="b"/><c:crossAx val="222"/></c:valAx>`
    const yAx =
      `<c:valAx><c:axId val="222"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
      `<c:delete val="0"/><c:axPos val="l"/><c:crossAx val="111"/></c:valAx>`
    return (
      `<c:plotArea><c:layout/><c:scatterChart><c:scatterStyle val="marker"/><c:varyColors val="0"/>` +
      sers +
      `<c:axId val="111"/><c:axId val="222"/></c:scatterChart>` +
      xAx +
      yAx +
      `</c:plotArea>`
    )
  }

  if (spec.type === 'line') {
    const sers = spec.series.map((s, i) => seriesXml(s, i, spec.catRef, true)).join('')
    return (
      `<c:plotArea><c:layout/><c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>` +
      sers +
      `<c:marker val="1"/><c:axId val="111"/><c:axId val="222"/></c:lineChart>` +
      catAx +
      valAx +
      `</c:plotArea>`
    )
  }

  if (spec.type === 'area') {
    const sers = spec.series.map((s, i) => seriesXml(s, i, spec.catRef, false)).join('')
    return (
      `<c:plotArea><c:layout/><c:areaChart><c:grouping val="standard"/><c:varyColors val="0"/>` +
      sers +
      `<c:axId val="111"/><c:axId val="222"/></c:areaChart>` +
      catAx +
      valAx +
      `</c:plotArea>`
    )
  }

  // bar
  const sers = spec.series.map((s, i) => seriesXml(s, i, spec.catRef, false)).join('')
  return (
    `<c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>` +
    sers +
    `<c:gapWidth val="60"/><c:axId val="111"/><c:axId val="222"/></c:barChart>` +
    catAx +
    valAx +
    `</c:plotArea>`
  )
}

// El title va dentro de <c:chart> antes de <c:plotArea>; lo componemos acá
function fullChartXml(spec: NativeChartSpec): string {
  const title =
    `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1100" b="1"/></a:pPr>` +
    `<a:r><a:rPr lang="es" sz="1100" b="1"/><a:t>${esc(spec.title)}</a:t></a:r></a:p>` +
    `</c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`
  const legend = `<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>`
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<c:chartSpace xmlns:c="${C_NS}" xmlns:a="${A_NS}" xmlns:r="${R_NS}">` +
    `<c:chart>` +
    title +
    plotXml(spec) +
    legend +
    `<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>` +
    `</c:chart></c:chartSpace>`
  )
}

function anchorXml(spec: NativeChartSpec, relId: string, frameId: number): string {
  const a = spec.anchor
  return (
    `<xdr:twoCellAnchor editAs="oneCell">` +
    `<xdr:from><xdr:col>${a.fromCol}</xdr:col><xdr:colOff>0</xdr:colOff>` +
    `<xdr:row>${a.fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
    `<xdr:to><xdr:col>${a.toCol}</xdr:col><xdr:colOff>0</xdr:colOff>` +
    `<xdr:row>${a.toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
    `<xdr:graphicFrame macro="">` +
    `<xdr:nvGraphicFramePr><xdr:cNvPr id="${frameId}" name="Gráfico ${frameId}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
    `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>` +
    `<a:graphic><a:graphicData uri="${C_NS}">` +
    `<c:chart xmlns:c="${C_NS}" xmlns:r="${R_NS}" r:id="${relId}"/>` +
    `</a:graphicData></a:graphic>` +
    `</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`
  )
}

function drawingXml(specs: NativeChartSpec[]): string {
  const anchors = specs.map((spec, i) => anchorXml(spec, `rId${i + 1}`, i + 2)).join('')
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<xdr:wsDr xmlns:xdr="${XDR_NS}" xmlns:a="${A_NS}">` +
    anchors +
    `</xdr:wsDr>`
  )
}

function drawingRelsXml(specs: NativeChartSpec[]): string {
  const rels = specs
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="${R_NS}/chart" Target="../charts/chart${i + 1}.xml"/>`
    )
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PKG_REL_NS}">${rels}</Relationships>`
}

/**
 * Inyecta gráficos nativos en el buffer de un .xlsx generado por exceljs.
 * @param buffer  workbook serializado (writeBuffer)
 * @param sheetFile  nombre del archivo de la hoja destino, ej. "sheet2.xml"
 * @param specs  gráficos a insertar en esa hoja
 */
export async function injectNativeCharts(
  buffer: ArrayBuffer | Buffer,
  sheetFile: string,
  specs: NativeChartSpec[]
): Promise<Buffer> {
  if (specs.length === 0) return Buffer.from(buffer as Buffer)

  const zip = await JSZip.loadAsync(buffer)

  // 1) charts
  specs.forEach((spec, i) => {
    zip.file(`xl/charts/chart${i + 1}.xml`, fullChartXml(spec))
  })

  // 2) drawing + rels
  zip.file('xl/drawings/drawing1.xml', drawingXml(specs))
  zip.file('xl/drawings/_rels/drawing1.xml.rels', drawingRelsXml(specs))

  // 3) relacionar la hoja con el drawing
  const sheetRelsPath = `xl/worksheets/_rels/${sheetFile}.rels`
  const drawingRelId = 'rIdDraw1'
  const existingRels = zip.file(sheetRelsPath)
  if (existingRels) {
    let xml = await existingRels.async('string')
    xml = xml.replace(
      '</Relationships>',
      `<Relationship Id="${drawingRelId}" Type="${R_NS}/drawing" Target="../drawings/drawing1.xml"/></Relationships>`
    )
    zip.file(sheetRelsPath, xml)
  } else {
    zip.file(
      sheetRelsPath,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PKG_REL_NS}">` +
        `<Relationship Id="${drawingRelId}" Type="${R_NS}/drawing" Target="../drawings/drawing1.xml"/></Relationships>`
    )
  }

  // 4) referencia <drawing> dentro de la hoja
  const sheetPath = `xl/worksheets/${sheetFile}`
  const sheetEntry = zip.file(sheetPath)
  if (!sheetEntry) throw new Error(`No se encontró la hoja ${sheetPath} en el workbook`)
  let sheetXml = await sheetEntry.async('string')
  if (!sheetXml.includes('<drawing ')) {
    sheetXml = sheetXml.replace('</worksheet>', `<drawing r:id="${drawingRelId}"/></worksheet>`)
    // asegurar el namespace r: en el root del worksheet
    if (!sheetXml.includes('xmlns:r=')) {
      sheetXml = sheetXml.replace('<worksheet ', `<worksheet xmlns:r="${R_NS}" `)
    }
    zip.file(sheetPath, sheetXml)
  }

  // 5) Content types overrides
  const ctPath = '[Content_Types].xml'
  const ctEntry = zip.file(ctPath)
  if (!ctEntry) throw new Error('No se encontró [Content_Types].xml')
  let ct = await ctEntry.async('string')
  const overrides =
    `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>` +
    specs
      .map(
        (_, i) =>
          `<Override PartName="/xl/charts/chart${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`
      )
      .join('')
  ct = ct.replace('</Types>', `${overrides}</Types>`)
  zip.file(ctPath, ct)

  const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  return out
}

/** Columna 0-based → letra de columna Excel (0 → A, 25 → Z, 26 → AA). */
export function colLetter(index: number): string {
  let n = index + 1
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}
