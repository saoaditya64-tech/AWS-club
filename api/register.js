const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join('/tmp', 'data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {}
}
const REGISTRATIONS_FILE = path.join(DATA_DIR, 'registrations.json');

function getRegistrations() {
  try {
    if (!fs.existsSync(REGISTRATIONS_FILE)) return [];
    return JSON.parse(fs.readFileSync(REGISTRATIONS_FILE, 'utf-8') || '[]');
  } catch (e) {
    return [];
  }
}

function saveRegistrations(data) {
  try {
    fs.writeFileSync(REGISTRATIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {}
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    body = body || {};

    const { name, email, phone, branch, year, section } = body;

    if (!name || !email || !phone || !branch || !year || !section) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const registrations = getRegistrations();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const regId = `AWS-RU-${randomSuffix}`;
    const now = new Date();
    const formattedDate = now.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const newRecord = {
      id: regId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      branch: branch.trim(),
      year: year.trim(),
      section: section.trim().toUpperCase(),
      registeredAt: now.toISOString(),
      formattedDate: formattedDate
    };

    registrations.unshift(newRecord);
    saveRegistrations(registrations);

    // Asynchronously forward to Google Sheets
    fetch('https://script.google.com/macros/s/AKfycbz2nqsYrezuQ-FTOGoQQbDKpdEZW8ZPSLGx5YZzUhe29650r0Jb9ABoNWRVndstq-JJ/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRecord)
    }).catch(e => console.warn('Google Sheet sync notice:', e.message));

    const whatsappText = `🚀 *NEW REGISTRATION — AWS COMMUNITY DAY* 🚀\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🎟️ *Pass ID*: #${newRecord.id}\n` +
      `👤 *Student Name*: ${newRecord.name}\n` +
      `📱 *Mobile*: ${newRecord.phone}\n` +
      `📧 *Email*: ${newRecord.email}\n` +
      `🎓 *Branch*: ${newRecord.branch}\n` +
      `📅 *Year*: ${newRecord.year} Year | *Section*: ${newRecord.section}\n` +
      `🏛️ *Venue*: Rungta University Campus\n` +
      `⏰ *Registered On*: ${formattedDate}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ *Status*: Confirmed Student Pass`;

    const adminWhatsApp = '919343756202';
    const adminWhatsAppUrl = `https://wa.me/${adminWhatsApp}?text=${encodeURIComponent(whatsappText)}`;

    const cleanStudentPhone = newRecord.phone.replace(/[^0-9]/g, '');
    const studentPhoneWithCountry = cleanStudentPhone.length === 10 ? `91${cleanStudentPhone}` : cleanStudentPhone;
    const studentWhatsAppUrl = `https://wa.me/${studentPhoneWithCountry}?text=${encodeURIComponent(whatsappText)}`;

    return res.status(200).json({
      success: true,
      message: 'Registration successful!',
      registration: newRecord,
      whatsappText: whatsappText,
      studentWhatsAppUrl: studentWhatsAppUrl,
      adminWhatsAppUrl: adminWhatsAppUrl
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
