let supabaseClient = null;

async function loadConfig() {
  const res = await fetch('/api/config');
  const cfg = await res.json();

  document.getElementById('metaDates').textContent = cfg.eventDates;
  document.getElementById('metaVenue').textContent = cfg.venue;
  document.getElementById('metaDeadline').textContent = cfg.registrationDeadline;
  document.getElementById('feeAmount').textContent = '₹' + cfg.fee;
  document.getElementById('orgName').textContent = cfg.organizerName;

  const waDigits = String(cfg.organizerPhone || '').replace(/\D/g, '');
  const waLink = document.getElementById('orgWhatsapp');
  if (waDigits) {
    waLink.href = 'https://wa.me/' + waDigits;
  } else {
    waLink.style.display = 'none';
  }

  // When the admin has stopped registrations, block the form behind a
  // non-dismissable "Registration is full" message instead -- the real
  // enforcement is server-side (in /api/register), this is just so
  // visitors aren't left filling out a form that will be rejected.
  const closedModal = document.getElementById('registrationClosedModal');
  const registrationPanel = document.getElementById('registrationPanel');
  if (cfg.registrationOpen === false) {
    const closedWaLink = document.getElementById('closedWhatsappLink');
    if (closedWaLink) closedWaLink.href = waDigits ? 'https://wa.me/' + waDigits : '#';
    if (registrationPanel) registrationPanel.hidden = true;
    if (closedModal) closedModal.hidden = false;
  } else {
    if (closedModal) closedModal.hidden = true;
    if (registrationPanel) registrationPanel.hidden = false;
  }

  if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) {
    supabaseClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  }

  return cfg;
}

// Which payment method the visitor picks — Cash, or a specific QR code (by
// its label, rotated during the registration window). Only the label is
// recorded on the registration, not a database id, so it reads clearly in
// the admin dashboard even after a QR code is later removed.
let selectedPaymentMethod = null; // 'qr' | 'cash'
let selectedPaymentLabel = '';
let qrCodesLoaded = false;
// Whether the payment/transaction ID was successfully auto-detected via OCR
// from the uploaded screenshot (true), entered/left for manual entry (false),
// or not applicable because Cash was chosen (null).
let paymentIdAutoDetected = null;

function toggleDigitalFields(show) {
  document.getElementById('digitalPaymentFields').style.display = show ? '' : 'none';
  document.getElementById('paymentScreenshot').required = show;
  document.getElementById('paymentId').required = show;
}

function toggleCashNote(show) {
  document.getElementById('cashNote').style.display = show ? '' : 'none';
}

function loadMethodTiles() {
  const holder = document.getElementById('methodGallery');

  holder.innerHTML = `
    <label class="qr-item qr-selectable">
      <input type="radio" name="topMethodChoice" value="online" required />
      <div class="qr-cash-icon">📱</div>
      <div class="qr-label">Online</div>
    </label>
    <label class="qr-item qr-selectable">
      <input type="radio" name="topMethodChoice" value="cash" required />
      <div class="qr-cash-icon">💵</div>
      <div class="qr-label">Cash</div>
    </label>
  `;

  holder.querySelectorAll('input[name="topMethodChoice"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const onlineSection = document.getElementById('onlineQrSection');
      if (radio.value === 'cash') {
        selectedPaymentMethod = 'cash';
        selectedPaymentLabel = 'Cash';
        paymentIdAutoDetected = null;
        onlineSection.style.display = 'none';
        toggleDigitalFields(false);
        toggleCashNote(true);
      } else {
        selectedPaymentMethod = null;
        selectedPaymentLabel = '';
        onlineSection.style.display = '';
        toggleDigitalFields(false);
        toggleCashNote(false);
        if (!qrCodesLoaded) {
          qrCodesLoaded = true;
          loadQrCodes();
        }
      }
    });
  });
}

async function loadQrCodes() {
  const holder = document.getElementById('qrGallery');
  try {
    const res = await fetch('/api/qr-active');
    const codes = await res.json();

    if (!codes.length) {
      holder.innerHTML = '<div class="qr-loading">No QR codes are active right now — please choose Cash instead.</div>';
      return;
    }

    holder.innerHTML = codes
      .map(
        (q) => `
        <label class="qr-item qr-selectable">
          <input type="radio" name="qrChoice" value="qr" data-label="${escapeHtml(q.label || 'QR Code')}" required />
          <img src="${q.url}" alt="${q.label ? escapeHtml(q.label) : 'Payment QR code'}" />
          <div class="qr-label">${q.label ? escapeHtml(q.label) : 'QR Code'}</div>
        </label>
      `
      )
      .join('');

    holder.querySelectorAll('input[name="qrChoice"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        selectedPaymentMethod = 'qr';
        selectedPaymentLabel = radio.dataset.label || '';
        toggleDigitalFields(true);
      });
    });
  } catch (err) {
    holder.innerHTML = '<div class="qr-loading">Could not load QR codes — please refresh.</div>';
  }
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function extractTxnId(text) {
  const lines = text.split(/\n+/);
  const keyLine = lines.find((l) => /utr|txn|transaction|ref(erence)?/i.test(l) && /\d{9,}/.test(l));
  if (keyLine) {
    const m = keyLine.match(/\d{9,}/);
    if (m) return m[0];
  }
  const all = text.match(/\d{9,}/g);
  if (all && all.length) return all.sort((a, b) => b.length - a.length)[0];
  return '';
}

function setOcrStatus(text, cls) {
  const el = document.getElementById('ocrStatus');
  el.textContent = text;
  el.className = 'ocr-status' + (cls ? ' ' + cls : '');
}

function setPhotoStatus(text, cls) {
  const el = document.getElementById('photoStatus');
  el.textContent = text;
  el.className = 'ocr-status' + (cls ? ' ' + cls : '');
}

async function runOcr(file) {
  if (!file) return;
  paymentIdAutoDetected = false;
  if (typeof Tesseract === 'undefined') {
    setOcrStatus('Auto-detect unavailable — please enter the payment ID manually.', 'warn');
    return;
  }
  setOcrStatus('Scanning screenshot for a payment ID…', 'busy');
  try {
    const { data } = await Tesseract.recognize(file, 'eng');
    const txnId = extractTxnId(data.text || '');
    if (txnId) {
      document.getElementById('paymentId').value = txnId;
      paymentIdAutoDetected = true;
      setOcrStatus('Detected payment ID "' + txnId + '" — please double-check it against your screenshot.', 'ok');
    } else {
      setOcrStatus('Could not auto-detect a payment ID — please enter it manually below.', 'warn');
    }
  } catch (err) {
    setOcrStatus('Auto-detect failed — please enter the payment ID manually.', 'warn');
  }
}

function showMsg(text, type) {
  const el = document.getElementById('formMsg');
  el.textContent = text;
  el.className = 'msg ' + type;
}

// Same as showMsg(), but renders a clickable link for the players-list URL
// instead of plain text -- built with DOM nodes (not innerHTML) so nothing
// in `prefix` can ever be interpreted as markup.
function showSuccessMsg(prefix, linkUrl, linkText) {
  const el = document.getElementById('formMsg');
  el.textContent = '';
  el.appendChild(document.createTextNode(prefix + ' '));
  const a = document.createElement('a');
  a.href = linkUrl;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = linkText;
  el.appendChild(a);
  el.className = 'msg success';
}

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

function validatePhotoFile(file) {
  if (!file) return 'Please upload your photo.';
  if (file.size > MAX_PHOTO_BYTES) return 'Photo is larger than 10MB — please choose a smaller file.';
  const okType = /^image\/(jpe?g|png|heic|heif)$/i.test(file.type) || /\.(jpe?g|png|heic|heif)$/i.test(file.name);
  if (!okType) return 'Please upload a JPG, JPEG, PNG, or HEIC photo.';
  return '';
}

async function uploadToBucket(bucket, file) {
  if (!supabaseClient) throw new Error('Upload service is not configured yet.');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseClient.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type || 'application/octet-stream' });
  if (error) throw error;
  return path;
}

function isValidCricheroesLink(url) {
  return /^https:\/\/chshare\.link\/player\/[A-Za-z0-9_-]+\/?(\?.*)?$/i.test(String(url || '').trim());
}

async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById('submitBtn');

  const photoInput = document.getElementById('photoUpload');
  const photoErr = validatePhotoFile(photoInput.files[0]);
  if (photoErr) {
    setPhotoStatus(photoErr, 'error');
    showMsg(photoErr, 'error');
    return;
  }

  if (!document.querySelector('input[name="topMethodChoice"]:checked')) {
    showMsg('Please select how you are paying (Cash or Online).', 'error');
    return;
  }

  if (!selectedPaymentMethod) {
    showMsg('Please select which QR code you paid to.', 'error');
    return;
  }

  const fileInput = document.getElementById('paymentScreenshot');
  let paymentIdValue = '';
  if (selectedPaymentMethod === 'qr') {
    if (!fileInput.files.length) {
      showMsg('Please upload your payment screenshot.', 'error');
      return;
    }
    paymentIdValue = document.getElementById('paymentId').value.trim();
    if (!paymentIdValue) {
      showMsg('Please enter your payment ID.', 'error');
      return;
    }
    if (fileInput.files[0].size > MAX_PHOTO_BYTES) {
      showMsg('Payment screenshot is larger than 10MB — please choose a smaller file.', 'error');
      return;
    }
  }

  if (!isValidCricheroesLink(form.cricheroesLink.value)) {
    showMsg('Please enter a valid Cric Heroes link, e.g. https://chshare.link/player/nhh1FI', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Uploading photo…';

  let photoPath;
  try {
    photoPath = await uploadToBucket('bym-photos', photoInput.files[0]);
  } catch (err) {
    console.error(err);
    showMsg('Could not upload your photo (' + (err.message || 'please check your connection') + '). Please try again.', 'error');
    btn.disabled = false;
    btn.textContent = 'Submit Registration';
    return;
  }

  let screenshotPath = '';
  if (selectedPaymentMethod === 'qr') {
    btn.textContent = 'Uploading screenshot…';
    try {
      screenshotPath = await uploadToBucket('bym-screenshots', fileInput.files[0]);
    } catch (err) {
      console.error(err);
      showMsg('Could not upload your payment screenshot (' + (err.message || 'please check your connection') + '). Please try again.', 'error');
      btn.disabled = false;
      btn.textContent = 'Submit Registration';
      return;
    }
  }

  btn.textContent = 'Submitting…';

  const payload = {
    fullName: form.fullName.value,
    mobileNumber: form.mobileNumber.value,
    dob: form.dob.value,
    skillset: form.skillset.value,
    bowlingArm: form.bowlingArm.value,
    battingStyle: form.battingStyle.value,
    cricheroesLink: form.cricheroesLink.value,
    jerseyName: form.jerseyName.value,
    jerseyNumber: form.jerseyNumber.value,
    jerseySize: form.jerseySize.value,
    paymentId: paymentIdValue,
    paymentMethod: selectedPaymentMethod,
    qrLabel: selectedPaymentLabel,
    paymentIdAutoDetected: selectedPaymentMethod === 'cash' ? null : paymentIdAutoDetected,
    confirmCorrect: document.getElementById('confirmCorrect').checked,
    agreeTC: document.getElementById('agreeTC').checked,
    photoPath,
    screenshotPath,
  };

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();

    if (!res.ok) {
      showMsg(result.error || 'Something went wrong. Please try again.', 'error');
      btn.disabled = false;
      btn.textContent = 'Submit Registration';
      return;
    }

    const followUp = selectedPaymentMethod === 'cash'
      ? 'Please make the payment at the earliest — ideally within 24 hours of this submission — or your spot may be given to the next player on the waiting list.'
      : 'We will verify your payment shortly.';
    const successPrefix = 'Registration submitted! Your reference ID is ' + result.id + '. ' + followUp + ' Once your payment is verified, you will appear in the confirmed players list at';
    showSuccessMsg(successPrefix, '/players', '/players');
    form.reset();
    setOcrStatus('', '');
    setPhotoStatus('', '');
    btn.textContent = 'Submitted ✓';
  } catch (err) {
    console.error(err);
    showMsg('Your file(s) uploaded, but the registration could not be submitted (' + (err.message || 'please check your connection') + '). Please try again — you will need to reselect your files.', 'error');
    btn.disabled = false;
    btn.textContent = 'Submit Registration';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  loadMethodTiles();
  document.getElementById('regForm').addEventListener('submit', handleSubmit);
  document.getElementById('paymentScreenshot').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) runOcr(file);
  });
  document.getElementById('paymentId').addEventListener('input', () => {
    paymentIdAutoDetected = false;
  });
  document.getElementById('mobileNumber').addEventListener('input', (e) => {
    // Keep only digits and cap at 10 -- the backend also rejects anything
    // else, but stripping live avoids a confusing "invalid format" message
    // after someone pastes a number with spaces, dashes, or a +91 prefix.
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
  });
  document.getElementById('photoUpload').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const err = validatePhotoFile(file);
    setPhotoStatus(err || `Selected: ${file.name}`, err ? 'error' : 'ok');
  });
});
