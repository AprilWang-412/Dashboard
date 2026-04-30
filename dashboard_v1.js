const DATA_URLS = ["api/dashboard-data", "data/dashboard_data.json"];
const AUTO_REFRESH_MS = 60 * 1000;

let isRefreshing = false;

function el(id) {
  return document.getElementById(id);
}

function setRuntimeStatus(source, ok, data) {
  const now = new Date().toLocaleString("en-GB", { hour12: false });
  const status = ok ? "OK" : "Fallback";
  const dataStatus = data?.meta?.data_status ? ` | data: ${data.meta.data_status}` : "";
  el("meta-page-checked").textContent = now;
  el("meta-runtime-status").textContent = `${status} | source: ${source}${dataStatus}`;
}

function renderList(targetId, items) {
  const target = el(targetId);
  if (!target) return;
  target.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    target.appendChild(li);
  });
}

function renderRiskSignals(risk) {
  el("risk-active-count").textContent = String(risk.active_count);
  el("risk-summary").textContent =
    `${risk.new_this_week} new this week | ${risk.closed_historical} historical closed`;

  const log = el("risk-log");
  log.innerHTML = "";
  risk.items.forEach((item) => {
    const li = document.createElement("li");
    if (item.status === "closed") li.classList.add("closed");
    const statusSuffix = item.status === "closed" ? " (Closed)" : "";
    const date = document.createElement("span");
    date.textContent = item.date;
    li.appendChild(date);
    li.append(` ${item.message}${statusSuffix}`);
    if (item.url) {
      const link = document.createElement("a");
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = " source";
      li.appendChild(link);
    }
    log.appendChild(li);
  });
}

function renderIndiaEvents(events) {
  const log = el("india-event-log");
  log.innerHTML = "";
  events.forEach((item) => {
    const li = document.createElement("li");
    const date = document.createElement("span");
    date.textContent = item.date;
    li.appendChild(date);
    li.append(` [${item.tag}] ${item.message}`);
    if (item.url) {
      const link = document.createElement("a");
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = " source";
      li.appendChild(link);
    }
    log.appendChild(li);
  });
}

function renderBenchmark(benchmark) {
  const cards = el("benchmark-entity-cards");
  cards.innerHTML = "";
  benchmark.entities.forEach((entity) => {
    const article = document.createElement("article");
    article.className = "mini";
    article.innerHTML = `
      <h4>${entity.name}</h4>
      <ul class="rows">
        <li><span>${entity.user_metric}</span><strong>${entity.user_value}</strong></li>
        <li><span>${entity.stickiness_metric}</span><strong>${entity.stickiness_value}</strong></li>
      </ul>
      <p class="note">${entity.commentary}</p>
    `;
    cards.appendChild(article);
  });

  const tbody = el("benchmark-table").querySelector("tbody");
  tbody.innerHTML = "";
  benchmark.kpi_comparison.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.axis}</td>
      <td>${row.india}</td>
      <td>${row.doordash}</td>
      <td>${row.meituan_keeta}</td>
      <td>${row.comparability}</td>
    `;
    tbody.appendChild(tr);
  });

  renderList("benchmark-gap-readout", benchmark.gap_readout);
  el("benchmark-last-updated").textContent = benchmark.last_updated;
}

function renderData(data) {
  el("meta-data-updated").textContent =
    data.meta.data_updated_at || data.meta.last_refresh || "Unknown";
  el("meta-refresh-cadence").textContent = data.meta.source_latest_item_at
    ? `${data.meta.refresh_cadence} | Latest source item: ${data.meta.source_latest_item_at}`
    : data.meta.refresh_cadence;

  el("kpi-mau-value").textContent = data.kpis.mau.value;
  el("kpi-mau-mom").textContent = data.kpis.mau.mom;
  el("kpi-mau-yoy").textContent = data.kpis.mau.yoy;

  el("kpi-dau-value").textContent = data.kpis.dau.value;
  el("kpi-dau-mom").textContent = data.kpis.dau.mom;
  el("kpi-dau-yoy").textContent = data.kpis.dau.yoy;

  el("kpi-stickiness-value").textContent = data.kpis.dau_mau.value;
  el("kpi-stickiness-mom").textContent = data.kpis.dau_mau.mom;

  renderRiskSignals(data.risk_signals);

  renderList("consumer-blinkit", data.consumer_complaints.blinkit);
  renderList("consumer-instamart", data.consumer_complaints.instamart);
  renderList("consumer-zepto", data.consumer_complaints.zepto);

  renderList("merchant-blinkit", data.merchant_complaints.blinkit);
  renderList("merchant-swiggy", data.merchant_complaints.swiggy);
  renderList("merchant-zepto", data.merchant_complaints.zepto);

  renderList("driver-blinkit", data.driver_complaints.blinkit);
  renderList("driver-swiggy", data.driver_complaints.swiggy);
  renderList("driver-zepto", data.driver_complaints.zepto);

  renderIndiaEvents(data.india_narrative_events);
  renderBenchmark(data.benchmark);

  // 动态数据渲染
  if (data.platform_stickiness) {
    const container = el("platform-stickiness");
    if (container) {
      container.innerHTML = `
        <li><span>Blinkit</span><strong>${data.platform_stickiness.blinkit || "--"}</strong></li>
        <li><span>Instamart</span><strong>${data.platform_stickiness.instamart || "--"}</strong></li>
        <li><span>Zepto</span><strong>${data.platform_stickiness.zepto || "--"}</strong></li>
      `;
    }
  }

  if (data.review_volume_7d) {
    const container = el("review-volume");
    if (container) {
      container.innerHTML = `
        <li><span>Blinkit</span><strong>${data.review_volume_7d.blinkit?.toLocaleString() || "--"}</strong></li>
        <li><span>Instamart</span><strong>${data.review_volume_7d.instamart?.toLocaleString() || "--"}</strong></li>
        <li><span>Zepto</span><strong>${data.review_volume_7d.zepto?.toLocaleString() || "--"}</strong></li>
      `;
    }
  }

  if (data.sentiment_mix) {
    const pos = el("sentiment-positive");
    const neu = el("sentiment-neutral");
    const neg = el("sentiment-negative");
    if (pos) pos.textContent = `Positive ${data.sentiment_mix.positive || 0}%`;
    if (neu) neu.textContent = `Neutral ${data.sentiment_mix.neutral || 0}%`;
    if (neg) neg.textContent = `Negative ${data.sentiment_mix.negative || 0}%`;
  }

  if (data.top_complaint_topics) {
    const container = el("top-complaint-topics");
    if (container) {
      container.innerHTML = data.top_complaint_topics.map(topic => `<li>${topic}</li>`).join("");
    }
  }

  if (data.merchant_sentiment) {
    const container = el("merchant-sentiment");
    if (container) {
      container.innerHTML = `
        <li><span>Blinkit</span><strong>${data.merchant_sentiment.blinkit || "--"} / 100</strong></li>
        <li><span>Swiggy</span><strong>${data.merchant_sentiment.swiggy || "--"} / 100</strong></li>
        <li><span>Zepto</span><strong>${data.merchant_sentiment.zepto || "--"} / 100</strong></li>
      `;
    }
  }

  if (data.pain_points) {
    const container = el("pain-point-heat");
    if (container) {
      container.innerHTML = Object.entries(data.pain_points).map(([point, level]) => `
        <p><span>${point}</span><strong>${level}</strong></p>
      `).join("");
    }
  }

  if (data.driver_satisfaction) {
    const container = el("driver-satisfaction");
    if (container) {
      container.innerHTML = `
        <li><span>Blinkit</span><strong>${data.driver_satisfaction.blinkit || "--"} / 100</strong></li>
        <li><span>Swiggy</span><strong>${data.driver_satisfaction.swiggy || "--"} / 100</strong></li>
        <li><span>Zepto</span><strong>${data.driver_satisfaction.zepto || "--"} / 100</strong></li>
      `;
    }
  }

  if (data.driver_volatility) {
    const container = el("driver-volatility");
    if (container) {
      container.innerHTML = `
        <li><span>Blinkit</span><strong>${data.driver_volatility.blinkit || "--"}</strong></li>
        <li><span>Swiggy</span><strong>${data.driver_volatility.swiggy || "--"}</strong></li>
        <li><span>Zepto</span><strong>${data.driver_volatility.zepto || "--"}</strong></li>
      `;
    }
  }

  if (data.driver_risk_alerts) {
    const container = el("driver-risk-alerts");
    if (container) {
      container.innerHTML = data.driver_risk_alerts.map(alert => `<li>${alert}</li>`).join("");
    }
  }

  if (data.growth_scores) {
    const container = el("growth-scores");
    if (container) {
      container.innerHTML = `
        <li><span>Industry</span><strong>${data.growth_scores.industry || "--"} / 100</strong></li>
        <li><span>Eternal</span><strong>${data.growth_scores.eternal || "--"} / 100</strong></li>
        <li><span>Swiggy</span><strong>${data.growth_scores.swiggy || "--"} / 100</strong></li>
        <li><span>Zepto</span><strong>${data.growth_scores.zepto || "--"} / 100</strong></li>
      `;
    }
  }

  if (data.risk_scores) {
    const container = el("risk-scores");
    if (container) {
      container.innerHTML = `
        <li><span>Industry</span><strong>${data.risk_scores.industry || "--"} / 100</strong></li>
        <li><span>Eternal</span><strong>${data.risk_scores.eternal || "--"} / 100</strong></li>
        <li><span>Swiggy</span><strong>${data.risk_scores.swiggy || "--"} / 100</strong></li>
        <li><span>Zepto</span><strong>${data.risk_scores.zepto || "--"} / 100</strong></li>
      `;
    }
  }

  if (data.pricing_index) {
    const container = el("pricing-index");
    if (container) {
      container.innerHTML = `
        <li><span>Blinkit</span><strong>${data.pricing_index.blinkit || "--"}</strong></li>
        <li><span>Instamart</span><strong>${data.pricing_index.instamart || "--"}</strong></li>
        <li><span>Zepto</span><strong>${data.pricing_index.zepto || "--"}</strong></li>
      `;
    }
  }

  if (data.eta_data) {
    const container = el("eta-data");
    if (container) {
      container.innerHTML = `
        <li><span>Mumbai</span><strong>${data.eta_data.Mumbai || "--"}</strong></li>
        <li><span>Delhi NCR</span><strong>${data.eta_data["Delhi NCR"] || "--"}</strong></li>
        <li><span>Bangalore</span><strong>${data.eta_data.Bangalore || "--"}</strong></li>
      `;
    }
  }

  if (data.inventory_data) {
    const container = el("inventory-data");
    if (container) {
      container.innerHTML = `
        <li><span>Top 100 SKU fill rate</span><strong>${data.inventory_data.fill_rate || "--"}</strong></li>
        <li><span>OOS spike alerts</span><strong>${data.inventory_data.oos_alerts || "--"}</strong></li>
        <li><span>Promo mismatch alerts</span><strong>${data.inventory_data.promo_mismatches || "--"}</strong></li>
      `;
    }
  }

  // MAU 趋势图
  if (data.mau_trend && data.mau_trend.bars) {
    const chartContainer = document.querySelector(".chart.bars");
    if (chartContainer) {
      chartContainer.innerHTML = data.mau_trend.bars.map(bar => `
        <div class="bar" style="--h: ${bar.height}%">
          <span>${bar.label}</span>
        </div>
      `).join("");
    }
  }
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
          refreshBtn.textContent = "✓ 已刷新";
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
        refreshBtn.textContent = "⚠️ 离线模式";
        setTimeout(() => {
          if (refreshBtn) refreshBtn.textContent = "Refresh now";
        }, 2000);
      }
    }
  } catch (error) {
    console.error("Refresh failed:", error);
    if (refreshBtn) {
      refreshBtn.textContent = "❌ 刷新失败";
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
