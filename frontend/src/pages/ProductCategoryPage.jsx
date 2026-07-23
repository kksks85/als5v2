import { useMemo, useState } from 'react'
import { ArrowLeft, Download, Edit2, Eye, PackageCheck, Search, ShieldCheck, Trash2, Wrench, X } from 'lucide-react'

const formatDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '--'

export default function ProductCategoryPage({ category, assets, contracts, selectedCustomer, onUpdateAsset, onDeleteAsset }) {
  const [search, setSearch] = useState('')
  const [editingAsset, setEditingAsset] = useState(null)
  const [viewingAsset, setViewingAsset] = useState(null)
  const categoryAssets = useMemo(() => assets.filter((asset) => asset.category === category && (selectedCustomer === 'All customers' || !asset.customer || asset.customer === selectedCustomer) && (!search || [asset.serialNumber, asset.contractNumber, asset.customer, asset.warranty].some((value) => String(value || '').toLowerCase().includes(search.toLowerCase())))), [assets, category, search, selectedCustomer])
  const assignedCount = categoryAssets.filter((asset) => asset.contractNumber).length
  const coveredCount = categoryAssets.filter((asset) => asset.warranty && !asset.warranty.toLowerCase().includes('expired')).length

  const exportCsv = () => {
    const csv = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
    const data = [['Serial Number', 'Contract', 'Customer', 'Delivered On', 'Warranty', 'Warranty Expiry', 'Last Serviced'].map(csv), ...categoryAssets.map((a) => [a.serialNumber, a.contractNumber || '', a.customer || '', a.deliveredOn || '', a.warranty || '', a.warrantyExpiry || '', a.lastServiced || ''].map(csv))].map((r) => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = `${category.toLowerCase().replaceAll(' ', '-')}-assets.csv`; a.click(); URL.revokeObjectURL(url)
  }

  return <section className="product-category-page">
    <header className="product-category-header">
      <div><p>Product category registry</p><h1>{category}</h1><span>One lifecycle record per unique Product Master serial number.</span></div>
      <div className="product-category-metrics"><article><PackageCheck size={17} /><span><strong>{categoryAssets.length}</strong> units</span></article><article><ShieldCheck size={17} /><span><strong>{assignedCount}</strong> contract assigned</span></article><article><Wrench size={17} /><span><strong>{coveredCount}</strong> covered</span></article></div>
    </header>
    <div className="product-category-toolbar"><label><Search size={15} /><input aria-label={`Search ${category} assets`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search serial, contract, customer, or warranty" /></label><button className="compact-button secondary" onClick={exportCsv} disabled={!categoryAssets.length}><Download size={15} /> Extract data</button><span>{selectedCustomer === 'All customers' ? 'All customers' : selectedCustomer} · {categoryAssets.length} records</span></div>
    <div className="product-category-table"><table><thead><tr><th>Unit serial number</th><th>Delivered under contract</th><th>Customer</th><th>Delivered on</th><th>Warranty / coverage</th><th>Warranty expiry</th><th>Last serviced</th><th>Action</th></tr></thead><tbody>{categoryAssets.map((asset) => <tr key={asset.id}><td><strong>{asset.serialNumber}</strong></td><td>{asset.contractNumber || <span className="table-empty">Unassigned</span>}</td><td>{asset.customer || <span className="table-empty">--</span>}</td><td>{formatDate(asset.deliveredOn)}</td><td><span className={`asset-coverage ${asset.warranty ? '' : 'unassigned'}`}>{asset.warranty || 'Not recorded'}</span></td><td>{formatDate(asset.warrantyExpiry)}</td><td>{formatDate(asset.lastServiced)}</td><td><button className="action-btn" title={`View ${asset.serialNumber}`} onClick={() => setViewingAsset(asset)}><Eye size={15} /></button><button className="action-btn" title={`Edit ${asset.serialNumber}`} onClick={() => setEditingAsset(asset)}><Edit2 size={15} /></button><button className="action-btn" title={`Delete ${asset.serialNumber}`} onClick={() => { if (confirm(`Delete unit ${asset.serialNumber}?`)) onDeleteAsset(asset.id) }}><Trash2 size={15} /></button></td></tr>)}{!categoryAssets.length && <tr><td colSpan="8" className="empty-row">No serial-number records match this category and customer context.</td></tr>}</tbody></table></div>
    {editingAsset && <AssetForm asset={editingAsset} contracts={contracts} onClose={() => setEditingAsset(null)} onSave={(asset) => { onUpdateAsset(asset); setEditingAsset(null) }} />}
    {viewingAsset && <AssetDetail asset={viewingAsset} onClose={() => setViewingAsset(null)} onEdit={() => { setViewingAsset(null); setEditingAsset(viewingAsset) }} />}
  </section>
}

function AssetForm({ asset, contracts, onClose, onSave }) {
  const [form, setForm] = useState(asset)
  const eligibleContracts = contracts.filter((contract) => (contract.deliverables || []).some((deliverable) => deliverable.product === asset.category))
  const selectContract = (contractNumber) => {
    const contract = contracts.find((candidate) => candidate.number === contractNumber)
    setForm((current) => ({ ...current, contractNumber, customer: contract?.customer || '', warranty: contract?.warranty || '', warrantyExpiry: contract?.expiryDate || '', deliveredOn: contract?.jriDate || '' }))
  }
  return <div className="report-dialog-backdrop"><form className="asset-record-form" onSubmit={(event) => { event.preventDefault(); onSave(form) }}>
    <header><div><p>{asset.category}</p><h2>{asset.serialNumber}</h2><span>Unit delivery and service record</span></div><button type="button" onClick={onClose} aria-label="Close asset form"><X size={17} /></button></header>
    <section><h3>Delivery entitlement</h3><div className="asset-form-grid"><label><span>Delivered under contract</span><select value={form.contractNumber} onChange={(event) => selectContract(event.target.value)}><option value="">Unassigned</option>{eligibleContracts.map((contract) => <option key={contract.number} value={contract.number}>{contract.number} · {contract.customer}</option>)}</select></label><label><span>Customer</span><input value={form.customer} readOnly placeholder="Derived from contract" /></label><label><span>Delivered on</span><input type="date" value={form.deliveredOn || ''} onChange={(event) => setForm((current) => ({ ...current, deliveredOn: event.target.value }))} /></label></div></section>
    <section><h3>Warranty and service</h3><div className="asset-form-grid"><label><span>Warranty / coverage</span><input value={form.warranty} readOnly placeholder="Derived from contract" /></label><label><span>Warranty expiry</span><input type="date" value={form.warrantyExpiry || ''} readOnly /></label><label><span>Last serviced on</span><input type="date" value={form.lastServiced || ''} onChange={(event) => setForm((current) => ({ ...current, lastServiced: event.target.value }))} /></label></div></section>
    <footer><button type="button" className="compact-button secondary" onClick={onClose}>Cancel</button><button className="compact-button primary" type="submit">Save unit record</button></footer>
  </form></div>
}

function AssetDetail({ asset, onClose, onEdit }) {
  return <div className="customer-detail-page">
    <header className="customer-detail-header"><button className="compact-button secondary" onClick={onClose}><ArrowLeft size={15} /> Back</button><h1>{asset.serialNumber}</h1><button className="compact-button primary" onClick={onEdit}><Edit2 size={15} /> Edit</button></header>
    <div className="customer-detail-grid">
      <div className="detail-field"><span className="detail-label">Serial Number</span><span className="detail-value">{asset.serialNumber}</span></div>
      <div className="detail-field"><span className="detail-label">Category</span><span className="detail-value">{asset.category}</span></div>
      <div className="detail-field"><span className="detail-label">Contract</span><span className="detail-value">{asset.contractNumber || '--'}</span></div>
      <div className="detail-field"><span className="detail-label">Customer</span><span className="detail-value">{asset.customer || '--'}</span></div>
      <div className="detail-field"><span className="detail-label">Delivered On</span><span className="detail-value">{formatDate(asset.deliveredOn)}</span></div>
      <div className="detail-field"><span className="detail-label">Warranty / Coverage</span><span className="detail-value">{asset.warranty || 'Not recorded'}</span></div>
      <div className="detail-field"><span className="detail-label">Warranty Expiry</span><span className="detail-value">{formatDate(asset.warrantyExpiry)}</span></div>
      <div className="detail-field"><span className="detail-label">Last Serviced</span><span className="detail-value">{formatDate(asset.lastServiced)}</span></div>
    </div>
  </div>
}