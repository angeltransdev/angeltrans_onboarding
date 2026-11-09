import { useCallback, useEffect, useMemo, useState } from "react";
import { HRSidebar } from "../../components/layout/HRSidebar";
import api from "../../services/api";

const categories = ["Vehicle", "Mobile Device", "Ambulance Equipment", "Other"];
const statuses = ["Available", "In Use", "Maintenance", "Retired"];
const recordCategories = ["Registration", "Insurance", "Permit", "Inspection", "Certification", "Maintenance", "Other"];
const suggestedRecordCategories = {
  "Vehicle": ["Registration", "Insurance", "Permit", "Inspection", "Maintenance"],
  "Mobile Device": ["Insurance", "Certification", "Maintenance"],
  "Ambulance Equipment": ["Inspection", "Certification", "Permit", "Maintenance"],
  "Other": ["Insurance", "Permit", "Inspection", "Certification", "Maintenance"],
};
const recordExamples = {
  "Vehicle": "registration, insurance policy, permit, inspection, or maintenance item",
  "Mobile Device": "insurance policy, certification, or maintenance item",
  "Ambulance Equipment": "inspection, certification, permit, or maintenance item",
  "Other": "insurance policy, permit, inspection, certification, or maintenance item",
};
const emptyAsset = () => ({ name: "", category: "Vehicle", identifier: "", location: "", status: "Available", vin: "", licensePlate: "", serialNumber: "", notes: "" });
const emptyRecord = () => ({ title: "", category: "", dueDate: "", documentUrl: "", notes: "", status: "Open" });
const message = (err, fallback) => err.response?.data?.message || fallback;

function Field({ label, children }) {
  return <label className="block text-label-lg text-on-surface space-y-1"><span>{label}</span>{children}</label>;
}

export default function AssetManagement() {
  const [assets, setAssets] = useState([]);
  const [due, setDue] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [records, setRecords] = useState([]);
  const [assetForm, setAssetForm] = useState(null);
  const [recordForm, setRecordForm] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refresh = useCallback(async () => {
    const [assetsResponse, dueResponse] = await Promise.all([api.get("/assets"), api.get("/assets/due")]);
    setAssets(assetsResponse.data);
    setDue(dueResponse.data);
  }, []);

  useEffect(() => {
    refresh().catch(err => setError(message(err, "Failed to load assets."))).finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) { setRecords([]); return; }
    let cancelled = false;
    setRecords([]);
    setRecordsLoading(true);
    api.get(`/assets/${selectedId}/records`)
      .then(res => { if (!cancelled) setRecords(res.data); })
      .catch(err => { if (!cancelled) setError(message(err, "Failed to load asset records.")); })
      .finally(() => { if (!cancelled) setRecordsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId]);

  const selected = assets.find(asset => asset.id === selectedId);
  const filtered = useMemo(() => assets.filter(asset => {
    const query = search.trim().toLowerCase();
    return (!category || asset.category === category) && (!status || asset.status === status) &&
      (!query || [asset.name, asset.identifier, asset.location, asset.vin, asset.licensePlate, asset.serialNumber].some(value => value?.toLowerCase().includes(query)));
  }), [assets, search, category, status]);
  const overdue = due.filter(item => item.daysUntilDue < 0).length;

  const selectAsset = id => { setSelectedId(id); setAssetForm(null); setRecordForm(null); setError(""); setSuccess(""); };
  const saveAsset = async event => {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try {
      const response = assetForm.id
        ? await api.put(`/assets/${assetForm.id}`, assetForm)
        : await api.post("/assets", assetForm);
      setSelectedId(response.data.id); setAssetForm(null); setSuccess("Asset saved.");
      try { await refresh(); }
      catch (err) { setError(`Asset saved, but the list could not be refreshed: ${message(err, "Reload the page.")}`); }
    } catch (err) { setError(message(err, "Failed to save asset.")); }
    finally { setSaving(false); }
  };
  const saveRecord = async event => {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try {
      if (recordForm.id) await api.put(`/assets/${selectedId}/records/${recordForm.id}`, recordForm);
      else await api.post(`/assets/${selectedId}/records`, recordForm);
      setRecordForm(null); setSuccess("Asset record saved.");
      try {
        const [response] = await Promise.all([api.get(`/assets/${selectedId}/records`), refresh()]);
        setRecords(response.data);
      } catch (err) { setError(`Record saved, but the list could not be refreshed: ${message(err, "Reload the page.")}`); }
    } catch (err) { setError(message(err, "Failed to save asset record.")); }
    finally { setSaving(false); }
  };

  return <div className="flex min-h-screen bg-surface"><HRSidebar />
    <main className="lg:ml-64 flex-1 min-w-0 p-4 lg:p-8 mt-14 lg:mt-0">
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div><h1 className="font-headline font-bold text-display-lg">Asset Management</h1><p className="text-secondary mt-1">Manage equipment, locations, and upcoming requirements.</p></div>
        <button className="btn-primary" onClick={() => { setSelectedId(null); setRecordForm(null); setAssetForm(emptyAsset()); setError(""); setSuccess(""); }}>Add Asset</button>
      </div>
      {error && <div role="alert" className="p-3 mb-4 bg-error-container text-error rounded-lg">{error}</div>}
      {success && <div role="status" className="p-3 mb-4 bg-success-container text-success rounded-lg">{success}</div>}
      {loading ? <p>Loading assets...</p> : <>
        <section className="card mb-6" aria-labelledby="due-heading">
          <h2 id="due-heading" className="font-semibold text-headline-sm">Needs Attention</h2>
          <p className="text-secondary mt-1">{overdue} overdue; {due.length - overdue} due within 30 days. Retired assets are excluded.</p>
          {due.length === 0 ? <p className="text-secondary mt-3">No upcoming or overdue records.</p> : <ul className="divide-y divide-outline-variant mt-3">
            {due.map(item => <li key={item.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
              <button className="text-primary font-semibold text-left" onClick={() => selectAsset(item.assetId)}>{item.assetName}: {item.title}</button>
              <span className={item.daysUntilDue < 0 ? "badge-terminated" : "badge-progress"}>{item.dueDate} {item.daysUntilDue < 0 ? `(${Math.abs(item.daysUntilDue)} days overdue)` : item.daysUntilDue === 0 ? "(due today)" : `(in ${item.daysUntilDue} days)`}</span>
            </li>)}
          </ul>}
        </section>
        <section className="card mb-6" aria-labelledby="assets-heading">
          <h2 id="assets-heading" className="font-semibold text-headline-sm mb-4">Assets ({filtered.length})</h2>
          <div className="grid md:grid-cols-3 gap-3 mb-4">
            <input aria-label="Search assets" className="input-field" placeholder="Search name, location or ID" value={search} onChange={e => setSearch(e.target.value)} />
            <select aria-label="Filter by category" className="input-field" value={category} onChange={e => setCategory(e.target.value)}><option value="">All categories</option>{categories.map(v => <option key={v}>{v}</option>)}</select>
            <select aria-label="Filter by status" className="input-field" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{statuses.map(v => <option key={v}>{v}</option>)}</select>
          </div>
          {filtered.length === 0 ? <p className="text-secondary">No matching assets.</p> : <ul className="divide-y divide-outline-variant">
            {filtered.map(asset => <li key={asset.id} className="py-3 flex flex-wrap justify-between gap-2"><button className="text-primary font-semibold text-left" onClick={() => selectAsset(asset.id)}>{asset.name}</button><span className="text-secondary">{asset.category} · {asset.status} · {asset.location || "No location"}{asset.nextDueDate ? ` · Next due ${asset.nextDueDate}` : ""}</span></li>)}
          </ul>}
        </section>
        {assetForm && <form onSubmit={saveAsset} className="card mb-6 space-y-4">
          <h2 className="font-semibold text-headline-sm">{assetForm.id ? "Edit Asset" : "Add Asset"}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Asset name *"><input required maxLength={255} className="input-field" value={assetForm.name} onChange={e => setAssetForm({ ...assetForm, name: e.target.value })} /></Field>
            <Field label="Category *"><select className="input-field" value={assetForm.category} onChange={e => setAssetForm({ ...assetForm, category: e.target.value })}>{categories.map(v => <option key={v}>{v}</option>)}</select></Field>
            <Field label="Asset identifier"><input maxLength={255} className="input-field" value={assetForm.identifier || ""} onChange={e => setAssetForm({ ...assetForm, identifier: e.target.value })} /></Field>
            <Field label="Location"><input maxLength={255} className="input-field" value={assetForm.location || ""} onChange={e => setAssetForm({ ...assetForm, location: e.target.value })} /></Field>
            <Field label="Status *"><select className="input-field" value={assetForm.status} onChange={e => setAssetForm({ ...assetForm, status: e.target.value })}>{statuses.map(v => <option key={v}>{v}</option>)}</select></Field>
            {assetForm.category === "Vehicle" && <>
              <Field label="VIN"><input maxLength={100} className="input-field" value={assetForm.vin || ""} onChange={e => setAssetForm({ ...assetForm, vin: e.target.value })} /></Field>
              <Field label="License plate"><input maxLength={100} className="input-field" value={assetForm.licensePlate || ""} onChange={e => setAssetForm({ ...assetForm, licensePlate: e.target.value })} /></Field>
            </>}
            <Field label="Serial number"><input maxLength={255} className="input-field" value={assetForm.serialNumber || ""} onChange={e => setAssetForm({ ...assetForm, serialNumber: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><textarea maxLength={10000} className="input-field" rows={3} value={assetForm.notes || ""} onChange={e => setAssetForm({ ...assetForm, notes: e.target.value })} /></Field>
          {assetForm.category !== "Vehicle" && (assetForm.vin || assetForm.licensePlate) && <p className="text-secondary text-sm">Existing vehicle details are retained if you change the category. Select Vehicle to view or edit them.</p>}
          {!assetForm.id && <p className="text-secondary text-sm">After saving the asset, add its documents and due dates under Documents &amp; Due Dates.</p>}
          <div className="flex gap-3"><button disabled={saving} className="btn-primary">{saving ? "Saving..." : "Save Asset"}</button><button type="button" className="btn-secondary" onClick={() => setAssetForm(null)} disabled={saving}>Cancel</button></div>
        </form>}
        {selected && !assetForm && <section className="card mb-6" aria-labelledby="detail-heading">
          <div className="flex flex-wrap justify-between gap-3 mb-4"><div><h2 id="detail-heading" className="font-semibold text-headline-sm">{selected.name}</h2><p className="text-secondary">{selected.category} · {selected.status} · {selected.location || "No location"}</p></div><div className="flex gap-2"><button className="btn-secondary" onClick={() => { setAssetForm({ ...selected }); setRecordForm(null); }}>Edit Asset</button><button className="btn-primary" onClick={() => { setRecordForm(emptyRecord()); setError(""); setSuccess(""); }}>Add Document / Due Date</button></div></div>
          <div className="text-secondary text-sm mb-4 break-words">{selected.identifier && <p>Identifier: {selected.identifier}</p>}{selected.vin && <p>VIN: {selected.vin}</p>}{selected.licensePlate && <p>License plate: {selected.licensePlate}</p>}{selected.serialNumber && <p>Serial number: {selected.serialNumber}</p>}{selected.notes && <p>Notes: {selected.notes}</p>}</div>
          <h3 className="font-semibold text-lg">Documents &amp; Due Dates</h3>
          <p className="text-secondary text-sm mt-1">Add a separate record for each {recordExamples[selected.category]}. Each record can include a Google Drive or Docs link.</p>
          {recordsLoading ? <p>Loading records...</p> : records.length === 0 ? <p className="text-secondary mt-2">No documents or due dates added yet.</p> : <ul className="divide-y divide-outline-variant">
            {records.map(record => <li key={record.id} className="py-3 flex flex-wrap justify-between gap-3"><div className="min-w-0 break-words"><p className="font-semibold">{record.title} <span className="text-secondary font-normal">· {record.category} · {record.status}</span></p><p className="text-secondary">Due: {record.dueDate}</p>{record.notes && <p className="text-secondary">{record.notes}</p>}{record.documentUrl && <a className="text-primary underline" href={record.documentUrl} target="_blank" rel="noopener noreferrer">Open {record.category} document in Google Drive or Docs</a>}</div><button className="btn-secondary" onClick={() => { setRecordForm({ ...record }); setError(""); setSuccess(""); }}>Edit</button></li>)}
          </ul>}
          {recordForm && <form onSubmit={saveRecord} className="mt-5 pt-4 border-t border-outline-variant space-y-4">
            <h3 className="font-semibold text-lg">{recordForm.id ? "Edit Document / Due Date" : `Add Document / Due Date for ${selected.name}`}</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Document / record type *"><select required className="input-field" value={recordForm.category} onChange={e => setRecordForm({ ...recordForm, category: e.target.value })}>
                <option value="">Select a type</option>
                <optgroup label={`Suggested for ${selected.category}`}>
                  {suggestedRecordCategories[selected.category].map(value => <option key={value} value={value}>{value}</option>)}
                </optgroup>
                <optgroup label="Other types">
                  {recordCategories.filter(value => !suggestedRecordCategories[selected.category].includes(value)).map(value => <option key={value} value={value}>{value}</option>)}
                </optgroup>
              </select></Field>
              <Field label="Document / record name *"><input required maxLength={255} className="input-field" placeholder={selected.category === "Vehicle" ? "e.g. vehicle insurance" : "e.g. inspection certificate"} value={recordForm.title} onChange={e => setRecordForm({ ...recordForm, title: e.target.value })} /></Field>
              <Field label="Due / expiration date *"><input required type="date" className="input-field" value={recordForm.dueDate} onChange={e => setRecordForm({ ...recordForm, dueDate: e.target.value })} /></Field>
              <Field label="Status *"><select className="input-field" value={recordForm.status} onChange={e => setRecordForm({ ...recordForm, status: e.target.value })}><option>Open</option><option>Resolved</option></select></Field>
              <Field label="Document link (Google Drive or Docs)"><input type="url" maxLength={2048} className="input-field" placeholder="https://drive.google.com/..." value={recordForm.documentUrl || ""} onChange={e => setRecordForm({ ...recordForm, documentUrl: e.target.value })} /></Field>
            </div>
            <Field label="Notes"><textarea maxLength={10000} className="input-field" rows={2} value={recordForm.notes || ""} onChange={e => setRecordForm({ ...recordForm, notes: e.target.value })} /></Field>
            <p className="text-secondary text-sm">The link opens the document in Google Drive or Docs; access and download permissions are managed by Google. No file is uploaded to this portal.</p>
            <p className="text-secondary text-sm">Resolved records and records on retired assets do not send reminders. For a renewal, update the due date and keep the record open.</p>
            <div className="flex gap-3"><button disabled={saving} className="btn-primary">{saving ? "Saving..." : "Save Record"}</button><button type="button" className="btn-secondary" onClick={() => setRecordForm(null)} disabled={saving}>Cancel</button></div>
          </form>}
        </section>}
      </>}
    </main>
  </div>;
}