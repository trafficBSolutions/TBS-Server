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
]);

const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—';
const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return `${hr > 12 ? hr - 12 : hr || 12}:${m}${hr >= 12 ? 'PM' : 'AM'}`;
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Status badge config
const STATUS_BADGE = {
  paid:   { bg: '#27ae60', color: '#fff', label: '✓ Paid' },
  unpaid: { bg: 'rgba(236,77,7,0.85)', color: '#fff', label: '● Sent/Unpaid' },
};

// Orange admin theme tokens (matches admin.css --adm-accent)
const ORANGE = 'rgb(236,77,7)';
const ORANGE_LIGHT = 'rgba(236,77,7,0.12)';
const ORANGE_MED = 'rgba(236,77,7,0.28)';
const ORANGE_BORDER = 'rgba(236,77,7,0.45)';

function InvoiceForm({ wos, onSent, onCancel }) {
  const [client, setClient] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState([{ id: 1, description: 'Hydrovac Services', hours: '', rate: '', amount: 0 }]);
  const [sending, setSending] = useState(false);
  const [woPdfUrls, setWoPdfUrls] = useState({});
  const [loadingPdfs, setLoadingPdfs] = useState(false);
  const [images, setImages] = useState([]); // [{ name, dataUrl }]

  const total = useMemo(() => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0), [rows]);

  // Fetch PDF URLs for all WOs
  useEffect(() => {
    if (!wos?.length) return;
    setLoadingPdfs(true);
    Promise.all(
      wos.map(wo =>
        api.post(`/hydrovac-work-order/${wo._id}/pdf-cloudinary`)
          .then(res => ({ id: wo._id, url: res.data.url }))
          .catch(() => ({ id: wo._id, url: null }))
      )
    ).then(results => {
      const map = {};
      results.forEach(r => { map[r.id] = r.url; });
      setWoPdfUrls(map);
    }).finally(() => setLoadingPdfs(false));
  }, [wos?.map(w => w._id).join(',')]);

  // Auto-add TC line items for WOs with traffic control
  useEffect(() => {
    const tcRows = [];
    wos.forEach(wo => {
      if (!wo.trafficControlUsed) return;
      const tcHrs = (() => {
        if (!wo.tcStartTime || !wo.tcEndTime) return '';
        const toMins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
        const diff = (toMins(wo.tcEndTime) - toMins(wo.tcStartTime)) / 60;
        return diff > 0 ? diff.toFixed(2) : '';
      })();
      const trucks = wo.tcTrucks?.length ? ` (${wo.tcTrucks.join(', ')})` : '';
      tcRows.push({
        id: `tc-${wo._id}`,
        description: `Traffic Control — ${wo.date}${trucks}`,
        hours: tcHrs,
        rate: '',
        amount: 0,
      });
    });
    if (tcRows.length > 0) {
      setRows(prev => {
        const existingIds = new Set(prev.map(r => r.id));
        const newTc = tcRows.filter(r => !existingIds.has(r.id));
        return [...prev, ...newTc];
      });
    }
  }, [wos.map(w => w._id).join(',')]);

  const handleImageAdd = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImages(prev => [...prev, { name: file.name, dataUrl: ev.target.result }]);
      };
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
      await api.post('/api/hydrovac-invoicing/send', {
        workOrderIds: wos.map(w => w._id),
        wosData: wos.map(wo => ({
          date: wo.date, cdlDriver: wo.cdlDriver, secondWorker: wo.secondWorker,
          coordinator: wo.coordinator, engineHoursStart: wo.engineHoursStart,
          engineHoursEnd: wo.engineHoursEnd, mileageStart: wo.mileageStart,
          mileageEnd: wo.mileageEnd, timesDumped: wo.timesDumped,
          utilitiesFound: wo.utilitiesFound, arrivalAtLocate: wo.arrivalAtLocate,
          arrivalBackAtShop: wo.arrivalBackAtShop, notes: wo.notes,
          trafficControlUsed: wo.trafficControlUsed, tcStartTime: wo.tcStartTime,
          tcEndTime: wo.tcEndTime, tcTrucks: wo.tcTrucks,
        })),
        woPdfUrls: wos.map(wo => woPdfUrls[wo._id] || null),
        client, clientEmail, invoiceNumber, invoiceDate, notes, rows, total,
        images: images.map(img => ({ name: img.name, dataUrl: img.dataUrl })),
      });
      toast.success(`Invoice sent to ${clientEmail}!`);
      onSent();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send invoice');
    } finally {
      setSending(false);
    }
  };

  const dateRange = wos.length === 1
    ? wos[0].date
    : `${wos[0].date} – ${wos[wos.length - 1].date}`;

  return (
    <div style={{ padding: 20, border: `1px solid ${ORANGE_BORDER}`, borderRadius: 10, background: '#fff', boxShadow: '0 4px 16px rgba(236,77,7,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>📄 Invoice — {dateRange} · {wos.length} Work Order{wos.length > 1 ? 's' : ''}</h3>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' }}>✕</button>
      </div>

      {/* WO Summaries */}
      {wos.map((wo, i) => (
        <div key={wo._id} style={{ background: ORANGE_LIGHT, border: `1px solid ${ORANGE_BORDER}`, borderRadius: 8, padding: 12, marginBottom: 10, fontSize: 13 }}>
          <strong>Work Order {wos.length > 1 ? `#${i + 1} — ` : ''}{wo.date}</strong>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6 }}>
            <span>CDL Driver: <strong>{wo.cdlDriver}</strong></span>
            <span>2nd Worker: <strong>{wo.secondWorker || '—'}</strong></span>
            <span>Coordinator: <strong>{wo.coordinator}</strong></span>
            <span>Engine Hrs: <strong>{wo.engineHoursStart}→{wo.engineHoursEnd}</strong></span>
            <span>Miles: <strong>{wo.mileageStart}→{wo.mileageEnd}</strong></span>
            <span>Times Dumped: <strong>{wo.timesDumped}</strong></span>
          </div>
          {woPdfUrls[wo._id] && (
            <a href={woPdfUrls[wo._id]} target="_blank" rel="noreferrer"
              style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: '#1565c0' }}>
              📄 View Work Order PDF
            </a>
          )}
        </div>
      ))}
      {loadingPdfs && <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>Loading WO PDFs…</div>}

      {/* Invoice Fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {[
          { label: 'Invoice #*', value: invoiceNumber, onChange: e => setInvoiceNumber(e.target.value.toUpperCase()), placeholder: 'e.g. HV-001' },
          { label: 'Invoice Date', value: invoiceDate, onChange: e => setInvoiceDate(e.target.value), type: 'date' },
          { label: 'Client / Company*', value: client, onChange: e => setClient(e.target.value), placeholder: 'Client name' },
          { label: 'Client Email*', value: clientEmail, onChange: e => setClientEmail(e.target.value), placeholder: 'client@example.com', type: 'email' },
        ].map(({ label, ...props }) => (
          <div key={label}>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 3 }}>{label}</label>
            <input {...props} style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #ced4da', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        ))}
      </div>

      {/* Line Items */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>Line Items</label>
          <button type="button" className="btn" style={{ fontSize: 11, padding: '3px 10px' }}
            onClick={() => setRows(r => [...r, { id: Date.now(), description: '', hours: '', rate: '', amount: 0 }])}>+ Add Line</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: `linear-gradient(135deg, ${ORANGE}, rgba(243,156,18,0.9))`, color: '#fff' }}>
              <th style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.2)', textAlign: 'left' }}>Description</th>
              <th style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.2)', width: 80, textAlign: 'right' }}>Hours</th>
              <th style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.2)', width: 100, textAlign: 'right' }}>$/hr</th>
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
                    onChange={e => {
                      const hours = e.target.value;
                      setRows(p => p.map(x => {
                        if (x.id !== r.id) return x;
                        const amt = hours !== '' && x.rate !== '' ? Number(hours) * Number(x.rate) : x.amount;
                        return { ...x, hours, amount: amt };
                      }));
                    }}
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 3, textAlign: 'right' }} />
                </td>
                <td style={{ padding: 4, border: '1px solid #ddd' }}>
                  <input type="number" step="0.01" min="0" value={r.rate} placeholder="—"
                    onChange={e => {
                      const rate = e.target.value;
                      setRows(p => p.map(x => {
                        if (x.id !== r.id) return x;
                        const amt = rate !== '' && x.hours !== '' ? Number(x.hours) * Number(rate) : x.amount;
                        return { ...x, rate, amount: amt };
                      }));
                    }}
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

      {/* Images */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>📷 Attach Images (optional)</label>
          <label style={{ fontSize: 11, padding: '3px 10px', background: ORANGE_LIGHT, border: `1px solid ${ORANGE_BORDER}`, color: ORANGE, borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>
            + Add Images
            <input type="file" accept="image/*" multiple onChange={handleImageAdd} style={{ display: 'none' }} />
          </label>
        </div>
        {images.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {images.map((img, i) => (
              <div key={i} style={{ position: 'relative', border: `1px solid ${ORANGE_BORDER}`, borderRadius: 6, overflow: 'hidden', width: 90, height: 90, flexShrink: 0 }}>
                <img src={img.dataUrl} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                  style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 18, height: 18, color: '#fff', cursor: 'pointer', fontSize: 11, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                >✕</button>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 9, padding: '2px 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{img.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #ced4da', fontSize: 13, boxSizing: 'border-box' }} />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={handleSend} disabled={sending} style={{ fontSize: 13, padding: '8px 20px', background: `linear-gradient(135deg, ${ORANGE}, rgba(243,156,18,0.9))`, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}>
          {sending ? 'Sending…' : `📧 Send Invoice + ${wos.length} WO PDF${wos.length > 1 ? 's' : ''}`}
        </button>
        {loadingPdfs && <span style={{ fontSize: 12, color: '#888' }}>Loading PDFs…</span>}
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
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 6 }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 12, fontWeight: 700,
            color: ORANGE, padding: '6px 0',
            borderBottom: `2px solid ${ORANGE_BORDER}`,
          }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
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

          let bg = '#fafafa';
          let borderColor = '#e8e8e8';
          if (allPaid)       { bg = '#eafaf1'; borderColor = '#a9dfbf'; }
          else if (anySent)  { bg = ORANGE_LIGHT; borderColor = ORANGE_BORDER; }
          else if (hasWo)    { bg = 'rgba(236,77,7,0.06)'; borderColor = 'rgba(236,77,7,0.25)'; }
          if (isSelected)    { borderColor = ORANGE; }

          return (
            <div key={day} onClick={() => hasWo && onDayClick(dateStr)}
              style={{
                minHeight: 72, padding: '6px 7px', borderRadius: 8,
                background: bg,
                border: `${isSelected ? '2px' : '1px'} solid ${borderColor}`,
                cursor: hasWo ? 'pointer' : 'default',
                boxShadow: isSelected ? `0 0 0 3px ${ORANGE_MED}` : hasWo ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                transition: 'box-shadow 0.15s, border-color 0.15s',
              }}>
              {/* Day number */}
              <div style={{
                fontSize: 13, fontWeight: 700,
                color: isToday ? '#fff' : hasWo ? ORANGE : '#555',
                background: isToday ? ORANGE : 'transparent',
                borderRadius: '50%', width: 22, height: 22,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 3,
              }}>{day}</div>

              {/* WO entries */}
              {wos.map(wo => {
                const inv = invoicesByWoId[wo._id];
                const badge = inv ? STATUS_BADGE[inv.payStatus] : null;
                return (
                  <div key={wo._id} style={{ marginBottom: 3 }}>
                    <div style={{ fontSize: 10, color: '#333', fontWeight: 600, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      🚛 {wo.cdlDriver}
                    </div>
                    <span style={{
                      display: 'inline-block', fontSize: 9, padding: '1px 5px', borderRadius: 3, marginTop: 1, fontWeight: 700,
                      background: badge ? badge.bg : '#e0e0e0',
                      color: badge ? badge.color : '#666',
                    }}>{badge ? badge.label : 'Not Billed'}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 12, flexWrap: 'wrap', paddingTop: 10, borderTop: `1px solid ${ORANGE_BORDER}` }}>
        {[
          { bg: 'rgba(236,77,7,0.06)', border: `1px solid rgba(236,77,7,0.25)`, label: 'Has WO — Not Billed' },
          { bg: ORANGE_LIGHT, border: `1px solid ${ORANGE_BORDER}`, label: 'Invoice Sent (Unpaid)' },
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

export default function HydrovacInvoicing() {
  const navigate = useNavigate();
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth()); // 0-indexed
  const [woList, setWoList] = useState([]);
  const [loadingWo, setLoadingWo] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [loadingInv, setLoadingInv] = useState(false);
  const [selectedDates, setSelectedDates] = useState(new Set());
  const [selectedWos, setSelectedWos] = useState([]);
  const [payingId, setPayingId] = useState(null);
  const [payMethod, setPayMethod] = useState('check');
  const [invFilter, setInvFilter] = useState({ search: '', status: '' });

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('adminUser') || '{}');
    if (!ALLOWED_EMAILS.has(user.email)) navigate('/admin-dashboard');
  }, [navigate]);

  const fetchWo = async () => {
    setLoadingWo(true);
    try {
      const res = await api.get(`/hydrovac-work-orders?month=${calMonth + 1}&year=${calYear}`);
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
      const res = await api.get('/api/hydrovac-invoicing');
      setInvoices(res.data || []);
    } catch {
      setInvoices([]);
    } finally {
      setLoadingInv(false);
    }
  };

  useEffect(() => { fetchInvoices(); }, []);
  useEffect(() => { fetchWo(); }, [calYear, calMonth]);

  // Group WOs by date string
  const wosByDate = useMemo(() => {
    const map = {};
    woList.forEach(wo => {
      if (!map[wo.date]) map[wo.date] = [];
      map[wo.date].push(wo);
    });
    return map;
  }, [woList]);

  // Map workOrderId -> invoice
  const invoicesByWoId = useMemo(() => {
    const map = {};
    invoices.forEach(inv => {
      if (inv.workOrderId) map[inv.workOrderId] = inv;
    });
    return map;
  }, [invoices]);

  const wosOnSelectedDates = useMemo(() => {
    const all = [];
    selectedDates.forEach(d => (wosByDate[d] || []).forEach(wo => all.push(wo)));
    return all.sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedDates, wosByDate]);

  const handleDayClick = (dateStr) => {
    setSelectedDates(prev => new Set([...prev, dateStr]));
  };

  const toggleWoSelection = (wo) => {
    setSelectedWos(prev =>
      prev.find(w => w._id === wo._id)
        ? prev.filter(w => w._id !== wo._id)
        : [...prev, wo]
    );
  };

  const handleMarkPaid = async (id) => {
    try {
      await api.patch(`/api/hydrovac-invoicing/${id}/pay`, { payMethod });
      toast.success('Marked as paid!');
      setPayingId(null);
      fetchInvoices();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to mark paid');
    }
  };

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  const filtered = useMemo(() => invoices.filter(inv => {
    if (invFilter.status === 'paid' && inv.payStatus !== 'paid') return false;
    if (invFilter.status === 'unpaid' && inv.payStatus !== 'unpaid') return false;
    if (invFilter.search) {
      const s = invFilter.search.toLowerCase();
      if (!(inv.invoiceNumber || '').toLowerCase().includes(s) &&
          !(inv.client || '').toLowerCase().includes(s)) return false;
    }
    return true;
  }), [invoices, invFilter]);

  const totalUnpaid = useMemo(() =>
    invoices.filter(i => i.payStatus !== 'paid').reduce((s, i) => s + (i.total || 0), 0),
    [invoices]
  );

  return (
    <div>
      <Header activePage="/admin-dashboard" />
      <div className="invoice-page" style={{ maxWidth: 1300, margin: '0 auto', padding: '24px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: '2.2rem', color: '#1a1a1a' }}>🚛 Hydrovac Invoicing</h1>
          <button className="btn" onClick={() => navigate('/admin-dashboard')}
            style={{ fontSize: 13, background: ORANGE_LIGHT, border: `1px solid ${ORANGE_BORDER}`, color: ORANGE, borderRadius: 8, padding: '7px 16px', fontWeight: 700, cursor: 'pointer' }}>
            ← Dashboard
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Invoices', value: invoices.length, color: '#1a1a1a', bg: ORANGE_LIGHT, border: ORANGE_BORDER },
            { label: 'Outstanding', value: `$${totalUnpaid.toFixed(2)}`, color: ORANGE, bg: 'rgba(236,77,7,0.06)', border: ORANGE_BORDER },
            { label: 'Paid', value: invoices.filter(i => i.payStatus === 'paid').length, color: '#27ae60', bg: '#eafaf1', border: '#a9dfbf' },
            { label: 'Unpaid', value: invoices.filter(i => i.payStatus !== 'paid').length, color: '#888', bg: '#f5f5f5', border: '#ddd' },
          ].map(({ label, value, color, bg, border }) => (
            <div key={label} style={{
              background: bg, border: `1px solid ${border}`,
              borderRadius: 10, padding: '14px 22px', minWidth: 130,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}>
              <div style={{ fontSize: 12, color: '#666', fontWeight: 600, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Calendar — full width */}
        <div style={{
          background: '#fff', borderRadius: 12,
          border: `1px solid ${ORANGE_BORDER}`,
          boxShadow: '0 4px 16px rgba(236,77,7,0.08)',
          padding: '20px 20px 16px',
          marginBottom: 20,
        }}>
          {/* Month Nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <button onClick={prevMonth} style={{
              background: ORANGE_LIGHT, border: `1px solid ${ORANGE_BORDER}`,
              borderRadius: 8, padding: '6px 16px', cursor: 'pointer', fontSize: 18,
              color: ORANGE, fontWeight: 700, transition: 'background 0.15s',
            }}>‹</button>
            <div style={{ fontWeight: 800, fontSize: 20, color: '#1a1a1a', letterSpacing: '0.02em' }}>
              {MONTH_NAMES[calMonth]} {calYear}
            </div>
            <button onClick={nextMonth} style={{
              background: ORANGE_LIGHT, border: `1px solid ${ORANGE_BORDER}`,
              borderRadius: 8, padding: '6px 16px', cursor: 'pointer', fontSize: 18,
              color: ORANGE, fontWeight: 700, transition: 'background 0.15s',
            }}>›</button>
          </div>
          {loadingWo && <p style={{ color: '#888', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Loading work orders…</p>}
          {!loadingWo && (
            <Calendar
              year={calYear} month={calMonth}
              wosByDate={wosByDate} invoicesByWoId={invoicesByWoId}
              onDayClick={handleDayClick} selectedDates={selectedDates}
            />
          )}
        </div>

        {/* Day Detail Panel */}
        {selectedDates.size > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: `linear-gradient(135deg, ${ORANGE}, rgba(243,156,18,0.9))`,
              color: '#fff', borderRadius: '10px 10px 0 0', padding: '12px 20px',
            }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>
                📅 {selectedDates.size === 1
                  ? `Work Orders — ${[...selectedDates][0]}`
                  : `Work Orders — ${selectedDates.size} days selected`}
                <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 10, opacity: 0.85 }}>
                  (click more days to add)
                </span>
              </div>
              <button onClick={() => { setSelectedDates(new Set()); setSelectedWos([]); }}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>✕</button>
            </div>

            <div style={{
              background: '#fff', border: `1px solid ${ORANGE_BORDER}`, borderTop: 'none',
              borderRadius: '0 0 10px 10px', padding: 16,
            }}>
              {/* WO cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(wosOnSelectedDates.length || 1, 3)}, 1fr)`,
                gap: 12, marginBottom: selectedWos.length > 0 ? 16 : 0,
              }}>
                {wosOnSelectedDates.length === 0 && (
                  <p style={{ color: '#888', fontSize: 13, margin: 0 }}>No work orders on selected days.</p>
                )}
                {wosOnSelectedDates.map(wo => {
                  const inv = invoicesByWoId[wo._id];
                  const badge = inv ? STATUS_BADGE[inv.payStatus] : null;
                  const isChecked = selectedWos.find(w => w._id === wo._id);
                  return (
                    <div key={wo._id}
                      onClick={() => !inv && toggleWoSelection(wo)}
                      style={{
                        border: `2px solid ${isChecked ? ORANGE : inv ? '#a9dfbf' : '#e0e0e0'}`,
                        borderRadius: 10, padding: '12px 14px',
                        background: isChecked ? ORANGE_LIGHT : inv ? '#eafaf1' : '#fafafa',
                        cursor: inv ? 'default' : 'pointer',
                        boxShadow: isChecked ? `0 0 0 3px ${ORANGE_MED}` : '0 1px 4px rgba(0,0,0,0.06)',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {!inv && (
                            <input type="checkbox" checked={!!isChecked} onChange={() => toggleWoSelection(wo)}
                              onClick={e => e.stopPropagation()}
                              style={{ width: 16, height: 16, accentColor: ORANGE, cursor: 'pointer', flexShrink: 0 }} />
                          )}
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>
                            🚛 {wo.date} · {wo.cdlDriver}{wo.secondWorker ? ` & ${wo.secondWorker}` : ''}
                          </div>
                        </div>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 700, flexShrink: 0, marginLeft: 6,
                          background: badge ? badge.bg : '#e0e0e0',
                          color: badge ? badge.color : '#666',
                        }}>{badge ? badge.label : 'Not Billed'}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>
                        <div>Coordinator: <strong>{wo.coordinator}</strong></div>
                        <div>Engine Hrs: <strong>{wo.engineHoursStart}→{wo.engineHoursEnd}</strong> · Miles: <strong>{wo.mileageStart}→{wo.mileageEnd}</strong></div>
                        <div>Dumped: <strong>{wo.timesDumped}x</strong> · Utilities: <strong>{wo.utilitiesFound}</strong></div>
                      </div>
                      {inv && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e0e0e0', fontSize: 12, color: '#555' }}>
                          <strong>Inv #{inv.invoiceNumber}</strong> · {inv.client} · <strong>${Number(inv.total || 0).toFixed(2)}</strong>
                          {inv.woPdfUrl && <a href={inv.woPdfUrl} target="_blank" rel="noreferrer" style={{ marginLeft: 8, color: ORANGE, fontWeight: 600 }}>📄 WO PDF</a>}
                        </div>
                      )}
                      {!inv && (
                        <div style={{ marginTop: 6, fontSize: 12, color: ORANGE, fontWeight: 600 }}>
                          {isChecked ? '✓ Selected for invoice' : 'Click to select for invoice'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Select all unbilled button */}
              {wosOnSelectedDates.some(wo => !invoicesByWoId[wo._id]) && (
                <div style={{ display: 'flex', gap: 8, marginBottom: selectedWos.length > 0 ? 16 : 0 }}>
                  <button
                    onClick={() => setSelectedWos(wosOnSelectedDates.filter(wo => !invoicesByWoId[wo._id]))}
                    style={{ fontSize: 12, padding: '5px 14px', background: ORANGE_LIGHT, border: `1px solid ${ORANGE_BORDER}`, color: ORANGE, borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>
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

              {/* Invoice Form */}
              {selectedWos.length > 0 && (
                <InvoiceForm
                  wos={selectedWos}
                  onCancel={() => setSelectedWos([])}
                  onSent={() => { setSelectedWos([]); fetchInvoices(); }}
                />
              )}
            </div>
          </div>
        )}

        {/* Sent Invoices Table */}
        <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${ORANGE_BORDER}`, boxShadow: '0 4px 16px rgba(236,77,7,0.08)', padding: 20 }}>
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
                style={{ padding: '6px 12px', background: '#888', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                Clear
              </button>
            )}
          </div>

          {loadingInv && <p style={{ color: '#888' }}>Loading invoices…</p>}
          <div className="inv-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 800 }}>
              <thead>
                <tr style={{ background: `linear-gradient(135deg, ${ORANGE}, rgba(243,156,18,0.9))`, color: '#fff' }}>
                  {['Date Sent','Inv #','Client','WO Date','Driver','Hours Billed','Total','Status','Actions'].map(h => (
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
                    <td style={{ padding: '7px 8px', border: '1px solid #ddd' }}>{inv.woData?.date || '—'}</td>
                    <td style={{ padding: '7px 8px', border: '1px solid #ddd' }}>{inv.woData?.cdlDriver || '—'}</td>
                    <td style={{ padding: '7px 8px', border: '1px solid #ddd', textAlign: 'right' }}>
                      {(() => {
                        const wos = inv.wosData?.length ? inv.wosData : (inv.woData ? [inv.woData] : []);
                        const hrs = wos.reduce((sum, wo) => {
                          const s = parseFloat(wo.engineHoursStart);
                          const e = parseFloat(wo.engineHoursEnd);
                          return sum + (isNaN(s) || isNaN(e) ? 0 : e - s);
                        }, 0);
                        return hrs > 0 ? `${hrs.toFixed(1)} hrs` : '—';
                      })()}
                    </td>
                    <td style={{ padding: '7px 8px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 600 }}>${Number(inv.total || 0).toFixed(2)}</td>
                    <td style={{ padding: '7px 8px', border: '1px solid #ddd' }}>
                      {inv.payStatus === 'paid' ? (
                        <span style={{ background: '#28a745', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                          Paid {inv.payMethod ? `(${inv.payMethod})` : ''}
                        </span>
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
                            style={{ padding: '3px 8px', background: '#ffc107', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                            Mark Paid
                          </button>
                        )
                      )}
                      {inv.woPdfUrl && (
                        <a href={inv.woPdfUrl} target="_blank" rel="noreferrer"
                          style={{ marginLeft: 6, fontSize: 11, color: '#1565c0' }}>📄 WO</a>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !loadingInv && (
                  <tr><td colSpan={9} style={{ padding: 20, textAlign: 'center', color: '#888' }}>No invoices found.</td></tr>
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
