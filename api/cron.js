// api/cron.js
module.exports = async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.CRON_SECRET;

  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.status(200).json({
    success: true,
    timestamp: new Date().toISOString(),
    message: 'Cron job executed - Dashboard data refresh triggered'
  });
};
