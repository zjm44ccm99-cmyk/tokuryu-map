/* トクリュウ事件マップ 本体スクリプト（tools ではなく build で生成） */
window.PREF_PAGES=true;

const SUFFIX={"北海道":"","東京":"都","大阪":"府","京都":"府"};
const fullName=p=>p+(p in SUFFIX?SUFFIX[p]:"県");


const $=id=>document.getElementById(id);
/* HTMLに差し込む文字列は必ず esc を通す。リンク先は safeUrl で https のみ許可。 */
const esc=s=>String(s??"").replace(/[&<>"'`=\/]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","`":"&#96;","=":"&#61;","/":"&#47;"}[m]));
const safeUrl=u=>{try{const x=new URL(String(u));return x.protocol==="https:"?x.href:"#";}catch(e){return "#";}};
const keyOf=c=>c.pref+"|"+c.city;
const labelOf=k=>{const [p,c]=k.split("|");return fullName(p)+" "+c;};
const toDate=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,Math.min(d,28));};
const TODAY=(()=>{const t=new Date();return t<toDate(UPDATED)?toDate(UPDATED):t;})();
const ageDays=c=>(TODAY-toDate(c.d))/864e5;
const fmtDate=s=>{const [y,m,d]=s.split("-");return `${+y}年${+m}月${+d}日`;};
$("updated").textContent="最終更新 "+fmtDate(UPDATED)+" ／ 掲載 "+CASES.length+"件";

const state={place:null,type:null,period:365,month:null,home:""};
try{const h=localStorage.getItem("tkr-home");if(h)state.home=h;}catch(e){}

/* 都道府県の中心（地図データから計算） */
const PREF_C={};
if(window.d3&&window.topojson&&TOPO){
  topojson.feature(TOPO,TOPO.objects.japan).features.forEach(f=>{
    const n=f.properties.nam_ja.replace(/[都府県]$/,"");PREF_C[n==="北海道"?"北海道":n]=d3.geoCentroid(f);});
}
const km=(a,b)=>{const R=6371,toR=x=>x*Math.PI/180;const dLat=toR(b[1]-a[1]),dLon=toR(b[0]-a[0]);
  const h=Math.sin(dLat/2)**2+Math.cos(toR(a[1]))*Math.cos(toR(b[1]))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(h));};
const lonlat=c=>{const p=PLACES[keyOf(c)];return [p[1],p[0]];};

/* ルーティング */
const VIEWS=["now","teguchi","taisaku","data"];
function route(){
  const v=VIEWS.includes(location.hash.slice(1))?location.hash.slice(1):"now";
  VIEWS.forEach(x=>$("v-"+x).hidden=x!==v);
  document.querySelectorAll("[data-nav]").forEach(a=>{if(a.dataset.nav===v)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});
}
window.addEventListener("hashchange",()=>{route();window.scrollTo(0,0);});
route();

/* 種別フィルタ */
const filters=$("filters");
Object.entries(TYPES).forEach(([k,t])=>{
  const b=document.createElement("button");
  b.className="chip";b.dataset.type=k;b.setAttribute("aria-pressed","false");
  b.innerHTML=`<span class="dot" style="background:${t.color}"></span>${t.label}`;
  b.addEventListener("click",()=>{state.type=state.type===k?null:k;render();});
  filters.appendChild(b);
});
document.querySelectorAll("[data-period]").forEach(b=>b.addEventListener("click",()=>{state.period=+b.dataset.period;state.month=null;render();}));
$("reset").addEventListener("click",()=>{state.place=null;state.type=null;state.month=null;render();});
const inPeriod=c=>!state.period||ageDays(c)<=state.period;
const NEAR_KM=150;
const homeC=()=>state.home&&PREF_C[state.home]?PREF_C[state.home]:null;
const inArea=c=>{const h=homeC();return !h||km(h,lonlat(c))<=NEAR_KM;};
const alInArea=a=>{const h=homeC();if(!h)return true;const p=PLACES[a.pref+"|"+a.city];return km(h,[p[1],p[0]])<=NEAR_KM;};
const areaName=()=>homeC()?fullName(state.home)+"周辺":"";
const visible=c=>(state.month?c.d.slice(0,7)===state.month:inPeriod(c))&&(!state.type||c.type===state.type)&&inArea(c);

/* 警察の注意情報（予兆電話など）。30日を過ぎたものは表示しない */
const ALERT_LIST=(typeof ALERTS!=="undefined"?ALERTS:[]).filter(a=>PLACES[a.pref+"|"+a.city]&&(TODAY-toDate(a.d))/864e5<=30).sort((a,b)=>b.d.localeCompare(a.d));
const aKey=(a,i)=>"al-"+i;
function alertCard(a,i,dist){return `<article class="acard" id="${aKey(a,i)}"><div class="ah"><span>${esc(fmtDate(a.d))}</span><span class="ak">${esc(a.kind)}</span>${dist!=null?`<span>約${Math.round(dist/10)*10}km</span>`:""}${a.basis==="headline"?'<span class="hl">見出しで確認</span>':""}</div>
  <div class="aw">${fullName(a.pref)} ${esc(a.city)}</div><p>${esc(a.desc)}</p>
  <div class="src">出典：<a href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener noreferrer">${esc(a.src)}</a></div></article>`;}
function renderAlerts(){
  if(!ALERT_LIST.length){$("alertsBox").hidden=true;return;}
  $("alh").textContent=homeC()?`警察の注意情報（${areaName()}・直近30日）`:"警察の注意情報（直近30日）";
  const h=homeC();
  const list=ALERT_LIST.map((a,i)=>({a,i})).filter(x=>alInArea(x.a));
  if(!list.length){$("alerts").innerHTML=`<p class="hint">${areaName()}（150km以内）では、直近30日に掲載中の注意情報はありません。掲載は確認できた一部です。</p>`;return;}
  const dist=a=>{if(!h)return null;const p=PLACES[a.pref+"|"+a.city];return km(h,[p[1],p[0]]);};
  $("alerts").innerHTML=list.slice(0,6).map(x=>alertCard(x.a,x.i,dist(x.a))).join("")+(list.length>6?`<p class="hint">ほか${list.length-6}件は地図の◆から見られます。</p>`:"");
}
function flashAlert(i){
  if(!$(aKey(null,i))){const a=ALERT_LIST[i];$("alerts").insertAdjacentHTML("afterbegin",alertCard(a,i));}
  const el=$(aKey(null,i));if(!el)return;
  el.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"});
  el.classList.add("flash");setTimeout(()=>el.classList.remove("flash"),1600);
}

/* 最新の事件 */
function renderLatest(){
  $("latestLab").textContent=homeC()?`${areaName()}の最新の事件`:"最新の事件";
  const rows=CASES.filter(inArea).sort((a,b)=>b.d.localeCompare(a.d)).slice(0,4);
  if(!rows.length){$("latest").innerHTML=`<p class="hint">${areaName()}（150km以内）では、掲載中の事件はありません。掲載は報道で確認できた一部で、被害がないという意味ではありません。</p>`;return;}
  $("latest").innerHTML=rows.map(c=>`<button class="lcard" style="--c:${TYPES[c.type].color}" data-k="${esc(keyOf(c))}">
    <span class="when">${esc(c.show)}${ageDays(c)<=90?'<span class="new">直近</span>':""}</span>
    <span class="where">${fullName(c.pref)} ${esc(c.city)}</span>
    <span class="what">${TYPES[c.type].label}｜${esc(c.desc)}</span></button>`).join("");
  $("latest").querySelectorAll(".lcard").forEach(b=>b.addEventListener("click",()=>gotoPlace(b.dataset.k)));
}

/* 近くの事件 */
const homeSel=$("homeSel");
Object.keys(PREF_C).length&&[..."北海道,青森,岩手,宮城,秋田,山形,福島,茨城,栃木,群馬,埼玉,千葉,東京,神奈川,新潟,富山,石川,福井,山梨,長野,岐阜,静岡,愛知,三重,滋賀,京都,大阪,兵庫,奈良,和歌山,鳥取,島根,岡山,広島,山口,徳島,香川,愛媛,高知,福岡,佐賀,長崎,熊本,大分,宮崎,鹿児島,沖縄".split(",")]
  .forEach(p=>{const o=document.createElement("option");o.value=p;o.textContent=fullName(p);homeSel.appendChild(o);});
if(!Object.keys(PREF_C).length) $("near").hidden=true;
homeSel.value=state.home;
homeSel.addEventListener("change",()=>{state.home=homeSel.value;state.place=null;state.month=null;try{localStorage.setItem("tkr-home",state.home);}catch(e){}
  renderNear();renderAlerts();renderLatest();render();if(zoomHome)zoomHome();});
function renderNear(){
  $("reportBox").hidden=!homeC();
  if(!homeC()){$("nearBody").innerHTML='<p>都道府県を選ぶと、地図・事件・警察の注意情報が、その周辺（中心から150km以内）に切り替わります。</p>';return;}
  const c0=PREF_C[state.home];
  const rows=CASES.map(c=>({c,dist:km(c0,lonlat(c))})).filter(x=>x.dist<=NEAR_KM&&ageDays(x.c)<=365);
  const recent=rows.filter(x=>ageDays(x.c)<=90).length;
  const al=ALERT_LIST.filter(alInArea).length;
  const head=rows.length?`<p><b>${fullName(state.home)}の周辺150km以内で、直近1年に${rows.length}件</b>（うち直近3か月に${recent}件）${al?`、直近30日の警察の注意情報が${al}件`:""}。近くで続いているのは、${topKinds(rows)}です。</p>`
    :`<p>${fullName(state.home)}の周辺150km以内では、直近1年に掲載中の事件はありません${al?`（警察の注意情報は${al}件）`:""}。掲載は報道で確認できた一部で、被害がないという意味ではありません。</p>`;
  $("nearBody").innerHTML=head+`<p style="font-size:13px"><a href="#taisaku">対策を見る</a>${prefLink(state.home)}</p>`+policeLinks(state.home);
}
const SLUG={"北海道":"hokkaido","青森":"aomori","岩手":"iwate","宮城":"miyagi","秋田":"akita","山形":"yamagata","福島":"fukushima","茨城":"ibaraki","栃木":"tochigi","群馬":"gunma","埼玉":"saitama","千葉":"chiba","東京":"tokyo","神奈川":"kanagawa","新潟":"niigata","富山":"toyama","石川":"ishikawa","福井":"fukui","山梨":"yamanashi","長野":"nagano","岐阜":"gifu","静岡":"shizuoka","愛知":"aichi","三重":"mie","滋賀":"shiga","京都":"kyoto","大阪":"osaka","兵庫":"hyogo","奈良":"nara","和歌山":"wakayama","鳥取":"tottori","島根":"shimane","岡山":"okayama","広島":"hiroshima","山口":"yamaguchi","徳島":"tokushima","香川":"kagawa","愛媛":"ehime","高知":"kochi","福岡":"fukuoka","佐賀":"saga","長崎":"nagasaki","熊本":"kumamoto","大分":"oita","宮崎":"miyazaki","鹿児島":"kagoshima","沖縄":"okinawa"};
const prefLink=p=>window.PREF_PAGES&&SLUG[p]?` ／ <a href="pref/${SLUG[p]}.html">${fullName(p)}のページを見る</a>`:"";
const PL=(typeof POLICE_LINKS!=="undefined"?POLICE_LINKS:{});
const PC=(typeof POLICE_CONTACTS!=="undefined"?POLICE_CONTACTS:{});
const policeContact=p=>PC[p]?`<p class="plinks">${fullName(p)}警察本部（代表）<b style="user-select:all">${esc(PC[p].hq)}</b> ／ <a href="${esc(safeUrl(PC[p].list))}" target="_blank" rel="noopener noreferrer">警察署一覧</a><span class="hint">（警察を名乗る電話は、この番号に自分から掛け直して確認）</span></p>`:"";
const policeLinks=p=>policeContact(p)+_policeLinks(p);
const _policeLinks=p=>(PL[p]&&PL[p].length)?`<p class="plinks">最新の速報は警察の公式発信で：${PL[p].map(l=>`<a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener noreferrer">${esc(l.name)}</a>`).join(" ／ ")}<span class="hint">（県警の公式サイトでリンクを確認済み）</span></p>`:"";
function topKinds(rows){const n={};rows.forEach(x=>n[x.c.type]=(n[x.c.type]||0)+1);
  return Object.entries(n).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${TYPES[k].label}（${v}件）`).join("、");}

/* 地図 */
let alertSel,pinSel,ringSel,lblSel,prefSel,zoomer,svg,proj,projOki,goView,zoomHome;
const projAll=(ll,pref)=>pref==="沖縄"&&projOki?projOki(ll):proj(ll);
function drawMap(){
  if(!window.d3||!window.topojson||!TOPO){$("map").outerHTML='<p class="empty" style="padding:16px">地図を読み込めませんでした。右のリストから事件を確認できます。</p>';return;}
  svg=d3.select("#map");const W=800,H=800;
  const geo=topojson.feature(TOPO,TOPO.objects.japan);
  proj=d3.geoMercator().fitExtent([[16,16],[W-16,H-16]],{type:"Feature",geometry:{type:"MultiPoint",coordinates:[[129.3,30.9],[145.9,45.6]]}});
  const path=d3.geoPath(proj);
  const g=svg.append("g");
  const hit=new Set(CASES.map(c=>fullName(c.pref)));
  /* 沖縄県は左上の枠（インセット）に縮尺を変えて表示 */
  const oki=geo.features.find(f=>f.properties.nam_ja==="沖縄県");
  const box=[[24,24],[420,268]];
  if(oki){
    projOki=d3.geoMercator().fitExtent([[box[0][0]+8,box[0][1]+22],[box[1][0]-8,box[1][1]-8]],{type:"Feature",geometry:{type:"MultiPoint",coordinates:[[123.6,24.05],[128.4,27.05]]}});
    svg.append("defs").append("clipPath").attr("id","okiclip").append("rect").attr("x",box[0][0]).attr("y",box[0][1]).attr("width",box[1][0]-box[0][0]).attr("height",box[1][1]-box[0][1]);
    g.append("rect").attr("x",box[0][0]).attr("y",box[0][1]).attr("width",box[1][0]-box[0][0]).attr("height",box[1][1]-box[0][1])
      .attr("fill","none").attr("stroke","var(--border)").attr("stroke-dasharray","4 3").attr("vector-effect","non-scaling-stroke");
    g.append("text").attr("x",box[0][0]+8).attr("y",box[0][1]+16).attr("class","axis").style("font","11px var(--body)").style("fill","var(--muted)").text("沖縄県（縮尺・位置を変えて表示。与那国島・大東諸島などは省略）");
  }
  const pathOki=projOki?d3.geoPath(projOki):path;
  prefSel=g.append("g").selectAll("path").data(geo.features).join("path")
    .attr("class",d=>"pref"+(hit.has(d.properties.nam_ja)?" has":""))
    .attr("d",d=>d.properties.nam_ja==="沖縄県"?pathOki(d):path(d))
    .attr("clip-path",d=>d.properties.nam_ja==="沖縄県"?"url(#okiclip)":null);
  prefSel.append("title").text(d=>d.properties.nam_ja);
  g.append("g").attr("class","pins");
  svg.node().__g=g;
  zoomer=d3.zoom().scaleExtent([1,40]).translateExtent([[-100,-100],[W+100,H+100]])
    .on("zoom",e=>{g.attr("transform",e.transform);scalePins(e.transform.k);});
  svg.call(zoomer);
  const views={all:null,kanto:[[138.95,35.15],[140.75,36.6]],tokai:[[136.6,34.5],[139.2,35.4]],
    kansai:[[134.4,34.1],[136.2,35.1]],shikoku:[[132.3,32.8],[134.9,34.5]],west:[[129.8,33.2],[134.4,34.8]]};
  goView=(v,center)=>{
    document.querySelectorAll("[data-view]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.view===v)));
    const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t=reduce?svg:svg.transition().duration(600);
    if(center){const [x,y]=center;t.call(zoomer.transform,d3.zoomIdentity.translate(W/2,H/2).scale(9).translate(-x,-y));return;}
    if(!views[v]){t.call(zoomer.transform,d3.zoomIdentity);return;}
    const [[a,b],[c,d2]]=views[v];const [x0,y0]=proj([a,d2]),[x1,y1]=proj([c,b]);
    const k=Math.min(W/(x1-x0),H/(y1-y0))*0.92;
    t.call(zoomer.transform,d3.zoomIdentity.translate(W/2,H/2).scale(k).translate(-(x0+x1)/2,-(y0+y1)/2));
  };
  zoomHome=(instant)=>{
    if(!homeC()){goView("all");return;}
    const f=geo.features.find(x=>x.properties.nam_ja===fullName(state.home));if(!f)return;
    const [[x0,y0],[x1,y1]]=(state.home==="沖縄"?pathOki:path).bounds(f);
    const k=Math.max(1,Math.min(12,Math.min(W/(x1-x0),H/(y1-y0))*0.55));
    document.querySelectorAll("[data-view]").forEach(b=>b.setAttribute("aria-pressed","false"));
    const reduce=instant||window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    (reduce?svg:svg.transition().duration(600)).call(zoomer.transform,d3.zoomIdentity.translate(W/2,H/2).scale(k).translate(-(x0+x1)/2,-(y0+y1)/2));
  };
  document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>goView(b.dataset.view)));
  $("zin").addEventListener("click",()=>svg.transition().duration(250).call(zoomer.scaleBy,1.6));
  $("zout").addEventListener("click",()=>svg.transition().duration(250).call(zoomer.scaleBy,1/1.6));
}
const rOf=n=>4+Math.sqrt(n)*3;
let curK=1;
function scalePins(k){
  curK=k;if(!pinSel)return;
  pinSel.attr("r",d=>rOf(d.n)/k);alertSel&&alertSel.attr("transform",d=>`translate(${d.x},${d.y}) scale(${1/k})`);ringSel&&ringSel.attr("r",d=>rOf(d.n)/k);
  lblSel.attr("x",d=>d.x+(rOf(d.n)+3)/k).attr("y",d=>d.y+4/k).style("font-size",(11/k)+"px")
    .style("stroke-width",(3/k)+"px").attr("display",k>=3.5?null:"none");
}
function renderMapState(){
  if(!svg)return;
  const g=svg.node().__g.select("g.pins");
  const groups={};CASES.filter(visible).forEach(c=>{(groups[keyOf(c)]=groups[keyOf(c)]||[]).push(c);});
  const rank=list=>list.reduce((a,c)=>TYPES[c.type].rank>TYPES[a].rank?c.type:a,list[0].type);
  const pins=Object.entries(groups).map(([k,list])=>{const p=PLACES[k];const [x,y]=projAll([p[1],p[0]],k.split("|")[0]);
    return {k,list,x,y,vague:!!p[2],top:rank(list),n:list.length,recent:list.some(c=>ageDays(c)<=90)};}).sort((a,b)=>b.n-a.n);
  g.selectAll("*").remove();
  ringSel=g.selectAll("circle.ring").data(pins.filter(d=>d.recent)).join("circle").attr("class","ring")
    .attr("cx",d=>d.x).attr("cy",d=>d.y).attr("stroke","var(--focus)");
  pinSel=g.selectAll("circle.pin").data(pins).join("circle")
    .attr("class",d=>"pin"+(d.vague?" vague":"")+(d.k===state.place?" sel":""))
    .attr("cx",d=>d.x).attr("cy",d=>d.y).attr("fill",d=>TYPES[d.top].color).attr("stroke-width",1.5)
    .attr("tabindex",0).attr("role","button").attr("aria-label",d=>`${labelOf(d.k)} ${d.n}件`)
    .on("click",(e,d)=>{state.place=state.place===d.k?null:d.k;render();})
    .on("keydown",(e,d)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();state.place=state.place===d.k?null:d.k;render();}});
  pinSel.append("title").text(d=>`${labelOf(d.k)}：${d.n}件`);
  lblSel=g.selectAll("text").data(pins).join("text").attr("class","lbl").text(d=>d.k.split("|")[1]+(d.n>1?` ${d.n}`:""));
  const ams=ALERT_LIST.map((a,i)=>[a,i]).filter(([a])=>alInArea(a)).map(([a,i])=>{const p=PLACES[a.pref+"|"+a.city];const [x,y]=projAll([p[1],p[0]],a.pref);return {a,i,x:x+7,y:y-7,vague:!!p[2]};});
  alertSel=g.selectAll("path.amark").data(ams).join("path").attr("class",d=>"amark"+(d.vague?" vague":"")).attr("d","M0,-7L7,0L0,7L-7,0Z")
    .attr("tabindex",0).attr("role","button").attr("aria-label",d=>`注意情報 ${fullName(d.a.pref)} ${d.a.city} ${d.a.kind}`)
    .on("click",(e,d)=>flashAlert(d.i)).on("keydown",(e,d)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();flashAlert(d.i);}});
  alertSel.append("title").text(d=>`${fmtDate(d.a.d)} ${fullName(d.a.pref)} ${d.a.city}：${d.a.kind}`);
  prefSel.classed("home",d=>state.home&&d.properties.nam_ja===fullName(state.home));
  scalePins(curK);
}
function gotoPlace(k){
  state.place=k;state.month=null;state.period=0;state.type=null;
  if(location.hash&&location.hash!=="#now"){location.hash="now";}
  render();
  const p=PLACES[k];if(goView&&proj)goView(null,projAll([p[1],p[0]],k.split("|")[0]));
  document.querySelector(".main").scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
}
document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>gotoPlace(b.dataset.goto)));

/* 時系列（月別） */
function renderTimeline(){
  const months=[];const start=new Date(2024,0,1);
  for(let d=new Date(start);d<=TODAY;d.setMonth(d.getMonth()+1))months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  const cnt={};CASES.filter(c=>!c.nodate&&inArea(c)).forEach(c=>{const m=c.d.slice(0,7);cnt[m]=(cnt[m]||0)+1;});
  const older=CASES.filter(c=>c.d<"2024-01"&&!c.nodate&&inArea(c)).length;const nod=CASES.filter(c=>c.nodate&&inArea(c)).length;
  const W=900,H=180,ml=26,mr=8,mt=14,mb=34;const bw=(W-ml-mr)/months.length;
  const max=Math.max(2,...months.map(m=>cnt[m]||0));const ticks=[];for(let i=0;i<=max;i+=max>6?2:1)ticks.push(i);
  const y=v=>H-mb-(v/ticks[ticks.length-1])*(H-mt-mb);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="月ごとの掲載件数">`;
  ticks.forEach(t=>{s+=`<line class="gl" x1="${ml}" x2="${W-mr}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${ml-6}" y="${y(t)+4}" text-anchor="end">${t}</text>`;});
  months.forEach((m,i)=>{const v=cnt[m]||0,x=ml+i*bw;
    if(v)s+=`<rect class="b${state.month===m?" on":""}" x="${x+bw*.15}" y="${y(v)}" width="${bw*.7}" height="${H-mb-y(v)}" rx="1.5"/>`;
    if(v)s+=`<text class="cnt" x="${x+bw/2}" y="${y(v)-3}" text-anchor="middle">${v}</text>`;
    const [yy,mm]=m.split("-");
    if(mm==="01"||mm==="07")s+=`<text class="axis" x="${x+bw/2}" y="${H-mb+14}" text-anchor="middle">${mm==="01"?yy+"年":""}${+mm}月</text>`;
    s+=`<rect class="hit" x="${x}" y="${mt}" width="${bw}" height="${H-mt-mb}" data-m="${m}" tabindex="${v?0:-1}" role="button" aria-label="${yy}年${+mm}月 ${v}件"><title>${yy}年${+mm}月：${v}件</title></rect>`;});
  s+=`</svg>`;
  $("timeline").innerHTML=s+((older||nod)?`<p class="hint">グラフ外：${older?`2023年以前 ${older}件`:""}${older&&nod?"、":""}${nod?`報道時期未確認 ${nod}件（期間「すべて」で一覧に表示）`:""}</p>`:"");
  $("timeline").querySelectorAll("rect.hit").forEach(r=>{const f=()=>{const m=r.dataset.m;if(!cnt[m])return;state.month=state.month===m?null:m;state.place=null;render();};
    r.addEventListener("click",f);r.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();f();}});});
}

/* 一覧 */
function render(){
  document.querySelectorAll("[data-period]").forEach(b=>b.setAttribute("aria-pressed",String(!state.month&&+b.dataset.period===state.period)));
  filters.querySelectorAll(".chip").forEach(c=>c.setAttribute("aria-pressed",String(c.dataset.type===state.type)));
  $("reset").hidden=!state.place&&!state.type&&!state.month;
  const pl=state.period===90?"直近3か月":state.period===365?"直近1年":"すべての期間";
  const [my,mm]=state.month?state.month.split("-"):[];
  $("listTitle").textContent=state.place?labelOf(state.place)+"の事件":(areaName()?areaName()+"・":"")+(state.month?`${my}年${+mm}月の事件`:`${pl}の事件`);
  const rows=CASES.filter(c=>state.place?keyOf(c)===state.place&&(!state.type||c.type===state.type):visible(c)).sort((a,b)=>b.d.localeCompare(a.d));
  $("list").innerHTML=rows.length?rows.map(c=>{const t=TYPES[c.type];
    return `<li class="item"><span class="stripe" style="background:${t.color}"></span><div>
      <div class="meta"><span>${esc(c.show)}${ageDays(c)<=90?'<span class="new">直近</span>':""}</span><span class="type" style="color:${t.color}">${t.label}</span>${c.series?`<span class="series">${esc(c.series)}</span>`:""}${c.basis==="headline"?'<span class="hl" title="記事本文を確認できず、報道の見出しで分類した事件">見出しで確認</span>':""}</div>
      <div class="place">${fullName(c.pref)} ${esc(c.city)}</div>
      <p class="desc">${esc(c.desc)}</p>
      <div class="src">出典：<a href="${esc(safeUrl(c.url))}" target="_blank" rel="noopener noreferrer">${esc(c.src)}</a>${c.gone?'<span class="hint">（配信元で記事の掲載が終了）</span>':""}</div>
    </div></li>`;}).join(""):`<li class="empty">この条件に合う事件はまだ掲載していません。期間を「すべて」にすると過去の事件も表示します。</li>`;
  renderMapState();renderTimeline();
}

/* データページ（令和8年版警察白書） */
const WP_CRIME=[["詐欺",3075],["薬物事犯",1887],["窃盗",1020],["風営適正化法違反",393],["強盗",304]];
const WP_AGE=[["14〜19歳",1048],["20〜24歳",1564],["25〜29歳",1247],["30〜34歳",810],["35〜39歳",518],["40〜44歳",484],["45〜49歳",296],["50〜54歳",259],["55〜59歳",194],["60〜64歳",119],["65〜69歳",58],["70歳以上",82]];
const WP_FRAUD=[["2016",407.7],["2017",394.7],["2018",382.9],["2019",315.8],["2020",285.2],["2021",282.0],["2022",370.8],["2023",907.7],["2024",1990.7],["2025",3257.4]];
function hbars(id,rows,hot){const max=Math.max(...rows.map(r=>r[1]));
  $(id).innerHTML=rows.map(([l,v])=>`<div class="hbar"><span>${l}</span><span class="track"><span class="fill${l===hot?" hot":""}" style="display:block;width:${(v/max*100).toFixed(1)}%"></span></span><span class="v">${v.toLocaleString()}人</span></div>`).join("");}
hbars("byCrime",WP_CRIME,"強盗");hbars("byAge",WP_AGE,"20〜24歳");
(function(){const W=720,H=240,ml=48,mr=10,mt=18,mb=28,n=WP_FRAUD.length,bw=(W-ml-mr)/n;
  const ticks=[0,1000,2000,3000,3500];const y=v=>H-mb-v/3500*(H-mt-mb);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="特殊詐欺などの被害額の推移（億円）">`;
  ticks.slice(0,4).forEach(t=>{s+=`<line class="gl" x1="${ml}" x2="${W-mr}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${ml-6}" y="${y(t)+4}" text-anchor="end">${t.toLocaleString()}</text>`;});
  s+=`<text class="axis" x="${ml-6}" y="${mt-6}" text-anchor="end">億円</text>`;
  WP_FRAUD.forEach(([yr,v],i)=>{const x=ml+i*bw;
    s+=`<rect x="${x+bw*.18}" y="${y(v)}" width="${bw*.64}" height="${H-mb-y(v)}" rx="2" fill="${i>=7?"var(--focus)":"var(--bar)"}"><title>${yr}年：${v.toLocaleString()}億円</title></rect>`;
    s+=`<text class="val" x="${x+bw/2}" y="${y(v)-4}" text-anchor="middle">${Math.round(v).toLocaleString()}</text>`;
    s+=`<text class="axis" x="${x+bw/2}" y="${H-mb+16}" text-anchor="middle">${yr}</text>`;});
  $("fraudChart").innerHTML=s+"</svg>";})();
drawMap();renderAlerts();renderLatest();renderNear();render();if(state.home&&zoomHome)zoomHome(true);
