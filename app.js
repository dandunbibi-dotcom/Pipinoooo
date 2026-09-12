/* =========================================================
PIPINO — TRADING JOURNAL
Version 2 — FIXED
========================================================= */


/* =========================
TELEGRAM
========================= */

const tg = window.Telegram?.WebApp || null;

if (tg) {
  tg.ready();
  tg.expand();
}


/* =========================
HELPERS
========================= */

const $ = id => document.getElementById(id);


/* =========================
STORAGE
========================= */

const cloud = tg?.CloudStorage || null;

const CLOUD_KEY = "pipino_trades_v2";

const userId =
  tg?.initDataUnsafe?.user?.id
    ? String(tg.initDataUnsafe.user.id)
    : "guest";

const LOCAL_KEY = `pipino_trades_v2_${userId}`;


/* =========================
STATE
========================= */

let trades = [];

let draft = {
  symbol: "",
  direction: "",
  entry: null,
  sl: null,
  tp: null
};


/* =========================
TOAST
========================= */

function toast(text) {
  const element = $("toast");

  if (!element) return;

  element.textContent = text;
  element.classList.remove("hidden");

  clearTimeout(window.__toastTimer);

  window.__toastTimer = setTimeout(() => {
    element.classList.add("hidden");
  }, 1800);
}


/* =========================
CLOUD GET
========================= */

function cloudGet(key) {
  return new Promise(resolve => {

    if (!cloud) {
      resolve(null);
      return;
    }

    cloud.getItem(key, (err, value) => {

      if (err) {
        resolve(null);
        return;
      }

      resolve(value || null);

    });

  });
}


/* =========================
CLOUD SET
========================= */

function cloudSet(key, value) {
  return new Promise(resolve => {

    if (!cloud) {
      resolve(false);
      return;
    }

    cloud.setItem(key, value, err => {
      resolve(!err);
    });

  });
}


/* =========================
LOAD TRADES
========================= */

async function loadTrades() {

  let loaded = null;

  /*
  Telegram CloudStorage
  */

  const cloudValue = await cloudGet(CLOUD_KEY);

  if (cloudValue) {

    try {
      loaded = JSON.parse(cloudValue);
    } catch (error) {
      loaded = null;
    }

  }


  /*
  LocalStorage fallback
  */

  if (!Array.isArray(loaded)) {

    try {

      loaded = JSON.parse(
        localStorage.getItem(LOCAL_KEY) || "[]"
      );

    } catch (error) {

      loaded = [];

    }

  }


  trades = Array.isArray(loaded)
    ? loaded
    : [];


  render();

}


/* =========================
SAVE DATA
========================= */

async function persist() {

  const json = JSON.stringify(trades);


  /*
  LocalStorage
  */

  try {

    localStorage.setItem(
      LOCAL_KEY,
      json
    );

  } catch (error) {

    console.warn(
      "LocalStorage unavailable",
      error
    );

  }


  /*
  Telegram CloudStorage
  */

  await cloudSet(
    CLOUD_KEY,
    json
  );


  render();

}


/* =========================
STEP CONTROL
========================= */

function showStep(n) {

  document
    .querySelectorAll(".step")
    .forEach(element => {
      element.classList.add("hidden");
    });


  const step = $("step" + n);

  if (step) {
    step.classList.remove("hidden");
  }

}


/* =========================
RESET DRAFT
========================= */

function resetDraft() {

  draft = {
    symbol: "",
    direction: "",
    entry: null,
    sl: null,
    tp: null
  };


  [
    "symbol",
    "entry",
    "sl",
    "tp"
  ].forEach(id => {

    const element = $(id);

    if (element) {
      element.value = "";
    }

  });


  /*
  Reset direction buttons
  */

  document
    .querySelectorAll("[data-dir]")
    .forEach(button => {
      button.classList.remove("selected");
    });


  showStep(1);

}


/* =========================
OPEN MODAL
========================= */

function openModal() {

  resetDraft();

  const modal = $("tradeModal");

  if (modal) {
    modal.classList.remove("hidden");
  }

}


/* =========================
CLOSE MODAL
========================= */

function closeModal() {

  const modal = $("tradeModal");

  if (modal) {
    modal.classList.add("hidden");
  }

}


/* =========================
CALCULATE R:R
========================= */

function calcR(trade) {

  const entry = Number(trade.entry);
  const sl = Number(trade.sl);
  const tp = Number(trade.tp);


  const risk =
    trade.direction === "BUY"
      ? entry - sl
      : sl - entry;


  const reward =
    trade.direction === "BUY"
      ? tp - entry
      : entry - tp;


  if (
    !Number.isFinite(risk) ||
    !Number.isFinite(reward) ||
    risk <= 0 ||
    reward <= 0
  ) {
    return null;
  }


  return reward / risk;

}


/* =========================
VALIDATE TRADE
========================= */

function validateTrade() {

  const symbol =
    String(draft.symbol || "")
      .trim()
      .toUpperCase();


  const entry = Number(draft.entry);
  const sl = Number(draft.sl);
  const tp = Number(draft.tp);


  /*
  Symbol
  */

  if (
    !/^[A-Z0-9._-]{2,20}$/.test(symbol)
  ) {

    return "نماد نامعتبره.";

  }


  /*
  Direction
  */

  if (
    draft.direction !== "BUY" &&
    draft.direction !== "SELL"
  ) {

    return "جهت معامله رو انتخاب کن.";

  }


  /*
  Prices
  */

  if (
    ![
      entry,
      sl,
      tp
    ].every(Number.isFinite) ||
    entry <= 0 ||
    sl <= 0 ||
    tp <= 0
  ) {

    return "قیمت‌ها باید معتبر و بزرگ‌تر از صفر باشن.";

  }


  /*
  BUY
  */

  if (
    draft.direction === "BUY" &&
    !(
      sl < entry &&
      tp > entry
    )
  ) {

    return "برای BUY باید SL پایین‌تر از Entry و TP بالاتر از Entry باشه.";

  }


  /*
  SELL
  */

  if (
    draft.direction === "SELL" &&
    !(
      sl > entry &&
      tp < entry
    )
  ) {

    return "برای SELL باید SL بالاتر از Entry و TP پایین‌تر از Entry باشه.";

  }


  /*
  Save normalized values
  */

  draft.symbol = symbol;
  draft.entry = entry;
  draft.sl = sl;
  draft.tp = tp;


  return null;

}


/* =========================
PREVIEW
========================= */

function showPreview() {

  const error = validateTrade();

  if (error) {
    toast(error);
    return;
  }


  const rr = calcR(draft);

  if (!rr) {
    toast("R:R قابل محاسبه نیست.");
    return;
  }


  const direction =
    draft.direction === "BUY"
      ? "🟢 BUY"
      : "🔴 SELL";


  const previewBox = $("previewBox");

  if (!previewBox) return;


  previewBox.innerHTML = `

    <div>
      <b>${draft.symbol}</b>
      &nbsp;
      ${direction}
    </div>

    <div>
      Entry:
      <span class="ltr">
        ${draft.entry}
      </span>
    </div>

    <div>
      Stop Loss:
      <span class="ltr">
        ${draft.sl}
      </span>
    </div>

    <div>
      Take Profit:
      <span class="ltr">
        ${draft.tp}
      </span>
    </div>

    <div>
      R:R:
      <b class="ltr">
        1 : ${rr.toFixed(2)}
      </b>
    </div>

    <div class="status">
      نتیجه فعلاً: OPEN
    </div>

  `;


  showStep(6);

}


/* =========================
SAVE TRADE
========================= */

async function saveTrade() {

  const error = validateTrade();

  if (error) {
    toast(error);
    return;
  }


  const rr = calcR(draft);

  if (!rr) {
    toast("R:R نامعتبره.");
    return;
  }


  const trade = {

    id: Date.now(),

    symbol: draft.symbol,

    direction: draft.direction,

    entry: draft.entry,

    sl: draft.sl,

    tp: draft.tp,

    rr: Number(
      rr.toFixed(4)
    ),

    result: "OPEN",

    createdAt:
      new Date().toISOString()

  };


  trades.unshift(trade);


  await persist();


  closeModal();


  toast("✓ معامله ثبت شد");

}


/* =========================
SET TRADE RESULT
========================= */

async function setResult(id, result) {

  const trade =
    trades.find(
      t => Number(t.id) === Number(id)
    );


  if (!trade) {
    return;
  }


  /*
  Don't allow changing an already
  closed trade
  */

  if (trade.result !== "OPEN") {
    return;
  }


  trade.result = result;

  trade.closedAt =
    new Date().toISOString();


  await persist();


  if (result === "WIN") {

    toast("✓ معامله Win شد");

  }

  else if (result === "LOSS") {

    toast("✓ معامله Loss شد");

  }

  else {

    toast("✓ Break Even شد");

  }

}


/* =========================
FORMAT R
========================= */

function formatR(n) {

  const x = Number(n || 0);

  return `${x >= 0 ? "+" : ""}${x.toFixed(2)}R`;

}


/* =========================
STATS
========================= */

function stats() {

  const closed =
    trades.filter(
      t =>
        t.result &&
        t.result !== "OPEN"
    );


  const wins =
    closed.filter(
      t => t.result === "WIN"
    ).length;


  const losses =
    closed.filter(
      t => t.result === "LOSS"
    ).length;


  const be =
    closed.filter(
      t => t.result === "BE"
    ).length;


  /*
  WIN = +R:R
  LOSS = -1R
  BE = 0R
  */

  const netR =
    closed.reduce(
      (sum, trade) => {

        if (
          trade.result === "WIN"
        ) {

          return (
            sum +
            Number(trade.rr || 0)
          );

        }


        if (
          trade.result === "LOSS"
        ) {

          return sum - 1;

        }


        return sum;

      },
      0
    );


  return {
    closed,
    wins,
    losses,
    be,
    netR
  };

}


/* =========================
RENDER
========================= */

function render() {

  const s = stats();


  /*
  Trade count
  */

  const tradeCount = $("tradeCount");

  if (tradeCount) {
    tradeCount.textContent =
      trades.length;
  }


  /*
  Portfolio
  */

  const portfolio = $("portfolio");

  if (portfolio) {
    portfolio.textContent =
      formatR(s.netR);
  }


  /*
  Portfolio subtitle
  */

  const portfolioSub =
    $("portfolioSub");

  if (portfolioSub) {

    portfolioSub.textContent =
      `${s.closed.length} closed • ${
        trades.length - s.closed.length
      } open`;

  }


  /*
  Profit
  */

  const profit = $("profit");

  if (profit) {

    profit.textContent =
      formatR(s.netR);

  }


  /*
  Win rate
  */

  const decided =
    s.wins + s.losses;


  const winRate =
    $("winRate");


  if (winRate) {

    winRate.textContent =
      decided
        ? `${Math.round(
            (s.wins / decided) * 100
          )}%`
        : "—";

  }


  /*
  Trade list
  */

  const tradeList =
    $("tradeList");


  if (!tradeList) {
    return;
  }


  /*
  No trades
  */

  if (!trades.length) {

    tradeList.innerHTML = `
      <div class="empty">
        هنوز معامله‌ای ثبت نشده.
      </div>
    `;

    return;

  }


  /*
  Render latest trades
  */

  tradeList.innerHTML =
    trades
      .slice(0, 12)
      .map(trade => {

        const resultText =
          trade.result === "WIN"
            ? "WIN"
            : trade.result === "LOSS"
              ? "LOSS"
              : trade.result === "BE"
                ? "BREAK EVEN"
                : "OPEN";


        const resultClass =
          trade.result === "WIN"
            ? "win"
            : trade.result === "LOSS"
              ? "loss"
              : "";


        const direction =
          trade.direction === "BUY"
            ? "🟢 BUY"
            : "🔴 SELL";


        const directionClass =
          trade.direction === "BUY"
            ? "buy"
            : "sell";


        const rr =
          Number(trade.rr || 0);


        return `

          <div class="trade">

            <div class="trade-head">

              <div class="trade-symbol">
                ${escapeHTML(trade.symbol)}
              </div>

              <div
                class="badge ${directionClass}"
              >
                ${direction}
              </div>

            </div>


            <div class="trade-meta">

              <div>
                Entry
                <b class="ltr">
                  ${trade.entry}
                </b>
              </div>

              <div>
                SL
                <b class="ltr">
                  ${trade.sl}
                </b>
              </div>

              <div>
                TP
                <b class="ltr">
                  ${trade.tp}
                </b>
              </div>

            </div>


            <div
              class="status ${resultClass}"
            >

              R:R 1:${rr.toFixed(2)}

              •

              ${resultText}

            </div>


            ${
              trade.result === "OPEN"

                ? `

                  <div class="result-row">

                    <button
                      data-result="WIN"
                      data-id="${trade.id}"
                    >
                      🟢 Win
                    </button>

                    <button
                      data-result="LOSS"
                      data-id="${trade.id}"
                    >
                      🔴 Loss
                    </button>

                    <button
                      data-result="BE"
                      data-id="${trade.id}"
                    >
                      ⚪ BE
                    </button>

                  </div>

                `

                : ""
            }

          </div>

        `;

      })
      .join("");

}


/* =========================
ESCAPE HTML
========================= */

function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


/* =========================
NEXT STEP
========================= */

function handleNext(n) {

  /*
  STEP 1 → SYMBOL
  */

  if (n === 2) {

    const symbol =
      $("symbol")
        ?.value
        .trim()
        .toUpperCase();


    if (
      !symbol ||
      !/^[A-Z0-9._-]{2,20}$/.test(symbol)
    ) {

      toast("نماد نامعتبره.");
      return;

    }


    draft.symbol = symbol;

  }


  /*
  STEP 3 → ENTRY
  */

  if (n === 4) {

    const entry =
      Number(
        $("entry")?.value
      );


    if (
      !Number.isFinite(entry) ||
      entry <= 0
    ) {

      toast("Entry نامعتبره.");
      return;

    }


    draft.entry = entry;

  }


  /*
  STEP 4 → SL
  */

  if (n === 5) {

    const sl =
      Number(
        $("sl")?.value
      );


    if (
      !Number.isFinite(sl) ||
      sl <= 0
    ) {

      toast("Stop Loss نامعتبره.");
      return;

    }


    draft.sl = sl;

  }


  showStep(n);

}


/* =========================
OPEN TRADE
========================= */

const openTradeButton =
  $("openTrade");

if (openTradeButton) {

  openTradeButton.addEventListener(
    "click",
    openModal
  );

}


/* =========================
CANCEL TRADE
========================= */

const cancelTradeButton =
  $("cancelTrade");

if (cancelTradeButton) {

  cancelTradeButton.addEventListener(
    "click",
    closeModal
  );

}


/* =========================
CLOSE TELEGRAM
========================= */

const closeButton =
  $("closeBtn");

if (closeButton) {

  closeButton.addEventListener(
    "click",
    () => {

      if (tg) {

        tg.close();

      }

      else {

        window.history.back();

      }

    }
  );

}


/* =========================
PREVIEW
========================= */

const previewButton =
  $("preview");

if (previewButton) {

  previewButton.addEventListener(
    "click",
    () => {

      const tp =
        Number(
          $("tp")?.value
        );


      if (
        !Number.isFinite(tp) ||
        tp <= 0
      ) {

        toast("Take Profit نامعتبره.");
        return;

      }


      draft.tp = tp;

      showPreview();

    }
  );

}


/* =========================
SAVE
========================= */

const saveTradeButton =
  $("saveTrade");

if (saveTradeButton) {

  saveTradeButton.addEventListener(
    "click",
    saveTrade
  );

}


/* =========================
EDIT
========================= */

const editTradeButton =
  $("editTrade");

if (editTradeButton) {

  editTradeButton.addEventListener(
    "click",
    () => {

      showStep(5);

    }
  );

}


/* =========================
NEXT BUTTONS
========================= */

document
  .querySelectorAll(".next")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        handleNext(
          Number(
            button.dataset.next
          )
        );

      }
    );

  });


/* =========================
BUY / SELL
========================= */

document
  .querySelectorAll("[data-dir]")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        draft.direction =
          button.dataset.dir;


        /*
        Visual selected state
        */

        document
          .querySelectorAll("[data-dir]")
          .forEach(item => {
            item.classList.remove(
              "selected"
            );
          });


        button.classList.add(
          "selected"
        );


        showStep(3);

      }
    );

  });


/* =========================
TRADE RESULT BUTTONS
========================= */

const recent =
  document.querySelector(".recent");


if (recent) {

  recent.addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(
          "[data-result]"
        );


      if (!button) {
        return;
      }


      const id =
        Number(
          button.dataset.id
        );


      const result =
        button.dataset.result;


      setResult(
        id,
        result
      );

    }
  );

}


/* =========================
BOTTOM NAV
========================= */

document
  .querySelectorAll(
    ".bottom-nav button"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(
            ".bottom-nav button"
          )
          .forEach(item => {

            item.classList.remove(
              "active"
            );

          });


        button.classList.add(
          "active"
        );


        /*
        TRADES
        */

        if (
          button.dataset.tab ===
          "trades"
        ) {

          const recent =
            document.querySelector(
              ".recent"
            );


          if (recent) {

            recent.scrollIntoView({
              behavior: "smooth"
            });

          }

        }


        /*
        STATS
        */

        else if (
          button.dataset.tab ===
          "stats"
        ) {

          const hero =
            document.querySelector(
              ".hero"
            );


          if (hero) {

            hero.scrollIntoView({
              behavior: "smooth"
            });

          }

        }


        /*
        HOME
        */

        else {

          window.scrollTo({
            top: 0,
            behavior: "smooth"
          });

        }

      }
    );

  });


/* =========================
TELEGRAM USER
========================= */

if (
  tg?.initDataUnsafe?.user?.first_name
) {

  const greeting =
    $("greeting");


  if (greeting) {

    greeting.textContent =
      "WELCOME, " +
      tg
        .initDataUnsafe
        .user
        .first_name
        .toUpperCase();

  }

}


/* =========================
START
========================= */

loadTrades();
