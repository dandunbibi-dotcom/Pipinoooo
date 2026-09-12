/* =========================================================
   PIPINO — Trading Journal
   Compatible with current index.html
========================================================= */

const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
}

/* =========================================================
   USER ID / STORAGE
========================================================= */

const telegramUserId =
  tg?.initDataUnsafe?.user?.id
    ? String(tg.initDataUnsafe.user.id)
    : "guest";

const LOCAL_KEY = `pipino_trades_v2_${telegramUserId}`;

let trades = [];
let draft = {
  symbol: "",
  direction: "",
  entry: null,
  sl: null,
  tp: null
};

/* =========================================================
   DOM
========================================================= */

const $ = (id) => document.getElementById(id);

const tradeModal = $("tradeModal");
const tradeList = $("tradeList");

const portfolioEl = $("portfolio");
const portfolioSubEl = $("portfolioSub");
const tradeCountEl = $("tradeCount");
const winRateEl = $("winRate");
const profitEl = $("profit");

const symbolInput = $("symbol");
const entryInput = $("entry");
const slInput = $("sl");
const tpInput = $("tp");

const previewBox = $("previewBox");
const toast = $("toast");

/* =========================================================
   HELPERS
========================================================= */

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 2200);
}

function vibrate(type = "light") {
  try {
    if (tg?.HapticFeedback) {
      if (type === "success") {
        tg.HapticFeedback.notificationOccurred("success");
      } else if (type === "error") {
        tg.HapticFeedback.notificationOccurred("error");
      } else {
        tg.HapticFeedback.impactOccurred("light");
      }
    }
  } catch (e) {}
}

function formatR(value) {
  const n = Number(value) || 0;

  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}R`;
}

function formatNumber(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return "-";

  return n.toLocaleString("en-US", {
    maximumFractionDigits: 8
  });
}

function getRR(direction, entry, sl, tp) {
  const risk = Math.abs(entry - sl);

  if (risk <= 0) return null;

  const reward = Math.abs(tp - entry);

  return reward / risk;
}

function isValidTrade(direction, entry, sl, tp) {
  if (
    !Number.isFinite(entry) ||
    !Number.isFinite(sl) ||
    !Number.isFinite(tp)
  ) {
    return false;
  }

  if (entry === sl || entry === tp) {
    return false;
  }

  if (direction === "BUY") {
    return sl < entry && tp > entry;
  }

  if (direction === "SELL") {
    sl > entry && tp < entry;
  }

  return false;
}

/* =========================================================
   STORAGE
========================================================= */

function saveLocal() {
  try {
    localStorage.setItem(
      LOCAL_KEY,
      JSON.stringify(trades)
    );
  } catch (e) {
    console.warn("LocalStorage error:", e);
  }
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);

    if (!raw) {
      trades = [];
      return;
    }

    const parsed = JSON.parse(raw);

    trades = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    trades = [];
  }
}

/* =========================================================
   TELEGRAM CLOUD STORAGE
========================================================= */

function cloudGet(key) {
  return new Promise((resolve) => {

    if (!tg?.CloudStorage) {
      resolve(null);
      return;
    }

    tg.CloudStorage.getItem(key, (error, value) => {
      if (error) {
        resolve(null);
        return;
      }

      resolve(value || null);
    });

  });
}

function cloudSet(key, value) {
  return new Promise((resolve) => {

    if (!tg?.CloudStorage) {
      resolve(false);
      return;
    }

    tg.CloudStorage.setItem(key, value, (error, success) => {
      resolve(!error && success !== false);
    });

  });
}

async function loadTrades() {

  /*
    First try Telegram CloudStorage.
    If unavailable, use user-specific localStorage.
  */

  const cloudData = await cloudGet("pipino_trades");

  if (cloudData) {
    try {
      const parsed = JSON.parse(cloudData);

      if (Array.isArray(parsed)) {
        trades = parsed;
        saveLocal();
        return;
      }
    } catch (e) {}
  }

  loadLocal();
}

async function persistTrades() {

  const json = JSON.stringify(trades);

  saveLocal();

  await cloudSet("pipino_trades", json);
}

/* =========================================================
   GREETING
========================================================= */

function updateGreeting() {

  const greeting = $("greeting");

  if (!greeting) return;

  const firstName =
    tg?.initDataUnsafe?.user?.first_name;

  greeting.textContent =
    firstName
      ? `TRADING JOURNAL • ${firstName}`
      : "TRADING JOURNAL";
}

/* =========================================================
   MODAL
========================================================= */

function openModal() {

  tradeModal.classList.remove("hidden");

  resetForm();

  showStep(1);

  setTimeout(() => {
    symbolInput?.focus();
  }, 150);
}

function closeModal() {

  tradeModal.classList.add("hidden");

  resetForm();
}

function resetForm() {

  draft = {
    symbol: "",
    direction: "",
    entry: null,
    sl: null,
    tp: null
  };

  if (symbolInput) symbolInput.value = "";
  if (entryInput) entryInput.value = "";
  if (slInput) slInput.value = "";
  if (tpInput) tpInput.value = "";

  if (previewBox) {
    previewBox.innerHTML = "";
  }

  document
    .querySelectorAll(".step")
    .forEach((step) => {
      step.classList.add("hidden");
    });
}

function showStep(number) {

  document
    .querySelectorAll(".step")
    .forEach((step) => {
      step.classList.add("hidden");
    });

  const target = $(`step${number}`);

  if (target) {
    target.classList.remove("hidden");
  }
}

/* =========================================================
   STEP NAVIGATION
========================================================= */

document
  .querySelectorAll(".next")
  .forEach((button) => {

    button.addEventListener("click", () => {

      const next = Number(button.dataset.next);

      if (next === 2) {

        const symbol =
          symbolInput.value.trim().toUpperCase();

        if (!symbol) {
          showToast("نماد را وارد کن");
          vibrate("error");
          return;
        }

        draft.symbol = symbol;
      }

      if (next === 4) {

        const entry = Number(entryInput.value);

        if (!Number.isFinite(entry) || entry <= 0) {
          showToast("Entry معتبر نیست");
          vibrate("error");
          return;
        }

        draft.entry = entry;
      }

      if (next === 5) {

        const sl = Number(slInput.value);

        if (!Number.isFinite(sl) || sl <= 0) {
          showToast("Stop Loss معتبر نیست");
          vibrate("error");
          return;
        }

        draft.sl = sl;
      }

      showStep(next);
    });

  });

/* =========================================================
   DIRECTION
========================================================= */

document
  .querySelectorAll("[data-dir]")
  .forEach((button) => {

    button.addEventListener("click", () => {

      const direction = button.dataset.dir;

      draft.direction = direction;

      vibrate("light");

      showStep(3);
    });

  });

/* =========================================================
   PREVIEW
========================================================= */

$("preview")?.addEventListener("click", () => {

  const tp = Number(tpInput.value);

  if (!Number.isFinite(tp) || tp <= 0) {
    showToast("Take Profit معتبر نیست");
    vibrate("error");
    return;
  }

  draft.tp = tp;

  const valid = isValidTrade(
    draft.direction,
    draft.entry,
    draft.sl,
    draft.tp
  );

  if (!valid) {

    if (draft.direction === "BUY") {
      showToast("برای BUY: SL پایین Entry و TP بالای Entry باشد");
    } else {
      showToast("برای SELL: SL بالای Entry و TP پایین Entry باشد");
    }

    vibrate("error");

    return;
  }

  const rr = getRR(
    draft.direction,
    draft.entry,
    draft.sl,
    draft.tp
  );

  previewBox.innerHTML = `
    <div class="preview-row">
      <span>Symbol</span>
      <strong>${escapeHTML(draft.symbol)}</strong>
    </div>

    <div class="preview-row">
      <span>Direction</span>
      <strong class="${draft.direction === "BUY" ? "buy" : "sell"}">
        ${draft.direction === "BUY" ? "🟢 BUY" : "🔴 SELL"}
      </strong>
    </div>

    <div class="preview-row">
      <span>Entry</span>
      <strong>${formatNumber(draft.entry)}</strong>
    </div>

    <div class="preview-row">
      <span>Stop Loss</span>
      <strong>${formatNumber(draft.sl)}</strong>
    </div>

    <div class="preview-row">
      <span>Take Profit</span>
      <strong>${formatNumber(draft.tp)}</strong>
    </div>

    <div class="preview-row rr-row">
      <span>R:R</span>
      <strong>1 : ${rr.toFixed(2)}</strong>
    </div>
  `;

  showStep(6);

});

/* =========================================================
   EDIT TRADE
========================================================= */

$("editTrade")?.addEventListener("click", () => {

  showStep(1);

  symbolInput.value = draft.symbol;

  /*
    Put the user back at symbol first.
    They can move through the steps again.
  */

});

/* =========================================================
   SAVE TRADE
========================================================= */

$("saveTrade")?.addEventListener("click", async () => {

  if (
    !draft.symbol ||
    !draft.direction ||
    !draft.entry ||
    !draft.sl ||
    !draft.tp
  ) {
    showToast("اطلاعات معامله کامل نیست");
    vibrate("error");
    return;
  }

  const rr = getRR(
    draft.direction,
    draft.entry,
    draft.sl,
    draft.tp
  );

  const trade = {

    id:
      Date.now().toString() +
      "_" +
      Math.random().toString(36).slice(2, 8),

    number: trades.length + 1,

    symbol: draft.symbol,

    direction: draft.direction,

    entry: Number(draft.entry),

    sl: Number(draft.sl),

    tp: Number(draft.tp),

    rr: Number(rr.toFixed(4)),

    status: "OPEN",

    resultR: 0,

    createdAt: new Date().toISOString()

  };

  trades.unshift(trade);

  await persistTrades();

  closeModal();

  renderAll();

  showToast("✓ معامله با موفقیت ثبت شد");

  vibrate("success");

});

/* =========================================================
   TRADE RESULT
========================================================= */

async function setTradeStatus(id, status) {

  const trade = trades.find(
    (item) => item.id === id
  );

  if (!trade) return;

  trade.status = status;

  if (status === "WIN") {
    trade.resultR = Number(trade.rr) || 0;
  }

  else if (status === "LOSS") {
    trade.resultR = -1;
  }

  else if (status === "BE") {
    trade.resultR = 0;
  }

  else {
    trade.resultR = 0;
  }

  await persistTrades();

  renderAll();

  vibrate(
    status === "WIN"
      ? "success"
      : "light"
  );

}

/* =========================================================
   DELETE TRADE
========================================================= */

async function deleteTrade(id) {

  const index = trades.findIndex(
    (trade) => trade.id === id
  );

  if (index === -1) return;

  trades.splice(index, 1);

  /*
    Re-number trades after deletion.
  */

  trades.forEach((trade, i) => {
    trade.number = trades.length - i;
  });

  await persistTrades();

  renderAll();

  showToast("معامله حذف شد");
}

/* =========================================================
   RENDER TRADES
========================================================= */

function renderTrades() {

  if (!tradeList) return;

  if (!trades.length) {

    tradeList.className = "empty";

    tradeList.innerHTML =
      "هنوز معامله‌ای ثبت نشده.";

    return;
  }

  tradeList.className = "trade-list";

  tradeList.innerHTML = trades
    .map((trade) => {

      const directionClass =
        trade.direction === "BUY"
          ? "buy"
          : "sell";

      const statusClass =
        trade.status.toLowerCase();

      let resultText = "OPEN";

      if (trade.status === "WIN") {
        resultText = `WIN ${formatR(trade.resultR)}`;
      }

      else if (trade.status === "LOSS") {
        resultText = "LOSS -1.00R";
      }

      else if (trade.status === "BE") {
        resultText = "BE 0.00R";
      }

      return `
        <article class="trade-card">

          <div class="trade-top">

            <div>
              <strong class="trade-symbol">
                #${trade.number} ${escapeHTML(trade.symbol)}
              </strong>

              <span class="trade-direction ${directionClass}">
                ${trade.direction}
              </span>
            </div>

            <span class="trade-status ${statusClass}">
              ${resultText}
            </span>

          </div>


          <div class="trade-levels">

            <div>
              <span>Entry</span>
              <b>${formatNumber(trade.entry)}</b>
            </div>

            <div>
              <span>SL</span>
              <b>${formatNumber(trade.sl)}</b>
            </div>

            <div>
              <span>TP</span>
              <b>${formatNumber(trade.tp)}</b>
            </div>

            <div>
              <span>R:R</span>
              <b>1:${Number(trade.rr).toFixed(2)}</b>
            </div>

          </div>


          <div class="trade-actions">

            ${
              trade.status === "OPEN"
                ? `
                  <button
                    class="result-btn win-btn"
                    data-action="win"
                    data-id="${trade.id}"
                  >
                    ✓ WIN
                  </button>

                  <button
                    class="result-btn loss-btn"
                    data-action="loss"
                    data-id="${trade.id}"
                  >
                    × LOSS
                  </button>

                  <button
                    class="result-btn be-btn"
                    data-action="be"
                    data-id="${trade.id}"
                  >
                    BE
                  </button>
                `
                : `
                  <button
                    class="result-btn open-btn"
                    data-action="open"
                    data-id="${trade.id}"
                  >
                    ↻ OPEN
                  </button>
                `
            }

            <button
              class="delete-btn"
              data-action="delete"
              data-id="${trade.id}"
            >
              حذف
            </button>

          </div>

        </article>
      `;

    })
    .join("");

}

/* =========================================================
   TRADE ACTION EVENTS
========================================================= */

tradeList?.addEventListener("click", async (event) => {

  const button =
    event.target.closest("[data-action]");

  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;

  if (action === "win") {
    await setTradeStatus(id, "WIN");
  }

  else if (action === "loss") {
    await setTradeStatus(id, "LOSS");
  }

  else if (action === "be") {
    await setTradeStatus(id, "BE");
  }

  else if (action === "open") {
    await setTradeStatus(id, "OPEN");
  }

  else if (action === "delete") {

    const confirmed =
      window.confirm("این معامله حذف شود؟");

    if (confirmed) {
      await deleteTrade(id);
    }

  }

});

/* =========================================================
   STATS
========================================================= */

function calculateStats() {

  const closedTrades =
    trades.filter(
      (trade) =>
        ["WIN", "LOSS", "BE"].includes(trade.status)
    );

  const wins =
    closedTrades.filter(
      (trade) => trade.status === "WIN"
    ).length;

  const losses =
    closedTrades.filter(
      (trade) => trade.status === "LOSS"
    ).length;

  const be =
    closedTrades.filter(
      (trade) => trade.status === "BE"
    ).length;

  const profit =
    closedTrades.reduce(
      (sum, trade) =>
        sum + (Number(trade.resultR) || 0),
      0
    );

  const winRate =
    closedTrades.length
      ? (wins / closedTrades.length) * 100
      : null;

  return {
    total: trades.length,
    closed: closedTrades.length,
    wins,
    losses,
    be,
    profit,
    winRate
  };

}

/* =========================================================
   RENDER STATS
========================================================= */

function renderStats() {

  const stats = calculateStats();

  tradeCountEl.textContent =
    stats.total;

  profitEl.textContent =
    formatR(stats.profit);

  portfolioEl.textContent =
    formatR(stats.profit);

  portfolioSubEl.textContent =
    `${stats.closed} closed trades`;

  if (stats.closed === 0) {
    winRateEl.textContent = "—";
  } else {
    winRateEl.textContent =
      `${stats.winRate.toFixed(1)}%`;
  }

  /*
    Add small visual classes if supported by CSS.
  */

  portfolioEl.classList.remove(
    "positive",
    "negative"
  );

  profitEl.classList.remove(
    "positive",
    "negative"
  );

  if (stats.profit > 0) {

    portfolioEl.classList.add("positive");
    profitEl.classList.add("positive");

  }

  else if (stats.profit < 0) {

    portfolioEl.classList.add("negative");
    profitEl.classList.add("negative");

  }

}

/* =========================================================
   RENDER ALL
========================================================= */

function renderAll() {

  renderStats();

  renderTrades();

}

/* =========================================================
   BOTTOM NAV
========================================================= */

document
  .querySelectorAll(".bottom-nav [data-tab]")
  .forEach((button) => {

    button.addEventListener("click", () => {

      document
        .querySelectorAll(".bottom-nav [data-tab]")
        .forEach((btn) => {
          btn.classList.remove("active");
        });

      button.classList.add("active");

      const tab = button.dataset.tab;

      if (tab === "home") {

        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });

      }

      else if (tab === "trades") {

        document
          .querySelector(".recent")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });

      }

      else if (tab === "stats") {

        document
          .querySelector(".stats")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });

      }

    });

  });

/* =========================================================
   OPEN / CLOSE BUTTONS
========================================================= */

$("openTrade")?.addEventListener(
  "click",
  openModal
);

$("cancelTrade")?.addEventListener(
  "click",
  closeModal
);

$("closeBtn")?.addEventListener(
  "click",
  () => {

    if (tg) {
      tg.close();
    } else {
      window.history.back();
    }

  }
);

/* =========================================================
   MODAL BACKDROP
========================================================= */

tradeModal?.addEventListener("click", (event) => {

  if (event.target === tradeModal) {
    closeModal();
  }

});

/* =================================
