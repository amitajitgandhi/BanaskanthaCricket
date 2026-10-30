let supabaseClient = null;

async function loadConfig() {
  const res = await fetch('/api/config');
  const cfg = await res.json();

  document.getElementById('metaDates').textContent = cfg.eventDates;
  document.getElementById('metaVenue').textContent = cfg.venue;
  document.getElementById('metaDeadline').textContent = cfg.registrationDeadline;

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
function showSuccessMsg(referenceId) {
  const el = document.getElementById('formMsg');
  el.textContent = '';

  const lines = [
    'Registration submitted successfully.',
    'We will review your details and contact you if any discrepancies or clarifications are required.',
    'If a player remains unsold during the auction, the applicable registration fee will be refunded.',
    'See you at the auction soon! Stay tuned for more details.',
  ];

  lines.forEach((line, index) => {
    if (index > 0) el.appendChild(document.createElement('br'));
    el.appendChild(document.createTextNode(line));
  });

  el.appendChild(document.createElement('br'));
  el.appendChild(document.createTextNode('Your registration reference ID is ' + referenceId + '.'));
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
  return !String(url || '').trim() || /^https:\/\/chshare\.link\/player\/[A-Za-z0-9_-]+\/?(\?.*)?$/i.test(String(url || '').trim());
}

const DOB_CUTOFF = '2009-12-10';

function isEligibleDateOfBirth(dob) {
  return Boolean(dob) && dob <= DOB_CUTOFF;
}


function openAgeCriteriaModal() {
  const modal = document.getElementById('ageCriteriaModal');
  const okButton = document.getElementById('ageModalOk');
  if (!modal || !okButton) return;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  okButton.focus();
  const close = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
    document.getElementById('dob').focus();
    okButton.removeEventListener('click', close);
    modal.removeEventListener('click', onBackdrop);
    document.removeEventListener('keydown', onKeydown);
  };
  const onBackdrop = (event) => { if (event.target === modal) close(); };
  const onKeydown = (event) => {
    if (event.key === 'Escape') close();
    if (event.key === 'Tab') {
      event.preventDefault();
      okButton.focus();
    }
  };
  okButton.addEventListener('click', close);
  modal.addEventListener('click', onBackdrop);
  document.addEventListener('keydown', onKeydown);
}

async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById('submitBtn');

  const dob = document.getElementById('dob').value;
  if (!isEligibleDateOfBirth(dob)) {
    const message = 'Date of birth criteria not met. Players must have been born on or before 10 December 2009. Your registration cannot be submitted.';
    showMsg(message, 'error');
    openAgeCriteriaModal();
    return;
  }

  const photoInput = document.getElementById('photoUpload');
  const photoErr = validatePhotoFile(photoInput.files[0]);
  if (photoErr) {
    setPhotoStatus(photoErr, 'error');
    showMsg(photoErr, 'error');
    return;
  }

  const cricHeroesValue = form.cricheroesLink.value.trim();
  if (cricHeroesValue && !isValidCricheroesLink(cricHeroesValue)) {
    showMsg('Please enter a valid Cric Heroes link, or leave the field blank.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Uploading photo…';

  let photoPath;
  try {
    photoPath = await uploadToBucket('sbkym-player-photos', photoInput.files[0]);
  } catch (err) {
    console.error(err);
    showMsg('Could not upload your photo (' + (err.message || 'please check your connection') + '). Please try again.', 'error');
    btn.disabled = false;
    btn.textContent = 'Submit Registration';
    return;
  }

  const payload = {
    formNumber: form.formNumber.value.trim(),
    fullName: form.fullName.value,
    gotra: form.gotra.value.trim(),
    mobileNumber: form.mobileNumber.value,
    dob: form.dob.value,
    skillset: form.skillset.value,
    bowlingArm: form.bowlingArm.value,
    bowlingStyle: form.bowlingStyle.value,
    battingStyle: form.battingStyle.value,
    cricheroesLink: form.cricheroesLink.value.trim(),
    jerseyName: form.jerseyName.value,
    jerseyNumber: form.jerseyNumber.value,
    jerseySize: form.jerseySize.value,

    confirmCorrect: document.getElementById('confirmCorrect').checked,
    agreeTC: document.getElementById('agreeTC').checked,
    photoPath,

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

    showSuccessMsg(result.id);
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

  document.getElementById('regForm').addEventListener('submit', handleSubmit);
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
