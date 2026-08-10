const componentNames = ['Power Module', 'Control Assembly', 'Interface Harness']

const createComponents = (prefix, name, extras = {}) => Array.from({ length: 10 }, (_, productIndex) => {
  const productNumber = String(productIndex + 1).padStart(3, '0')
  const productSerialNumber = `${prefix}-${productNumber}`
  return componentNames.map((component, componentIndex) => {
    const componentNumber = String(componentIndex + 1).padStart(2, '0')
    const partNumber = `${prefix}-C${componentNumber}-${productNumber}`
    return {
      id: `${prefix.toLowerCase()}-${productNumber}-${componentNumber}`,
      product_serial_number: productSerialNumber,
      part_number: partNumber,
      sap_part_number: `70${String(productIndex + 1).padStart(3, '0')}${componentNumber}`,
      material_description: `${name} ${component}`,
      quantity: '1',
      unit_of_measurement: 'EA',
      remarks: `Component ${componentIndex + 1} of ${productSerialNumber}`,
      ...Object.fromEntries(Object.entries(extras).map(([key, value]) => [key, typeof value === 'function' ? value(productNumber, componentNumber) : value])),
    }
  })
}).flat()

export const seedMcsProducts = createComponents('MCS', 'Mission Control System', {
  make: 'Aero Systems',
  model: 'MCS-C1',
  item_serial_number: (product, component) => `MCS-${product}-ITEM-${component}`,
})

export const seedGdtProducts = createComponents('GDT', 'Ground Diagnostic Tool', {
  batch_number: (product) => `GDT-26-${product}`,
  item_serial_number: (product, component) => `GDT-${product}-ITEM-${component}`,
})

export const seedMastProducts = createComponents('MAST', 'Mast System', {
  batch_number: (product) => `MAST-26-${product}`,
  item_serial_number: (product, component) => `MAST-${product}-ITEM-${component}`,
})

export const seedSimulatorProducts = createComponents('SIM', 'Simulator', {
  item_serial_number: (product, component) => `SIM-${product}-ITEM-${component}`,
})

export const seedTmvProducts = createComponents('TMV', 'Transport Vehicle', {
  vehicle_ba_number: (product) => `BA-TMV-${product}`,
  engine_number: (product) => `ENG-TMV-${product}`,
  chasis_number: (product) => `CHS-TMV-${product}`,
})

export const seedBatteryProducts = createComponents('BAT', 'Battery System', {
  batch_number: (product) => `BAT-26-${product}`,
  make: 'PowerCell',
  battery_type: 'Lithium-ion',
  material_serial_number: (product, component) => `BAT-${product}-CELL-${component}`,
})

export const seedWarheadSamProducts = createComponents('WHS', 'Warhead SAM', {
  batch_number: (product) => `WHS-26-${product}`,
  material_serial_number: (product, component) => `WHS-${product}-MAT-${component}`,
})

export const seedToolsProducts = createComponents('TLS', 'Tool Set', {
  material_serial_number: (product, component) => `TLS-${product}-MAT-${component}`,
})

export const seedMrlsProducts = createComponents('MRLS', 'MRLS Support System', {
  batch_number: (product) => `MRLS-26-${product}`,
  material_serial_number: (product, component) => `MRLS-${product}-MAT-${component}`,
})

export const seedSmeSteProducts = createComponents('SME', 'SME STE', {
  material_serial_number: (product, component) => `SME-${product}-MAT-${component}`,
})

export const seedGseProducts = createComponents('GSE', 'Ground Support Equipment', {
  make: 'GroundTech',
  item_serial_number: (product, component) => `GSE-${product}-ITEM-${component}`,
})
