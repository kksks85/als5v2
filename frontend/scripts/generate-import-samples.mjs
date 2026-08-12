import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import * as XLSX from 'xlsx'

const outputDirectory = resolve('public/assets/import-samples')

const writeWorkbook = (fileName, sheetName, headers, rows, title = '') => {
  const sheetRows = title ? [[title], headers, ...rows] : [headers, ...rows]
  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows)
  worksheet['!cols'] = headers.map((header) => ({ wch: Math.max(16, header.length + 2) }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, resolve(outputDirectory, fileName))
}

const commonHeaders = [
  'Product Serial Number',
  'Part Number',
  'SAP Part number',
  'Material Description',
]

const quantityHeaders = ['Quantity', 'Unit of Measurement (UOM)', 'Remarks']
const commonRow = (serial, partNumber, sapPartNumber, description) => [serial, partNumber, sapPartNumber, description]

mkdirSync(outputDirectory, { recursive: true })

writeWorkbook(
  'loitering-munition-route-card-sample.xlsx',
  'Route Card Sample',
  ['Part Number', 'SAP Part Number', 'Material Description', 'Batch No / PO No', 'Material Serial No', 'Weight in Grams', 'Required Quantity', 'Unit of Measurement', 'Subsystem'],
  [
    ['LM-RC-1001', '967670019457196', 'Fuselage Integration Assembly', 'LM-PO-2026-001', '', '2450', '1', 'EA', 'AIRFRAME'],
    ['LM-RC-1002', '967670019457197', 'Radio Transceiver Assembly', 'LM-PO-2026-001', '', '680', '1', 'EA', 'DATALINK'],
  ],
  'Loitering Munition Route Card - Sample',
)

writeWorkbook(
  'loitering-munition-configuration-sample.xlsx',
  'Configuration Sample',
  ['Subsystem', 'Part Number', 'Serial Number'],
  [
    ['AIRFRAME', 'LM-RC-1001', 'LM-TEST-001-AIR-001'],
    ['DATALINK', 'LM-RC-1002', 'LM-TEST-001-DAT-001'],
  ],
  'Loitering Munition Configuration - Sample',
)

writeWorkbook(
  'mcs-product-master-sample.xlsx',
  'Product Master MCS',
  [...commonHeaders, 'Make', 'Model', 'Item Serial No.', ...quantityHeaders],
  [
    [...commonRow('MCS-TEST-001', 'MCS-C-001', '70001001', 'Mission Control Console'), 'Aero Systems', 'MCS-C1', 'MCS-TEST-ITEM-001', '1', 'EA', 'Import test sample'],
  ],
)

writeWorkbook(
  'gdt-product-master-sample.xlsx',
  'Product Master GDT',
  [...commonHeaders, 'Batch Number (if applicable)', 'Item Serial No. (if applicable)', ...quantityHeaders],
  [
    [...commonRow('GDT-TEST-001', 'GDT-C-001', '70002001', 'Ground Data Terminal Assembly'), 'GDT-26-001', 'GDT-TEST-ITEM-001', '1', 'EA', 'Import test sample'],
  ],
)

writeWorkbook(
  'mast-product-master-sample.xlsx',
  'Product Master MAST',
  [...commonHeaders, 'Batch Number (if applicable)', 'Item Serial No. (if applicable)', ...quantityHeaders],
  [
    [...commonRow('MAST-TEST-001', 'MAST-C-001', '70003001', 'Mast System Assembly'), 'MAST-26-001', 'MAST-TEST-ITEM-001', '1', 'EA', 'Import test sample'],
  ],
)

writeWorkbook(
  'simulator-product-master-sample.xlsx',
  'Product Master Simulator',
  [...commonHeaders, 'Item Serial No.', ...quantityHeaders],
  [
    [...commonRow('SIM-TEST-001', 'SIM-C-001', '70004001', 'Simulator Control Assembly'), 'SIM-TEST-ITEM-001', '1', 'EA', 'Import test sample'],
  ],
)

writeWorkbook(
  'tmv-product-master-sample.xlsx',
  'Product Master TMV',
  [...commonHeaders, 'Vehicle BA No.', 'Engine No.', 'Chasis No.', 'Remarks'],
  [
    [...commonRow('TMV-TEST-001', 'TMV-C-001', '70005001', 'Tactical Mobility Vehicle'), 'BA-TMV-TEST-001', 'ENG-TMV-TEST-001', 'CHS-TMV-TEST-001', 'Import test sample'],
  ],
)

writeWorkbook(
  'battery-product-master-sample.xlsx',
  'Product Master Batteries',
  [...commonHeaders, 'Batch Number', 'Make', 'Battery Type', 'Material Serial No', 'Quantity', 'Unit of Measurement', 'Remarks'],
  [
    [...commonRow('BAT-TEST-001', 'BAT-C-001', '70006001', 'Lithium-ion Battery Module'), 'BAT-26-001', 'PowerCell', 'Lithium-ion', 'BAT-TEST-MAT-001', '1', 'EA', 'Import test sample'],
  ],
)

writeWorkbook(
  'warhead-sam-product-master-sample.xlsx',
  'Product Master Warhead SAM',
  [...commonHeaders, 'Batch No', 'Material Serial No', 'Quantity', 'Unit of Measurement (UOM)', 'Remarks'],
  [
    [...commonRow('WHS-TEST-001', 'WHS-C-001', '70007001', 'Warhead SAM Assembly'), 'WHS-26-001', 'WHS-TEST-MAT-001', '1', 'EA', 'Import test sample'],
  ],
)

writeWorkbook(
  'tools-product-master-sample.xlsx',
  'Product Master Tools',
  [...commonHeaders, 'Material Serial No', 'Quantity', 'Unit of Measurement (UOM)', 'Remarks'],
  [
    [...commonRow('TLS-TEST-001', 'TLS-C-001', '70008001', 'Tool Set Assembly'), 'TLS-TEST-MAT-001', '1', 'EA', 'Import test sample'],
  ],
)

writeWorkbook(
  'mrls-product-master-sample.xlsx',
  'Product Master MRLS',
  [...commonHeaders, 'Batch No', 'Material Serial No', 'Quantity', 'Unit of Measurement (UOM)', 'Remarks'],
  [
    [...commonRow('MRLS-TEST-001', 'MRLS-C-001', '70009001', 'MRLS Support Assembly'), 'MRLS-26-001', 'MRLS-TEST-MAT-001', '1', 'EA', 'Import test sample'],
  ],
)

writeWorkbook(
  'sme-ste-product-master-sample.xlsx',
  'Product Master SME STE',
  [...commonHeaders, 'Material Serial No', 'Quantity', 'Unit of Measurement (UOM)', 'Remarks'],
  [
    [...commonRow('SME-TEST-001', 'SME-C-001', '70010001', 'SME STE Test Assembly'), 'SME-TEST-MAT-001', '1', 'EA', 'Import test sample'],
  ],
)

writeWorkbook(
  'gse-product-master-sample.xlsx',
  'Product Master GSE',
  [...commonHeaders, 'Make', 'Item Serial No.', 'Quantity', 'Unit of Measurement (UOM)', 'Remarks'],
  [
    [...commonRow('GSE-TEST-001', 'GSE-C-001', '70011001', 'Ground Support Equipment Assembly'), 'GroundTech', 'GSE-TEST-ITEM-001', '1', 'EA', 'Import test sample'],
  ],
)