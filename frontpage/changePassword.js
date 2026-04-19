/* changePassword.js — Internly
   Handles: toggle visibility, strength meter, form submission + feedback
*/

function toggleVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  const icon  = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

function checkStrength(val) {
  const bars  = ['s1','s2','s3','s4'].map(id => document.getElementById(id));
  const label = document.getElementById('strengthLabel');

  let score = 0;
  if (val.length >= 12)           score++;
  if (/[A-Z]/.test(val))          score++;
  if (/[0-9]/.test(val))          score++;
  if (/[^A-Za-z0-9]/.test(val))  score++;

  const colors = ['#e53935','#fb8c00','#fdd835','#43a047'];
  const labels = ['Weak','Fair','Good','Strong'];

  bars.forEach((b, i) => {
    b.style.background = i < score ? colors[score - 1] : '#e0e0e0';
  });
  label.textContent = val.length === 0 ? '' : (labels[score - 1] || '');
  label.style.color = score > 0 ? colors[score - 1] : '#888';
}

/* Helper — show an error message under the correct field */
function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent      = message;
  el.style.display    = 'block';
}

function clearMessages() {
  ['currentError','matchError'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.textContent = ''; }
  });
  const banner = document.getElementById('successBanner');
  if (banner) banner.style.display = 'none';
}

async function handleSave() {
  const currentVal  = document.getElementById('currentPassword').value.trim();
  const newVal      = document.getElementById('newPassword').value;
  const confirmVal  = document.getElementById('confirmPassword').value;

  clearMessages();

  /* ── Client-side validation ── */
  let valid = true;

  if (!currentVal) {
    showError('currentError', 'Please enter your current password.');
    valid = false;
  }

  if (!newVal) {
    showError('matchError', 'Please enter a new password.');
    valid = false;
  }

  if (newVal && newVal !== confirmVal) {
    showError('matchError', 'Passwords do not match.');
    valid = false;
  }

  if (!valid) return;

  /* ── Submit to server ── */
  const token = localStorage.getItem('token');

  try {
    const res  = await fetch('/change-password', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        currentPassword:    currentVal,
        newPassword:        newVal,
        confirmNewPassword: confirmVal
      })
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data.error || 'Failed to update password.';

      /* Route the error to the most relevant field */
      if (msg.toLowerCase().includes('current')) {
        showError('currentError', msg);
      } else {
        showError('matchError', msg);
      }
      return;
    }

    /* ── Success ── */
    const banner = document.getElementById('successBanner');
    if (banner) banner.style.display = 'block';

    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value     = '';
    document.getElementById('confirmPassword').value = '';
    checkStrength('');

  } catch (err) {
    console.error('Change-password error:', err);
    showError('matchError', 'Server error. Please try again.');
  }
}
