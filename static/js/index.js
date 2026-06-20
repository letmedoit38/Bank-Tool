const pincodeInput = document.getElementById("pincodeInput");
const searchBtn    = document.getElementById("searchBtn");
const locationBtn  = document.getElementById("locationBtn");
const locationStatus = document.getElementById("locationStatus");
const loader       = document.getElementById("loader");
const errorBox     = document.getElementById("errorBox");
const resultsSection = document.getElementById("resultsSection");
const resultsTitle = document.getElementById("resultsTitle");
const resultsCount = document.getElementById("resultsCount");
const firmsBody    = document.getElementById("firmsBody");

searchBtn.addEventListener("click", () => {
  const pin = pincodeInput.value.trim();
  if (!pin || pin.length !== 6 || !/^\d+$/.test(pin)) {
    showError("Please enter a valid 6-digit pincode.");
    return;
  }
  fetchFirms(pin);
});

pincodeInput.addEventListener("keydown", e => {
  if (e.key === "Enter") searchBtn.click();
});

locationBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    showError("Geolocation is not supported by your browser.");
    return;
  }
  locationBtn.disabled = true;
  locationBtn.textContent = "📍 Detecting…";
  showLocationStatus("Getting your location…");

  navigator.geolocation.getCurrentPosition(
    async pos => {
      const { latitude, longitude } = pos.coords;
      showLocationStatus("Reverse geocoding coordinates…");
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
          { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json();
        const pin = data.address?.postcode?.replace(/\s/g, "").slice(0, 6);
        if (pin && /^\d{6}$/.test(pin)) {
          pincodeInput.value = pin;
          showLocationStatus(`✓ Detected pincode: ${pin}`);
          fetchFirms(pin);
        } else {
          showError("Could not detect pincode from your location. Please enter manually.");
          hideLocationStatus();
        }
      } catch {
        showError("Reverse geocoding failed. Please enter pincode manually.");
        hideLocationStatus();
      }
      locationBtn.disabled = false;
      locationBtn.textContent = "📍 Use My Location";
    },
    err => {
      showError("Location access denied. Please enter pincode manually.");
      locationBtn.disabled = false;
      locationBtn.textContent = "📍 Use My Location";
      hideLocationStatus();
    }
  );
});

async function fetchFirms(pincode) {
  showLoader();
  hideError();
  hideResults();

  try {
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pincode })
    });
    const data = await res.json();
    if (!res.ok) { showError(data.error || "Something went wrong."); return; }
    renderFirms(data.firms, pincode);
  } catch {
    showError("Network error. Please check your connection and try again.");
  } finally {
    hideLoader();
  }
}

function renderFirms(firms, pincode) {
  firmsBody.innerHTML = "";
  if (!firms || firms.length === 0) {
    showError(`No GST registered firms found for pincode ${pincode}.`);
    return;
  }

  resultsTitle.textContent = `Firms in Pincode: ${pincode}`;
  resultsCount.textContent = `${firms.length} found`;
  resultsCount.className = "badge badge-green";

  firms.forEach((f, i) => {
    const status = f.status || "Unknown";
    const badgeClass = status.toLowerCase().includes("active") ? "badge-green"
                     : status.toLowerCase().includes("cancel") ? "badge-red"
                     : "badge-grey";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${i + 1}</td>
      <td><strong>${escHtml(f.legalName || f.tradeName || "N/A")}</strong>${f.tradeName && f.tradeName !== f.legalName ? `<br/><small style="color:#718096">${escHtml(f.tradeName)}</small>` : ""}</td>
      <td><code style="font-size:0.82rem;letter-spacing:0.5px">${escHtml(f.gstin)}</code></td>
      <td>${escHtml(f.type || "–")}</td>
      <td><span class="badge ${badgeClass}">${escHtml(status)}</span></td>
      <td><a class="btn-view" href="/company/${encodeURIComponent(f.gstin)}">View Details →</a></td>
    `;
    firmsBody.appendChild(row);
  });

  resultsSection.classList.remove("hidden");
}

function showLoader()  { loader.classList.remove("hidden"); }
function hideLoader()  { loader.classList.add("hidden"); }
function showError(msg){ errorBox.textContent = msg; errorBox.classList.remove("hidden"); }
function hideError()   { errorBox.classList.add("hidden"); }
function hideResults() { resultsSection.classList.add("hidden"); }
function showLocationStatus(msg) { locationStatus.textContent = msg; locationStatus.classList.remove("hidden"); }
function hideLocationStatus()    { locationStatus.classList.add("hidden"); }
function escHtml(s) {
  if (!s) return "";
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
