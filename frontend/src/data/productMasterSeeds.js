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

const mrlsAllocations = [
  ['Indian Air Force', 'TASL-CTR-2026-001'],
  ['Indian Army', 'TASL-CTR-2026-002'],
  ['Indian Navy', 'TASL-CTR-2026-003'],
  ['Indian Army Special Forces', 'TASL-CTR-2024-001'],
  ['Indian Air Force', 'TASL-CTR-2023-001'],
  ['Indian Navy', 'TASL-CTR-2022-001'],
  ['Indian Army', 'TASL-CTR-2024-002'],
  ['Indian Air Force', 'TASL-CTR-2025-001'],
  ['Indian Army Special Forces', 'TASL-CTR-2026-004'],
  ['Indian Navy', 'TASL-CTR-2025-002'],
]
const genericMrlsComponents = Array.from({ length: 30 }, (_, index) => {
  const sequence = String(index + 1).padStart(3, '0')
  const [customer, contract_number] = mrlsAllocations[index % mrlsAllocations.length]
  const component = componentNames[index % componentNames.length]
  return {
    id: `mrls-component-${sequence}`,
    product_serial_number: `MRLS-COMP-${sequence}`,
    part_number: `MRLS-${component.slice(0, 3).toUpperCase()}-${sequence}`,
    sap_part_number: `700${sequence}`,
    material_description: component,
    batch_number: `MRLS-26-${String(Math.floor(index / 10) + 1).padStart(2, '0')}`,
    material_serial_number: `MRLS-${component.slice(0, 3).toUpperCase()}-${sequence}`,
    customer,
    contract_number,
    quantity: '1',
    unit_of_measurement: 'EA',
    remarks: `Serialized MRLS spare allocated to ${customer} / ${contract_number}`,
  }
})
const centerWingGimbalCameraSamples = mrlsAllocations.flatMap(([customer, contract_number], allocationIndex) => Array.from({ length: 2 }, (_, cameraIndex) => {
  const sequence = String(allocationIndex * 2 + cameraIndex + 1).padStart(3, '0')
  return {
    id: `mrls-center-wing-gimbal-camera-${sequence}`,
    product_serial_number: `MRLS-COMP-CWG-${sequence}`,
    part_number: `CWG-CAM-${sequence}`,
    sap_part_number: `CWGCAM${sequence}`,
    material_description: 'Center Wing Gimbal Camera',
    batch_number: `MRLS-CWG-26-${String(allocationIndex + 1).padStart(2, '0')}`,
    material_serial_number: `CWG-CAM-${sequence}`,
    customer,
    contract_number,
    quantity: '1',
    unit_of_measurement: 'EA',
    remarks: `Replacement test spare ${cameraIndex + 1} of 2 for ${customer} / ${contract_number}`,
  }
}))
const centerWingPayloadCameraSamples = mrlsAllocations.flatMap(([customer, contract_number], allocationIndex) => Array.from({ length: 3 }, (_, cameraIndex) => {
  const sequence = String(allocationIndex * 3 + cameraIndex + 1).padStart(3, '0')
  return {
    id: `mrls-center-wing-payload-camera-${sequence}`,
    product_serial_number: `MRLS-COMP-CWP-${sequence}`,
    part_number: `CWP-CAM-${sequence}`,
    sap_part_number: `CWPCAM${sequence}`,
    material_description: 'Center Wing Payload Camera',
    batch_number: `MRLS-CWP-26-${String(allocationIndex + 1).padStart(2, '0')}`,
    material_serial_number: `CWP-CAM-${sequence}`,
    customer,
    contract_number,
    quantity: '1',
    unit_of_measurement: 'EA',
    remarks: `Replacement test spare ${cameraIndex + 1} of 3 for ${customer} / ${contract_number}`,
  }
}))
export const seedMrlsProducts = [...genericMrlsComponents, ...centerWingGimbalCameraSamples, ...centerWingPayloadCameraSamples]

export const seedSmeSteProducts = createComponents('SME', 'SME STE', {
  material_serial_number: (product, component) => `SME-${product}-MAT-${component}`,
})

export const seedGseProducts = createComponents('GSE', 'Ground Support Equipment', {
  make: 'GroundTech',
  item_serial_number: (product, component) => `GSE-${product}-ITEM-${component}`,
})
