const normalized = (value) => String(value || '').trim().toLowerCase()
const normalizedProductCategory = (value) => normalized(value).replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
const productCategoryAliases = {
  'warhead / sam': 'warhead',
  'sme / ste': 'smt / ste',
}
const productCategoryContractTargets = {
  'Mission Control Station (MCS)': 'TASL-CTR-2026-002',
  'Ground Data Terminal (GDT)': 'TASL-CTR-2026-002',
  MAST: 'TASL-CTR-2024-001',
  Simulator: 'TASL-CTR-2026-003',
  'Tactical Mobility Vehicle (TMV)': 'TASL-CTR-2024-002',
  Batteries: 'TASL-CTR-2026-001',
  'Warhead / SAM': 'TASL-CTR-2025-001',
  Tools: 'TASL-CTR-2023-001',
  MRLS: 'TASL-CTR-2023-001',
  'SME / STE': 'TASL-CTR-2024-001',
  'Ground Support Equipment (GSE)': 'TASL-CTR-2025-002',
}
const canonicalProductCategory = (value) => productCategoryAliases[normalizedProductCategory(value)] || normalizedProductCategory(value)

export const productCategoryMatches = (productLabel, category) => canonicalProductCategory(productLabel) === canonicalProductCategory(category)

export const categoryKey = (category) => normalized(category).replace(/[^a-z0-9]+/g, '-')

export const getProductCategories = (products) => [...new Set(products
  .map((product) => String(product.product_category || '').trim())
  .filter(Boolean))]
  .sort((left, right) => left.localeCompare(right))

export const ensureProductCategoryContractDeliverables = (contracts, products) => {
  const unitsByCategory = new Map()
  products.forEach((product) => {
    const category = String(product.product_category || '').trim()
    const serialNumber = String(product.product_serial_number || '').trim()
    if (!category || !serialNumber) return
    const serialNumbers = unitsByCategory.get(category) || new Set()
    serialNumbers.add(serialNumber)
    unitsByCategory.set(category, serialNumbers)
  })

  let changed = false
  const nextContracts = contracts.map((contract) => ({ ...contract, deliverables: [...(contract.deliverables || [])] }))
  unitsByCategory.forEach((serialNumbers, category) => {
    const targetContractNumber = productCategoryContractTargets[category]
    if (!targetContractNumber) return
    const requiredQuantity = serialNumbers.size
    const allocatedQuantity = nextContracts.reduce((total, contract) => total + (contract.deliverables || [])
      .filter((deliverable) => productCategoryMatches(deliverable.product, category))
      .reduce((subtotal, deliverable) => subtotal + Number(deliverable.quantity || 0), 0), 0)
    const shortfall = requiredQuantity - allocatedQuantity
    if (shortfall <= 0) return
    const targetContract = nextContracts.find((contract) => contract.number === targetContractNumber)
    if (!targetContract) return
    const matchingDeliverable = targetContract.deliverables.find((deliverable) => productCategoryMatches(deliverable.product, category))
    if (matchingDeliverable) matchingDeliverable.quantity = Number(matchingDeliverable.quantity || 0) + shortfall
    else targetContract.deliverables.push({ product: category, quantity: shortfall })
    changed = true
  })
  return changed ? nextContracts : contracts
}

const contractAllocations = (contracts) => contracts.flatMap((contract) => (contract.deliverables || [])
  .filter((deliverable) => deliverable.product && Number(deliverable.quantity) > 0)
  .map((deliverable) => ({
    category: deliverable.product,
    remaining: Number(deliverable.quantity),
    contractNumber: contract.number,
    customer: contract.customer,
    warranty: contract.warranty,
    warrantyExpiry: contract.expiryDate,
    deliveredOn: contract.jriDate,
  })))

export const reconcileProductAssets = (products, contracts, existingAssets = []) => {
  const existingById = new Map(existingAssets.map((asset) => [asset.id, asset]))
  const allocations = contractAllocations(contracts)
  const uniqueProducts = new Map()

  products.forEach((product) => {
    const category = String(product.product_category || '').trim()
    const isMrlsComponent = canonicalProductCategory(category) === 'mrls'
    const serialNumber = String(isMrlsComponent ? product.material_serial_number || product.product_serial_number : product.product_serial_number || '').trim()
    if (!serialNumber || !category) return
    const id = `${categoryKey(category)}::${serialNumber}`
    if (!uniqueProducts.has(id)) uniqueProducts.set(id, {
      id,
      serialNumber,
      category,
      productMasterSerialNumber: product.product_serial_number || '',
      customer: product.customer || '',
      contract_number: product.contract_number || product.contractNumber || '',
    })
  })

  return [...uniqueProducts.values()]
    .sort((left, right) => left.category.localeCompare(right.category) || left.serialNumber.localeCompare(right.serialNumber, undefined, { numeric: true }))
    .map((product) => {
      const existing = existingById.get(product.id) || (canonicalProductCategory(product.category) === 'mrls'
        ? existingAssets.find((asset) => asset.category === product.category && asset.serialNumber === product.productMasterSerialNumber)
        : undefined)
      const componentContractNumber = product.contract_number || product.contractNumber || ''
      const componentCustomer = product.customer || ''
      if (existing) {
        if (componentContractNumber || componentCustomer) {
          const contract = contracts.find((candidate) => candidate.number === componentContractNumber)
          return { ...product, ...existing, id: product.id, serialNumber: product.serialNumber, category: product.category, contractNumber: componentContractNumber || existing.contractNumber || '', customer: componentCustomer || contract?.customer || existing.customer || '', warranty: contract?.warranty || existing.warranty || '', warrantyExpiry: contract?.expiryDate || existing.warrantyExpiry || '', deliveredOn: contract?.jriDate || existing.deliveredOn || '' }
        }
        const contract = contracts.find((candidate) => candidate.number === existing.contractNumber)
        const allocation = allocations.find((candidate) => candidate.contractNumber === existing.contractNumber && productCategoryMatches(candidate.category, product.category))
        if (existing.contractNumber) {
          if (allocation?.remaining > 0) allocation.remaining -= 1
          return { ...product, ...existing, id: product.id, serialNumber: product.serialNumber, category: product.category, customer: contract?.customer || existing.customer || '', warranty: contract?.warranty || existing.warranty || '', warrantyExpiry: contract?.expiryDate || existing.warrantyExpiry || '', deliveredOn: contract?.jriDate || existing.deliveredOn || '' }
        }
        const nextAllocation = allocations.find((candidate) => productCategoryMatches(candidate.category, product.category) && candidate.remaining > 0)
        if (nextAllocation) nextAllocation.remaining -= 1
        return { ...product, ...existing, id: product.id, serialNumber: product.serialNumber, category: product.category, contractNumber: nextAllocation?.contractNumber || '', customer: nextAllocation?.customer || '', warranty: nextAllocation?.warranty || '', warrantyExpiry: nextAllocation?.warrantyExpiry || '', deliveredOn: nextAllocation?.deliveredOn || '' }
      }
      const allocation = allocations.find((candidate) => productCategoryMatches(candidate.category, product.category) && candidate.remaining > 0)
      if (allocation) allocation.remaining -= 1
      return {
        ...product,
        contractNumber: allocation?.contractNumber || '',
        customer: allocation?.customer || '',
        warranty: allocation?.warranty || '',
        warrantyExpiry: allocation?.warrantyExpiry || '',
        deliveredOn: allocation?.deliveredOn || '',
        lastServiced: '',
      }
    })
}