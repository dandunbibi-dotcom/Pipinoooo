const tg = window.Telegram?.WebApp;
if(tg){tg.ready();tg.expand();}

const $ = id => document.getElementById(id);
const key = "pipino_trades";
let trades = JSON.parse(localStorage.getItem(key) || "[]");
let draft = {symbol:"",direction:"",entry:null,sl:null,tp:null};

if(tg?.initDataUnsafe?.user?.first_name){
  $("greeting").textContent = "WELCOME, " + tg.initDataUnsafe.user.first_name.toUpperCase();
}

function showStep(n){
  document.querySelectorAll(".step").forEach(x=>x.classList.add("hidden"));
  $("step"+n).classList.remove("hidden");
}

function save(){
  localStorage.setItem(key, JSON.stringify(trades));
  render();
}

function render(){
  $("tradeCount").textContent = trades.length;
  const list = $("tradeList");
  if(!trades.length){list.className="empty";list.textContent="هنوز معامله‌ای ثبت نشده.";return;}
  list.className="";
  list.innerHTML = trades.slice().reverse().slice(0,5).map(t =>
    `<div class="trade-row"><div><b>#${t.id} ${t.symbol}</b><br><small>${t.direction} · Entry ${t.entry}</small></div><div>TP ${t.tp}<br><small>SL ${t.sl}</small></div></div>`
  ).join("");
}

$("openTrade").onclick=()=>{
  draft={symbol:"",direction:"",entry:null,sl:null,tp:null};
  $("symbol").value="";$("entry").value="";$("sl").value="";$("tp").value="";
  showStep(1);$("tradeModal").classList.remove("hidden");
};

$("cancelTrade").onclick=()=>$("tradeModal").classList.add("hidden");
$("closeBtn").onclick=()=>tg?.close();

document.querySelectorAll(".next").forEach(btn=>{
  btn.onclick=()=>{
    const n=Number(btn.dataset.next);
    if(n===2){
      const s=$("symbol").value.trim().toUpperCase();
      if(!/^[A-Z0-9]{2,15}$/.test(s)) return tg?.showAlert?.("نماد نامعتبره؛ مثلاً BTCUSDT");
      draft.symbol=s;
    }
    if(n===4){
      const v=Number($("entry").value); if(!(v>0)) return tg?.showAlert?.("Entry نامعتبره");
      draft.entry=v;
    }
    if(n===5){
      const v=Number($("sl").value); if(!(v>0)) return tg?.showAlert?.("Stop Loss نامعتبره");
      draft.sl=v;
    }
    showStep(n);
  };
});

document.querySelectorAll("[data-dir]").forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll("[data-dir]").forEach(b=>b.classList.remove("selected"));
    btn.classList.add("selected");
    draft.direction=btn.dataset.dir;
    showStep(3);
  };
});

$("preview").onclick=()=>{
  const v=Number($("tp").value); if(!(v>0)) return tg?.showAlert?.("Take Profit نامعتبره");
  draft.tp=v;
  let risk = draft.direction==="BUY" ? draft.entry-draft.sl : draft.sl-draft.entry;
  let reward = draft.direction==="BUY" ? draft.tp-draft.entry : draft.entry-draft.tp;
  let rr = risk>0 && reward>0 ? "1 : "+(reward/risk).toFixed(2) : "—";
  $("previewBox").innerHTML =
    `<div class="title">◼️ CONFIRM TRADE</div>
     <b>${draft.symbol}</b> &nbsp; ${draft.direction==="BUY"?"🟢 BUY":"🔴 SELL"}<br>
     Entry &nbsp; <b>${draft.entry}</b><br>
     Stop Loss &nbsp; <b>${draft.sl}</b><br>
     Take Profit &nbsp; <b>${draft.tp}</b><br>
     R:R &nbsp; <b>${rr}</b>`;
  showStep(6);
};

$("editTrade").onclick=()=>showStep(5);

$("saveTrade").onclick=()=>{
  trades.push({id:trades.length+1,...draft,createdAt:new Date().toISOString()});
  save();
  $("tradeModal").classList.add("hidden");
  tg?.showPopup?.({title:"PIPINO",message:"معامله با موفقیت ثبت شد.",buttons:[{type:"ok"}]});
};

$("navTrades").onclick=()=>{
  $("tradeModal").classList.remove("hidden");
  showStep(6);
  $("previewBox").innerHTML = trades.length ? "معاملات شما در صفحه اصلی نمایش داده می‌شوند." : "هنوز معامله‌ای ثبت نشده.";
};

render();
