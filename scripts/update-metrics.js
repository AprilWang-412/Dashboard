// scripts/update-metrics.js
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'dashboard_data.json');

function updateMetrics() {
  const newMAU = process.argv[2];
  const newDAU = process.argv[3];

  if (!newMAU || !newDAU) {
    console.log('Usage: node scripts/update-metrics.js <MAU> <DAU>');
    console.log('Example: node scripts/update-metrics.js 78.5 19.8');
    process.exit(1);
  }

  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    data.kpis.mau.value = `${newMAU}M`;
    data.kpis.dau.value = `${newDAU}M`;
    data.kpis.dau_mau.value = `${((parseFloat(newDAU) / parseFloat(newMAU)) * 100).toFixed(1)}%`;
    data.meta.data_updated_at = new Date().toLocaleString('en-GB', { hour12: false, timeZone: 'Asia/Hong_Kong' });
    data.meta.data_updated_at_iso = new Date().toISOString();

    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`✅ MAU updated to ${newMAU}M, DAU updated to ${newDAU}M`);
  } catch (err) {
    console.error('更新失败:', err.message);
  }
}

updateMetrics();
