export const initialProcesses = [
  ['Repair at Factory', 'Query Registered', 1],
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
].map(([repairExecution, status, order], index) => ({ id: index + 1, repairExecution, status, order }))

export const getProcessStages = (repairExecution) => initialProcesses
  .filter((process) => process.repairExecution === repairExecution)
  .sort((first, second) => first.order - second.order)