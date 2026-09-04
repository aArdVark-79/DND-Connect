import { supabase } from '../config/supabase.js';

// ============ HELP & REPORT ============
const helpFabBtn = document.getElementById('helpFabBtn');
const helpReportOverlay = document.getElementById('helpReportOverlay');
const reportTypeToggle = document.getElementById('reportTypeToggle');
const reportListingIdWrap = document.getElementById('reportListingIdWrap');
const reportListingId = document.getElementById('reportListingId');
const reportMessage = document.getElementById('reportMessage');
const reportMessageLabel = document.getElementById('reportMessageLabel');
const reportContact = document.getElementById('reportContact');
const reportMsgFeedback = document.getElementById('reportMsgFeedback');
const helpReportSubmit = document.getElementById('helpReportSubmit');
let reportType = 'listing';

function resetReportForm() {
  reportType = 'listing';
  [...reportTypeToggle.children].forEach(b => b.classList.toggle('active', b.dataset.type === 'listing'));
  reportListingIdWrap.style.display = 'block';
  reportMessageLabel.textContent = 'What happened?';
  reportListingId.value = '';
  reportMessage.value = '';
  reportContact.value = '';
  reportMsgFeedback.style.display = 'none';
  helpReportSubmit.disabled = false;
  helpReportSubmit.textContent = 'Send';
}

helpFabBtn.addEventListener('click', () => {
  resetReportForm();
  helpReportOverlay.classList.add('open');
});
document.getElementById('helpReportCancel').addEventListener('click', () => helpReportOverlay.classList.remove('open'));
helpReportOverlay.addEventListener('click', (e) => { if (e.target === helpReportOverlay) helpReportOverlay.classList.remove('open'); });

reportTypeToggle.addEventListener('click', (e) => {
  if (e.target.tagName !== 'BUTTON') return;
  [...reportTypeToggle.children].forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  reportType = e.target.dataset.type;
  reportListingIdWrap.style.display = reportType === 'listing' ? 'block' : 'none';
  reportMessageLabel.textContent = reportType === 'listing' ? 'What happened?' : 'What\'s your question?';
});

helpReportSubmit.addEventListener('click', async () => {
  const messageVal = reportMessage.value.trim();
  reportMsgFeedback.style.display = 'none';
  if (!messageVal) {
    reportMsgFeedback.textContent = 'Please enter a message before sending.';
    reportMsgFeedback.style.display = 'block';
    return;
  }

  helpReportSubmit.disabled = true;
  helpReportSubmit.textContent = 'Sending...';

  const { error } = await supabase.rpc('submit_report', {
    p_report_type: reportType,
    p_listing_id: reportType === 'listing' && reportListingId.value.trim() ? reportListingId.value.trim() : null,
    p_message: messageVal,
    p_contact: reportContact.value.trim() || null,
  });

  if (error) {
    helpReportSubmit.disabled = false;
    helpReportSubmit.textContent = 'Send';
    reportMsgFeedback.textContent = error.message;
    reportMsgFeedback.style.display = 'block';
    return;
  }

  helpReportSubmit.textContent = 'Sent';
  reportMsgFeedback.textContent = 'Thanks — we\'ll take a look.';
  reportMsgFeedback.style.display = 'block';
  setTimeout(() => helpReportOverlay.classList.remove('open'), 1200);
});
