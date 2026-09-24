const { printHtmlToPdfBuffer, loadTBSLogo } = require('./pdfUtils');

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

const TOPIC_LABELS = {
  trafficControl:      'Traffic Control',
  ppe:                 'Personal Protective Equipment (PPE)',
  flagging:            'Flagging Procedures',
  workZoneSetup:       'Work Zone Setup / Teardown',
  vehicleSafety:       'Vehicle & Equipment Safety',
  heatColdStress:      'Heat / Cold Stress',
  firstAidEmergency:   'First Aid & Emergency Procedures',
  hazardCommunication: 'Hazard Communication (HazCom)',
  slipsTripsFalls:     'Slips, Trips & Falls',
  liftingErgonomics:   'Lifting & Ergonomics',
  incidentReporting:   'Incident / Near-Miss Reporting',
  other:               'Other'
};

function topicsHTML(topics = {}) {
  return Object.entries(TOPIC_LABELS).map(([key, label]) => {
    if (key === 'other' && !topics.other) return '';
    const checked = topics[key] ? '&#10003;' : '';
    const extra = key === 'other' && topics.otherText ? ` — ${topics.otherText}` : '';
    return `<div class="check-row"><span class="box">${checked}</span>${label}${extra}</div>`;
  }).join('');
}

function hazardsHTML(hazards = []) {
  if (!hazards.length) return '<p style="color:#888;font-size:11px">None identified</p>';
  return `<table class="tbl">
    <thead><tr><th>#</th><th>Hazard Description</th><th>Corrective Action</th><th>Resolved</th></tr></thead>
    <tbody>${hazards.map((h, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${h.description || ''}</td>
        <td>${h.correctiveAction || ''}</td>
        <td style="text-align:center">${h.resolved ? '&#10003;' : '&#9744;'}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function attendeesHTML(attendees = []) {
  const rows = Array.from({ length: 12 }, (_, i) => {
    const a = attendees[i] || {};
    return `<tr>
      <td>${i + 1}</td>
      <td style="border-bottom:1px solid #ccc">${a.name || ''}</td>
      <td style="border-bottom:1px solid #ccc;font-style:italic;color:#555">${a.signature || ''}</td>
      <td style="border-bottom:1px solid #ccc">${a.signedAt ? fmtDate(a.signedAt) : ''}</td>
    </tr>`;
  });
  return `<table class="tbl">
    <thead><tr><th>#</th><th>Printed Name</th><th>Signature</th><th>Date</th></tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table>`;
}

function generateSafetyMeetingHTML(doc) {
  const logo = loadTBSLogo();
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Safety Meeting</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#333;background:#fff}
  .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:12px;border-bottom:3px solid #1e3a8a}
  .logo{max-height:75px;max-width:190px}
  .co-info{text-align:right;font-size:11px;color:#666}
  .title{text-align:center;font-size:20px;font-weight:bold;color:#1e3a8a;margin:14px 0;text-transform:uppercase;letter-spacing:1px}
  .section{margin-bottom:16px;background:#f8f9fa;padding:12px;border-radius:8px;border-left:4px solid #1e3a8a}
  .section-title{font-size:12px;font-weight:bold;color:#1e3a8a;margin-bottom:8px;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:3px}
  .row{display:flex;margin-bottom:5px}
  .label{font-weight:bold;min-width:160px;color:#555}
  .val{flex:1;padding-left:8px}
  .two-col{display:flex;gap:16px}
  .two-col .col{flex:1}
  .check-row{display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:11px}
  .box{display:inline-block;width:16px;height:16px;border:1px solid #555;text-align:center;line-height:14px;font-size:13px;flex-shrink:0}
  .tbl{width:100%;border-collapse:collapse;font-size:11px;margin-top:6px}
  .tbl th{background:#e9ecef;border:1px solid #ccc;padding:5px;text-align:left}
  .tbl td{border:1px solid #ddd;padding:5px;min-height:22px}
  .notice{background:#fff3cd;border:1px solid #ffeaa7;border-radius:6px;padding:10px;margin-bottom:14px;border-left:4px solid #f39c12;font-size:11px}
  .notice b{color:#856404}
  .sig-grid{display:flex;gap:30px;margin-top:16px}
  .sig-col{flex:1}
  .sig-line{border-bottom:2px solid #333;height:44px;margin-bottom:4px;font-style:italic;font-size:15px;display:flex;align-items:flex-end;padding-bottom:3px;color:#555}
  .sig-label{font-size:11px;color:#555}
  .footer{margin-top:30px;padding-top:12px;border-top:2px solid #1e3a8a;text-align:center;font-size:10px;color:#666}
</style></head><body>

  <div class="header">
    ${logo ? `<img src="${logo}" alt="TBS Logo" class="logo">` : '<div></div>'}
    <div class="co-info">
      <div><strong>Traffic &amp; Barrier Solutions, LLC</strong></div>
      <div>721 N Wall St, Calhoun, GA 30701</div>
      <div>Phone: (706) 263-0175</div>
      <div>www.trafficbarriersolutions.com</div>
    </div>
  </div>

  <div class="title">TBS Safety Meeting Checklist &amp; Employee Sign-Off</div>

  <div class="notice">
    <b>NOTICE:</b> By signing below, each employee confirms attendance and understanding of the topics discussed. Signing does <u>not</u> waive any employee rights under applicable law.
  </div>

  <div class="section">
    <div class="section-title">Meeting Information</div>
    <div class="two-col">
      <div class="col">
        <div class="row"><div class="label">Date:</div><div class="val">${fmtDate(doc.meetingDate)}</div></div>
        <div class="row"><div class="label">Jobsite:</div><div class="val">${doc.jobsite || ''}</div></div>
      </div>
      <div class="col">
        <div class="row"><div class="label">Meeting Leader:</div><div class="val">${doc.meetingLeader || ''}</div></div>
        <div class="row"><div class="label">Toolbox Topic:</div><div class="val">${doc.toolboxTopic || ''}</div></div>
      </div>
    </div>
    ${doc.topicNotes ? `<div class="row" style="margin-top:6px"><div class="label">Topic Notes:</div><div class="val">${doc.topicNotes}</div></div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">Safety Topics Covered</div>
    ${topicsHTML(doc.topics)}
  </div>

  <div class="section">
    <div class="section-title">Hazards &amp; Corrective Actions</div>
    ${hazardsHTML(doc.hazards)}
    ${doc.followUpRequired ? `<div style="margin-top:8px;font-size:11px"><strong>Follow-Up Required:</strong> ${fmtDate(doc.followUpDate) || 'TBD'} &nbsp;|&nbsp; <strong>Completed By:</strong> ${doc.followUpCompletedBy || '___________________'}</div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">Employee Sign-Off (Attendance &amp; Understanding)</div>
    ${attendeesHTML(doc.attendees)}
  </div>

  <div class="section">
    <div class="section-title">Meeting Leader Certification</div>
    <p style="font-size:11px;margin-bottom:10px">I certify that the above safety topics were discussed with all employees listed, and that all questions were answered to the best of my ability.</p>
    <div class="sig-grid">
      <div class="sig-col">
        <div class="sig-line">${doc.leaderSignature || ''}</div>
        <div class="sig-label"><strong>Meeting Leader Signature</strong></div>
        <div class="sig-label">${doc.meetingLeader || ''}</div>
      </div>
      <div class="sig-col">
        <div class="sig-line"></div>
        <div class="sig-label"><strong>Date</strong></div>
        <div class="sig-label">${fmtDate(doc.meetingDate)}</div>
      </div>
    </div>
  </div>

  ${doc.notes ? `<div class="section"><div class="section-title">Additional Notes</div><div style="white-space:pre-wrap;font-size:11px">${doc.notes}</div></div>` : ''}

  <div class="footer">
    <div><strong>Traffic &amp; Barrier Solutions, LLC</strong> — Safety Meeting Record</div>
    <div>Generated ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} &nbsp;|&nbsp; Record ID: ${doc._id || 'N/A'}</div>
  </div>
</body></html>`;
}

async function generateSafetyMeetingPdf(doc) {
  const plain = doc.toObject ? doc.toObject() : doc;
  return await printHtmlToPdfBuffer(generateSafetyMeetingHTML(plain));
}

module.exports = { generateSafetyMeetingPdf };
