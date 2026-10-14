/* =========================================================
   OnMatKoi ? — application (v1.0)
   Données : API TMDB (films, séries, disponibilités FR via JustWatch)
   ========================================================= */
(function(){
"use strict";
const CFG = window.ONMATKOI_CONFIG || {TMDB_KEY:"",VERSION:"1.0"};
const IMG = "https://image.tmdb.org/t/p/";

/* ---------- petits outils ---------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const store = {
  get(k,d){try{const v=localStorage.getItem("omk_"+k);return v?JSON.parse(v):d}catch(e){return d}},
  set(k,v){try{localStorage.setItem("omk_"+k,JSON.stringify(v))}catch(e){}}
};
const esc = s => String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ic = (id,cls) => `<svg class="${cls||""}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const shuffle = a => {for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const fmt = m => m ? (m>=60 ? Math.floor(m/60)+"h"+String(m%60).padStart(2,"0") : m+" min") : "—";
function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,2800)}
function show(html,after){$("#view").innerHTML=`<div class="screen">${html}</div>`;window.scrollTo(0,0);if(after)after()}
function loading(msg){show(`<div class="loading"><div class="reel"></div><div>${esc(msg||"Je cherche…")}</div></div>`)}

/* ---------- état ---------- */
const S = {
  subs: store.get("subs",{netflix:true,prime:true,disney:false,stremio:true}),
  seen: store.get("seen",[]),
  key: store.get("key","") || CFG.TMDB_KEY || ""
};
let Q; function resetQ(){Q={who:null,age:null,type:null,amb:[],top:false,time:"any",onlySubs:false,incSeen:false,dice:false}}
resetQ();

/* ---------- ambiances → genres TMDB ---------- */
const AMB=[["rire","Rigoler"],["peur","Angoisser"],["polar","Polar / thriller"],["tete","Faire réfléchir"],["action","Action / aventure"],["sf","SF / fantastique"],["love","Feel-good / romance"],["drame","Drame"],["vrai","Histoire vraie"],["docu","Docu"]];
const HUE={rire:["#B8641F","#3A1A08"],peur:["#4A2460","#100818"],polar:["#25466F","#0A1424"],tete:["#1F6A75","#081F24"],action:["#A3311C","#2A0904"],sf:["#4936A8","#0E0A2E"],love:["#A8395F","#2A0A18"],drame:["#6E5236","#1C140C"],vrai:["#7A6A3C","#1E1A0D"],docu:["#2F7048","#0A2014"]};
const G={
  film:{rire:"35",peur:"27|53",polar:"80|53|9648",tete:"9648|878|18",action:"28|12",sf:"878|14",love:"10749|10751",drame:"18",docu:"99"},
  serie:{rire:"35",peur:"9648|10765",polar:"80|9648",tete:"9648|10765|18",action:"10759",sf:"10765",love:"10751|35",drame:"18",docu:"99"}
};
const KW_TRUE_STORY="9672";
const SUB_IDS={netflix:[8,1796],prime:[119,9],disney:[337]};
const MAXCERT={8:0,12:10,15:12};

/* ---------- API TMDB ---------- */
const memo=new Map();
async function api(path,params){
  if(!S.key){const e=new Error("nokey");e.code=401;throw e}
  const u=new URL("https://api.themoviedb.org/3"+path);
  const p=Object.assign({},params||{});
  const v4=S.key.startsWith("eyJ");
  if(!v4)p.api_key=S.key;
  Object.keys(p).forEach(k=>{if(p[k]!==undefined&&p[k]!==null&&p[k]!=="")u.searchParams.set(k,p[k])});
  const url=u.toString();
  if(memo.has(url))return memo.get(url);
  const r=await fetch(url,{headers:v4?{Authorization:"Bearer "+S.key,accept:"application/json"}:{accept:"application/json"}});
  if(r.status===401){const e=new Error("key");e.code=401;throw e}
  if(!r.ok){const e=new Error("http "+r.status);e.code=r.status;throw e}
  const j=await r.json();memo.set(url,j);return j;
}

/* ---------- moteur de recherche ---------- */
let P={film:null,serie:null}, shown=new Set(), pair=[];
const isSeen=k=>S.seen.some(s=>s.key===k);
function norm(r,type){return{key:(type==="film"?"m":"t")+r.id,id:r.id,type,t:r.title||r.name||"Sans titre",y:(r.release_date||r.first_air_date||"").slice(0,4),poster:r.poster_path,backdrop:r.backdrop_path,note:r.vote_average||0,overview:r.overview||""}}
function params(type,page,useUS){
  const kid=Q.who==="enfant", film=type==="film";
  const p={language:"fr-FR",include_adult:"false",page};
  const ambs=Q.dice?[]:Q.amb;
  let g=ambs.map(a=>G[type][a]).filter(Boolean).join("|");
  if(ambs.includes("vrai"))p.with_keywords=KW_TRUE_STORY;
  if(Q.top){p.sort_by="vote_average.desc";p["vote_count.gte"]=film?(kid?800:2500):(kid?200:500);p["vote_average.gte"]=7.6}
  else{p.sort_by="popularity.desc";p["vote_count.gte"]=film?(kid?100:300):(kid?40:100);p["vote_average.gte"]=Q.dice?6.8:(ambs.includes("tete")?7.2:6.4)}
  if(kid){
    if(film){
      if(useUS){p.certification_country="US";p.certification={8:"G|PG",12:"G|PG",15:"G|PG|PG-13"}[Q.age]}
      else{p.certification_country="FR";p.certification={8:"U|TP",12:"U|TP|10",15:"U|TP|10|12"}[Q.age]}
      if(Q.age<=12)p.without_genres="27";
    }else{
      const kg={8:"10762|10751|16",12:"10762|10751|16|35|10759"}[Q.age];
      if(kg)g=g?g+","+kg:kg;
    }
  }
  if(g)p.with_genres=g;
  if(Q.time==="short"){if(film)p["with_runtime.lte"]=110;else{p["with_runtime.lte"]=35;p["with_runtime.gte"]=1}}
  if(Q.onlySubs){
    const ids=Object.keys(SUB_IDS).filter(k=>S.subs[k]).flatMap(k=>SUB_IDS[k]);
    if(ids.length){p.with_watch_providers=ids.join("|");p.watch_region="FR";p.with_watch_monetization_types="flatrate"}
  }
  return p;
}
async function initPool(type){
  const path="/discover/"+(type==="film"?"movie":"tv");
  let useUS=false;
  let first=await api(path,params(type,1,false));
  if(!first.total_results&&Q.who==="enfant"&&type==="film"){useUS=true;first=await api(path,params(type,1,true))}
  const cap=Q.top?20:(Q.dice?15:8);
  const max=Math.max(1,Math.min(first.total_pages||1,cap,500));
  const pages=shuffle(Array.from({length:max},(_,i)=>i+1));
  P[type]={items:[],pages,first,useUS,path};
}
async function loadPage(type){
  const pl=P[type];if(!pl.pages.length)return false;
  const n=pl.pages.shift();
  const data=n===1?pl.first:await api(pl.path,params(type,n,pl.useUS));
  pl.items.push(...shuffle((data.results||[]).map(r=>norm(r,type))));
  return true;
}
async function next(type){
  if(!P[type])await initPool(type);
  const pl=P[type];
  for(let guard=0;guard<60;guard++){
    if(!pl.items.length){const ok=await loadPage(type);if(!ok)return null;continue}
    const x=pl.items.shift();
    if(shown.has(x.key))continue;
    if(!Q.incSeen&&isSeen(x.key))continue;
    try{await details(x)}catch(e){if(e.code===401)throw e;continue}
    if(Q.time==="quick"&&(x.type!=="serie"||!x.sr||x.sr.s>2))continue;
    if(Q.who==="enfant"&&x.age!=null&&x.age>MAXCERT[Q.age])continue;
    shown.add(x.key);return x;
  }
  return null;
}
function certAge(c){if(!c)return null;const s=String(c).trim().toUpperCase();if(["U","TP","TOUS PUBLICS","0","ALL"].includes(s))return 0;const n=parseInt(s,10);return isNaN(n)?null:n}
async function details(x){
  if(x.det)return x;
  const film=x.type==="film";
  const d=await api((film?"/movie/":"/tv/")+x.id,{language:"fr-FR",append_to_response:film?"watch/providers,release_dates,external_ids":"watch/providers,content_ratings,external_ids"});
  x.genres=(d.genres||[]).map(g=>g.name);
  x.overview=d.overview||x.overview;
  x.poster=d.poster_path||x.poster;x.backdrop=d.backdrop_path||x.backdrop;
  x.note=d.vote_average||x.note;
  x.imdb=d.imdb_id||(d.external_ids&&d.external_ids.imdb_id)||null;
  if(film){
    x.d=d.runtime||null;
    const fr=((d.release_dates&&d.release_dates.results)||[]).find(r=>r.iso_3166_1==="FR");
    const c=fr&&(fr.release_dates||[]).map(r=>r.certification).find(Boolean);
    x.age=certAge(c);
  }else{
    const st=d.status==="Ended"?"fin":d.status==="Canceled"?"arret":"cours";
    const epd=(d.episode_run_time&&d.episode_run_time[0])||(d.last_episode_to_air&&d.last_episode_to_air.runtime)||null;
    x.sr={s:d.number_of_seasons||0,ep:d.number_of_episodes||0,epd,first:(d.first_air_date||"").slice(0,4),last:(d.last_air_date||"").slice(0,4),st};
    const fr=((d.content_ratings&&d.content_ratings.results)||[]).find(r=>r.iso_3166_1==="FR");
    x.age=certAge(fr&&fr.rating);
  }
  x.wp=(d["watch/providers"]&&d["watch/providers"].results&&d["watch/providers"].results.FR)||null;
  if(!x.overview){
    try{const en=await api((film?"/movie/":"/tv/")+x.id,{language:"en-US"});if(en.overview){x.overview=en.overview;x.ovEn=true}}catch(e){}
  }
  x.det=true;return x;
}

/* ---------- affichage commun ---------- */
const prog=n=>{const tot=Q.who==="enfant"?5:4;return `<div class="progress">${Array.from({length:tot},(_,i)=>`<i class="${i<n?"on":""}"></i>`).join("")}</div>`};
const opt=(v,i,t,s)=>`<button class="opt" data-v="${v}">${ic(i)}<span><strong>${t}</strong>${s?`<small>${s}</small>`:""}</span>${ic("chev","chev")}</button>`;
const bind=fn=>$$("#view [data-v]").forEach(b=>b.onclick=()=>fn(b.dataset.v));
const back=(id,label)=>`<button class="backlink" id="${id}">${ic("back")}${label||"Retour"}</button>`;
const typeTag=x=>x.type==="film"?`<span class="tag t-film">${ic("film")}Film</span>`:`<span class="tag t-serie">${ic("tv")}Série</span>`;
const ageLabel=a=>a==null?"":a===0?"Tous publics":`Dès ${a} ans`;
function poster(x){
  return x.poster
    ?`<div class="poster"><img src="${IMG}w500${x.poster}" alt="Affiche de ${esc(x.t)}" loading="lazy">${typeTag(x)}</div>`
    :`<div class="poster noimg" style="background:linear-gradient(165deg,#3a3a42,#121216)">${typeTag(x)}<b class="cond">${esc(x.t)}</b></div>`;
}
function recap(){const p=[];
  if(Q.dice)return `<span class="chipr">Au hasard</span>`;
  if(Q.who)p.push({moi:"Moi",nous:"Nous deux",enfant:"Enfant "+({8:"6-9",12:"10-12",15:"13-15"}[Q.age]||"")+" ans"}[Q.who]);
  if(Q.type)p.push({film:"Film",serie:"Série",both:"Film + série"}[Q.type]);
  p.push(Q.amb.length?Q.amb.map(a=>AMB.find(x=>x[0]===a)[1]).join(", "):"Toutes ambiances");
  if(Q.top)p.push("Incontournables");
  if(Q.time==="short")p.push("Court");if(Q.time==="quick")p.push("Vite finie");
  if(Q.onlySubs)p.push("Mes abonnements");
  return p.map(x=>`<span class="chipr">${esc(x)}</span>`).join("")}
function handleErr(e){
  if(e&&e.code===401){keyScreen(S.key?"La clé TMDB a été refusée. Vérifie-la puis recolle-la.":null);return}
  show(`<h2 class="q cond">Oups</h2><div class="empty">Impossible de joindre TMDB. Vérifie la connexion internet, puis réessaie.</div>
    <div style="display:grid;gap:10px;margin-top:18px"><button class="btn primary" id="retry">${ic("redo")}Réessayer</button><button class="textlink" id="hm">Accueil</button></div>`,
    ()=>{$("#retry").onclick=()=>run(true);$("#hm").onclick=home});
}

/* ---------- écran clé manquante ---------- */
function keyScreen(msg){
  show(`<h2 class="q cond">Il manque la clé TMDB</h2>
    <p class="sub">${esc(msg||"L'appli a besoin d'une clé gratuite TMDB pour trouver les films et séries. Le plus simple : la coller une fois dans le fichier config.js sur GitHub (voir le LISEZMOI). Sinon, colle-la ici.")}</p>
    <input class="field" id="k1" placeholder="Clé d'API ou jeton de lecture" autocomplete="off" autocapitalize="off" spellcheck="false">
    <div style="display:grid;gap:10px;margin-top:14px"><button class="btn primary" id="k1s">Enregistrer la clé</button>
    <a class="textlink" href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">Obtenir une clé sur themoviedb.org</a></div>`,
    ()=>{$("#k1s").onclick=async()=>{const v=$("#k1").value.trim();if(!v)return;await setKey(v);if(S.key)home()}});
}
async function setKey(v){
  const old=S.key;S.key=v;memo.clear();
  try{await api("/configuration");store.set("key",v);toast("Clé enregistrée");renderKeyState()}
  catch(e){S.key=old;toast(e.code===401?"Clé refusée par TMDB":"Pas de connexion, réessaie")}
}

/* ---------- accueil ---------- */
let trending=null;
async function loadTrending(){
  if(trending||!S.key)return;
  try{const d=await api("/trending/all/week",{language:"fr-FR"});trending=(d.results||[]).filter(r=>r.poster_path).slice(0,12)}catch(e){}
  paintStrip();
}
function paintStrip(){const s=$("#strip");if(!s||!trending)return;const pick=shuffle(trending.slice()).slice(0,4);
  s.innerHTML=pick.map(r=>`<div style="background-image:url(${IMG}w185${r.poster_path})"></div>`).join("")}
function home(){
  resetQ();
  if(!S.key){keyScreen();return}
  show(`<div class="homehero bleed">
      <div class="eyebrow" style="color:var(--gold)">Ce soir</div>
      <h1 class="cond">Y'a quoi<br><span>ce soir ?</span></h1>
      <p class="sub" style="margin:0">Trois questions, et je te trouve un film ou une série.</p>
      <div class="strip" id="strip" aria-hidden="true"><div></div><div></div><div></div><div></div></div>
    </div>
    <div style="display:grid;gap:10px;margin-top:18px">
      <button class="btn primary" id="start">${ic("play")}Commencer</button>
      <div class="row2"><button class="btn outline" id="dice">${ic("dice")}Au hasard</button><button class="btn outline" id="topgo">${ic("star")}Incontournable</button></div>
      <button class="textlink" id="det">${ic("search")}J'ai déjà une idée : recherche détaillée</button>
      <button class="textlink" id="homeInstall" hidden>${ic("dl")}Installer l'appli sur ce téléphone</button>
    </div>`,()=>{
    $("#start").onclick=qWho;
    $("#dice").onclick=e=>{e.currentTarget.classList.add("rolling");Q.type="both";Q.dice=true;setTimeout(()=>run(true),500)};
    $("#topgo").onclick=()=>{Q.type="both";Q.top=true;run(true)};
    $("#det").onclick=detailed;
    if(deferredPrompt){$("#homeInstall").hidden=false;$("#homeInstall").onclick=doInstall}
    paintStrip();loadTrending();
  });
}

/* ---------- questions ---------- */
function qWho(){show(`${prog(1)}<h2 class="q cond">Qui regarde ?</h2><p class="sub">Pas de profil, juste pour viser juste.</p>
  <div class="list">${opt("moi","me","Moi tout seul","Tranquille sur le canapé")}${opt("nous","us","Nous deux","Soirée en couple")}${opt("enfant","kid","Avec un enfant","Je demande son âge juste après")}</div>
  <div class="spacer"></div>${back("bk","Accueil")}`,()=>{bind(v=>{Q.who=v;v==="enfant"?qAge():qType()});$("#bk").onclick=home})}
function qAge(){show(`${prog(2)}<h2 class="q cond">Quel âge ?</h2><p class="sub">Je ne proposerai que des titres adaptés.</p>
  <div class="list">${opt("8","age","6 à 9 ans","Tous publics")}${opt("12","age","10 à 12 ans","Tous publics et « dès 10 ans »")}${opt("15","age","13 à 15 ans","Jusqu'à « dès 12 ans »")}</div>
  <div class="spacer"></div>${back("bk")}`,()=>{bind(v=>{Q.age=+v;qType()});$("#bk").onclick=qWho})}
function qType(){show(`${prog(Q.who==="enfant"?3:2)}<h2 class="q cond">Film ou série ?</h2><p class="sub">Indécis ? Je te propose un de chaque.</p>
  <div class="list">${opt("film","film","Un film","Une histoire, une soirée")}${opt("serie","tv","Une série","On s'installe pour plusieurs soirs")}${opt("both","both","Les deux","Un film et une série, tu choisis")}</div>
  <div class="spacer"></div>${back("bk")}`,()=>{bind(v=>{Q.type=v;qAmb()});$("#bk").onclick=()=>Q.who==="enfant"?qAge():qWho()})}
function qAmb(){show(`${prog(Q.who==="enfant"?4:3)}<h2 class="q cond">Quelle ambiance ?</h2><p class="sub">Une touche suffit.</p>
  <div class="tiles">${AMB.map(([k,l])=>`<button class="tile" data-v="${k}" style="background:linear-gradient(135deg,${HUE[k][0]},${HUE[k][1]})"><span class="cond">${l}</span></button>`).join("")}
  <button class="tile surprise" data-v="surprise"><span class="cond">Surprends-moi</span></button></div>
  ${back("bk")}`,()=>{bind(v=>{Q.amb=v==="surprise"?[]:[v];qReady()});$("#bk").onclick=qType})}
function qReady(){show(`${prog(Q.who==="enfant"?5:4)}<h2 class="q cond">C'est noté.</h2>
  <div class="recap">${recap()}</div>
  <p class="sub" style="margin-top:10px">On lance tel quel, ou on affine en deux secondes ?</p>
  <div class="toggle"><label for="t_top"><strong>Que des incontournables</strong><small>Les titres cultes, très bien notés par énormément de monde</small></label><input type="checkbox" class="switch" id="t_top"></div>
  <div style="display:grid;gap:10px;margin-top:18px"><button class="btn primary" id="go">${ic("play")}Voir mes propositions</button><button class="btn outline" id="aff">${ic("set")}Affiner</button></div>
  <div class="spacer"></div>${back("bk")}`,()=>{
  $("#t_top").checked=Q.top;$("#t_top").onchange=e=>Q.top=e.target.checked;
  $("#go").onclick=()=>run(true);$("#aff").onclick=qAffine;$("#bk").onclick=qAmb})}
function qAffine(){show(`<h2 class="q cond">On affine</h2><p class="sub">Tout est facultatif.</p>
  <div class="eyebrow" style="margin-bottom:8px">Temps dispo ce soir</div>
  <div class="seg" id="tm"><button data-t="any">Peu importe</button><button data-t="short">Court</button><button data-t="quick">Vite finie</button></div>
  <div class="hint">Court : film de moins de 1h50, ou épisodes de moins de 35 min. Vite finie : série de 2 saisons max.</div>
  <div style="display:grid;gap:10px;margin-top:16px">
    <div class="toggle"><label for="t_subs"><strong>Seulement mes abonnements</strong><small>Inclus, sans location</small></label><input type="checkbox" class="switch" id="t_subs"></div>
    <div class="toggle"><label for="t_seen"><strong>Inclure les déjà regardés</strong><small>Pour revoir un bon souvenir</small></label><input type="checkbox" class="switch" id="t_seen"></div>
  </div>
  <div style="margin-top:18px"><button class="btn primary" id="go">${ic("play")}Voir mes propositions</button></div>
  <div class="spacer"></div>${back("bk")}`,()=>{
  const up=()=>$$("#tm button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.t===Q.time));
  $$("#tm button").forEach(b=>b.onclick=()=>{Q.time=b.dataset.t;if(Q.time==="quick"&&Q.type==="film")toast("« Vite finie » ne concerne que les séries");up()});up();
  $("#t_subs").checked=Q.onlySubs;$("#t_subs").onchange=e=>Q.onlySubs=e.target.checked;
  $("#t_seen").checked=Q.incSeen;$("#t_seen").onchange=e=>Q.incSeen=e.target.checked;
  $("#go").onclick=()=>run(true);$("#bk").onclick=qReady})}

/* ---------- propositions ---------- */
async function run(fresh){
  if(fresh){P={film:null,serie:null};shown=new Set()}
  if(Q.time==="quick"&&Q.type==="both")Q.type="serie";
  loading(Q.dice?"Je lance le dé…":"Je cherche…");
  try{
    let a,b;
    if(Q.type==="both"){[a,b]=await Promise.all([next("film"),next("serie")])}
    else{const t=Q.type==="film"||Q.type==="serie"?Q.type:"film";a=await next(t);b=await next(t)}
    pair=[a,b].filter(Boolean);
    propositions();
  }catch(e){handleErr(e)}
}
function propositions(){
  if(!pair.length){show(`<h2 class="q cond">Rien ne colle</h2><div class="empty">Plus rien ne correspond. Essaie une autre ambiance, retire « incontournables » ou un filtre, ou inclus les déjà regardés.</div>
    <div style="display:grid;gap:10px;margin-top:18px"><button class="btn primary" id="re">Recommencer</button><button class="textlink" id="det">${ic("search")}Recherche détaillée</button></div>`,()=>{$("#re").onclick=qWho;$("#det").onclick=detailed});return}
  const who=Q.dice?"Le dé a parlé":Q.who==="nous"?"Pour vous deux":Q.who==="enfant"?"En famille":"Rien que pour toi";
  show(`<div class="eyebrow" style="color:var(--gold);margin-top:14px">${who}</div>
    <h2 class="q cond" style="margin-top:6px">${pair.length>1?"Deux idées pour ce soir":"Une idée pour ce soir"}</h2>
    <div class="recap">${recap()}</div>
    <div class="${pair.length>1?"pair":"single"}">${pair.map((x,i)=>`<button class="pick" data-i="${i}">${poster(x)}<span class="ln"><strong>${esc(x.t)}</strong><span class="r">★ ${x.note.toFixed(1)}</span> · ${x.type==="film"?(x.y||"")+" · "+fmt(x.d):x.sr.s+" saison"+(x.sr.s>1?"s":"")+" · "+x.sr.ep+" ép."}</span></button>`).join("")}</div>
    <div style="display:grid;gap:10px;margin-top:22px"><button class="btn outline" id="again">${ic("redo")}Autres propositions</button>
    <div class="row2"><button class="textlink" id="restart">${ic("back")}Changer mes réponses</button><button class="textlink" id="det">${ic("search")}Recherche détaillée</button></div></div>`,()=>{
    $$(".pick").forEach(b=>b.onclick=()=>fiche(pair[+b.dataset.i]));
    $("#again").onclick=()=>run(false);$("#restart").onclick=qWho;$("#det").onclick=detailed});
}

/* ---------- fiche ---------- */
function provLink(pid,x){
  const q=encodeURIComponent(x.t);
  if(pid===8||pid===1796)return "https://www.netflix.com/search?q="+q;
  if(pid===119||pid===9)return "https://www.primevideo.com/search?phrase="+q;
  return (x.wp&&x.wp.link)||"https://www.themoviedb.org/"+(x.type==="film"?"movie/":"tv/")+x.id+"/watch?locale=FR";
}
const mine=pid=>Object.keys(SUB_IDS).some(k=>S.subs[k]&&SUB_IDS[k].includes(pid));
function provHTML(x){
  const wp=x.wp||{};
  const flat=(wp.flatrate||[]).slice().sort((a,b)=>(mine(b.provider_id)?1:0)-(mine(a.provider_id)?1:0)).slice(0,5);
  const seenIds=new Set(flat.map(p=>p.provider_id));
  const rent=[];((wp.rent||[]).concat(wp.buy||[])).forEach(p=>{if(!seenIds.has(p.provider_id)&&!rent.some(r=>r.provider_id===p.provider_id))rent.push(p)});
  let h="";
  if(flat.length)h+=`<div class="prov">${flat.map(p=>`<a class="pv${mine(p.provider_id)?" mine":""}" href="${esc(provLink(p.provider_id,x))}" target="_blank" rel="noopener">${p.logo_path?`<img src="${IMG}w92${p.logo_path}" alt="">`:""}${esc(p.provider_name)} <em class="in">· inclus</em></a>`).join("")}</div>`;
  if(rent.length)h+=`<p class="hint" style="margin-top:${flat.length?10:0}px">Location ou achat : ${rent.slice(0,4).map(p=>esc(p.provider_name)).join(", ")}${wp.link?` · <a href="${esc(wp.link)}" target="_blank" rel="noopener" style="color:var(--gold)">voir les offres</a>`:""}</p>`;
  if(!flat.length&&!rent.length)h+=`<p class="hint" style="margin:0">Pas de plateforme française connue pour ce titre.</p>`;
  if(S.subs.stremio&&x.imdb)h+=`<div class="prov" style="margin-top:10px"><a class="pv" href="stremio:///detail/${x.type==="film"?"movie":"series"}/${esc(x.imdb)}">${ic("play")} Ouvrir dans Stremio</a></div>`;
  return h;
}
function fiche(x){
  const s=x.sr;
  const st=s?(s.st==="fin"?'<span class="tag t-ok">Terminée</span>':s.st==="arret"?'<span class="tag t-stop">Arrêtée</span>':'<span class="tag t-on">En cours</span>'):"";
  const meta=x.type==="film"
    ?[x.y,fmt(x.d),ageLabel(x.age)].filter(Boolean)
    :[`${s.first||x.y} – ${s.st==="cours"?"…":(s.last||"")}`,`${s.s} saison${s.s>1?"s":""}`,`${s.ep} ép.`,s.epd?`≈ ${s.epd} min`:""].filter(Boolean);
  const facts=x.type==="film"
    ?`<div class="fact"><span>Durée</span><strong>${fmt(x.d)}</strong></div><div class="fact"><span>Sortie</span><strong>${esc(x.y||"—")}</strong></div>`
    :`<div class="fact"><span>Saisons</span><strong>${s.s}</strong></div><div class="fact"><span>Épisodes</span><strong>${s.ep}</strong></div><div class="fact"><span>Par épisode</span><strong>${s.epd?"≈ "+s.epd+" min":"—"}</strong></div><div class="fact"><span>Diffusion</span><strong>${esc(s.first||"?")} → ${s.st==="cours"?"en cours":esc(s.last||"?")}</strong></div>`;
  const bg=x.backdrop?`${IMG}w1280${x.backdrop}`:(x.poster?`${IMG}w780${x.poster}`:"");
  const seen=isSeen(x.key);
  show(`<div class="hero bleed" style="${bg?`background-image:url(${bg})`:""}">
      <div style="display:flex;gap:8px;flex-wrap:wrap">${typeTag(x)}${st}${Q.top?'<span class="tag t-soft">Incontournable</span>':""}${seen?'<span class="tag t-soft">Déjà vu</span>':""}</div>
      <h1 class="cond">${esc(x.t)}</h1>
      <div class="metaline"><span class="r">★ ${x.note.toFixed(1)}</span>${meta.map(m=>`<span>${esc(m)}</span>`).join("<span>·</span>")}</div>
    </div>
    <div class="body">
      <div style="display:flex;gap:10px"><button class="btn primary" id="watch">${ic("play")}On regarde ça</button><button class="btn outline square" id="other" aria-label="Autres propositions">${ic("redo")}</button></div>
      <p class="syn">${esc(x.overview||"Pas de résumé disponible.")}${x.ovEn?' <span class="small">(résumé en anglais)</span>':""}</p>
      <div class="facts">${facts}</div>
      <div><div class="eyebrow" style="margin-bottom:10px">Disponible sur</div>${provHTML(x)}</div>
      ${x.genres&&x.genres.length?`<div><div class="eyebrow" style="margin-bottom:10px">Genres</div><div class="recap">${x.genres.map(g=>`<span class="chipr">${esc(g)}</span>`).join("")}${x.age!=null?`<span class="chipr">${ageLabel(x.age)}</span>`:""}</div></div>`:""}
      ${back("bk","Retour aux propositions")}
    </div>`,()=>{
    $("#bk").onclick=propositions;
    $("#other").onclick=()=>run(false);
    $("#watch").onclick=()=>{
      if(!seen){S.seen.unshift({key:x.key,t:x.t,type:x.type,poster:x.poster,d:new Date().toLocaleDateString("fr-FR")});S.seen=S.seen.slice(0,300);store.set("seen",S.seen)}
      toast("Bon visionnage. Ajouté aux déjà regardés");setTimeout(home,1500)};
  });
}

/* ---------- recherche détaillée ---------- */
function detailed(){
  const keep=Q.who?Object.assign({},Q):null;resetQ();if(keep)Object.assign(Q,keep,{dice:false});
  if(!Q.who)Q.who="nous";if(!Q.type)Q.type="both";
  show(`<h2 class="q cond">Recherche détaillée</h2><p class="sub">Tout sur une page, pour aller droit au but.</p>
  <div class="eyebrow" style="margin-bottom:8px">Qui regarde</div>
  <div class="seg" id="d_who"><button data-s="moi">Moi</button><button data-s="nous">Nous</button><button data-s="enfant">Enfant</button></div>
  <div id="ageRow" hidden><div class="eyebrow lbl">Âge de l'enfant</div><div class="seg" id="d_age"><button data-s="8">6-9 ans</button><button data-s="12">10-12 ans</button><button data-s="15">13-15 ans</button></div></div>
  <div class="eyebrow lbl">Film ou série</div>
  <div class="seg" id="d_type"><button data-s="film">Film</button><button data-s="serie">Série</button><button data-s="both">Les deux</button></div>
  <div class="eyebrow lbl">Ambiances (plusieurs possibles)</div>
  <div class="chips" id="d_amb">${AMB.map(([k,l])=>`<button class="chip" data-a="${k}">${l}</button>`).join("")}</div>
  <div class="eyebrow lbl">Temps dispo</div>
  <div class="seg" id="d_time"><button data-s="any">Peu importe</button><button data-s="short">Court</button><button data-s="quick">Vite finie</button></div>
  <div style="display:grid;gap:10px;margin-top:16px">
    <div class="toggle"><label for="d_top"><strong>Que des incontournables</strong></label><input type="checkbox" class="switch" id="d_top"></div>
    <div class="toggle"><label for="d_subs"><strong>Seulement mes abonnements</strong></label><input type="checkbox" class="switch" id="d_subs"></div>
    <div class="toggle"><label for="d_seen"><strong>Inclure les déjà regardés</strong></label><input type="checkbox" class="switch" id="d_seen"></div>
  </div>
  <div style="display:grid;gap:6px;margin-top:18px"><button class="btn primary" id="go">${ic("search")}Trouver</button><button class="textlink" id="fun">${ic("play")}Revenir aux questions</button></div>`,()=>{
  let upAge=()=>{};
  const seg=(id,key,num)=>{const up=()=>$$(`#${id} button`).forEach(b=>b.setAttribute("aria-pressed",String(num?+b.dataset.s===Q[key]:b.dataset.s===Q[key])));
    $$(`#${id} button`).forEach(b=>b.onclick=()=>{Q[key]=num?+b.dataset.s:b.dataset.s;up();if(key==="who"){$("#ageRow").hidden=Q.who!=="enfant";if(Q.who==="enfant"&&!Q.age){Q.age=12;upAge()}}});up();return up};
  seg("d_who","who");upAge=seg("d_age","age",true);seg("d_type","type");seg("d_time","time");
  $("#ageRow").hidden=Q.who!=="enfant";
  $$("#d_amb .chip").forEach(b=>{b.setAttribute("aria-pressed",Q.amb.includes(b.dataset.a));b.onclick=()=>{const k=b.dataset.a;Q.amb=Q.amb.includes(k)?Q.amb.filter(a=>a!==k):Q.amb.concat(k);b.setAttribute("aria-pressed",Q.amb.includes(k))}});
  [["d_top","top"],["d_subs","onlySubs"],["d_seen","incSeen"]].forEach(([id,k])=>{$("#"+id).checked=Q[k];$("#"+id).onchange=e=>Q[k]=e.target.checked});
  $("#go").onclick=()=>run(true);$("#fun").onclick=qWho});
}

/* ---------- réglages ---------- */
function renderHist(){
  const h=$("#hist");
  h.innerHTML=S.seen.length?"":'<p class="hint" style="margin:0">Rien pour l\'instant. « On regarde ça » remplit la liste.</p>';
  S.seen.forEach((v,i)=>{const d=document.createElement("div");
    d.innerHTML=`${v.poster?`<img src="${IMG}w92${v.poster}" alt="">`:"<img alt=\"\">"}<span><strong>${esc(v.t)}</strong><br><small>${v.type==="film"?"Film":"Série"} · ${esc(v.d)}</small></span><button class="x">Retirer</button>`;
    d.querySelector("button").onclick=()=>{S.seen.splice(i,1);store.set("seen",S.seen);renderHist()};h.append(d)});
}
function renderKeyState(){
  const local=store.get("key","");
  $("#keyState").textContent=local?"Clé enregistrée sur ce téléphone.":(CFG.TMDB_KEY?"Clé fournie par le fichier config.js.":"Aucune clé pour l'instant.");
}
["netflix","prime","disney","stremio"].forEach(p=>{const el=$("#s_"+p);el.checked=!!S.subs[p];el.onchange=()=>{S.subs[p]=el.checked;store.set("subs",S.subs)}});
$("#openSet").onclick=()=>{renderHist();renderKeyState();$("#sheet").hidden=false};
$("#closeSet").onclick=()=>$("#sheet").hidden=true;
$("#sheet").onclick=e=>{if(e.target.id==="sheet")$("#sheet").hidden=true};
$("#homeBtn").onclick=home;
$("#detailBtn").onclick=()=>{if(!S.key)keyScreen();else detailed()};
$("#replay").onclick=()=>{$("#sheet").hidden=true;intro()};
$("#saveKey").onclick=async()=>{const v=$("#tmdbKey").value.trim();if(!v)return;await setKey(v);$("#tmdbKey").value=""};
$("#clearKey").onclick=()=>{store.set("key","");S.key=CFG.TMDB_KEY||"";memo.clear();renderKeyState();toast("Clé du téléphone effacée")};
$("#ver").textContent=CFG.VERSION||"1.0";

/* ---------- thème ---------- */
function applySkin(s){
  document.documentElement.setAttribute("data-skin",s);store.set("skin",s);
  $$("#skins .skin").forEach(b=>b.setAttribute("aria-pressed",b.dataset.skin===s));
  const tc={obscure:"#0B0B0D",fun:"#17143A",lumiere:"#ECEEF2"}[s];
  const m=document.querySelector('meta[name="theme-color"]');if(m&&tc)m.setAttribute("content",tc);
}
$$("#skins .skin").forEach(b=>b.onclick=()=>applySkin(b.dataset.skin));
applySkin(store.get("skin","obscure"));

/* ---------- installation ---------- */
let deferredPrompt=null;
const standalone=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("#installBox").hidden=false;const h=$("#homeInstall");if(h){h.hidden=false;h.onclick=doInstall}});
async function doInstall(){if(!deferredPrompt)return;deferredPrompt.prompt();try{await deferredPrompt.userChoice}catch(e){}deferredPrompt=null;$("#installBox").hidden=true;const h=$("#homeInstall");if(h)h.hidden=true}
$("#installBtn").onclick=doInstall;
if(!standalone&&/iphone|ipad|ipod/i.test(navigator.userAgent))$("#iosBox").hidden=false;

/* ---------- intro ---------- */
let T=[];
function intro(){
  T.forEach(clearTimeout);T=[];const el=$("#intro");el.hidden=false;el.style.opacity=1;
  const w=$("#word");w.style.animation="none";void w.offsetWidth;w.style.animation="";
  const bar=document.querySelector(".ilogo .bar");bar.style.animation="none";void bar.offsetWidth;bar.style.animation="";
  $("#typed").textContent="";const txt="Bon… y'a quoi ce soir ?";let i=0;
  const ty=()=>{$("#typed").textContent=txt.slice(0,++i);if(i<txt.length)T.push(setTimeout(ty,42))};
  T.push(setTimeout(ty,1500));T.push(setTimeout(endIntro,3700));
}
function endIntro(){T.forEach(clearTimeout);const el=$("#intro");el.style.transition="opacity .5s";el.style.opacity=0;setTimeout(()=>{el.hidden=true;el.style.transition=""},500)}
$("#intro").onclick=endIntro;

home();intro();
})();
