import ExcelJS from 'exceljs'

const MAX_WORKBOOK_BYTES = 10 * 1024 * 1024

const cellValue = (cell) => {
  if (cell?.text !== undefined) return cell.text
  if (cell?.result !== undefined) return cell.result
  return cell ?? ''
}

export async function readWorkbook(arrayBuffer) {
  if (arrayBuffer.byteLength > MAX_WORKBOOK_BYTES) throw new Error('Workbook exceeds the 10 MB import limit.')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(arrayBuffer)
  return workbook.worksheets.map((worksheet) => ({
    name: worksheet.name,
    rows: worksheet.getSheetValues().slice(1).map((row = []) => row.slice(1).map(cellValue)),
  }))
}

export async function readWorkbookObjects(arrayBuffer) {
  const [sheet] = await readWorkbook(arrayBuffer)
  if (!sheet) return []
  const headers = sheet.rows[0]?.map((header) => String(header ?? '').trim()) || []
  return sheet.rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}

export async function downloadWorkbook(fileName, sheetName, rows) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(sheetName)
  const headers = Object.keys(rows[0] || {})
  worksheet.columns = headers.map((header) => ({ header, key: header }))
  rows.forEach((row) => worksheet.addRow(row))
  const buffer = await workbook.xlsx.writeBuffer()
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  link.download = fileName
  link.click()
  URL.revokeObjectURL(link.href)
}