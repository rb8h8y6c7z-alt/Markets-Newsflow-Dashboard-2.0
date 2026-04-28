const updated = document.querySelector("#updated");
const refreshButton = document.querySelector("#refresh");
const lensSelect = document.querySelector("#lens-select");
const summary = document.querySelector("#summary");
const indices = document.querySelector("#indices");
const stocks = document.querySelector("#stocks");
const macro = document.querySelector("#macro");
const winners = document.querySelector("#winners");
const losers = document.querySelector("#losers");
const radar = document.querySelector("#radar");
const news = document.querySelector("#news");
const notes = document.querySelector("#notes");
const lookupForm = document.querySelector("#lookup-form");
const lookupQuery = document.querySelector("#lookup-query");
const lookupResult = document.querySelector("#lookup-result");

const fmtTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const fmtPrice = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
const fmtPct = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const regions = ["AMERICAS", "EMEA", "APAC", "GLOBAL"];
const packedContainers = [indices, stocks, macro, winners, losers, news, radar];
let dashboardIssue = "";

function price(value) {
  return Number.isFinite(value) ? fmtPrice.format(value) : "n/a";
}

function pct(value) {
  if (!Number.isFinite(value)) return "n/a";
  return `${value >= 0 ? "+" : ""}${fmtPct.format(value)}%`;
}

function direction(value) {
  return value > 0 ? "up" : value < 0 ? "down" : "flat";
}

function sparkline(item) {
  if (![item.open, item.high, item.low, item.price].every(Number.isFinite)) return "";
  const values = item.changePct >= 0
    ? [item.open, item.low, item.high, item.price]
    : [item.open, item.high, item.low, item.price];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = 3 + index * 22;
    const y = 24 - ((value - min) / range) * 18;
    return `${x},${y}`;
  }).join(" ");
  return `
    <svg class="spark" viewBox="0 0 72 26" aria-hidden="true">
      <polyline points="${points}" />
    </svg>
  `;
}

function quoteCard(item) {
  const el = document.createElement("article");
  el.className = `quote ${direction(item.changePct)}`;
  el.innerHTML = `
    <div>
      <strong>${item.name}</strong>
      <span>${item.tag || item.symbol}</span>
    </div>
    ${sparkline(item)}
    <div>
      <strong>${price(item.price)}</strong>
      <span>${pct(item.changePct)}</span>
    </div>
  `;
  return el;
}

function panelFor(element) {
  return element.closest(".panel") || element;
}

function setDensity(element, count) {
  element.dataset.count = count;
  element.classList.toggle("is-empty", count === 0);
  element.classList.toggle("is-tight", count > 0 && count <= 4);
  element.classList.toggle("is-packed", count >= 8);
  panelFor(element).classList.toggle("is-empty-panel", count === 0);
}

function renderQuotes(container, items, grid = false) {
  container.replaceChildren();
  const quoteItems = items || [];
  setDensity(container, quoteItems.length);
  if (!quoteItems.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No quotes available from the current source.";
    container.append(empty);
  } else {
    const activeRegions = regions.filter((region) => quoteItems.some((item) => item.region === region));
    activeRegions.forEach((region) => {
      const regionItems = quoteItems.filter((item) => item.region === region);
      const section = document.createElement("section");
      section.className = "region-section";
      section.dataset.count = regionItems.length;
      const title = document.createElement("h3");
      title.textContent = region;
      section.append(title);
      const list = document.createElement("div");
      list.className = "region-quotes";
      regionItems.forEach((item) => list.append(quoteCard(item)));
      section.append(list);
      container.append(section);
    });
  }
  container.classList.toggle("quote-grid", grid);
}

function feedItem(item) {
  const anchor = document.createElement("a");
  anchor.className = "feed-item";
  anchor.href = item.link;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.innerHTML = `<span>${item.category} · ${item.source}</span><strong>${item.title}</strong><p>${item.description || ""}</p>`;
  return anchor;
}

function tapeItem(item) {
  const anchor = document.createElement("a");
  anchor.className = "tape-item";
  anchor.href = item.link;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.innerHTML = `
    <span>${item.category}</span>
    <strong>${item.title}</strong>
    <em>${item.source}</em>
  `;
  return anchor;
}

function renderRegionalNews(buckets) {
  news.replaceChildren();
  const activeBuckets = (buckets || []).filter((bucket) => bucket.items?.length);
  const itemCount = activeBuckets.reduce((total, bucket) => total + bucket.items.length, 0);
  setDensity(news, itemCount);
  if (!activeBuckets.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No newsflow available.";
    news.append(empty);
    return;
  }
  activeBuckets.forEach((bucket) => {
    const section = document.createElement("section");
    section.className = "region-section";
    section.dataset.count = bucket.items.length;
    const title = document.createElement("h3");
    title.textContent = bucket.region;
    section.append(title);
    const list = document.createElement("div");
    list.className = "region-news tape-list";
    bucket.items.slice(0, 5).forEach((item) => list.append(tapeItem(item)));
    section.append(list);
    news.append(section);
  });
}

function renderRadar(items) {
  setDensity(radar, items?.length || 0);
  radar.replaceChildren(...items.map((item) => {
    const el = document.createElement("article");
    el.className = "radar";
    el.innerHTML = `<span>${item.count} item${item.count === 1 ? "" : "s"}</span><strong>${item.category}</strong><p>${item.signal || item.headline}</p>`;
    return el;
  }));
}

function repackDashboard(data) {
  const totalQuotes = [
    data.indices,
    data.stocks,
    data.macro,
    data.movers.winners,
    data.movers.losers
  ].reduce((total, items) => total + (items?.length || 0), 0);
  const newsCount = (data.regionalNews || []).reduce((total, bucket) => total + (bucket.items?.length || 0), 0);
  document.body.dataset.density = totalQuotes + newsCount >= 42 ? "max" : "tight";
  packedContainers.forEach((container) => {
    const panel = panelFor(container);
    const count = Number(container.dataset.count || 0);
    panel.classList.toggle("panel-small", count > 0 && count <= 4);
    panel.classList.toggle("panel-full", count >= 10);
  });
}

function renderSummary(data) {
  const s = data.summary;
  summary.innerHTML = `
    <span>${s.tone}</span>
    <strong>${pct(s.averageMovePct)} average move</strong>
    <p>${s.notableMoves} notable moves · Top theme: ${s.topNewsTheme}</p>
    <small>${s.topNewsHeadline}</small>
  `;
}

function dashboardIssueFrom(data) {
  const quality = data.dataQuality || {};
  const failures = quality.quoteFailures || [];
  const sources = quality.quoteSources
    ? Object.entries(quality.quoteSources).map(([source, count]) => `${source}: ${count}`).join(" · ")
    : "";
  if (!quality.quoteSuccessCount) return "Pricing feed issue: no market quotes loaded. Check Render logs and public data-source access.";
  if (failures.length) {
    return `Pricing feed warning: ${failures.length} quote(s) unavailable (${failures.map((item) => item.name).slice(0, 4).join(", ")}${failures.length > 4 ? "..." : ""}). ${sources}`;
  }
  return sources ? `Pricing sources OK: ${sources}` : "";
}

async function load(forceRefresh = false) {
  updated.textContent = "Reassessing markets...";
  refreshButton.disabled = true;
  lensSelect.disabled = true;
  try {
    const params = new URLSearchParams({ lens: lensSelect.value });
    if (forceRefresh) params.set("refresh", "1");
    const response = await fetch(`/api/dashboard?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Dashboard failed");
    updated.textContent = `${data.lens?.label || "Global"} · ${data.refreshed ? "Reassessed" : "Updated"} ${fmtTime.format(new Date(data.generatedAt))}${data.cached ? " · cached" : ""}`;
    renderSummary(data);
    renderQuotes(indices, data.indices, true);
    renderQuotes(stocks, data.stocks);
    renderQuotes(macro, data.macro);
    renderQuotes(winners, data.movers.winners);
    renderQuotes(losers, data.movers.losers);
    renderRadar(data.eventRadar);
    renderRegionalNews(data.regionalNews);
    repackDashboard(data);
    dashboardIssue = dashboardIssueFrom(data);
    notes.replaceChildren(...data.sourceNotes.map((note) => {
      const li = document.createElement("li");
      li.textContent = note;
      return li;
    }));
  } catch (error) {
    updated.textContent = error.message || "Could not load dashboard.";
    dashboardIssue = `Dashboard load issue: ${error.message || "Could not load dashboard."}`;
    lookupResult.innerHTML = `<p class="lookup-issue">${dashboardIssue}</p>`;
  } finally {
    refreshButton.disabled = false;
    lensSelect.disabled = false;
  }
}

async function runLookup() {
  const q = lookupQuery.value.trim();
  if (!q) return;
  lookupResult.textContent = "Looking up...";
  try {
    const response = await fetch(`/api/stock-lookup?q=${encodeURIComponent(q)}&lens=${encodeURIComponent(lensSelect.value)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Lookup failed");
    if (!data.selected) {
      lookupResult.innerHTML = `<p class="empty">${data.message}</p>`;
      return;
    }
    const item = data.selected;
    lookupResult.innerHTML = `
      <article class="quote lookup-quote ${direction(item.changePct)}">
        <div>
          <strong>${item.name}</strong>
          <span>${item.symbol} · ${item.region}</span>
        </div>
        ${sparkline(item)}
        <div>
          <strong>${price(item.price)}</strong>
          <span>${pct(item.changePct)}</span>
        </div>
      </article>
      <div class="factor-grid"></div>
      ${dashboardIssue ? `<p class="lookup-issue">${dashboardIssue}</p>` : ""}
      <p class="lookup-message">${data.message}</p>
      <div class="lookup-news"></div>
    `;
    const factors = lookupResult.querySelector(".factor-grid");
    (data.factors || []).forEach((factor) => {
      const row = document.createElement("article");
      row.className = "factor";
      row.innerHTML = `<span>${factor.label}</span><strong>${factor.value}</strong><em>${factor.note || ""}</em>`;
      factors.append(row);
    });
    const related = lookupResult.querySelector(".lookup-news");
    data.relatedNews.slice(0, 3).forEach((newsItem) => related.append(tapeItem(newsItem)));
  } catch (error) {
    lookupResult.innerHTML = `<p class="empty">${error.message || "Lookup failed."}</p>`;
  }
}

refreshButton.addEventListener("click", async () => {
  await load(true);
  await runLookup();
});
lensSelect.addEventListener("change", async () => {
  await load(true);
  await runLookup();
});

lookupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await runLookup();
});

load().then(runLookup);
