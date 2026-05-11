const DATA_URLS = ["api/dashboard-data", "data/dashboard_data.json"];
const AUTO_REFRESH_MS = 60 * 1000;

let isRefreshing = false;

const VERTICAL_CONFIG = {
  quick_commerce: {
    elementId: "quick-commerce-column",
    tag: "Quick commerce only",
    platforms: [
      { key: "blinkit", name: "Blinkit" },
      { key: "instamart", name: "Instamart" },
      { key: "zepto", name: "Zepto" }
    ],
    merchantTitle: "FMCG / Merchant Pulse",
    fulfilmentTitle: "SKU, Pricing & Fulfilment"
  },
  food_delivery: {
    elementId: "food-delivery-column",
    tag: "Food delivery only",
    platforms: [
      { key: "zomato", name: "Zomato" },
      { key: "swiggy", name: "Swiggy" }
    ],
    merchantTitle: "Restaurant Pulse",
    fulfilmentTitle: "Restaurant, Pricing & Fulfilment"
  }
};

function el(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const target = el(id);
  if (target) target.textContent = value ?? "--";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(value) {
  const url = String(value || "");
  return /^https?:\/\//i.test(url) ? url : "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asMetric(metric, fallbackValue = "Provider required") {
  return {
    value: metric?.value ?? fallbackValue,
    mom: metric?.mom ?? metric?.delta ?? "",
    yoy: metric?.yoy ?? metric?.note ?? ""
  };
}

function titleCaseKey(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTrendPeriod(period) {
  if (!period) return "";
  const [year, month] = String(period).split("-");
  if (!year || !month) return String(period);
  return new Date(Number(year), Number(month) - 1, 1).toLocaleString("en-GB", { month: "short" });
}

function providerOrderMetrics(verticalName) {
  return {
    status: "order_provider_unconfigured",
    source: "No verified live AOV/order-count provider connected",
    aov: { value: "Provider required", delta: "Connect company disclosure, app-intelligence or scraped order feed" },
    daily_orders: { value: "Provider required", delta: "Connect same-day order-count feed" },
    feed: [
      {
        date: "--",
        message: `${verticalName} AOV and daily order count are intentionally blank until a verified source is connected.`,
        source: "Dashboard control"
      }
    ]
  };
}

function emptyComplaintMap(platforms) {
  return Object.fromEntries(
    platforms.map((platform) => [
      platform.key,
      ["No material public complaint cluster captured in current feed."]
    ])
  );
}

function buildFallbackVerticals(data) {
  const quickConfig = VERTICAL_CONFIG.quick_commerce;
  const foodConfig = VERTICAL_CONFIG.food_delivery;
  const quickOrders = providerOrderMetrics("Quick commerce");
  const foodOrders = providerOrderMetrics("Food delivery");

  const quickMerchantComplaints = {
    blinkit: data.merchant_complaints?.blinkit || [],
    instamart: data.merchant_complaints?.instamart || data.merchant_complaints?.swiggy || [],
    zepto: data.merchant_complaints?.zepto || []
  };
  const quickDriverComplaints = {
    blinkit: data.driver_complaints?.blinkit || [],
    instamart: data.driver_complaints?.instamart || data.driver_complaints?.swiggy || [],
    zepto: data.driver_complaints?.zepto || []
  };

  return {
    quick_commerce: {
      key: "quick_commerce",
      title: "Quick Commerce",
      subtitle: "Blinkit, Swiggy Instamart and Zepto | Grocery, FMCG and dark-store fulfilment",
      platforms: quickConfig.platforms,
      source_item_count: data.meta?.source_item_count || 0,
      kpis: {
        mau: asMetric(data.kpis?.mau),
        dau: asMetric(data.kpis?.dau),
        dau_mau: asMetric(data.kpis?.dau_mau),
        aov: quickOrders.aov,
        daily_orders: quickOrders.daily_orders
      },
      order_metrics: quickOrders,
      user_metrics: data.user_metrics || {},
      risk_signals: data.risk_signals || { active_count: 0, new_this_week: 0, closed_historical: 0, items: [] },
      consumer_complaints: data.consumer_complaints || emptyComplaintMap(quickConfig.platforms),
      merchant_complaints: quickMerchantComplaints,
      driver_complaints: quickDriverComplaints,
      india_narrative_events: data.india_narrative_events || [],
      review_volume_7d: data.review_volume_7d || {},
      sentiment_mix: data.sentiment_mix || { positive: 0, neutral: 100, negative: 0 },
      top_complaint_topics: data.top_complaint_topics || [],
      merchant_sentiment: data.merchant_sentiment || {},
      pain_points: data.pain_points || {},
      driver_satisfaction: data.driver_satisfaction || {},
      driver_volatility: data.driver_volatility || {},
      driver_risk_alerts: data.driver_risk_alerts || [],
      growth_scores: data.growth_scores || {},
      risk_scores: data.risk_scores || {},
      pricing_index: data.pricing_index || {},
      eta_data: data.eta_data || {},
      inventory_data: data.inventory_data || {}
    },
    food_delivery: {
      key: "food_delivery",
      title: "Food Delivery",
      subtitle: "Zomato and Swiggy | Restaurant marketplace and meal delivery",
      platforms: foodConfig.platforms,
      source_item_count: 0,
      kpis: {
        mau: { value: "Provider required", mom: "Connect Zomato/Swiggy app panel", yoy: "Food-delivery split needed" },
        dau: { value: "Provider required", mom: "Connect Zomato/Swiggy app panel", yoy: "Food-delivery split needed" },
        dau_mau: { value: "Provider required", mom: "No live food-delivery user source connected" },
        aov: foodOrders.aov,
        daily_orders: foodOrders.daily_orders
      },
      order_metrics: foodOrders,
      user_metrics: {
        status: "provider_unconfigured",
        source: "similarweb_app_active_users",
        scope: "India national Android app panel | food-delivery segment split",
        note: "Connect Zomato and Swiggy app-panel or segment data to populate food-delivery MAU/DAU."
      },
      risk_signals: {
        active_count: 0,
        new_this_week: 0,
        closed_historical: 0,
        items: [
          {
            date: "--",
            message: "Food-delivery vertical feed requires the live API/source pipeline; no static estimate is inserted.",
            status: "active"
          }
        ]
      },
      consumer_complaints: emptyComplaintMap(foodConfig.platforms),
      merchant_complaints: emptyComplaintMap(foodConfig.platforms),
      driver_complaints: emptyComplaintMap(foodConfig.platforms),
      india_narrative_events: [],
      review_volume_7d: { zomato: 0, swiggy: 0 },
      sentiment_mix: { positive: 0, neutral: 100, negative: 0 },
      top_complaint_topics: [],
      merchant_sentiment: {},
      pain_points: {},
      driver_satisfaction: {},
      driver_volatility: {},
      driver_risk_alerts: [],
      growth_scores: {},
      risk_scores: {},
      pricing_index: { zomato: "Provider required", swiggy: "Provider required" },
      eta_data: {},
      inventory_data: { fill_rate: "n/a", oos_alerts: "n/a", promo_mismatches: "n/a" }
    }
  };
}

function setRuntimeStatus(source, ok, data) {
  const now = new Date().toLocaleString("en-GB", { hour12: false });
  const status = ok ? "OK" : "Fallback";
  const dataStatus = data?.meta?.data_status ? ` | data: ${data.meta.data_status}` : "";
  setText("meta-page-checked", now);
  setText("meta-runtime-status", `${status} | source: ${source}${dataStatus}`);
}

function renderSourceLink(item) {
  const url = safeUrl(item?.url);
  if (!url) return "";
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">source</a>`;
}

function renderKpiCard(label, metric, extraClass = "") {
  const normalized = asMetric(metric);
  const detail = [normalized.mom, normalized.yoy].filter(Boolean).join(" | ");
  return `
    <article class="card kpi vertical-kpi ${extraClass}">
      <h3>${escapeHtml(label)}</h3>
      <p class="big">${escapeHtml(normalized.value)}</p>
      <p class="delta">${escapeHtml(detail || "Awaiting verified update")}</p>
    </article>
  `;
}

function renderRiskSignals(risk) {
  const items = asArray(risk?.items);
  const rows = items.length
    ? items.map((item) => `
        <li class="${item.status === "closed" ? "closed" : ""}">
          <span class="date">${escapeHtml(item.date || "--")}</span>
          <span class="message">${escapeHtml(item.message || "No detail")}</span>
          ${renderSourceLink(item)}
        </li>
      `).join("")
    : `<li><span class="message">No active risk signals in the current feed.</span></li>`;

  return `
    <section class="card risk-signals-card">
      <div class="head">
        <h2>Critical Risk Signals</h2>
        <span class="tag weekly">Rolling feed</span>
      </div>
      <div class="risk-summary-row compact">
        <div class="risk-badge active"><span class="risk-count">${escapeHtml(risk?.active_count ?? 0)}</span><span class="risk-label">Active</span></div>
        <div class="risk-badge new"><span class="risk-count">${escapeHtml(risk?.new_this_week ?? 0)}</span><span class="risk-label">New 7D</span></div>
        <div class="risk-badge closed"><span class="risk-count">${escapeHtml(risk?.closed_historical ?? 0)}</span><span class="risk-label">Closed</span></div>
      </div>
      <ol class="risk-log">${rows}</ol>
    </section>
  `;
}

function renderMiniBars(userMetrics) {
  const trend = asArray(userMetrics?.mau_trend);
  if (!trend.length) {
    return `<p class="note">MAU history requires a connected app-intelligence provider.</p>`;
  }
  return `
    <div class="bars mini-bars">
      ${trend.map((row) => {
        const height = Number(row.height) || 35;
        return `
          <div class="bar" style="--h: ${height}%">
            <strong>${escapeHtml(row.label || row.value || "")}</strong>
            <span>${escapeHtml(formatTrendPeriod(row.period) || row.month || "")}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderPlatformRows(platforms, values, formatter) {
  return `
    <ul class="rows">
      ${platforms.map((platform) => {
        const value = values?.[platform.key];
        return `
          <li>
            <span>${escapeHtml(platform.name)}</span>
            <strong>${escapeHtml(formatter ? formatter(value, platform) : value ?? "--")}</strong>
          </li>
        `;
      }).join("")}
    </ul>
  `;
}

function renderUserMetrics(vertical, config) {
  const metrics = vertical.user_metrics || {};
  const rawRows = asArray(metrics.platforms);
  const rows = config.platforms.map((platform) => {
    const needsSegmentSplit =
      (vertical.key === "quick_commerce" && platform.key === "instamart") ||
      (vertical.key === "food_delivery" && platform.key === "swiggy");
    if (needsSegmentSplit) {
      return {
        key: platform.key,
        name: platform.name,
        mau: "--",
        dau: "--",
        stickiness: "Segment split required",
        segmentNote: "Swiggy whole-app traffic mixes food delivery and Instamart, so it is not shown as segment-pure data."
      };
    }

    const exact = rawRows.find((row) =>
      row.key === platform.key ||
      String(row.name || "").toLowerCase() === platform.name.toLowerCase()
    );
    return exact
      ? { ...exact, name: platform.name }
      : {
          key: platform.key,
          name: platform.name,
          mau: "--",
          dau: "--",
          stickiness: "Provider required"
        };
  });

  return `
    <section class="card">
      <div class="head">
        <h2>User Base & Engagement</h2>
        <span class="tag daily">${escapeHtml(metrics.status || "provider pending")}</span>
      </div>
      <p class="note">${escapeHtml(metrics.scope || "India national app panel")} | ${escapeHtml(metrics.source || "source pending")}</p>
      ${renderMiniBars(metrics)}
      <ul class="rows platform-engagement">
        ${rows.map((row) => `
          <li>
            <span>
              ${escapeHtml(row.name)} | MAU ${escapeHtml(row.mau || "--")} / DAU ${escapeHtml(row.dau || "--")}
              ${row.segmentNote ? `<small>${escapeHtml(row.segmentNote)}</small>` : ""}
            </span>
            <strong>${escapeHtml(row.stickiness || "n/a")}</strong>
          </li>
        `).join("")}
      </ul>
      ${metrics.note ? `<p class="note">${escapeHtml(metrics.note)}</p>` : ""}
    </section>
  `;
}

function renderComplaintCards(title, complaints, platforms) {
  return `
    <section class="card">
      <div class="head">
        <h2>${escapeHtml(title)}</h2>
        <span class="tag weekly">Platform split</span>
      </div>
      <div class="platform-card-grid">
        ${platforms.map((platform) => {
          const items = asArray(complaints?.[platform.key]);
          const rows = items.length ? items : ["No material public complaint cluster captured in current feed."];
          return `
            <article class="mini">
              <h4>${escapeHtml(platform.name)}</h4>
              <ul class="topics">
                ${rows.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
              </ul>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderSentimentMix(sentiment) {
  const positive = Math.max(0, Math.min(100, Number(sentiment?.positive) || 0));
  const neutral = Math.max(0, Math.min(100, Number(sentiment?.neutral) || 0));
  const negative = Math.max(0, Math.min(100, Number(sentiment?.negative) || 0));
  return `
    <div class="sentiment-track" aria-label="Public signal sentiment mix">
      <span class="sentiment-pos" style="width:${positive}%"></span>
      <span class="sentiment-neu" style="width:${neutral}%"></span>
      <span class="sentiment-neg" style="width:${negative}%"></span>
    </div>
    <div class="sentiment-labels">
      <span>Positive ${positive}%</span>
      <span>Neutral ${neutral}%</span>
      <span>Negative ${negative}%</span>
    </div>
  `;
}

function renderConsumerPulse(vertical, config) {
  return `
    <section class="card">
      <div class="head">
        <h2>Consumer Pulse</h2>
        <span class="tag daily">Public signals 7D</span>
      </div>
      <p class="note">Volume below is source-signal volume, not a fabricated app-review count.</p>
      ${renderPlatformRows(config.platforms, vertical.review_volume_7d || {}, (value) => Number(value || 0).toLocaleString())}
      ${renderSentimentMix(vertical.sentiment_mix)}
      <h4>Top Complaint Topics</h4>
      <ul class="topics">
        ${asArray(vertical.top_complaint_topics).length
          ? asArray(vertical.top_complaint_topics).map((topic) => `<li>${escapeHtml(topic)}</li>`).join("")
          : "<li>No topic cluster captured in current feed.</li>"}
      </ul>
    </section>
  `;
}

function renderMerchantPulse(vertical, config) {
  return `
    <section class="card">
      <div class="head">
        <h2>${escapeHtml(config.merchantTitle)}</h2>
        <span class="tag weekly">Partner feedback</span>
      </div>
      ${renderPlatformRows(config.platforms, vertical.merchant_sentiment || {}, (value) => value ? `${value} / 100` : "--")}
      <div class="heat">
        ${Object.entries(vertical.pain_points || {}).length
          ? Object.entries(vertical.pain_points).map(([point, level]) => `<p><span>${escapeHtml(point)}</span><strong>${escapeHtml(level)}</strong></p>`).join("")
          : `<p><span>Partner pain-point heat</span><strong>Provider required</strong></p>`}
      </div>
    </section>
  `;
}

function renderDriverPulse(vertical, config) {
  return `
    <section class="card">
      <div class="head">
        <h2>Driver Pulse</h2>
        <span class="tag weekly">Gig-worker signals</span>
      </div>
      <h4>Satisfaction Proxy</h4>
      ${renderPlatformRows(config.platforms, vertical.driver_satisfaction || {}, (value) => value ? `${value} / 100` : "--")}
      <h4>Volatility Proxy</h4>
      ${renderPlatformRows(config.platforms, vertical.driver_volatility || {}, (value) => value || "--")}
      <ul class="topics">
        ${asArray(vertical.driver_risk_alerts).length
          ? asArray(vertical.driver_risk_alerts).map((alert) => `<li>${escapeHtml(alert)}</li>`).join("")
          : "<li>No driver-specific alert cluster captured in current feed.</li>"}
      </ul>
    </section>
  `;
}

function renderOrderFeed(vertical) {
  const orderMetrics = vertical.order_metrics || {};
  const feed = asArray(orderMetrics.feed);
  return `
    <section class="card">
      <div class="head">
        <h2>Average Order Value & Orders Today</h2>
        <span class="tag weekly">${escapeHtml(orderMetrics.status || "provider pending")}</span>
      </div>
      <p class="note">${escapeHtml(orderMetrics.source || "Connect verified order metrics provider.")}</p>
      <div class="grid two compact-metrics">
        ${renderKpiCard("Average Order Value", orderMetrics.aov, "embedded-kpi")}
        ${renderKpiCard("Orders Today", orderMetrics.daily_orders, "embedded-kpi")}
      </div>
      <h4>Daily Order Feed</h4>
      <ol class="event-log feed-list">
        ${feed.length
          ? feed.map((item) => `
              <li>
                <span>${escapeHtml(item.date || "--")}</span>
                ${escapeHtml(item.message || "No detail")}
                ${item.source ? `<em>${escapeHtml(item.source)}</em>` : ""}
                ${renderSourceLink(item)}
              </li>
            `).join("")
          : "<li><span>--</span> No daily order feed items available.</li>"}
      </ol>
    </section>
  `;
}

function scoreValue(scores, platformKey) {
  if (!scores) return "--";
  if (scores[platformKey] !== undefined) return scores[platformKey];
  if (platformKey === "zomato" || platformKey === "blinkit") return scores.eternal ?? "--";
  if (platformKey === "instamart") return scores.swiggy ?? "--";
  return "--";
}

function renderThesisValidation(vertical, config) {
  const scoreRows = [
    { key: "industry", name: "Industry" },
    ...config.platforms
  ];
  return `
    <section class="card">
      <div class="head">
        <h2>Thesis Validation</h2>
        <span class="tag weekly">Growth vs risk</span>
      </div>
      <div class="grid two compact-metrics">
        <article class="mini">
          <h4>Growth Score</h4>
          <ul class="rows">
            ${scoreRows.map((row) => `
              <li><span>${escapeHtml(row.name)}</span><strong>${escapeHtml(scoreValue(vertical.growth_scores, row.key))} / 100</strong></li>
            `).join("")}
          </ul>
        </article>
        <article class="mini">
          <h4>Risk Score</h4>
          <ul class="rows">
            ${scoreRows.map((row) => `
              <li><span>${escapeHtml(row.name)}</span><strong>${escapeHtml(scoreValue(vertical.risk_scores, row.key))} / 100</strong></li>
            `).join("")}
          </ul>
        </article>
      </div>
    </section>
  `;
}

function renderFulfilment(vertical, config) {
  return `
    <section class="card">
      <div class="head">
        <h2>${escapeHtml(config.fulfilmentTitle)}</h2>
        <span class="tag daily">Operational watch</span>
      </div>
      <div class="grid two compact-metrics">
        <article class="mini">
          <h4>Pricing Index</h4>
          ${renderPlatformRows(config.platforms, vertical.pricing_index || {}, (value) => value || "--")}
        </article>
        <article class="mini">
          <h4>ETA by City</h4>
          <ul class="rows">
            ${["Mumbai", "Delhi NCR", "Bangalore"].map((city) => `
              <li><span>${escapeHtml(city)}</span><strong>${escapeHtml(vertical.eta_data?.[city] ?? "--")}${vertical.eta_data?.[city] ? " min" : ""}</strong></li>
            `).join("")}
          </ul>
        </article>
      </div>
      <div class="mini inventory-mini">
        <h4>${vertical.key === "quick_commerce" ? "SKU Availability" : "Food-delivery Supply Coverage"}</h4>
        <ul class="rows">
          <li><span>${vertical.key === "quick_commerce" ? "Top SKU fill rate" : "Restaurant availability"}</span><strong>${escapeHtml(vertical.inventory_data?.fill_rate ?? "Provider required")}</strong></li>
          <li><span>${vertical.key === "quick_commerce" ? "OOS alerts" : "Menu / restaurant outage alerts"}</span><strong>${escapeHtml(vertical.inventory_data?.oos_alerts ?? "Provider required")}</strong></li>
          <li><span>Promo mismatch alerts</span><strong>${escapeHtml(vertical.inventory_data?.promo_mismatches ?? "Provider required")}</strong></li>
        </ul>
      </div>
    </section>
  `;
}

function renderNarrativeEvents(vertical) {
  const events = asArray(vertical.india_narrative_events);
  return `
    <section class="card">
      <div class="head">
        <h2>India Narrative Events</h2>
        <span class="tag weekly">Time-stamped</span>
      </div>
      <ol class="event-log">
        ${events.length
          ? events.map((item) => `
              <li>
                <span>${escapeHtml(item.date || "--")}</span>
                [${escapeHtml(item.tag || item.topic || "Event")}] ${escapeHtml(item.message || "No detail")}
                ${renderSourceLink(item)}
              </li>
            `).join("")
          : "<li><span>--</span> No event captured in current feed.</li>"}
      </ol>
    </section>
  `;
}

function renderVerticalColumn(vertical, config) {
  const platforms = asArray(vertical.platforms).length ? vertical.platforms : config.platforms;
  const platformNames = platforms.map((platform) => platform.name).join(", ");

  return `
    <section class="vertical-page ${escapeHtml(vertical.key)}">
      <section class="card vertical-hero">
        <div class="head">
          <div>
            <p class="kicker">${escapeHtml(config.tag)}</p>
            <h2>${escapeHtml(vertical.title || titleCaseKey(vertical.key))}</h2>
          </div>
          <span class="tag daily">${escapeHtml(vertical.source_item_count ?? 0)} source items</span>
        </div>
        <p class="note">${escapeHtml(vertical.subtitle || "")}</p>
        <p class="source-pill">Tracked platforms: ${escapeHtml(platformNames)}</p>
      </section>

      <section class="grid vertical-kpi-grid">
        ${renderKpiCard("MAU", vertical.kpis?.mau)}
        ${renderKpiCard("DAU", vertical.kpis?.dau)}
        ${renderKpiCard("DAU / MAU", vertical.kpis?.dau_mau)}
        ${renderKpiCard("Average Order Value", vertical.kpis?.aov)}
        ${renderKpiCard("Orders Today", vertical.kpis?.daily_orders, "wide-kpi")}
      </section>

      ${renderOrderFeed(vertical)}
      ${renderRiskSignals(vertical.risk_signals)}
      ${renderUserMetrics(vertical, { ...config, platforms })}
      ${renderConsumerPulse(vertical, { ...config, platforms })}
      ${renderComplaintCards("Consumer Complaint Split", vertical.consumer_complaints, platforms)}
      ${renderComplaintCards(config.merchantTitle, vertical.merchant_complaints, platforms)}
      ${renderMerchantPulse(vertical, { ...config, platforms })}
      ${renderComplaintCards("Driver Complaint Split", vertical.driver_complaints, platforms)}
      ${renderDriverPulse(vertical, { ...config, platforms })}
      ${renderFulfilment(vertical, { ...config, platforms })}
      ${renderThesisValidation(vertical, { ...config, platforms })}
      ${renderNarrativeEvents(vertical)}
    </section>
  `;
}

function renderData(data) {
  const meta = data.meta || {};
  setText("meta-data-updated", meta.data_updated_at || meta.last_refresh || "Unknown");
  setText(
    "meta-refresh-cadence",
    meta.source_latest_item_at
      ? `${meta.refresh_cadence || "--"} | Latest source item: ${meta.source_latest_item_at}`
      : meta.refresh_cadence || "--"
  );

  const verticals = data.verticals || buildFallbackVerticals(data);
  Object.entries(VERTICAL_CONFIG).forEach(([key, config]) => {
    const column = el(config.elementId);
    if (!column) return;
    const vertical = verticals[key] || buildFallbackVerticals(data)[key];
    column.innerHTML = renderVerticalColumn(vertical, config);
  });
}

async function fetchAndRender() {
  if (isRefreshing) return;

  const refreshBtn = el("refresh-now");

  try {
    isRefreshing = true;

    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.textContent = "Refreshing...";
      refreshBtn.style.opacity = "0.6";
    }

    for (const url of DATA_URLS) {
      try {
        const response = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Failed to load data: ${response.status}`);
        const data = await response.json();
        renderData(data);
        setRuntimeStatus(url.includes("api") ? "live-api" : "live-json", true, data);

        if (refreshBtn) {
          refreshBtn.textContent = "Refreshed";
          setTimeout(() => {
            if (refreshBtn) refreshBtn.textContent = "Refresh now";
          }, 1500);
        }
        return;
      } catch (error) {
        console.warn(`Data fetch failed for ${url}.`, error);
      }
    }

    if (window.DASHBOARD_INLINE_DATA) {
      renderData(window.DASHBOARD_INLINE_DATA);
      setRuntimeStatus("inline-fallback", false, window.DASHBOARD_INLINE_DATA);
      if (refreshBtn) {
        refreshBtn.textContent = "Offline mode";
        setTimeout(() => {
          if (refreshBtn) refreshBtn.textContent = "Refresh now";
        }, 2000);
      }
    }
  } catch (error) {
    console.error("Refresh failed:", error);
    if (refreshBtn) {
      refreshBtn.textContent = "Refresh failed";
      setTimeout(() => {
        if (refreshBtn) refreshBtn.textContent = "Refresh now";
      }, 2000);
    }
  } finally {
    isRefreshing = false;
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.style.opacity = "1";
    }
  }
}

fetchAndRender();
setInterval(fetchAndRender, AUTO_REFRESH_MS);

const refreshButton = el("refresh-now");
if (refreshButton) {
  refreshButton.addEventListener("click", fetchAndRender);
}
