const fs = require("fs");
const path = require("path");

const TIME_ZONE = "Asia/Hong_Kong";
const FETCH_TIMEOUT_MS = 8000;

function formatHkt(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short"
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const zone = map.timeZoneName === "GMT+8" ? "HKT" : map.timeZoneName || "HKT";
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute} ${zone}`;
}

function loadConfig() {
  const configPath = path.join(process.cwd(), "data", "user_metrics_sources.json");
  if (!fs.existsSync(configPath)) return {};
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function monthShift(year, month, offset) {
  const totalMonths = year * 12 + (month - 1) + offset;
  return {
    year: Math.floor(totalMonths / 12),
    month: (totalMonths % 12) + 1
  };
}

function monthLabel({ year, month }) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

function monthWindow(runDate, months) {
  const lastComplete = monthShift(runDate.getFullYear(), runDate.getMonth() + 1, -1);
  const start = monthShift(lastComplete.year, lastComplete.month, -(months - 1));
  return {
    startDate: monthLabel(start),
    endDate: monthLabel(lastComplete)
  };
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value).replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractRows(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows
    .map((row) => {
      const value =
        toNumber(row.active_users) ??
        toNumber(row.users) ??
        toNumber(row.value) ??
        toNumber(row.mau) ??
        toNumber(row.dau);
      const period = row.date || row.month || row.period || row.start_date || row.end_date;
      if (value === null || !period) return null;
      return { period: String(period).slice(0, 10), value };
    })
    .filter(Boolean)
    .sort((a, b) => String(a.period).localeCompare(String(b.period)));
}

function formatCompact(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${Math.round(value)}`;
}

function pctChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return (current / previous - 1) * 100;
}

function formatPctDelta(value, suffix) {
  if (value === null || value === undefined || !Number.isFinite(value)) return `n/a ${suffix}`;
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}% ${suffix}`;
}

function average(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function endpointFor(config, app) {
  const template =
    process.env.SIMILARWEB_ACTIVE_USERS_URL_TEMPLATE ||
    config.endpoint_template ||
    "https://api.similarweb.com/v5/apps/{store}/active-users";
  const storeMap = { google: "Google", apple: "Apple", unified: "Unified" };
  const store = storeMap[String(app.store || "google").toLowerCase()] || "Google";
  return template.replace("{store}", store);
}

async function fetchActiveUsers(config, app, apiKey, granularity, startDate, endDate) {
  if (typeof fetch !== "function") {
    throw new Error("Server runtime does not expose fetch().");
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    app_id: app.app_id,
    country: config.country || "in",
    granularity,
    start_date: startDate,
    end_date: endDate,
    format: "json"
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${endpointFor(config, app)}?${params.toString()}`, {
      headers: { "api-key": apiKey },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Similarweb HTTP ${response.status}`);
    }
    return extractRows(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

function buildProviderUnconfigured(config, data, runDate) {
  const existing = data.user_metrics || {};
  return {
    status: "provider_unconfigured",
    source: config.provider || "similarweb_app_active_users",
    scope: config.primary_metric_scope || "India national app panel",
    updated_at: formatHkt(runDate),
    note: "Set SIMILARWEB_API_KEY in Vercel to update MAU, DAU and DAU/MAU automatically; current KPI cards remain static estimates.",
    mau_trend: existing.mau_trend || [],
    platforms: existing.platforms || [
      { key: "blinkit", name: "Blinkit", mau: "--", dau: "--", stickiness: "27.4%" },
      { key: "swiggy", name: "Swiggy", mau: "--", dau: "--", stickiness: "24.9%" },
      { key: "zepto", name: "Zepto", mau: "--", dau: "--", stickiness: "23.1%" }
    ]
  };
}

function applyUserMetrics(data, result) {
  data.user_metrics = Object.fromEntries(
    Object.entries(result).filter(([key]) => key !== "kpis")
  );
  if (result.kpis) {
    data.kpis = result.kpis;
  }
  data.platform_stickiness = Object.fromEntries(
    (data.user_metrics.platforms || []).map((row) => [row.key === "swiggy" ? "instamart" : row.key, row.stickiness])
  );
  data.mau_trend = {
    bars: (data.user_metrics.mau_trend || []).map((row) => ({
      label: row.period,
      value: row.label,
      height: row.height
    }))
  };
  return data;
}

async function buildLiveUserMetrics(data) {
  const config = loadConfig();
  const apiKey = process.env.SIMILARWEB_API_KEY || process.env.SIMILARWEB_APP_API_KEY;
  const runDate = new Date();

  if (!apiKey) {
    return applyUserMetrics(data, buildProviderUnconfigured(config, data, runDate));
  }

  const apps = config.apps || [];
  if (!apps.length) {
    data.user_metrics = {
      status: "provider_config_missing",
      source: config.provider || "similarweb_app_active_users",
      scope: config.primary_metric_scope || "India national app panel",
      updated_at: formatHkt(runDate),
      note: "No apps configured in data/user_metrics_sources.json."
    };
    return data;
  }

  try {
    const historyMonths = Number(config.history_months || 13);
    const dailyDays = Number(config.daily_days || 14);
    const monthlyWindow = monthWindow(runDate, historyMonths);
    const dailyEnd = new Date(runDate);
    dailyEnd.setDate(dailyEnd.getDate() - 1);
    const dailyStart = new Date(dailyEnd);
    dailyStart.setDate(dailyStart.getDate() - (dailyDays - 1));

    const results = [];
    for (const app of apps) {
      const monthly = await fetchActiveUsers(
        config,
        app,
        apiKey,
        "monthly",
        monthlyWindow.startDate,
        monthlyWindow.endDate
      );
      const daily = await fetchActiveUsers(
        config,
        app,
        apiKey,
        "daily",
        dailyStart.toISOString().slice(0, 10),
        dailyEnd.toISOString().slice(0, 10)
      );
      if (!monthly.length) continue;
      const latestMau = monthly[monthly.length - 1].value;
      const previousMau = monthly.length > 1 ? monthly[monthly.length - 2].value : null;
      const yearAgoMau = monthly.length >= 13 ? monthly[monthly.length - 13].value : null;
      const latestDau = average(daily.slice(-7).map((row) => row.value));
      const priorDau = average(daily.slice(-14, -7).map((row) => row.value));
      results.push({
        key: app.key,
        name: app.name,
        monthly,
        mau: latestMau,
        mauMom: pctChange(latestMau, previousMau),
        mauYoy: pctChange(latestMau, yearAgoMau),
        dau: latestDau,
        dauWow: pctChange(latestDau, priorDau),
        stickiness: latestDau && latestMau ? (latestDau / latestMau) * 100 : null
      });
    }

    if (!results.length) {
      const fallback = buildProviderUnconfigured(config, data, runDate);
      fallback.status = "provider_empty_response";
      fallback.note = "Similarweb returned no usable active-user rows; static estimates retained.";
      return applyUserMetrics(data, fallback);
    }

    const monthTotals = new Map();
    results.forEach((result) => {
      result.monthly.forEach((row) => {
        const period = String(row.period).slice(0, 7);
        monthTotals.set(period, (monthTotals.get(period) || 0) + row.value);
      });
    });
    const trend = [...monthTotals.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([period, value], _, rows) => {
        const max = Math.max(...rows.map((row) => row[1]));
        return {
          period,
          value,
          label: formatCompact(value),
          height: Math.max(22, Math.round((value / max) * 88))
        };
      });

    const latestMonth = [...monthTotals.keys()].sort().at(-1);
    const previousMonth = [...monthTotals.keys()].sort().at(-2);
    const yearAgoMonth = [...monthTotals.keys()].sort().at(-13);
    const combinedMau = [...monthTotals.values()].at(-1);
    const combinedDau = results.reduce((sum, row) => sum + (row.dau || 0), 0);
    const combinedStickiness = combinedMau && combinedDau ? (combinedDau / combinedMau) * 100 : null;

    return applyUserMetrics(data, {
      status: "live_similarweb_api",
      source: config.provider || "similarweb_app_active_users",
      scope: config.primary_metric_scope || "India national Android app panel",
      updated_at: formatHkt(runDate),
      latest_period: latestMonth,
      note: "Live Similarweb App Active Users API. DAU is average daily active users over the latest seven available days.",
      mau_trend: trend,
      platforms: results.map((row) => ({
        key: row.key,
        name: row.name,
        mau: formatCompact(row.mau),
        dau: formatCompact(row.dau),
        stickiness: row.stickiness === null ? "n/a" : `${row.stickiness.toFixed(1)}%`,
        mau_mom: formatPctDelta(row.mauMom, "MoM"),
        dau_wow: formatPctDelta(row.dauWow, "7D vs prev 7D")
      })),
      kpis: {
        mau: {
          value: formatCompact(combinedMau),
          mom: formatPctDelta(
            pctChange(monthTotals.get(latestMonth), previousMonth ? monthTotals.get(previousMonth) : null),
            "MoM"
          ),
          yoy: formatPctDelta(
            pctChange(monthTotals.get(latestMonth), yearAgoMonth ? monthTotals.get(yearAgoMonth) : null),
            "YoY"
          )
        },
        dau: {
          value: formatCompact(combinedDau),
          mom: "latest 7D average",
          yoy: "provider live API"
        },
        dau_mau: {
          value: combinedStickiness === null ? "n/a" : `${combinedStickiness.toFixed(1)}%`,
          mom: "DAU uses latest 7D average"
        }
      }
    });
  } catch (error) {
    const fallback = buildProviderUnconfigured(config, data, runDate);
    fallback.status = "provider_fetch_failed";
    fallback.note = `Similarweb user-metric fetch failed; static estimates retained. Error: ${error.message}`;
    return applyUserMetrics(data, fallback);
  }
}

module.exports = {
  buildLiveUserMetrics
};
