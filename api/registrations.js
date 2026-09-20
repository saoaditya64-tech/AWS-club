const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join('/tmp', 'data');
const REGISTRATIONS_FILE = path.join(DATA_DIR, 'registrations.json');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let list = [];
  try {
    if (fs.existsSync(REGISTRATIONS_FILE)) {
      list = JSON.parse(fs.readFileSync(REGISTRATIONS_FILE, 'utf-8') || '[]');
    }
  } catch (e) {}

  // Merge live Google Sheet rows if GET
  if (req.method === 'GET') {
    try {
      const sheetRes = await fetch('https://script.google.com/macros/s/AKfycbz2nqsYrezuQ-FTOGoQQbDKpdEZW8ZPSLGx5YZzUhe29650r0Jb9ABoNWRVndstq-JJ/exec', {
        signal: AbortSignal.timeout(3500)
      });
      if (sheetRes.ok) {
        const sheetData = await sheetRes.json();
        if (sheetData && Array.isArray(sheetData.registrations)) {
          const map = new Map();
          list.forEach(item => { if (item && item.id) map.set(item.id, item); });
          sheetData.registrations.forEach(item => { if (item && item.id) map.set(item.id, item); });
          list = Array.from(map.values());
        }
      }
    } catch (e) {}
  }

  if (req.method === 'DELETE') {
    // Extract ID from query or url path
    const urlParts = (req.url || '').split('?')[0].split('/');
    const id = req.query?.id || urlParts[urlParts.length - 1];
    if (id && id !== 'registrations') {
      const initialCount = list.length;
      list = list.filter(r => r.id !== id);
      if (list.length < initialCount) {
        try {
          fs.writeFileSync(REGISTRATIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
        } catch (e) {}
        return res.status(200).json({ success: true, message: `Deleted ${id}` });
      }
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }
    return res.status(400).json({ success: false, message: 'ID is required' });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = list.filter(r => r.registeredAt && r.registeredAt.startsWith(todayStr)).length;
  const branchCounts = {};
  const yearCounts = {};
  list.forEach(r => {
    branchCounts[r.branch] = (branchCounts[r.branch] || 0) + 1;
    yearCounts[r.year] = (yearCounts[r.year] || 0) + 1;
  });

  return res.status(200).json({
    success: true,
    total: list.length,
    todayCount,
    branchCounts,
    yearCounts,
    settings: { adminWhatsApp: '919343756202' },
    registrations: list
  });
};
