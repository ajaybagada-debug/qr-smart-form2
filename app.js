// ---------- Service worker registration ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// ---------- Install prompt ----------
let deferredInstallPrompt = null;
const installBanner = document.getElementById("installBanner");
const installBtn = document.getElementById("installBtn");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  installBanner.classList.add("show");
});

installBtn.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installBanner.classList.remove("show");
});

window.addEventListener("appinstalled", () => {
  installBanner.classList.remove("show");
});

// ---------- Routing ----------
const views = {
  home: document.getElementById("view-home"),
  form: document.getElementById("view-form"),
  doc: document.getElementById("view-doc"),
  admin: document.getElementById("view-admin"),
};
const crumbText = document.getElementById("crumbText");
const backBtn = document.getElementById("backBtn");

const crumbs = {
  home: "Home",
  form: "Account Statement Request",
  doc: "Request generated",
  admin: "Admin: QR code",
};

function navigate(name) {
  Object.values(views).forEach((v) => v.classList.remove("active"));
  views[name].classList.add("active");
  crumbText.textContent = crumbs[name];
  backBtn.style.display = name === "home" ? "none" : "inline-block";
  window.scrollTo(0, 0);
  window.location.hash = name === "home" ? "" : name;
}

backBtn.addEventListener("click", () => navigate("home"));
document.getElementById("goAccountStatement").addEventListener("click", () => navigate("form"));
document.getElementById("goAdmin").addEventListener("click", () => {
  navigate("admin");
  renderQrCode();
});

function routeFromHash() {
  const hash = window.location.hash.replace("#", "");
  if (hash === "account-statement" || hash === "form") {
    navigate("form");
  } else if (hash === "admin") {
    navigate("admin");
    renderQrCode();
  } else {
    navigate("home");
  }
}
window.addEventListener("hashchange", routeFromHash);
routeFromHash();

// ---------- Toast ----------
const toastEl = document.getElementById("toast");
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2200);
}

// ---------- Form validation ----------
const form = document.getElementById("statementForm");
const periodError = document.getElementById("periodError");

function setFieldError(fieldId, hasError) {
  document.getElementById(fieldId).classList.toggle("has-error", hasError);
}

function digitsOnly(el) {
  el.value = el.value.replace(/\D/g, "");
}
document.getElementById("custMobile").addEventListener("input", (e) => digitsOnly(e.target));
document.getElementById("custAccount").addEventListener("input", (e) => digitsOnly(e.target));

function isValidIndianMobile(v) {
  return /^[6-9]\d{9}$/.test(v);
}

function monthsBetween(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  if (e.getDate() < s.getDate()) months -= 1;
  return months;
}

let lastRequest = null;

form.addEventListener("submit", (e) => {
  e.preventDefault();
  periodError.classList.remove("show");
  periodError.textContent = "";

  const name = document.getElementById("custName").value.trim();
  const mobile = document.getElementById("custMobile").value.trim();
  const account = document.getElementById("custAccount").value.trim();
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;

  let valid = true;

  const nameOk = name.length > 0;
  setFieldError("field-name", !nameOk);
  if (!nameOk) valid = false;

  const mobileOk = isValidIndianMobile(mobile);
  setFieldError("field-mobile", !mobileOk);
  if (!mobileOk) valid = false;

  const accountOk = /^\d{16}$/.test(account);
  setFieldError("field-account", !accountOk);
  if (!accountOk) valid = false;

  const startOk = !!startDate;
  setFieldError("field-start", !startOk);
  if (!startOk) valid = false;

  const endOk = !!endDate;
  setFieldError("field-end", !endOk);
  if (!endOk) valid = false;

  if (startOk && endOk) {
    if (new Date(startDate) > new Date(endDate)) {
      periodError.textContent = "Start date cannot be after end date.";
      periodError.classList.add("show");
      valid = false;
    } else {
      const span = monthsBetween(startDate, endDate);
      if (span > 6) {
        periodError.textContent = "Statement period cannot exceed 6 months. Please narrow your date range.";
        periodError.classList.add("show");
        valid = false;
      }
    }
  }

  if (!valid) return;

  lastRequest = { name, mobile, account, startDate, endDate };
  populateDocument(lastRequest);
  navigate("doc");
});

// ---------- Generated document ----------
function formatDate(d) {
  const dt = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function populateDocument(reqData) {
  document.getElementById("docName").textContent = reqData.name;
  document.getElementById("docMobile").textContent = reqData.mobile;
  document.getElementById("docAccount").textContent = reqData.account;
  document.getElementById("docPeriod").textContent =
    formatDate(reqData.startDate) + "  to  " + formatDate(reqData.endDate);
  document.getElementById("docDate").textContent = formatDate(
    new Date().toISOString().slice(0, 10)
  );
}

document.getElementById("newRequestBtn").addEventListener("click", () => {
  form.reset();
  ["field-name", "field-mobile", "field-account", "field-start", "field-end"].forEach((id) =>
    setFieldError(id, false)
  );
  periodError.classList.remove("show");
  lastRequest = null;
  navigate("form");
});

document.getElementById("printBtn").addEventListener("click", () => window.print());

// ---------- PDF generation ----------
document.getElementById("downloadPdfBtn").addEventListener("click", () => {
  if (!lastRequest || !window.jspdf) {
    showToast("Unable to generate PDF right now.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = 210;
  const marginX = 25;
  let y = 30;

  doc.setDrawColor(11, 51, 88);
  doc.setLineWidth(0.6);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 88);
  doc.text("ACCOUNT STATEMENT REQUEST", pageWidth / 2, y, { align: "center" });
  y += 14;

  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);

  const rows = [
    ["Customer Name", lastRequest.name],
    ["Mobile Number", lastRequest.mobile],
    ["Account Number", lastRequest.account],
    ["Statement Period", formatDate(lastRequest.startDate) + " to " + formatDate(lastRequest.endDate)],
  ];

  rows.forEach(([k, v]) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90, 90, 88);
    doc.text(k + ":", marginX, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text(String(v), marginX, y + 6);
    y += 16;
    doc.setDrawColor(220, 216, 204);
    doc.setLineWidth(0.2);
    doc.line(marginX, y - 4, pageWidth - marginX, y - 4);
  });

  y += 8;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  const requestText = doc.splitTextToSize(
    "I request you to provide my account statement for the above-mentioned period.",
    pageWidth - marginX * 2
  );
  doc.text(requestText, marginX, y);
  y += requestText.length * 6 + 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Date: " + formatDate(new Date().toISOString().slice(0, 10)), marginX, y);

  const sigX = pageWidth - marginX - 55;
  doc.line(sigX, y, sigX + 55, y);
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 88);
  doc.text("Customer Signature", sigX + 27.5, y + 5, { align: "center" });

  doc.save("account-statement-request.pdf");
  showToast("PDF downloaded.");
});

// ---------- QR code (admin) ----------
function serviceUrl() {
  const base = window.location.origin + window.location.pathname;
  return base + "#account-statement";
}

let qrRendered = false;
function renderQrCode() {
  const box = document.getElementById("qrcode");
  document.getElementById("qrUrlText").textContent = serviceUrl();
  if (qrRendered) return;
  box.innerHTML = "";
  if (window.QRCode) {
    new QRCode(box, {
      text: serviceUrl(),
      width: 200,
      height: 200,
      colorDark: "#0B3358",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });
    qrRendered = true;
  }
}

document.getElementById("downloadQrBtn").addEventListener("click", () => {
  const canvas = document.querySelector("#qrcode canvas");
  if (!canvas) {
    showToast("QR code not ready yet.");
    return;
  }
  const link = document.createElement("a");
  link.download = "qr-smart-form-account-statement.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

document.getElementById("printQrBtn").addEventListener("click", () => window.print());
