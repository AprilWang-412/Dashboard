// api/benchmark-crawler.js
const https = require('https');

const BENCHMARK_COMPANIES = {
  doordash: {
    name: 'DoorDash',
    symbol: 'DASH',
    exchange: 'NASDAQ',
    userMetrics: { mau: '56M+', frequencyNote: 'All-time high (reported direction)' }
  },
  meituan: {
    name: 'Meituan / Keeta',
    symbol: '3690.HK',
    exchange: 'HKEX',
    userMetrics: { atu: '800M+', dauGrowth: '20%+' }
  }
};

async function fetchStockData(symbol) {
  return new Promise((resolve) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;

    https.get(url, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          const json = JSON.parse(data);
          const result = json.chart?.result?.[0];
          if (result) {
            const meta = result.meta;
            const quote = result.indicators.quote?.[0];
            const lastPrice = quote?.close?.[quote.close.length - 1] || meta.regularMarketPrice;

            resolve({
              symbol,
              price: lastPrice ? `$${lastPrice.toFixed(2)}` : 'N/A',
              marketCap: meta.marketCap ? `$${(meta.marketCap / 1e9).toFixed(1)}B` : 'N/A',
              updatedAt: new Date().toISOString(),
              source: 'Yahoo Finance'
            });
          } else {
            resolve(null);
          }
        } catch (err) {
          console.warn(`解析 ${symbol} 数据失败:`, err.message);
          resolve(null);
        }
      });
    }).on('error', (err) => {
      console.warn(`获取 ${symbol} 数据失败:`, err.message);
      resolve(null);
    });
  });
}

function generateBenchmarkData(stockData) {
  const benchmark = {
    last_updated: new Date().toISOString().slice(0, 10),
    entities: [
      {
        name: "India Top-3 (Blinkit + Instamart + Zepto)",
        user_metric: "MAU (estimated)",
        user_value: "74.2M",
        stickiness_metric: "DAU/MAU",
        stickiness_value: "25.1%",
        commentary: "High growth with elevated promo intensity."
      },
      {
        name: "DoorDash",
        user_metric: "MAU (reported)",
        user_value: stockData.doordash?.mau || "56M+",
        stickiness_metric: "Order frequency trend",
        stickiness_value: "All-time high",
        commentary: `Price: ${stockData.doordash?.price || 'N/A'} | Market cap: ${stockData.doordash?.marketCap || 'N/A'}`
      },
      {
        name: "Meituan / Keeta",
        user_metric: "Annual Transacting Users",
        user_value: stockData.meituan?.atu || "800M+",
        stickiness_metric: "App DAU growth (YoY)",
        stickiness_value: stockData.meituan?.dauGrowth || "20%+",
        commentary: `Price: ${stockData.meituan?.price || 'N/A'} | Market cap: ${stockData.meituan?.marketCap || 'N/A'}`
      }
    ],
    kpi_comparison: [
      { axis: "User Scale", india: "74.2M MAU (est.)", doordash: stockData.doordash?.mau || "56M+ MAU", meituan_keeta: stockData.meituan?.atu || "800M+ ATU", comparability: "Medium (metric definitions differ)" },
      { axis: "Engagement Quality", india: "DAU/MAU 25.1%", doordash: "Order frequency at all-time high", meituan_keeta: stockData.meituan?.dauGrowth || "DAU grew 20%+ YoY", comparability: "Low-Medium (different disclosure metrics)" },
      { axis: "Market Performance", india: "Private / Partially Public", doordash: stockData.doordash?.price || "N/A", meituan_keeta: stockData.meituan?.price || "N/A", comparability: "Public vs Private" },
      { axis: "Unit Economics", india: "Improving but uneven", doordash: "Mature profitable cohorts", meituan_keeta: "Scale with competitive investment", comparability: "Directional" },
      { axis: "Operational Consistency", india: "Peak-hour volatility", doordash: "Lower defect rates", meituan_keeta: "High-density fulfilment", comparability: "Directional" }
    ],
    gap_readout: [
      "India platforms are stronger on growth speed than on consistency under stress.",
      "Global peers show better repeatability in mature cohorts and service reliability.",
      "India's key gap is reducing promo dependence while preserving user growth.",
      "India's key upside is faster category experimentation and rapid city scaling.",
      `Stock data from Yahoo Finance as of ${new Date().toLocaleDateString()}`
    ]
  };

  return benchmark;
}

async function getBenchmarkData() {
  console.log('📊 正在获取 Benchmark 数据...');

  const stockPromises = [fetchStockData('DASH'), fetchStockData('3690.HK')];
  const [doordashStock, meituanStock] = await Promise.all(stockPromises);

  const stockData = {
    doordash: doordashStock ? { ...doordashStock, mau: '56M+' } : null,
    meituan: meituanStock ? { ...meituanStock, atu: '800M+', dauGrowth: '20%+' } : null
  };

  const benchmark = generateBenchmarkData(stockData);
  console.log('✅ Benchmark 数据获取完成');
  return benchmark;
}

module.exports = { getBenchmarkData, fetchStockData };
