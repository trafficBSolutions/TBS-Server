import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { toast } from 'react-hot-toast';
import '../../css/invoice.css';

const ALLOWED_EMAILS = new Set([
  'tbsolutions9@gmail.com',
  'tbsolutions1999@gmail.com',
  'trafficandbarriersolutions.ap@gmail.com',
  'tbsellen@gmail.com',
  'tbsolutions1995@gmail.com',
  'materialworx2@gmail.com',
  'tbsolutions4@gmail.com',
]);

const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—';
const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return `${hr > 12 ? hr - 12 : hr || 12}:${m}${hr >= 12 ? 'PM' : 'AM'}`;
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const STATUS_BADGE = {
  paid:   { bg: '#27ae60', color: '#fff', label: '✓ Paid' },
  unpaid: { bg: '#17365D', color: '#fff', label: '● Sent/Unpaid' },
};

const BLUE = '#17365D';
const BLUE_LIGHT = 'rgba(23,54,93,0.08)';
const BLUE_MED = 'rgba(23,54,93,0.2)';
const BLUE_BORDER = 'rgba(23,54,93,0.35)';

const DEFAULT_ROWS = [
  { id: 1, description: 'Traffic Control Services', hours: '', rate: '', amount: 0 },
  { id: 2, description: 'Flaggers', hours: '', rate: '', amount: 0 },
  { id: 3, description: 'Arrow Board', hours: '', rate: '', amount: 0 },
  { id: 4, description: 'Truck(s)', hours: '', rate: '', amount: 0 },
];

const TC_QUICK_ADD = [
  { key: 'mileage',       label: 'Mileage',                   description: 'Mileage',                   rate: '0.82' },
  { key: 'addFlagger',    label: 'Additional Flagger',        description: 'Additional Flagger',        rate: '' },
  { key: 'arrowBoard',    label: 'Arrow Board',               description: 'Arrow Board',               rate: '' },
  { key: 'msgBoard',      label: 'Message Board',             description: 'Message Board',             rate: '' },
  { key: 'tcPlan',        label: 'Traffic Control Plan',      description: 'Traffic Control Plan',      rate: '' },
  { key: 'addEquip',      label: 'Additional Equipment',      description: 'Additional Equipment',      rate: '' },
  { key: 'equipLeftOver', label: 'Equipment Left Over Hours', description: 'Equipment Left Over Hours', rate: '' },
  { key: 'police',        label: 'Police Officers',           description: 'Police Officers',           rate: '' },
  { key: 'emergLights',   label: 'Emergency Lights',          description: 'Emergency Lights',          rate: '' },
];

function QuickAddPanel({ rows, setRows, items, accentColor, accentLight, accentBorder }) {
  return (
    <div style={{ marginBottom: 12, background: accentLight, border: `1px solid ${accentBorder}`, borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: accentColor, marginBottom: 8 }}>⚡ Quick Add Line Items</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px' }}>
        {items.map(({ key, label, description, rate }) => {
          const already = rows.some(r => r.description === description);
          return (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: already ? 'default' : 'pointer', color: already ? '#aaa' : '#1a1a1a', userSelect: 'none' }}>
              <input type="checkbox" checked={already} disabled={already}
                onChange={() => { if (!already) setRows(p => [...p, { id: Date.now() + Math.random(), description, hours: '', rate, amount: 0 }]); }}
                style={{ accentColor, cursor: already ? 'default' : 'pointer' }} />
              {label}{rate !== '' ? <span style={{ color: '#888', fontSize: 11 }}> (${rate}/mi)</span> : ''}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function InvoiceForm({ wos, onSent, onCancel }) {
  const draftKey = `tc-draft-${wos.map(w => w._id).join('-')}`;
  const loadDraft = () => { try { return JSON.parse(localStorage.getItem(draftKey) || 'null'); } catch { return null; } };
  const draft = loadDraft();

  const [client, setClient] = useState(draft?.client || '');
  const [clientCompany, setClientCompany] = useState(draft?.clientCompany || wos[0]?.basic?.client || '');
  const [clientEmail, setClientEmail] = useState(draft?.clientEmail || '');

  const [description, setDescription] = useState(draft?.description || '');
  const [invoiceNumber, setInvoiceNumber] = useState(draft?.invoiceNumber || '');
  const [projectNumber, setProjectNumber] = useState(draft?.projectNumber || wos[0]?.basic?.project || '');
  const [invoiceDate, setInvoiceDate] = useState(draft?.invoiceDate || new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(draft?.notes || '');
  const [rows, setRows] = useState(draft?.rows || DEFAULT_ROWS);
  const [sending, setSending] = useState(false);
  const [images, setImages] = useState([]);
  const [extraPdfs, setExtraPdfs] = useState([]);
  const [draftSaved, setDraftSaved] = useState(false);

  const saveDraft = () => {
    localStorage.setItem(draftKey, JSON.stringify({ client, clientCompany, clientEmail, description, invoiceNumber, projectNumber, invoiceDate, notes, rows }));
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
  };
  const clearDraft = () => localStorage.removeItem(draftKey);
  const total = useMemo(() => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0), [rows]);

  const handleImageAdd = (e) => {
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => setImages(prev => [...prev, { name: file.name, dataUrl: ev.target.result }]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handlePdfAdd = (e) => {
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => setExtraPdfs(prev => [...prev, { name: file.name, dataUrl: ev.target.result }]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleSend = async () => {
    if (!client.trim()) return toast.error('Client name is required');
    if (!clientEmail.trim()) return toast.error('Client email is required');
    if (!invoiceNumber.trim()) return toast.error('Invoice number is required');
    setSending(true);
    try {
      await api.post('/api/tc-invoicing/send', {
        workOrderIds: wos.map(w => w._id),
        wosData: wos,
        client, clientEmail, clientCompany,
        description, invoiceNumber, projectNumber, invoiceDate, notes, rows, total,
        images: images.map(img => ({ name: img.name, dataUrl: img.dataUrl })),
        extraPdfs: extraPdfs.map(p => ({ name: p.name, dataUrl: p.dataUrl })),
      });
      toast.success(`Invoice sent to ${clientEmail}!`);
      clearDraft();
      onSent();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send invoice');
    } finally {
      setSending(false);
    }
  };

  const dateRange = wos.length === 1
    ? wos[0].basic?.dateOfJob
    : `${wos[0].basic?.dateOfJob} – ${wos[wos.length - 1].basic?.dateOfJob}`;

  const inputStyle = { width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #ced4da', fontSize: 13, boxSizing: 'border-box' };

  return (
    <div style={{ padding: 20, border: `1px solid ${BLUE_BORDER}`, borderRadius: 10, background: '#fff', boxShadow: '0 4px 16px rgba(23,54,93,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>📄 Invoice — {dateRange} · {wos.length} Work Order{wos.length > 1 ? 's' : ''}</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {draft && <span style={{ fontSize: 11, color: '#888' }}>Draft loaded</span>}
          <button onClick={saveDraft} style={{ fontSize: 11, padding: '4px 12px', background: BLUE_LIGHT, border: `1px solid ${BLUE_BORDER}`, color: BLUE, borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>
            {draftSaved ? '✓ Saved!' : '💾 Save Draft'}
          </button>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' }}>✕</button>
        </div>
      </div>

      {/* WO Summaries */}
      {wos.map((wo, i) => (
        <div key={wo._id} style={{ background: BLUE_LIGHT, border: `1px solid ${BLUE_BORDER}`, borderRadius: 8, padding: 12, marginBottom: 10, fontSize: 13 }}>
          <strong>Work Order {wos.length > 1 ? `#${i + 1} — ` : ''}{wo.basic?.dateOfJob}</strong>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6 }}>
            <span>Client: <strong>{wo.basic?.client}</strong></span>
            <span>Project: <strong>{wo.basic?.project}</strong></span>
            <span>Coordinator: <strong>{wo.basic?.coordinator}</strong></span>
            <span>Foreman: <strong>{wo.basic?.foremanName}</strong></span>
            <span>Time: <strong>{fmtTime(wo.basic?.startTime)} – {fmtTime(wo.basic?.endTime)}</strong></span>
            <span>Flaggers: <strong>{[wo.tbs?.flagger1, wo.tbs?.flagger2, wo.tbs?.flagger3].filter(Boolean).join(', ') || '—'}</strong></span>
          </div>
        </div>
      ))}

      {/* Invoice Fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {[
          { label: 'TBS Invoice #*', value: invoiceNumber, onChange: e => setInvoiceNumber(e.target.value.toUpperCase()), placeholder: 'e.g. 2026TC001' },
          { label: 'Project / Task #', value: projectNumber, onChange: e => setProjectNumber(e.target.value.toUpperCase()), placeholder: 'e.g. PROJ-001' },
          { label: 'Invoice Date', value: invoiceDate, onChange: e => setInvoiceDate(e.target.value), type: 'date' },
          { label: 'Representative*', value: client, onChange: e => setClient(e.target.value), placeholder: 'Contact name' },
          { label: 'Company', value: clientCompany, onChange: e => setClientCompany(e.target.value), placeholder: 'Company name' },
          { label: 'Client Email*', value: clientEmail, onChange: e => setClientEmail(e.target.value), placeholder: 'client@example.com', type: 'email' },
        ].map(({ label, ...props }) => (
          <div key={label}>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 3 }}>{label}</label>
            <input {...props} style={inputStyle} />
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 3 }}>Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
          placeholder="Brief description of work performed…" style={{ ...inputStyle, resize: 'vertical' }} />
      </div>

      <QuickAddPanel rows={rows} setRows={setRows} items={TC_QUICK_ADD} accentColor={BLUE} accentLight={BLUE_LIGHT} accentBorder={BLUE_BORDER} />

      {/* Line Items */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>Line Items</label>
          <button type="button" className="btn" style={{ fontSize: 11, padding: '3px 10px' }}
            onClick={() => setRows(r => [...r, { id: Date.now(), description: '', hours: '', rate: '', amount: 0 }])}>+ Add Line</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: `linear-gradient(135deg, ${BLUE}, #2a5298)`, color: '#fff' }}>
              <th style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.2)', textAlign: 'left' }}>Description</th>
              <th style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.2)', width: 80, textAlign: 'right' }}>Quantity</th>
              <th style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.2)', width: 100, textAlign: 'right' }}>Per Unit</th>
              <th style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.2)', width: 110, textAlign: 'right' }}>Amount</th>
              <th style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.2)', width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={{ padding: 4, border: '1px solid #ddd' }}>
                  <input value={r.description} onChange={e => setRows(p => p.map(x => x.id === r.id ? { ...x, description: e.target.value } : x))}
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 3 }} />
                </td>
                <td style={{ padding: 4, border: '1px solid #ddd' }}>
                  <input type="number" step="0.25" min="0" value={r.hours} placeholder="—"
                    onChange={e => { const hours = e.target.value; setRows(p => p.map(x => { if (x.id !== r.id) return x; const amt = hours !== '' && x.rate !== '' ? Number(hours) * Number(x.rate) : x.amount; return { ...x, hours, amount: amt }; })); }}
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 3, textAlign: 'right' }} />
                </td>
                <td style={{ padding: 4, border: '1px solid #ddd' }}>
                  <input type="number" step="0.01" min="0" value={r.rate} placeholder="—"
                    onChange={e => { const rate = e.target.value; setRows(p => p.map(x => { if (x.id !== r.id) return x; const amt = rate !== '' && x.hours !== '' ? Number(x.hours) * Number(rate) : x.amount; return { ...x, rate, amount: amt }; })); }}
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 3, textAlign: 'right' }} />
                </td>
                <td style={{ padding: 4, border: '1px solid #ddd' }}>
                  <input type="number" step="0.01" min="0" value={r.amount}
                    onChange={e => setRows(p => p.map(x => x.id === r.id ? { ...x, amount: Number(e.target.value), hours: '', rate: '' } : x))}
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 3, textAlign: 'right' }} />
                </td>
                <td style={{ padding: 4, border: '1px solid #ddd', textAlign: 'center' }}>
                  <button type="button" onClick={() => setRows(p => p.filter(x => x.id !== r.id))}
                    style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f0f0f0', fontWeight: 700 }}>
              <td style={{ padding: '6px 8px', border: '1px solid #ddd', textAlign: 'right' }} colSpan={3}>TOTAL</td>
              <td style={{ padding: '6px 8px', border: '1px solid #ddd', textAlign: 'right' }}>${total.toFixed(2)}</td>
              <td style={{ border: '1px solid #ddd' }}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Extra PDFs */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>📎 Attach PDFs (optional)</label>
          <label style={{ fontSize: 11, padding: '3px 10px', background: BLUE_LIGHT, border: `1px solid ${BLUE_BORDER}`, color: BLUE, borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>
            + Add PDFs
            <input type="file" accept="application/pdf" multiple onChange={handlePdfAdd} style={{ display: 'none' }} />
          </label>
        </div>
        {extraPdfs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {extraPdfs.map((pdf, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 6, padding: '6px 10px' }}>
                <span style={{ fontSize: 13 }}>📄</span>
                <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pdf.name}</span>
                <button onClick={() => setExtraPdfs(prev => prev.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Images */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>📷 Attach Images (optional)</label>
          <label style={{ fontSize: 11, padding: '3px 10px', background: BLUE_LIGHT, border: `1px solid ${BLUE_BORDER}`, color: BLUE, borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>
            + Add Images
            <input type="file" accept="image/*" multiple onChange={handleImageAdd} style={{ display: 'none' }} />
          </label>
        </div>
        {images.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {images.map((img, i) => (
              <div key={i} style={{ position: 'relative', border: `1px solid ${BLUE_BORDER}`, borderRadius: 6, overflow: 'hidden', width: 90, height: 90, flexShrink: 0 }}>
                <img src={img.dataUrl} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                <button onClick={e => { e.stopPropagation(); setImages(prev => prev.filter((_, j) => j !== i)); }}
                  style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 18, height: 18, color: '#fff', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 9, padding: '2px 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{img.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          style={{ ...inputStyle, resize: 'vertical' }} />
      </div>

      <button onClick={handleSend} disabled={sending}
        style={{ fontSize: 13, padding: '8px 20px', background: `linear-gradient(135deg, ${BLUE}, #2a5298)`, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}>
        {sending ? 'Sending…' : `📧 Send Invoice (${wos.length} WO${wos.length > 1 ? 's' : ''})`}
      </button>
    </div>
  );
}

function EditInvoiceModal({ inv, onClose, onSaved }) {
  const [client, setClient] = useState(inv.client || '');
  const [clientCompany, setClientCompany] = useState(inv.clientCompany || '');
  const [clientEmail, setClientEmail] = useState(inv.clientEmail || '');
  const [description, setDescription] = useState(inv.description || '');
  const [invoiceNumber, setInvoiceNumber] = useState(inv.invoiceNumber || '');
  const [projectNumber, setProjectNumber] = useState(inv.projectNumber || '');
  const [invoiceDate, setInvoiceDate] = useState(inv.invoiceDate || '');
  const [notes, setNotes] = useState(inv.notes || '');
  const [rows, setRows] = useState(inv.rows?.length ? inv.rows.map((r, i) => ({ ...r, id: i, hours: r.hours ?? '', rate: r.rate ?? '' })) : [{ id: 0, description: '', hours: '', rate: '', amount: 0 }]);
  const [resendEmail, setResendEmail] = useState(inv.clientEmail || '');
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);

  const total = useMemo(() => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0), [rows]);

  const handleSave = async () => {
    if (!client.trim() || !clientEmail.trim() || !invoiceNumber.trim()) return toast.error('Name, email, and invoice # required');
    setSaving(true);
    try {
      await api.put(`/api/tc-invoicing/${inv._id}`, { client, clientEmail, clientCompany, description, invoiceNumber, projectNumber, invoiceDate, notes, rows, total });
      toast.success('Invoice updated!');
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleResend = async () => {
    if (!resendEmail.trim()) return toast.error('Email required');
    setResending(true);
    try {
      await api.post(`/api/tc-invoicing/${inv._id}/resend`, { clientEmail: resendEmail });
      toast.success(`Invoice resent to ${resendEmail}!`);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to resend');
    } finally { setResending(false); }
  };

  const inputStyle = { width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #ced4da', fontSize: 13, boxSizing: 'border-box' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>✏️ Edit Invoice — {inv.invoiceNumber}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          {[
            { label: 'TBS Invoice #*', value: invoiceNumber, onChange: e => setInvoiceNumber(e.target.value.toUpperCase()) },
            { label: 'Project / Task #', value: projectNumber, onChange: e => setProjectNumber(e.target.value.toUpperCase()) },
            { label: 'Invoice Date', value: invoiceDate, onChange: e => setInvoiceDate(e.target.value), type: 'date' },
            { label: 'Representative*', value: client, onChange: e => setClient(e.target.value) },
            { label: 'Company', value: clientCompany, onChange: e => setClientCompany(e.target.value) },
            { label: 'Client Email*', value: clientEmail, onChange: e => setClientEmail(e.target.value), type: 'email' },
                ].map(({ label, ...props }) => (
            <div key={label}>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 3 }}>{label}</label>
              <input {...props} style={inputStyle} />
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 3 }}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Line Items</label>
            <button type="button" className="btn" style={{ fontSize: 11, padding: '3px 10px' }}
              onClick={() => setRows(r => [...r, { id: Date.now(), description: '', hours: '', rate: '', amount: 0 }])}>+ Add Line</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: `linear-gradient(135deg, ${BLUE}, #2a5298)`, color: '#fff' }}>
                {['Description','Qty','Per Unit','Amount',''].map(h => (
                  <th key={h} style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.2)', textAlign: h === 'Description' ? 'left' : 'right', width: h === '' ? 36 : h === 'Description' ? undefined : 90 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ padding: 4, border: '1px solid #ddd' }}>
                    <input value={r.description} onChange={e => setRows(p => p.map(x => x.id === r.id ? { ...x, description: e.target.value } : x))}
                      style={{ width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 3 }} />
                  </td>
                  <td style={{ padding: 4, border: '1px solid #ddd' }}>
                    <input type="number" step="0.25" min="0" value={r.hours} placeholder="—"
                      onChange={e => { const hours = e.target.value; setRows(p => p.map(x => x.id !== r.id ? x : { ...x, hours, amount: hours !== '' && x.rate !== '' ? Number(hours) * Number(x.rate) : x.amount })); }}
                      style={{ width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 3, textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: 4, border: '1px solid #ddd' }}>
                    <input type="number" step="0.01" min="0" value={r.rate} placeholder="—"
                      onChange={e => { const rate = e.target.value; setRows(p => p.map(x => x.id !== r.id ? x : { ...x, rate, amount: rate !== '' && x.hours !== '' ? Number(x.hours) * Number(rate) : x.amount })); }}
                      style={{ width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 3, textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: 4, border: '1px solid #ddd' }}>
                    <input type="number" step="0.01" min="0" value={r.amount}
                      onChange={e => setRows(p => p.map(x => x.id === r.id ? { ...x, amount: Number(e.target.value) } : x))}
                      style={{ width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 3, textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: 4, border: '1px solid #ddd', textAlign: 'center' }}>
                    <button type="button" onClick={() => setRows(p => p.filter(x => x.id !== r.id))}
                      style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f0f0f0', fontWeight: 700 }}>
                <td colSpan={3} style={{ padding: '6px 8px', border: '1px solid #ddd', textAlign: 'right' }}>TOTAL</td>
                <td style={{ padding: '6px 8px', border: '1px solid #ddd', textAlign: 'right' }}>${total.toFixed(2)}</td>
                <td style={{ border: '1px solid #ddd' }}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        <div style={{ background: BLUE_LIGHT, border: `1px solid ${BLUE_BORDER}`, borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>📧 Resend Invoice To</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="email" value={resendEmail} onChange={e => setResendEmail(e.target.value)} placeholder="client@example.com"
              style={{ flex: 1, padding: '6px 8px', borderRadius: 4, border: '1px solid #ced4da', fontSize: 13 }} />
            <button onClick={handleResend} disabled={resending}
              style={{ padding: '6px 16px', background: `linear-gradient(135deg, ${BLUE}, #2a5298)`, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: resending ? 'not-allowed' : 'pointer', opacity: resending ? 0.7 : 1, fontSize: 13, whiteSpace: 'nowrap' }}>
              {resending ? 'Sending…' : '📤 Resend'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '8px 20px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontSize: 13 }}>
            {saving ? 'Saving…' : '💾 Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Calendar({ year, month, wosByDate, invoicesByWoId, onDayClick, selectedDates }) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const pad = (n) => String(n).padStart(2, '0');
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 6 }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: BLUE, padding: '6px 0', borderBottom: `2px solid ${BLUE_BORDER}` }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={`e${idx}`} style={{ minHeight: 72 }} />;
          const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
          const wos = wosByDate[dateStr] || [];
          const hasWo = wos.length > 0;
          const statuses = wos.map(wo => invoicesByWoId[wo._id]?.payStatus || null);
          const allPaid = statuses.length > 0 && statuses.every(s => s === 'paid');
          const anySent = statuses.some(s => s === 'unpaid');
          const isSelected = selectedDates.has(dateStr);
          const isToday = dateStr === todayStr;

          let bg = '#fafafa', borderColor = '#e8e8e8';
          if (allPaid)      { bg = '#eafaf1'; borderColor = '#a9dfbf'; }
          else if (anySent) { bg = BLUE_LIGHT; borderColor = BLUE_BORDER; }
          else if (hasWo)   { bg = 'rgba(23,54,93,0.04)'; borderColor = 'rgba(23,54,93,0.2)'; }
          if (isSelected)   { borderColor = BLUE; }

          return (
            <div key={day} onClick={() => hasWo && onDayClick(dateStr)}
              style={{ minHeight: 72, padding: '6px 7px', borderRadius: 8, background: bg, border: `${isSelected ? '2px' : '1px'} solid ${borderColor}`, cursor: hasWo ? 'pointer' : 'default', boxShadow: isSelected ? `0 0 0 3px ${BLUE_MED}` : hasWo ? '0 1px 4px rgba(0,0,0,0.06)' : 'none', transition: 'box-shadow 0.15s' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: isToday ? '#fff' : hasWo ? BLUE : '#555', background: isToday ? BLUE : 'transparent', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 3 }}>{day}</div>
              {wos.map(wo => {
                const inv = invoicesByWoId[wo._id];
                const badge = inv ? STATUS_BADGE[inv.payStatus] : null;
                return (
                  <div key={wo._id} style={{ marginBottom: 3 }}>
                    <div style={{ fontSize: 10, color: '#333', fontWeight: 600, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      🚦 {wo.basic?.client}
                    </div>
                    <span style={{ display: 'inline-block', fontSize: 9, padding: '1px 5px', borderRadius: 3, marginTop: 1, fontWeight: 700, background: badge ? badge.bg : '#e0e0e0', color: badge ? badge.color : '#666' }}>
                      {badge ? badge.label : 'Not Billed'}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 12, flexWrap: 'wrap', paddingTop: 10, borderTop: `1px solid ${BLUE_BORDER}` }}>
        {[
          { bg: 'rgba(23,54,93,0.04)', border: `1px solid rgba(23,54,93,0.2)`, label: 'Has WO — Not Billed' },
          { bg: BLUE_LIGHT, border: `1px solid ${BLUE_BORDER}`, label: 'Invoice Sent (Unpaid)' },
          { bg: '#eafaf1', border: '1px solid #a9dfbf', label: 'All Paid' },
        ].map(({ bg, border, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, background: bg, border, flexShrink: 0 }} />
            <span style={{ color: '#555', fontWeight: 600 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaperInvoiceForm({ onSent, onCancel }) {
  const draftKey = 'tc-paper-draft';
  const loadDraft = () => { try { return JSON.parse(localStorage.getItem(draftKey) || 'null'); } catch { return null; } };
  const draft = loadDraft();

  const [jobDate, setJobDate] = useState(draft?.jobDate || new Date().toISOString().slice(0, 10));
  const [jobClient, setJobClient] = useState(draft?.jobClient || '');
  const [jobProject, setJobProject] = useState(draft?.jobProject || '');
  const [jobCoordinator, setJobCoordinator] = useState(draft?.jobCoordinator || '');
  const [jobForeman, setJobForeman] = useState(draft?.jobForeman || '');
  const [jobStartTime, setJobStartTime] = useState(draft?.jobStartTime || '');
  const [jobEndTime, setJobEndTime] = useState(draft?.jobEndTime || '');
  const [jobFlaggers, setJobFlaggers] = useState(draft?.jobFlaggers || '');
  const [client, setClient] = useState(draft?.client || '');
  const [clientCompany, setClientCompany] = useState(draft?.clientCompany || '');
  const [clientEmail, setClientEmail] = useState(draft?.clientEmail || '');
  const [description, setDescription] = useState(draft?.description || '');
  const [invoiceNumber, setInvoiceNumber] = useState(draft?.invoiceNumber || '');
  const [projectNumber, setProjectNumber] = useState(draft?.projectNumber || '');
  const [invoiceDate, setInvoiceDate] = useState(draft?.invoiceDate || new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(draft?.notes || '');
  const [rows, setRows] = useState(draft?.rows || DEFAULT_ROWS);
  const [images, setImages] = useState([]);
  const [extraPdfs, setExtraPdfs] = useState([]);
  const [sending, setSending] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  const total = useMemo(() => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0), [rows]);

  const saveDraft = () => {
    localStorage.setItem(draftKey, JSON.stringify({ jobDate, jobClient, jobProject, jobCoordinator, jobForeman, jobStartTime, jobEndTime, jobFlaggers, client, clientCompany, clientEmail, description, invoiceNumber, projectNumber, invoiceDate, notes, rows }));
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
  };
  const clearDraft = () => localStorage.removeItem(draftKey);

  const handleImageAdd = (e) => {
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => setImages(prev => [...prev, { name: file.name, dataUrl: ev.target.result }]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handlePdfAdd = (e) => {
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => setExtraPdfs(prev => [...prev, { name: file.name, dataUrl: ev.target.result }]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleSend = async () => {
    if (!client.trim()) return toast.error('Representative name is required');
    if (!clientEmail.trim()) return toast.error('Client email is required');
    if (!invoiceNumber.trim()) return toast.error('Invoice number is required');
    if (!jobDate) return toast.error('Job date is required');
    setSending(true);
    const syntheticWo = {
      _id: `paper-${Date.now()}`,
      basic: { dateOfJob: jobDate, client: jobClient, project: jobProject, coordinator: jobCoordinator, foremanName: jobForeman, startTime: jobStartTime, endTime: jobEndTime },
      tbs: { flagger1: jobFlaggers },
    };
    try {
      await api.post('/api/tc-invoicing/send', {
        workOrderIds: [],
        wosData: [syntheticWo],
        isPaperWorkOrder: true,
        client, clientEmail, clientCompany,
        description, invoiceNumber, projectNumber, invoiceDate, notes, rows, total,
        images: images.map(img => ({ name: img.name, dataUrl: img.dataUrl })),
        extraPdfs: extraPdfs.map(p => ({ name: p.name, dataUrl: p.dataUrl })),
      });
      toast.success(`Invoice sent to ${clientEmail}!`);
      clearDraft();
      onSent();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send invoice');
    } finally {
      setSending(false);
    }
  };

  const inputStyle = { width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #ced4da', fontSize: 13, boxSizing: 'border-box' };

  return (
    <div style={{ padding: 20, border: `2px solid #e67e22`, borderRadius: 10, background: '#fff', boxShadow: '0 4px 16px rgba(230,126,34,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>📋 Paper Work Order Invoice</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {draft && <span style={{ fontSize: 11, color: '#888' }}>Draft loaded</span>}
          <button onClick={saveDraft} style={{ fontSize: 11, padding: '4px 12px', background: BLUE_LIGHT, border: `1px solid ${BLUE_BORDER}`, color: BLUE, borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>
            {draftSaved ? '✓ Saved!' : '💾 Save Draft'}
          </button>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' }}>✕</button>
        </div>
      </div>

      {/* Paper WO Job Details */}
      <div style={{ background: 'rgba(230,126,34,0.07)', border: '1px solid rgba(230,126,34,0.3)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#e67e22', marginBottom: 10 }}>📄 Job Details (from paper work order)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Date of Job*', value: jobDate, onChange: e => setJobDate(e.target.value), type: 'date' },
            { label: 'Client / Company', value: jobClient, onChange: e => setJobClient(e.target.value), placeholder: 'Client name' },
            { label: 'Project / Task #', value: jobProject, onChange: e => setJobProject(e.target.value), placeholder: 'Project number' },
            { label: 'Coordinator', value: jobCoordinator, onChange: e => setJobCoordinator(e.target.value), placeholder: 'Coordinator name' },
            { label: 'Foreman', value: jobForeman, onChange: e => setJobForeman(e.target.value), placeholder: 'Foreman name' },
            { label: 'Start Time', value: jobStartTime, onChange: e => setJobStartTime(e.target.value), type: 'time' },
            { label: 'End Time', value: jobEndTime, onChange: e => setJobEndTime(e.target.value), type: 'time' },
            { label: 'Flaggers', value: jobFlaggers, onChange: e => setJobFlaggers(e.target.value), placeholder: 'e.g. John, Jane' },
          ].map(({ label, ...props }) => (
            <div key={label}>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 3 }}>{label}</label>
              <input {...props} style={inputStyle} />
            </div>
          ))}
        </div>
      </div>

      {/* Invoice Fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {[
          { label: 'TBS Invoice #*', value: invoiceNumber, onChange: e => setInvoiceNumber(e.target.value.toUpperCase()), placeholder: 'e.g. 2026TC001' },
          { label: 'Invoice Date', value: invoiceDate, onChange: e => setInvoiceDate(e.target.value), type: 'date' },
          { label: 'Representative*', value: client, onChange: e => setClient(e.target.value), placeholder: 'Contact name' },
          { label: 'Company', value: clientCompany, onChange: e => setClientCompany(e.target.value), placeholder: 'Company name' },
          { label: 'Client Email*', value: clientEmail, onChange: e => setClientEmail(e.target.value), placeholder: 'client@example.com', type: 'email' },
        ].map(({ label, ...props }) => (
          <div key={label}>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 3 }}>{label}</label>
            <input {...props} style={inputStyle} />
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 3 }}>Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
          placeholder="Brief description of work performed…" style={{ ...inputStyle, resize: 'vertical' }} />
      </div>

      <QuickAddPanel rows={rows} setRows={setRows} items={TC_QUICK_ADD} accentColor={BLUE} accentLight={BLUE_LIGHT} accentBorder={BLUE_BORDER} />

      {/* Line Items */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>Line Items</label>
          <button type="button" className="btn" style={{ fontSize: 11, padding: '3px 10px' }}
            onClick={() => setRows(r => [...r, { id: Date.now(), description: '', hours: '', rate: '', amount: 0 }])}>+ Add Line</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: `linear-gradient(135deg, ${BLUE}, #2a5298)`, color: '#fff' }}>
              <th style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.2)', textAlign: 'left' }}>Description</th>
              <th style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.2)', width: 80, textAlign: 'right' }}>Quantity</th>
              <th style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.2)', width: 100, textAlign: 'right' }}>Per Unit</th>
              <th style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.2)', width: 110, textAlign: 'right' }}>Amount</th>
              <th style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.2)', width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={{ padding: 4, border: '1px solid #ddd' }}>
                  <input value={r.description} onChange={e => setRows(p => p.map(x => x.id === r.id ? { ...x, description: e.target.value } : x))}
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 3 }} />
                </td>
                <td style={{ padding: 4, border: '1px solid #ddd' }}>
                  <input type="number" step="0.25" min="0" value={r.hours} placeholder="—"
                    onChange={e => { const hours = e.target.value; setRows(p => p.map(x => { if (x.id !== r.id) return x; const amt = hours !== '' && x.rate !== '' ? Number(hours) * Number(x.rate) : x.amount; return { ...x, hours, amount: amt }; })); }}
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 3, textAlign: 'right' }} />
                </td>
                <td style={{ padding: 4, border: '1px solid #ddd' }}>
                  <input type="number" step="0.01" min="0" value={r.rate} placeholder="—"
                    onChange={e => { const rate = e.target.value; setRows(p => p.map(x => { if (x.id !== r.id) return x; const amt = rate !== '' && x.hours !== '' ? Number(x.hours) * Number(rate) : x.amount; return { ...x, rate, amount: amt }; })); }}
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 3, textAlign: 'right' }} />
                </td>
                <td style={{ padding: 4, border: '1px solid #ddd' }}>
                  <input type="number" step="0.01" min="0" value={r.amount}
                    onChange={e => setRows(p => p.map(x => x.id === r.id ? { ...x, amount: Number(e.target.value), hours: '', rate: '' } : x))}
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 3, textAlign: 'right' }} />
                </td>
                <td style={{ padding: 4, border: '1px solid #ddd', textAlign: 'center' }}>
                  <button type="button" onClick={() => setRows(p => p.filter(x => x.id !== r.id))}
                    style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f0f0f0', fontWeight: 700 }}>
              <td style={{ padding: '6px 8px', border: '1px solid #ddd', textAlign: 'right' }} colSpan={3}>TOTAL</td>
              <td style={{ padding: '6px 8px', border: '1px solid #ddd', textAlign: 'right' }}>${total.toFixed(2)}</td>
              <td style={{ border: '1px solid #ddd' }}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Extra PDFs */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>📎 Attach PDFs (optional)</label>
          <label style={{ fontSize: 11, padding: '3px 10px', background: BLUE_LIGHT, border: `1px solid ${BLUE_BORDER}`, color: BLUE, borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>
            + Add PDFs
            <input type="file" accept="application/pdf" multiple onChange={handlePdfAdd} style={{ display: 'none' }} />
          </label>
        </div>
        {extraPdfs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {extraPdfs.map((pdf, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 6, padding: '6px 10px' }}>
                <span style={{ fontSize: 13 }}>📄</span>
                <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pdf.name}</span>
                <button onClick={() => setExtraPdfs(prev => prev.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Images */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>📷 Attach Images / Scanned WO (optional)</label>
          <label style={{ fontSize: 11, padding: '3px 10px', background: BLUE_LIGHT, border: `1px solid ${BLUE_BORDER}`, color: BLUE, borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>
            + Add Images
            <input type="file" accept="image/*" multiple onChange={handleImageAdd} style={{ display: 'none' }} />
          </label>
        </div>
        {images.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {images.map((img, i) => (
              <div key={i} style={{ position: 'relative', border: `1px solid ${BLUE_BORDER}`, borderRadius: 6, overflow: 'hidden', width: 90, height: 90, flexShrink: 0 }}>
                <img src={img.dataUrl} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                <button onClick={e => { e.stopPropagation(); setImages(prev => prev.filter((_, j) => j !== i)); }}
                  style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 18, height: 18, color: '#fff', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 9, padding: '2px 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{img.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          style={{ ...inputStyle, resize: 'vertical' }} />
      </div>

      <button onClick={handleSend} disabled={sending}
        style={{ fontSize: 13, padding: '8px 20px', background: `linear-gradient(135deg, #e67e22, #d35400)`, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}>
        {sending ? 'Sending…' : '📧 Send Paper WO Invoice'}
      </button>
    </div>
  );
}

export default function TcInvoicing() {
  const navigate = useNavigate();
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [woList, setWoList] = useState([]);
  const [loadingWo, setLoadingWo] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [loadingInv, setLoadingInv] = useState(false);
  const [selectedDates, setSelectedDates] = useState(new Set());
  const [selectedWos, setSelectedWos] = useState([]);
  const [payingId, setPayingId] = useState(null);
  const [payMethod, setPayMethod] = useState('check');
  const [invFilter, setInvFilter] = useState({ search: '', status: '' });
  const [editingInv, setEditingInv] = useState(null);
  const [showPaperForm, setShowPaperForm] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('adminUser') || '{}');
    if (!ALLOWED_EMAILS.has(user.email)) navigate('/admin-dashboard');
  }, [navigate]);

  const fetchWo = async () => {
    setLoadingWo(true);
    try {
      const res = await api.get(`/work-orders/month?month=${calMonth + 1}&year=${calYear}`);
      setWoList(res.data || []);
    } catch {
      setWoList([]);
    } finally {
      setLoadingWo(false);
    }
  };

  const fetchInvoices = async () => {
    setLoadingInv(true);
    try {
      const res = await api.get('/api/tc-invoicing');
      setInvoices(res.data || []);
    } catch {
      setInvoices([]);
    } finally {
      setLoadingInv(false);
    }
  };

  useEffect(() => { fetchInvoices(); }, []);
  useEffect(() => { fetchWo(); }, [calYear, calMonth]);

  const wosByDate = useMemo(() => {
    const map = {};
    woList.forEach(wo => {
      const d = wo.basic?.dateOfJob;
      if (!d) return;
      if (!map[d]) map[d] = [];
      map[d].push(wo);
    });
    return map;
  }, [woList]);

  const invoicesByWoId = useMemo(() => {
    const map = {};
    invoices.forEach(inv => {
      const ids = inv.workOrderIds?.length ? inv.workOrderIds : (inv.workOrderId ? [inv.workOrderId] : []);
      ids.forEach(id => { map[id] = inv; });
    });
    return map;
  }, [invoices]);

  const wosOnSelectedDates = useMemo(() => {
    const all = [];
    selectedDates.forEach(d => (wosByDate[d] || []).forEach(wo => all.push(wo)));
    return all.sort((a, b) => (a.basic?.dateOfJob || '').localeCompare(b.basic?.dateOfJob || ''));
  }, [selectedDates, wosByDate]);

  const toggleWoSelection = (wo) => {
    setSelectedWos(prev =>
      prev.find(w => w._id === wo._id) ? prev.filter(w => w._id !== wo._id) : [...prev, wo]
    );
  };

  const handleMarkPaid = async (id) => {
    try {
      await api.patch(`/api/tc-invoicing/${id}/pay`, { payMethod });
      toast.success('Marked as paid!');
      setPayingId(null);
      fetchInvoices();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to mark paid');
    }
  };

  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); };
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); };

  const filtered = useMemo(() => invoices.filter(inv => {
    if (invFilter.status === 'paid' && inv.payStatus !== 'paid') return false;
    if (invFilter.status === 'unpaid' && inv.payStatus !== 'unpaid') return false;
    if (invFilter.search) {
      const s = invFilter.search.toLowerCase();
      if (!(inv.invoiceNumber || '').toLowerCase().includes(s) && !(inv.client || '').toLowerCase().includes(s)) return false;
    }
    return true;
  }), [invoices, invFilter]);

  const totalUnpaid = useMemo(() => invoices.filter(i => i.payStatus !== 'paid').reduce((s, i) => s + (i.total || 0), 0), [invoices]);

  const lastTcInvoice = useMemo(() => {
    const nums = invoices.map(i => i.invoiceNumber || '').filter(n => /^2026TC/i.test(n));
    if (!nums.length) return null;
    nums.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return nums[nums.length - 1];
  }, [invoices]);

  return (
    <div>
      <Header activePage="/admin-dashboard" />
      <div className="invoice-page" style={{ maxWidth: 1300, margin: '0 auto', padding: '24px 16px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: '2.2rem', color: '#1a1a1a' }}>🚦 Traffic Control Invoicing</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowPaperForm(v => !v); setSelectedDates(new Set()); setSelectedWos([]); }}
              style={{ fontSize: 13, background: showPaperForm ? '#e67e22' : 'rgba(230,126,34,0.1)', border: '1px solid rgba(230,126,34,0.4)', color: showPaperForm ? '#fff' : '#e67e22', borderRadius: 8, padding: '7px 16px', fontWeight: 700, cursor: 'pointer' }}>
              📋 {showPaperForm ? 'Cancel Paper WO' : 'Paper Work Order Invoice'}
            </button>
            <button className="btn" onClick={() => navigate('/admin-dashboard')}
              style={{ fontSize: 13, background: BLUE_LIGHT, border: `1px solid ${BLUE_BORDER}`, color: BLUE, borderRadius: 8, padding: '7px 16px', fontWeight: 700, cursor: 'pointer' }}>
              ← Dashboard
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Invoices', value: invoices.length, color: '#1a1a1a', bg: BLUE_LIGHT, border: BLUE_BORDER },
            { label: 'Outstanding', value: `$${totalUnpaid.toFixed(2)}`, color: BLUE, bg: 'rgba(23,54,93,0.04)', border: BLUE_BORDER },
            { label: 'Paid', value: invoices.filter(i => i.payStatus === 'paid').length, color: '#27ae60', bg: '#eafaf1', border: '#a9dfbf' },
            { label: 'Unpaid', value: invoices.filter(i => i.payStatus !== 'paid').length, color: '#888', bg: '#f5f5f5', border: '#ddd' },
            ...(lastTcInvoice ? [{ label: 'Last 2026TC Inv #', value: lastTcInvoice, color: BLUE, bg: BLUE_LIGHT, border: BLUE_BORDER }] : []),
          ].map(({ label, value, color, bg, border }) => (
            <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '14px 22px', minWidth: 130, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 12, color: '#666', fontWeight: 600, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Paper WO Form */}
        {showPaperForm && (
          <div style={{ marginBottom: 24 }}>
            <PaperInvoiceForm onCancel={() => setShowPaperForm(false)} onSent={() => { setShowPaperForm(false); fetchInvoices(); }} />
          </div>
        )}

        {/* Calendar */}
        <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${BLUE_BORDER}`, boxShadow: '0 4px 16px rgba(23,54,93,0.08)', padding: '20px 20px 16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <button onClick={prevMonth} style={{ background: BLUE_LIGHT, border: `1px solid ${BLUE_BORDER}`, borderRadius: 8, padding: '6px 16px', cursor: 'pointer', fontSize: 18, color: BLUE, fontWeight: 700 }}>‹</button>
            <div style={{ fontWeight: 800, fontSize: 20, color: '#1a1a1a' }}>{MONTH_NAMES[calMonth]} {calYear}</div>
            <button onClick={nextMonth} style={{ background: BLUE_LIGHT, border: `1px solid ${BLUE_BORDER}`, borderRadius: 8, padding: '6px 16px', cursor: 'pointer', fontSize: 18, color: BLUE, fontWeight: 700 }}>›</button>
          </div>
          {loadingWo && <p style={{ color: '#888', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Loading work orders…</p>}
          {!loadingWo && (
            <Calendar year={calYear} month={calMonth} wosByDate={wosByDate} invoicesByWoId={invoicesByWoId} onDayClick={d => setSelectedDates(prev => new Set([...prev, d]))} selectedDates={selectedDates} />
          )}
        </div>

        {/* Day Detail Panel */}
        {selectedDates.size > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `linear-gradient(135deg, ${BLUE}, #2a5298)`, color: '#fff', borderRadius: '10px 10px 0 0', padding: '12px 20px' }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>
                📅 {selectedDates.size === 1 ? `Work Orders — ${[...selectedDates][0]}` : `Work Orders — ${selectedDates.size} days selected`}
                <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 10, opacity: 0.85 }}>(click more days to add)</span>
              </div>
              <button onClick={() => { setSelectedDates(new Set()); setSelectedWos([]); }}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>✕</button>
            </div>

            <div style={{ background: '#fff', border: `1px solid ${BLUE_BORDER}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(wosOnSelectedDates.length || 1, 3)}, 1fr)`, gap: 12, marginBottom: selectedWos.length > 0 ? 16 : 0 }}>
                {wosOnSelectedDates.length === 0 && <p style={{ color: '#888', fontSize: 13, margin: 0 }}>No work orders on selected days.</p>}
                {wosOnSelectedDates.map(wo => {
                  const inv = invoicesByWoId[wo._id];
                  const badge = inv ? STATUS_BADGE[inv.payStatus] : null;
                  const isChecked = selectedWos.find(w => w._id === wo._id);
                  return (
                    <div key={wo._id} onClick={() => !inv && toggleWoSelection(wo)}
                      style={{ border: `2px solid ${isChecked ? BLUE : inv ? '#a9dfbf' : '#e0e0e0'}`, borderRadius: 10, padding: '12px 14px', background: isChecked ? BLUE_LIGHT : inv ? '#eafaf1' : '#fafafa', cursor: inv ? 'default' : 'pointer', boxShadow: isChecked ? `0 0 0 3px ${BLUE_MED}` : '0 1px 4px rgba(0,0,0,0.06)', transition: 'border-color 0.15s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {!inv && (
                            <input type="checkbox" checked={!!isChecked} onChange={() => toggleWoSelection(wo)} onClick={e => e.stopPropagation()}
                              style={{ width: 16, height: 16, accentColor: BLUE, cursor: 'pointer', flexShrink: 0 }} />
                          )}
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>🚦 {wo.basic?.dateOfJob} · {wo.basic?.client}</div>
                        </div>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 700, flexShrink: 0, marginLeft: 6, background: badge ? badge.bg : '#e0e0e0', color: badge ? badge.color : '#666' }}>
                          {badge ? badge.label : 'Not Billed'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>
                        <div>Project: <strong>{wo.basic?.project}</strong></div>
                        <div>Coordinator: <strong>{wo.basic?.coordinator}</strong></div>
                        <div>Foreman: <strong>{wo.basic?.foremanName}</strong></div>
                        <div>Time: <strong>{fmtTime(wo.basic?.startTime)} – {fmtTime(wo.basic?.endTime)}</strong></div>
                        <div>Flaggers: <strong>{[wo.tbs?.flagger1, wo.tbs?.flagger2, wo.tbs?.flagger3].filter(Boolean).join(', ') || '—'}</strong></div>
                      </div>
                      {inv && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e0e0e0', fontSize: 12, color: '#555' }}>
                          <strong>Inv #{inv.invoiceNumber}</strong> · {inv.client} · <strong>${Number(inv.total || 0).toFixed(2)}</strong>
                        </div>
                      )}
                      {!inv && (
                        <div style={{ marginTop: 6, fontSize: 12, color: BLUE, fontWeight: 600 }}>
                          {isChecked ? '✓ Selected for invoice' : 'Click to select for invoice'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {wosOnSelectedDates.some(wo => !invoicesByWoId[wo._id]) && (
                <div style={{ display: 'flex', gap: 8, marginBottom: selectedWos.length > 0 ? 16 : 0 }}>
                  <button onClick={() => setSelectedWos(wosOnSelectedDates.filter(wo => !invoicesByWoId[wo._id]))}
                    style={{ fontSize: 12, padding: '5px 14px', background: BLUE_LIGHT, border: `1px solid ${BLUE_BORDER}`, color: BLUE, borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>
                    Select All Unbilled ({wosOnSelectedDates.filter(wo => !invoicesByWoId[wo._id]).length})
                  </button>
                  {selectedWos.length > 0 && (
                    <button onClick={() => setSelectedWos([])}
                      style={{ fontSize: 12, padding: '5px 14px', background: '#f5f5f5', border: '1px solid #ddd', color: '#666', borderRadius: 6, cursor: 'pointer' }}>
                      Clear Selection
                    </button>
                  )}
                </div>
              )}

              {selectedWos.length > 0 && (
                <InvoiceForm wos={selectedWos} onCancel={() => setSelectedWos([])} onSent={() => { setSelectedWos([]); fetchInvoices(); }} />
              )}
            </div>
          </div>
        )}

        {editingInv && (
          <EditInvoiceModal inv={editingInv} onClose={() => setEditingInv(null)} onSaved={() => { setEditingInv(null); fetchInvoices(); }} />
        )}

        {/* Sent Invoices Table */}
        <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${BLUE_BORDER}`, boxShadow: '0 4px 16px rgba(23,54,93,0.08)', padding: 20 }}>
          <h2 style={{ fontSize: 17, marginBottom: 14, color: '#1a1a1a', fontWeight: 800 }}>Sent Invoices</h2>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input placeholder="Search invoice # or client…" value={invFilter.search}
              onChange={e => setInvFilter(f => ({ ...f, search: e.target.value }))}
              style={{ flex: 1, minWidth: 200, padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 }} />
            <select value={invFilter.status} onChange={e => setInvFilter(f => ({ ...f, status: e.target.value }))}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 }}>
              <option value="">All Status</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
            {(invFilter.search || invFilter.status) && (
              <button onClick={() => setInvFilter({ search: '', status: '' })}
                style={{ padding: '6px 12px', background: '#888', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Clear</button>
            )}
          </div>

          {loadingInv && <p style={{ color: '#888' }}>Loading invoices…</p>}
          <div className="inv-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 800 }}>
              <thead>
                <tr style={{ background: `linear-gradient(135deg, ${BLUE}, #2a5298)`, color: '#fff' }}>
                  {['Date Sent','Inv #','Representative','Company','WO Date','Total','Status','Actions'].map(h => (
                    <th key={h} style={{ padding: '8px 8px', border: '1px solid #4a6fa5', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv, idx) => (
                  <tr key={inv._id || idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                    <td style={{ padding: '7px 8px', border: '1px solid #ddd', whiteSpace: 'nowrap' }}>{fmtDate(inv.sentAt || inv.createdAt)}</td>
                    <td style={{ padding: '7px 8px', border: '1px solid #ddd', fontWeight: 600 }}>{inv.invoiceNumber || '—'}</td>
                    <td style={{ padding: '7px 8px', border: '1px solid #ddd' }}>{inv.client || '—'}</td>
                    <td style={{ padding: '7px 8px', border: '1px solid #ddd' }}>{inv.clientCompany || '—'}</td>
                    <td style={{ padding: '7px 8px', border: '1px solid #ddd' }}>{inv.wosData?.[0]?.basic?.dateOfJob || '—'}</td>
                    <td style={{ padding: '7px 8px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 600 }}>${Number(inv.total || 0).toFixed(2)}</td>
                    <td style={{ padding: '7px 8px', border: '1px solid #ddd' }}>
                      {inv.payStatus === 'paid' ? (
                        <span style={{ background: '#28a745', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>Paid {inv.payMethod ? `(${inv.payMethod})` : ''}</span>
                      ) : (
                        <span style={{ background: '#ffc107', color: '#000', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>Unpaid</span>
                      )}
                    </td>
                    <td style={{ padding: '7px 8px', border: '1px solid #ddd', whiteSpace: 'nowrap' }}>
                      {inv.payStatus !== 'paid' && (
                        payingId === inv._id ? (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                              style={{ fontSize: 11, padding: '2px 4px', borderRadius: 4, border: '1px solid #ccc' }}>
                              <option value="check">Check</option>
                              <option value="card">Card</option>
                              <option value="ach">ACH</option>
                              <option value="cash">Cash</option>
                            </select>
                            <button onClick={() => handleMarkPaid(inv._id)}
                              style={{ padding: '2px 8px', background: '#28a745', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>✓</button>
                            <button onClick={() => setPayingId(null)}
                              style={{ padding: '2px 6px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>✕</button>
                          </div>
                        ) : (
                          <button onClick={() => setPayingId(inv._id)}
                            style={{ padding: '3px 8px', background: '#ffc107', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Mark Paid</button>
                        )
                      )}
                      <button onClick={() => setEditingInv(inv)}
                        style={{ marginLeft: 6, padding: '3px 8px', background: BLUE_LIGHT, border: `1px solid ${BLUE_BORDER}`, color: BLUE, borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                        ✏️ Edit
                      </button>
                      {inv.invoicePdfUrl && (
                        <a href={inv.invoicePdfUrl} target="_blank" rel="noreferrer"
                          style={{ marginLeft: 6, padding: '3px 8px', background: '#eafaf1', border: '1px solid #a9dfbf', color: '#27ae60', borderRadius: 4, fontSize: 11, fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
                          📄 View PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !loadingInv && (
                  <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: '#888' }}>No invoices found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      <Footer />
    </div>
  );
}



