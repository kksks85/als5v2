const normalized = (value) => String(value || '').trim().toLowerCase()
const normalizedProductCategory = (value) => normalized(value).replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()

export const productCategoryMatches = (productLabel, category) => normalizedProductCategory(productLabel) === normalizedProductCategory(category)

export const categoryKey = (category) => normalized(category).replace(/[^a-z0-9]+/g, '-')

export const getProductCategories = (products) => [...new Set(products
  .map((product) => String(product.product_category || '').trim())
  .filter(Boolean))]
  .sort((left, right) => left.localeCompare(right))

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
    const serialNumber = String(product.product_serial_number || '').trim()
    const category = String(product.product_category || '').trim()
    if (!serialNumber || !category) return
    const id = `${categoryKey(category)}::${serialNumber}`
    if (!uniqueProducts.has(id)) uniqueProducts.set(id, { id, serialNumber, category })
  })

  return [...uniqueProducts.values()]
    .sort((left, right) => left.category.localeCompare(right.category) || left.serialNumber.localeCompare(right.serialNumber, undefined, { numeric: true }))
    .map((product) => {
      const existing = existingById.get(product.id)
      if (existing) {
        const contract = contracts.find((candidate) => candidate.number === existing.contractNumber)
        const allocation = allocations.find((candidate) => candidate.contractNumber === existing.contractNumber && productCategoryMatches(candidate.category, product.category))
        if (allocation?.remaining > 0) allocation.remaining -= 1
        return { ...product, ...existing, id: product.id, serialNumber: product.serialNumber, category: product.category, customer: contract?.customer || existing.customer || '', warranty: contract?.warranty || existing.warranty || '', warrantyExpiry: contract?.expiryDate || existing.warrantyExpiry || '', deliveredOn: contract?.jriDate || existing.deliveredOn || '' }
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