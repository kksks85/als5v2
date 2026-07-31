export const initialProcesses = [
  ['Incident Registration', 'New', 1],
  ['Incident Registration', 'Registered', 2],
  ['Incident Registration', 'Advisory Group Review', 3],
  ['Repair at Factory', 'Awaiting Receipt', 1],
  ['Repair at Factory', 'Pending Dispatch', 2],
  ['Repair at Factory', 'Item Received', 3],
  ['Repair at Factory', 'Under IQC', 4],
  ['Repair at Factory', 'Work in Progress In-House', 5],
  ['Repair at Factory', 'Work in Progress - Vendor', 6],
  ['Repair at Factory', 'Post repair Quality Review', 7],
  ['Repair at Factory', 'Item Dispatched', 8],
  ['Repair at Factory', 'Received by Customer', 9],
  ['Repair at Factory', 'Closed', 10],
  ['Repair at site', 'Query Registered', 1],
  ['Repair at site', 'Resource Assignment', 2],
  ['Repair at site', 'Diagnosis', 3],
  ['Repair at site', 'Work in Progress', 4],
  ['Repair at site', 'Post repair Quality Review', 5],
  ['Repair at site', 'Closed', 6],
  ['Repair at site - Vendor', 'Query Registered', 1],
  ['Repair at site - Vendor', 'Assigned Vendor', 2],
  ['Repair at site - Vendor', 'Work in Progress - Vendor', 3],
  ['Repair at site - Vendor', 'Post repair Review', 4],
  ['Repair at site - Vendor', 'Closed', 5],
  ['Pre Delivery Flight', 'Pre-flight Inspection', 1],
  ['Pre Delivery Flight', 'Flight Preparation', 2],
  ['Pre Delivery Flight', 'Test Flight', 3],
  ['Pre Delivery Flight', 'Post-flight Inspection', 4],
  ['Pre Delivery Flight', 'Delivery Clearance', 5],
].map(([repairExecution, status, order], index) => ({ id: index + 1, repairExecution, status, order }))

export const processConfigurationStorageKey = 'als50-process-configuration'
const processConfigurationMigrationKey = 'als50-process-configuration-pre-delivery-flight-v7'
const processConfigurationClearMigrationKey = 'als50-process-configuration-cleared-v1'

export const defaultStageInstruction = (status) => status
  ? `Complete the required checks, record the supporting evidence, and confirm the handover requirements for ${status}.`
  : 'Describe the checks, actions, and evidence required before this stage is complete.'

const addIncidentRegistrationStage = (processes) => {
  if (localStorage.getItem(processConfigurationMigrationKey)) return processes
  const registrationStages = processes
    .filter((process) => process.repairExecution === 'Incident Registration')
    .sort((first, second) => first.order - second.order)
  const stagesByStatus = new Map()
  registrationStages.forEach((process) => {
    if (!stagesByStatus.has(process.status)) stagesByStatus.set(process.status, process)
  })
  let nextId = Math.max(...processes.map((process) => process.id), 0) + 1
  const createStage = (status) => stagesByStatus.get(status) || { id: nextId++, repairExecution: 'Incident Registration', status }
  const requiredStages = ['New', 'Registered', 'Advisory Group Review'].map(createStage)
  const remainingStages = [...stagesByStatus.values()].filter((process) => !['New', 'Registered', 'Advisory Group Review'].includes(process.status))
  const normalizedRegistrationStages = [...requiredStages, ...remainingStages]
    .map((process, index) => ({ ...process, order: index + 1 }))
  const factoryStages = processes
    .filter((process) => process.repairExecution === 'Repair at Factory')
    .sort((first, second) => first.order - second.order)
  const factoryFirstStage = factoryStages[0]
  const normalizedFactoryStages = factoryFirstStage
    ? factoryStages.map((process) => process.id === factoryFirstStage.id ? { ...process, status: 'Awaiting Receipt', order: 1 } : process)
    : [{ id: nextId++, repairExecution: 'Repair at Factory', status: 'Awaiting Receipt', order: 1 }]
  const preDeliveryStages = processes
    .filter((process) => process.repairExecution === 'Pre Delivery Flight')
    .sort((first, second) => first.order - second.order)
  const preDeliveryByStatus = new Map()
  preDeliveryStages.forEach((process) => {
    if (!preDeliveryByStatus.has(process.status)) preDeliveryByStatus.set(process.status, process)
  })
  const requiredPreDeliveryStages = ['Pre-flight Inspection', 'Flight Preparation', 'Test Flight', 'Post-flight Inspection', 'Delivery Clearance']
    .map((status) => preDeliveryByStatus.get(status) || { id: nextId++, repairExecution: 'Pre Delivery Flight', status })
  const nextProcesses = [
    ...processes.filter((process) => !['Incident Registration', 'Repair at Factory', 'Pre Delivery Flight'].includes(process.repairExecution)),
    ...normalizedRegistrationStages,
    ...normalizedFactoryStages,
    ...requiredPreDeliveryStages.map((process, index) => ({ ...process, order: index + 1 })),
  ]
  localStorage.setItem(processConfigurationStorageKey, JSON.stringify(nextProcesses))
  localStorage.setItem(processConfigurationMigrationKey, '1')
  return nextProcesses
}

export const getConfiguredProcesses = () => {
  if (!localStorage.getItem(processConfigurationClearMigrationKey)) {
    localStorage.setItem(processConfigurationStorageKey, '[]')
    localStorage.setItem(processConfigurationMigrationKey, '1')
    localStorage.setItem(processConfigurationClearMigrationKey, '1')
    return []
  }
  try {
    const stored = JSON.parse(localStorage.getItem(processConfigurationStorageKey) || 'null')
    return Array.isArray(stored) ? addIncidentRegistrationStage(stored) : []
  } catch {
    return []
  }
}

export const getProcessStages = (repairExecution, processes = getConfiguredProcesses()) => {
  const seenStatuses = new Set()
  return processes
    .filter((process) => process.repairExecution === repairExecution)
    .sort((first, second) => first.order - second.order)
    .filter((process) => !seenStatuses.has(process.status) && seenStatuses.add(process.status))
    .map((process, index) => ({ ...process, order: index + 1 }))
}

export const getProcessStage = (repairExecution, status, processes = getConfiguredProcesses()) => getProcessStages(repairExecution, processes)
  .find((stage) => stage.status === status)

export const getNextProcessStage = (repairExecution, status, processes = getConfiguredProcesses()) => {
  const stages = getProcessStages(repairExecution, processes)
  const currentIndex = stages.findIndex((stage) => stage.status === status)
  return currentIndex >= 0 ? stages[currentIndex + 1] : undefined
}

export const getRepairExecutions = (processes = getConfiguredProcesses()) => [...new Set(processes
  .map((process) => process.repairExecution)
  .filter(Boolean))]