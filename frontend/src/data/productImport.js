import * as XLSX from 'xlsx'

const normalizeHeader = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
export const normalizePartNumber = (value) => String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')

const routeFieldAliases = {
  partNumber: ['partnumber'],
  sapPartNumber: ['sappartnumber'],
  materialDescription: ['materialdescription'],
  batchOrPoNumber: ['batchponumber', 'batchnumberponumber'],
  materialSerialNumber: ['materialserialno', 'materialserialnumber'],
  weightInGrams: ['weightingrams'],
  requiredQuantity: ['requiredquantity'],
  unitOfMeasurement: ['unitofmeasurementuom', 'unitofmeasurement'],
  subsystem: ['subsystem'],
}

const configurationFieldAliases = {
  partNumber: ['partnumber'],
  serialNumber: ['serialnumber', 'materialserialno', 'materialserialnumber'],
}

const stringValue = (value) => String(value ?? '').trim()
const sourceCell = (row, index) => index === undefined ? '' : stringValue(row[index])

const findHeaderRow = (rows, requiredAliases) => rows.findIndex((row) => {
  const headers = row.map(normalizeHeader)
  return requiredAliases.every((aliases) => aliases.some((alias) => headers.includes(alias)))
})

const resolveIndexes = (headerRow, aliases) => Object.fromEntries(Object.entries(aliases).map(([field, candidates]) => [
  field,
  headerRow.findIndex((header) => candidates.includes(normalizeHeader(header))),
]))

const sheetRows = (sheet) => XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })

export const parseProductMasterWorkbook = (arrayBuffer, columns, idPrefix, fileName = 'Product Master workbook') => {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const rows = []
  const invalidRows = []
  const skippedSheets = []
  const requiredColumns = columns.filter((column) => column.required)

  workbook.SheetNames.forEach((sheetName, sheetIndex) => {
    const values = sheetRows(workbook.Sheets[sheetName])
    const headerIndex = findHeaderRow(values, requiredColumns.map((column) => [normalizeHeader(column.label)]))
    if (headerIndex === -1) {
      skippedSheets.push({ sheetName, reason: `Required headers were not found: ${requiredColumns.map((column) => column.label).join(', ')}.` })
      return
    }

    const indexes = Object.fromEntries(columns.map((column) => [column.key, values[headerIndex].findIndex((header) => normalizeHeader(header) === normalizeHeader(column.label))]))
    values.slice(headerIndex + 1).forEach((row, offset) => {
      const payload = Object.fromEntries(columns.map((column) => [column.key, sourceCell(row, indexes[column.key])]))
      if (!Object.values(payload).some(Boolean)) return
      const missingFields = requiredColumns.filter((column) => !payload[column.key]).map((column) => column.label)
      const rowNumber = headerIndex + offset + 2
      const materialIdentity = payload.material_serial_number || payload.item_serial_number || payload.material_description
      const recordId = [idPrefix, 'import', payload.product_serial_number, payload.part_number, materialIdentity]
        .map((value) => normalizePartNumber(value))
        .filter(Boolean)
        .join('-') || `${idPrefix}-import-${sheetIndex + 1}-${rowNumber}`
      const importedRow = { id: recordId, ...payload, importSource: { fileName, sheetName, rowNumber } }
      if (missingFields.length) invalidRows.push({ ...importedRow, missingFields })
      else rows.push(importedRow)
    })
  })

  return { fileName, sheetNames: workbook.SheetNames, rows, invalidRows, skippedSheets }
}

export const parseRouteCardWorkbook = (arrayBuffer, fileName = 'Route Card workbook') => {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const rows = []
  const invalidRows = []
  const skippedSheets = []

  workbook.SheetNames.forEach((sheetName) => {
    const values = sheetRows(workbook.Sheets[sheetName])
    const headerIndex = findHeaderRow(values, [routeFieldAliases.partNumber, routeFieldAliases.materialDescription])
    if (headerIndex === -1) {
      skippedSheets.push({ sheetName, reason: 'Part Number and Material Description headers were not found.' })
      return
    }

    const indexes = resolveIndexes(values[headerIndex], routeFieldAliases)
    const title = values.slice(0, headerIndex).flat().map(stringValue).find(Boolean) || sheetName
    values.slice(headerIndex + 1).forEach((row, offset) => {
      const partNumber = sourceCell(row, indexes.partNumber)
      const materialDescription = sourceCell(row, indexes.materialDescription)
      if (!partNumber && !materialDescription) return

      const source = { fileName, sheetName, rowNumber: headerIndex + offset + 2 }
      const routeRow = {
        ...source,
        routeCardDescription: title,
        partNumber,
        sapPartNumber: sourceCell(row, indexes.sapPartNumber),
        materialDescription,
        batchOrPoNumber: sourceCell(row, indexes.batchOrPoNumber),
        materialSerialNumber: sourceCell(row, indexes.materialSerialNumber),
        weightInGrams: sourceCell(row, indexes.weightInGrams),
        requiredQuantity: sourceCell(row, indexes.requiredQuantity),
        unitOfMeasurement: sourceCell(row, indexes.unitOfMeasurement),
        subsystem: sourceCell(row, indexes.subsystem),
      }
      const missingFields = [
        !partNumber && 'Part Number',
        !materialDescription && 'Material Description',
        !routeRow.requiredQuantity && 'Required Quantity',
        !routeRow.unitOfMeasurement && 'Unit of Measurement',
      ].filter(Boolean)
      if (missingFields.length) invalidRows.push({ ...routeRow, missingFields })
      else rows.push(routeRow)
    })
  })

  return { fileName, sheetNames: workbook.SheetNames, rows, invalidRows, skippedSheets }
}

export const parseConfigurationWorkbook = (arrayBuffer, fileName = 'Configuration workbook') => {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const rows = []
  const invalidRows = []
  const skippedSheets = []

  workbook.SheetNames.forEach((sheetName) => {
    const values = sheetRows(workbook.Sheets[sheetName])
    const headerIndex = findHeaderRow(values, [configurationFieldAliases.partNumber, configurationFieldAliases.serialNumber])
    if (headerIndex === -1) {
      skippedSheets.push({ sheetName, reason: 'Part Number and Serial Number headers were not found.' })
      return
    }

    const indexes = resolveIndexes(values[headerIndex], configurationFieldAliases)
    const subsystemIndex = Math.max(0, indexes.partNumber - 1)
    let currentSubsystem = ''
    values.slice(headerIndex + 1).forEach((row, offset) => {
      const partNumber = sourceCell(row, indexes.partNumber)
      const serialNumber = sourceCell(row, indexes.serialNumber)
      const subsystem = sourceCell(row, subsystemIndex)
      if (subsystem) currentSubsystem = subsystem
      if (!partNumber && !serialNumber) return

      const configurationRow = {
        fileName,
        sheetName,
        rowNumber: headerIndex + offset + 2,
        partNumber,
        serialNumber,
        subsystem: currentSubsystem,
      }
      if (!partNumber || !serialNumber) invalidRows.push(configurationRow)
      else rows.push(configurationRow)
    })
  })

  return { fileName, sheetNames: workbook.SheetNames, rows, invalidRows, skippedSheets }
}

const productRecordId = (productSerialNumber, routeRow, configurationRow) => [
  'import',
  normalizePartNumber(productSerialNumber),
  normalizePartNumber(routeRow.sheetName),
  routeRow.rowNumber,
  configurationRow?.rowNumber ?? 'unmatched',
].join('-')

const assembledProduct = (routeRow, configurationRow, identity, configurationFileName) => ({
  productRecordId: productRecordId(identity.productSerialNumber, routeRow, configurationRow),
  product_serial_number: identity.productSerialNumber,
  product_category: identity.productCategory,
  route_card_description: routeRow.routeCardDescription,
  part_number: routeRow.partNumber,
  sap_part_number: routeRow.sapPartNumber,
  material_description: routeRow.materialDescription,
  batch_or_po_number: routeRow.batchOrPoNumber,
  material_serial_number: configurationRow?.serialNumber || routeRow.materialSerialNumber,
  weight_in_grams: routeRow.weightInGrams,
  required_quantity: routeRow.requiredQuantity,
  unit_of_measurement: routeRow.unitOfMeasurement,
  subsystems: configurationRow?.subsystem || routeRow.subsystem,
  importSource: {
    routeCard: { fileName: routeRow.fileName, sheetName: routeRow.sheetName, rowNumber: routeRow.rowNumber },
    configuration: configurationRow ? { fileName: configurationFileName, sheetName: configurationRow.sheetName, rowNumber: configurationRow.rowNumber } : null,
    normalizedPartNumber: normalizePartNumber(routeRow.partNumber),
    matchStatus: configurationRow ? 'matched' : 'unmatched',
  },
})

export const reconcileProductImport = ({ routeCards, configuration, productSerialNumber, productCategory }) => {
  const identity = { productSerialNumber: stringValue(productSerialNumber), productCategory: stringValue(productCategory) }
  const configurationByPart = new Map()
  configuration.rows.forEach((row) => {
    const key = normalizePartNumber(row.partNumber)
    const matches = configurationByPart.get(key) || []
    matches.push(row)
    configurationByPart.set(key, matches)
  })

  const unmatchedRouteRows = []
  const duplicateConfigurationMatches = [...configurationByPart.entries()]
    .filter(([, matches]) => matches.length > 1)
    .map(([partNumber, matches]) => ({ partNumber, matches }))
  const consumedConfigurationMatches = new Map()
  const usedConfigurationRows = new Set()
  const assembledRows = routeCards.rows.map((routeRow) => {
    const key = normalizePartNumber(routeRow.partNumber)
    const matches = configurationByPart.get(key) || []
    const matchIndex = consumedConfigurationMatches.get(key) || 0
    const configurationRow = matches[matchIndex]
    if (!configurationRow) {
      unmatchedRouteRows.push(routeRow)
      return assembledProduct(routeRow, null, identity, configuration.fileName)
    }
    consumedConfigurationMatches.set(key, matchIndex + 1)
    usedConfigurationRows.add(`${configurationRow.sheetName}-${configurationRow.rowNumber}`)
    return assembledProduct(routeRow, configurationRow, identity, configuration.fileName)
  })

  return {
    identity,
    assembledRows,
    unmatchedRouteRows,
    orphanConfigurationRows: configuration.rows.filter((row) => !usedConfigurationRows.has(`${row.sheetName}-${row.rowNumber}`)),
    duplicateConfigurationMatches,
    invalidRouteRows: routeCards.invalidRows,
    invalidConfigurationRows: configuration.invalidRows,
    routeCards,
    configuration,
  }
}