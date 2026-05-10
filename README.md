# India Delivery Intelligence Dashboard

Automated dashboard for India delivery and quick-commerce research.

## Data Scope

- Platform scope: Blinkit, Swiggy Instamart, Zepto.
- User metrics scope: India national app-panel metrics.
- City panel v1: Mumbai, Delhi NCR, Bangalore for SKU, ETA, store-density and fulfilment checks only.

The city list is not the full research scope. It is a practical monitoring panel for high-frequency operational checks.

## User Metrics Connector

MAU, DAU and DAU/MAU update through the app-intelligence connector when a provider key is configured.

Required Vercel environment variable:

```bash
SIMILARWEB_API_KEY=<your_api_key>
```

Optional override if the account-specific endpoint differs:

```bash
SIMILARWEB_ACTIVE_USERS_URL_TEMPLATE=https://api.similarweb.com/v5/apps/{store}/active-users
```

If `SIMILARWEB_API_KEY` is missing, the dashboard keeps the static KPI estimates and shows `provider_unconfigured`.

## Files

- `index.html`: dashboard page.
- `dashboard_v1.js`: frontend rendering and auto-refresh.
- `api/dashboard-data.js`: live API endpoint for RSS, benchmark and user metric modules.
- `lib/user-metrics.js`: Similarweb active-user connector and fallback status logic.
- `data/user_metrics_sources.json`: app IDs and provider configuration.
