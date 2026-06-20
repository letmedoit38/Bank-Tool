const loader        = document.getElementById("loader");
const errorBox      = document.getElementById("errorBox");
const companyDetail = document.getElementById("companyDetail");

window.addEventListener("DOMContentLoaded", () => {
  if (!gstin) { showError("No GSTIN provided."); hideLoader(); return; }
  loadCompany(gstin);
});

async function loadCompany(g) {
  try {
    const res = await fetch(`/api/company/${encodeURIComponent(g)}`);
    const data = await res.json();
    if (!res.ok) { showError(data.error || "Failed to load company details."); return; }
    render(data);
  } catch {
    showError("Network error. Please try again.");
  } finally {
    hideLoader();
  }
}

function render(d) {
  // Banner
  setText("companyName", d.legalName || d.tradeName || d.gstin);
  const tradeDiff = d.tradeName && d.tradeName !== d.legalName;
  setText("tradeName", tradeDiff ? `Trade Name: ${d.tradeName}` : "");

  setBadge("statusBadge", d.status || "Unknown", statusClass(d.status));
  setBadge("typeBadge",   d.type   || "–",       "badge-blue");
  setBadge("cobBadge",    d.constitutionOfBusiness || "–", "badge-purple");

  // Registration details
  setText("d-gstin",      d.gstin       || "–");
  setText("d-regdate",    formatDate(d.registrationDate) || "–");
  setText("d-stj",        d.stateJurisdiction       || "–");
  setText("d-ctj",        d.centralJurisdiction     || "–");
  setText("d-canceldate", d.cancelDate ? formatDate(d.cancelDate) : "Not Cancelled");

  // Address
  const addrEl = document.getElementById("d-address");
  const address = buildAddress(d);
  addrEl.textContent = address || "Address not available";

  // Google Maps
  if (address) {
    const mapsEl = document.getElementById("d-maps");
    mapsEl.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    mapsEl.classList.remove("hidden");
  }

  // Phone
  const phone = d.phone || extractPhone(d.raw);
  if (phone) {
    document.getElementById("phoneRow").style.display = "flex";
    const ph = document.getElementById("d-phone");
    ph.href = `tel:${phone}`;
    ph.textContent = phone;
  }

  // Email
  const email = d.email || extractEmail(d.raw);
  if (email) {
    document.getElementById("emailRow").style.display = "flex";
    const em = document.getElementById("d-email");
    em.href = `mailto:${email}`;
    em.textContent = email;
  }

  if (!phone && !email) {
    setText("contactNote", "Phone/Email not available in public GST data.");
  }

  // Filing history
  renderFiling(d);

  // Banker assessment
  renderBankerSummary(d);

  companyDetail.classList.remove("hidden");
}

function renderFiling(d) {
  const section = document.getElementById("filingSection");
  const returns = d.returns;

  if (!returns || returns.length === 0) {
    section.innerHTML = `<p class="muted-note">Filing data not available from GST Portal for this GSTIN. Visit <a href="https://services.gst.gov.in/services/searchtp" target="_blank">gst.gov.in</a> to check manually.</p>`;
    // Set score based on status only
    setScore(null, d.status);
    return;
  }

  // Group by period
  let html = `<div class="filing-grid">`;
  returns.forEach(r => {
    const period = r.taxp || r.period || "–";
    const gstr1  = r.gstr1  || r.GSTR1  || {};
    const gstr3b = r.gstr3b || r.GSTR3B || {};

    const g1status = gstr1.status  || gstr1.sts  || "–";
    const g3status = gstr3b.status || gstr3b.sts || "–";

    html += `<div class="filing-month">
      <div class="month-label">${formatPeriod(period)}</div>
      <div class="filing-row"><span>GSTR-1</span><span class="${filedClass(g1status)}">${g1status}</span></div>
      <div class="filing-row"><span>GSTR-3B</span><span class="${filedClass(g3status)}">${g3status}</span></div>
    </div>`;
  });
  html += `</div>`;
  section.innerHTML = html;

  // Calculate score
  let filed = 0, total = 0;
  returns.forEach(r => {
    const g1 = (r.gstr1 || r.GSTR1 || {}).status || "";
    const g3 = (r.gstr3b || r.GSTR3B || {}).status || "";
    if (g1 !== "–") { total++; if (filedClass(g1) === "filed") filed++; }
    if (g3 !== "–") { total++; if (filedClass(g3) === "filed") filed++; }
  });
  const pct = total > 0 ? Math.round((filed / total) * 100) : null;
  setScore(pct, d.status);
}

function setScore(pct, status) {
  const numEl     = document.getElementById("scoreNumber");
  const ring      = document.querySelector(".score-ring");
  const verdictEl = document.getElementById("scoreVerdict");

  if (pct === null) {
    numEl.textContent = "N/A";
    if (status && status.toLowerCase().includes("active")) {
      verdictEl.textContent = "Active";
    } else {
      verdictEl.textContent = status || "–";
      verdictEl.className = "score-verdict poor";
      ring.style.borderColor = "#fc8181";
    }
    return;
  }

  numEl.textContent = pct + "%";
  if (pct >= 80) {
    ring.style.borderColor = "#68d391";
    verdictEl.textContent  = "Good";
    verdictEl.className    = "score-verdict";
  } else if (pct >= 50) {
    ring.style.borderColor = "#f6ad55";
    verdictEl.textContent  = "Average";
    verdictEl.className    = "score-verdict average";
  } else {
    ring.style.borderColor = "#fc8181";
    verdictEl.textContent  = "Poor";
    verdictEl.className    = "score-verdict poor";
  }
}

function renderBankerSummary(d) {
  const section = document.getElementById("bankerSummary");
  const isActive = (d.status || "").toLowerCase().includes("active");
  const regDate  = d.registrationDate ? formatDate(d.registrationDate) : "N/A";
  const ageYears = d.registrationDate ? ageFromDate(d.registrationDate) : null;

  let html = `<div class="assessment-grid">
    <div class="assessment-item">
      <div class="label">Registration Status</div>
      <div class="value">${isActive ? "✅ Active" : "❌ " + (d.status || "Unknown")}</div>
    </div>
    <div class="assessment-item">
      <div class="label">Business Age</div>
      <div class="value">${ageYears !== null ? ageYears + " year(s)" : "N/A"} <span style="color:#718096;font-size:0.8rem">(since ${regDate})</span></div>
    </div>
    <div class="assessment-item">
      <div class="label">Constitution</div>
      <div class="value">${d.constitutionOfBusiness || "–"}</div>
    </div>
    <div class="assessment-item">
      <div class="label">Business Type</div>
      <div class="value">${d.type || "–"}</div>
    </div>
  </div>`;

  // Verdict
  let verdictClass = "verdict-caution";
  let verdictIcon  = "⚠️";
  let verdictText  = "Proceed with caution — verify filing history before loan approval.";

  if (isActive && ageYears !== null && ageYears >= 2) {
    verdictClass = "verdict-good";
    verdictIcon  = "✅";
    verdictText  = "Business is GST Active with reasonable vintage. Review sales data and filing compliance before approval.";
  } else if (!isActive) {
    verdictClass = "verdict-poor";
    verdictIcon  = "❌";
    verdictText  = "GST registration is not active. Do not approve loan without further KYC and explanation.";
  }

  html += `<div class="verdict-box ${verdictClass}">${verdictIcon} ${verdictText}</div>`;
  section.innerHTML = html;
}

/* ===== HELPERS ===== */
function buildAddress(d) {
  if (d.address && d.address.trim()) return d.address;
  const raw = d.raw || {};
  const pradr = raw.pradr || {};
  const addr  = pradr.addr || {};
  const parts = [];
  for (const k of ["bno", "flno", "st", "loc", "dst", "stcd"]) {
    if (addr[k]) parts.push(addr[k]);
  }
  if (d.pincode) parts.push(d.pincode);
  return parts.join(", ");
}

function extractPhone(raw) {
  if (!raw) return "";
  const pradr = raw.pradr || {};
  return pradr.addr?.mob || raw.mob || "";
}

function extractEmail(raw) {
  if (!raw) return "";
  const pradr = raw.pradr || {};
  return pradr.addr?.em || raw.em || "";
}

function statusClass(s) {
  if (!s) return "badge-grey";
  const l = s.toLowerCase();
  if (l.includes("active"))   return "badge-green";
  if (l.includes("cancel"))   return "badge-red";
  return "badge-yellow";
}

function filedClass(s) {
  if (!s) return "";
  const l = s.toLowerCase();
  if (l === "filed" || l === "y" || l === "yes") return "filed";
  if (l === "not filed" || l === "n" || l === "no") return "not-filed";
  return "";
}

function formatDate(d) {
  if (!d) return "";
  // Handles DD/MM/YYYY or YYYY-MM-DD
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d;
  try { return new Date(d).toLocaleDateString("en-IN"); } catch { return d; }
}

function formatPeriod(p) {
  if (!p || p === "–") return p;
  // MMYYYY → Mon YYYY
  if (/^\d{6}$/.test(p)) {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const m = parseInt(p.slice(0, 2), 10);
    const y = p.slice(2);
    return `${months[m - 1] || p} ${y}`;
  }
  return p;
}

function ageFromDate(d) {
  if (!d) return null;
  let dt;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
    const [day, mon, yr] = d.split("/");
    dt = new Date(`${yr}-${mon}-${day}`);
  } else {
    dt = new Date(d);
  }
  if (isNaN(dt)) return null;
  return Math.floor((Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24 * 365));
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val || "";
}

function setBadge(id, text, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = `badge ${cls}`;
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}

function hideLoader() {
  loader.classList.add("hidden");
}
