// ==UserScript==
// @name         Campaign Update Search
// @namespace    https://shacaska.github.io/campaign-search/
// @version      2026.11.20
// @description  Adds a "Search updates" button to Kickstarter and Gamefound campaign pages that searches the full text of every update.
// @match        https://www.kickstarter.com/projects/*
// @match        https://gamefound.com/*
// @grant        none
// @run-at       document-idle
// @downloadURL  https://shacaska.github.io/campaign-search/campaign-search.user.js
// @updateURL    https://shacaska.github.io/campaign-search/campaign-search.user.js
// ==/UserScript==
(()=>{var T=/^[a-z0-9][a-z0-9_.-]{0,160}$/i;function E(e){if(!e)return null;let t=String(e).trim();/^https?:\/\//i.test(t)||(t="https://"+t);let n;try{n=new URL(t)}catch{return null}let o=n.hostname.toLowerCase().replace(/^www\./,""),a=n.pathname.split("/").filter(Boolean).map(decodeURIComponent);if(o==="kickstarter.com"){if(a[0]!=="projects"||a.length<3)return null;let r=a[1].toLowerCase(),s=a[2].toLowerCase();return!T.test(r)||!T.test(s)?null:{platform:"kickstarter",creator:r,slug:s,id:`kickstarter/${r}/${s}`,url:`https://www.kickstarter.com/projects/${r}/${s}`}}if(o==="gamefound.com"){let r=a.indexOf("projects");if(r<0||r>1||a.length<r+3)return null;let s=a[r+1].toLowerCase(),l=a[r+2].toLowerCase();return!T.test(s)||!T.test(l)?null:{platform:"gamefound",creator:s,slug:l,id:`gamefound/${s}/${l}`,url:`https://gamefound.com/en/projects/${s}/${l}`}}return null}var P={kickstarter:"Kickstarter",gamefound:"Gamefound"};function L(e){let t="",n=[];for(let o=0;o<e.length;o++){let a=e[o],r=a.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();r.length!==1&&(r=r.length?r[0]:a),r==="\u2019"||r==="\u2018"?r="'":r==="\u201C"||r==="\u201D"?r='"':(r==="\u2013"||r==="\u2014")&&(r="-"),t+=r,n.push(o)}return{text:t,map:n}}function Y(e){return L(e).text}function W(e){let t=[],n=[],o=/(-?)"([^"]+)"|(-?)(\S+)/g,a;for(;a=o.exec(e||"");){let r=a[1]||a[3],s=(a[2]??a[4]??"").trim();if(!s||r&&!s)continue;let l=Y(s);l.length<2&&!a[2]||(r?n:t).push(l)}return{terms:[...new Set(t)],exclude:[...new Set(n)]}}function M(e,t){let n=[];if(!t)return n;let o=e.indexOf(t);for(;o!==-1;)n.push(o),o=e.indexOf(t,o+t.length);return n}function A(e){return e.map(t=>({u:t,title:L(t.title||""),body:L(t.text||"")}))}function R(e,t,n="all"){let o=W(t),{terms:a,exclude:r}=o;if(!a.length)return{results:[],totalMentions:0,parsed:o};let s=[],l=0;for(let f of e){if(r.some(i=>f.body.text.includes(i)||f.title.text.includes(i)))continue;let g=a.map(i=>({t:i,title:M(f.title.text,i),body:M(f.body.text,i)})),m=g.filter(i=>i.title.length||i.body.length).length;if(n==="all"?m<a.length:m===0)continue;let b=[],S=[],d=0;for(let i of g){d+=i.title.length+i.body.length;for(let x of i.body)b.push(_(f.body,x,i.t.length));for(let x of i.title)S.push(_(f.title,x,i.t.length))}l+=d,b.sort((i,x)=>i[0]-x[0]),S.sort((i,x)=>i[0]-x[0]);let w=d+(S.length?25:0)+m*5;s.push({update:f.u,mentions:d,ranges:z(b),titleRanges:z(S),score:w})}return{results:s,totalMentions:l,parsed:o}}function _(e,t,n){let o=e.map[t],a=e.map[t+n-1]+1;return[o,a]}function z(e){let t=[];for(let n of e){let o=t[t.length-1];o&&n[0]<=o[1]?o[1]=Math.max(o[1],n[1]):t.push([n[0],n[1]])}return t}function C(e){return String(e).replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function O(e,t,n=0,o=e.length){let a="",r=n;for(let[s,l]of t){if(l<=n||s>=o)continue;let f=Math.max(s,n),g=Math.min(l,o);a+=C(e.slice(r,f))+"<mark>"+C(e.slice(f,g))+"</mark>",r=g}return a+C(e.slice(r,o))}function U(e,t,n=110){let o=[];for(let[a,r]of t){let s=Math.max(0,a-n),l=Math.min(e.length,r+n),f=e.lastIndexOf(`

`,a);f>=s&&(s=f+2);let g=e.indexOf(`

`,r);if(g!==-1&&g<l&&(l=g),s>0&&e[s-1]!==`
`){let b=e.indexOf(" ",s);b!==-1&&b<a&&(s=b+1)}if(l<e.length&&e[l]!==`
`){let b=e.lastIndexOf(" ",l);b>r&&(l=b)}let m=o[o.length-1];m&&s<=m.b+20?m.b=Math.max(m.b,l):o.push({a:s,b:l})}return o.map(({a,b:r})=>({start:a,end:r,html:(a>0&&e[a-1]!==`
`?"\u2026":"")+O(e,t,a,r).replace(/\n+/g," \u23CE ")+(r<e.length&&e[r]!==`
`?"\u2026":"")}))}var Z={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" ",ndash:"\u2013",mdash:"\u2014",hellip:"\u2026",lsquo:"\u2018",rsquo:"\u2019",ldquo:"\u201C",rdquo:"\u201D",bull:"\u2022",middot:"\xB7",copy:"\xA9",reg:"\xAE",trade:"\u2122",times:"\xD7",eacute:"\xE9",egrave:"\xE8",aacute:"\xE1",oacute:"\xF3",uacute:"\xFA",iacute:"\xED",ouml:"\xF6",uuml:"\xFC",auml:"\xE4",szlig:"\xDF",laquo:"\xAB",raquo:"\xBB",deg:"\xB0",euro:"\u20AC",pound:"\xA3",frac12:"\xBD",rarr:"\u2192",larr:"\u2190"};function tt(e){return e.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi,(t,n)=>{if(n[0]==="#"){let a=n[1]==="x"||n[1]==="X"?parseInt(n.slice(2),16):parseInt(n.slice(1),10);try{return String.fromCodePoint(a)}catch{return t}}let o=Z[n.toLowerCase()];return o===void 0?t:o})}function q(e){if(!e)return"";let t=String(e);return t=t.replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi," "),t=t.replace(/<!--[\s\S]*?-->/g," "),t=t.replace(/<br\s*\/?>/gi,`
`),t=t.replace(/<li\b[^>]*>/gi,`
\u2022 `),t=t.replace(/<\/(p|div|h[1-6]|li|ul|ol|blockquote|figure|figcaption|tr|table|section|article|header|footer|pre)>/gi,`

`),t=t.replace(/<(h[1-6]|p|div|blockquote|figure|table|ul|ol)\b[^>]*>/gi,`
`),t=t.replace(/<\/t[dh]>/gi,"	"),t=t.replace(/<img\b[^>]*?\balt\s*=\s*"([^"]{2,})"[^>]*>/gi,(n,o)=>` [image: ${o}] `),t=t.replace(/<[^>]+>/g,""),t=tt(t),t=t.replace(/\r/g,"").replace(/[ \t\u00a0\u200b]+/g," ").replace(/ *\n */g,`
`).replace(/\n{3,}/g,`

`).trim(),t}var et=["__typename id title number publishedAt isPublic isVisible ... on FreeformPost { body }","__typename id title publishedAt isPublic ... on FreeformPost { body }","__typename id title publishedAt ... on FreeformPost { body }"],nt=e=>`query CampaignPosts($slug: String!, $cursor: String) {
  project(slug: $slug) {
    id name url
    posts(first: 25, after: $cursor) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes { ${e} }
    }
  }
}`;function ot(e){return typeof atob=="function"?atob(e):Buffer.from(e,"base64").toString("utf8")}function rt(e){try{let t=ot(e).match(/-(\d+)$/);if(t)return t[1]}catch{}return/^\d+$/.test(String(e))?String(e):null}function D(e){if(e==null)return null;if(typeof e=="number")return new Date(e<1e12?e*1e3:e).toISOString();if(/^\d+$/.test(e))return D(Number(e));let t=new Date(e);return isNaN(t)?null:t.toISOString()}async function H(e,t,n={}){let{onProgress:o=()=>{},delayMs:a=250,maxPosts:r=2e3}=n,s=[e.slug,`${e.creator}/${e.slug}`],l;for(let f of et)for(let g of s)try{return await at(e,t,nt(f),g,{onProgress:o,delayMs:a,maxPosts:r})}catch(m){if(l=m,m.fatal)throw m;if(m.graphql)break}throw l}async function at(e,t,n,o,{onProgress:a,delayMs:r,maxPosts:s}){let l=[],f=null,g=null,m=null;for(let d=0;d<200;d++){let w=await t({query:n,variables:{slug:o,cursor:f}});if(w?.errors?.length){let c=new Error("Kickstarter GraphQL error: "+w.errors.map(p=>p.message).join("; "));throw c.graphql=w.errors,c}let i=w?.data?.project;if(!i)throw new Error(`Kickstarter has no project for slug "${o}"`);g=i,m=i.posts?.totalCount??m,l.push(...(i.posts?.nodes||[]).filter(Boolean)),a(l.length,m);let x=i.posts?.pageInfo;if(!x?.hasNextPage||l.length>=s)break;f=x.endCursor,r&&await new Promise(c=>setTimeout(c,r))}let b=(g.url||e.url).replace(/\/$/,""),S=l.map(d=>{let w=rt(d.id),i=typeof d.body=="string"&&d.body.length>0;return{id:w||d.id,n:d.number??null,title:(d.title||"").trim(),date:D(d.publishedAt),url:w?`${b}/posts/${w}`:`${b}/posts`,public:d.isPublic!==!1,locked:!i&&d.__typename==="FreeformPost",text:i?q(d.body):"",kind:d.__typename==="FreeformPost"?void 0:d.__typename}});return S.sort((d,w)=>(d.date||"").localeCompare(w.date||"")),S.every(d=>d.n==null)&&S.forEach((d,w)=>d.n=w+1),{name:g.name,url:b,updates:S}}function st(e){let t=e.match(/contact\?projectID=(\d+)/)||e.match(/"projectUserContext":\{[^}]*"projectID":(\d+)/)||e.match(/"projectID":(\d+)/);return t?Number(t[1]):null}function it(e){let t=e.indexOf('"update":{');if(t===-1)return null;let o=e.slice(t,t+3e6).match(/"content":("(?:[^"\\]|\\.)*"|null)/);if(!o)return null;try{return JSON.parse(o[1])}catch{return null}}async function F(e,t,n={}){let{onProgress:o=()=>{},delayMs:a=200,known:r=new Map}=n,s=e.url,l=await t(s+"/updates"),f=st(l);if(!f)throw new Error("Couldn\u2019t find the Gamefound project ID on the updates page");let g=(l.match(/<title>([^<]*)<\/title>/)?.[1]||"").replace(/\s*-\s*Updates\s*-\s*Gamefound\s*$/i,"").replace(/\s*-\s*Gamefound\s*$/i,"").trim()||e.slug,m=new Map,b=null;for(let i=0;i<100;i++){let x=await t("https://gamefound.com/api/projectUpdates/searchProjectUpdates",{method:"POST",headers:{"content-type":"application/json",accept:"application/json"},body:JSON.stringify({projectID:f,lowestFetchedSequenceNumber:b,searchTerm:"",dateFrom:null,dateTo:null,onlyUserRelevant:!1,projectUpdateUserContext:1})}),c=JSON.parse(x),p=c.pagedItems||c.items||[],v=0;for(let u of p)m.has(u.projectUpdateID)||(m.set(u.projectUpdateID,u),v++);let y=p.map(u=>u.sequenceNumber).filter(u=>typeof u=="number");if(!v||!y.length)break;let k=Math.min(...y);if(b!==null&&k>=b||(b=k,k<=1||c.hasMoreItems===!1))break}let S=[...m.values()].sort((i,x)=>(i.sequenceNumber??0)-(x.sequenceNumber??0)),d=[],w=0;for(let i of S){let x=new URL(i.projectUpdateUrl||`${s}/updates/${i.sequenceNumber}`,"https://gamefound.com").href,c=r.get(x),p=i.publishedAt||i.createdAt||null;if(c&&c.text&&c.date===p)d.push(c);else{let v=null;try{v=it(await t(x))}catch(y){if(y.status!==403&&y.status!==404)throw y}d.push({id:String(i.projectUpdateID),n:i.sequenceNumber??null,title:(i.title||"").trim(),date:p,url:x,public:i.targetAudience===0||i.targetAudience==null,locked:!v,text:v?q(v):i.abstract||""}),a&&await new Promise(y=>setTimeout(y,a))}o(++w,S.length)}return{name:g,url:s,updates:d}}var ct=1,lt="https://shacaska.github.io/campaign-search/",K=e=>`campaign-search:v${ct}:${e}`;async function pt(e){let t=document.querySelector('meta[name="csrf-token"]')?.content;return t||(t=(await(await fetch(e.url,{credentials:"same-origin"})).text()).match(/<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/)?.[1]),async n=>{let o=await fetch("/graph",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json",accept:"application/json",...t?{"x-csrf-token":t}:{}},body:JSON.stringify(n)});if(!o.ok){let a=new Error(`Kickstarter answered HTTP ${o.status}. Try reloading the page and running it again.`);throw a.fatal=o.status===403||o.status===429,a}return o.json()}}async function dt(e,t={}){let n=await fetch(e,{credentials:"same-origin",...t});if(!n.ok){let o=new Error(`Gamefound answered HTTP ${n.status} for ${e}`);throw o.status=n.status,o}return n.text()}async function ut(e,t,n){if(e.platform==="kickstarter")return H(e,await pt(e),{onProgress:n,delayMs:150});let o=new Map((t?.updates||[]).map(a=>[a.url,a]));return F(e,dt,{onProgress:n,delayMs:150,known:o})}function ft(e){try{return JSON.parse(localStorage.getItem(K(e))||"null")}catch{return null}}function mt(e){try{return localStorage.setItem(K(e.id),JSON.stringify(e)),!0}catch{return!1}}var G;function I(e,t){try{e.innerHTML=t;return}catch{}try{G||(G=window.trustedTypes.createPolicy("campaign-search",{createHTML:n=>n})),e.innerHTML=G.createHTML(t)}catch(n){throw new Error("this page blocks the search panel from drawing itself ("+(n.message||n)+")")}}var B=`
:host { all: initial; }
* { box-sizing: border-box; }
.wrap { position: fixed; z-index: 2147483646; top: 0; right: 0; bottom: 0; width: min(460px, 100vw);
  display: flex; flex-direction: column; background: #fffdf8; color: #1f1b16;
  font: 15px/1.5 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  box-shadow: -8px 0 40px rgba(0,0,0,.25); border-left: 1px solid #e2d9c9; }
@media (prefers-color-scheme: dark) {
  .wrap { background: #1e1b16; color: #ece5d8; border-color: #342e25; }
  input, select { background: #15130f !important; color: #ece5d8 !important; border-color: #342e25 !important; }
  .res { border-color: #342e25 !important; }
  .snip { color: #d8cfbf !important; border-color: #342e25 !important; }
  mark { background: #8a6a12 !important; }
  .bar { background: #342e25 !important; }
  .head, .foot { border-color: #342e25 !important; }
}
.head { padding: 12px 14px 10px; border-bottom: 1px solid #e2d9c9; }
.top { display: flex; align-items: center; gap: 8px; }
.title { flex: 1; font-weight: 700; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.x { border: 0; background: transparent; font-size: 22px; line-height: 1; cursor: pointer; color: inherit; padding: 4px 8px; }
.sub { font-size: 12px; opacity: .7; margin-top: 2px; }
.row { display: flex; gap: 6px; margin-top: 10px; }
input { flex: 1; min-width: 0; font: inherit; font-size: 16px; padding: 10px 12px; border: 1.5px solid #e2d9c9; border-radius: 10px; background: #fff; color: #1f1b16; }
input:focus { outline: none; border-color: #9a5b1e; }
select { font: inherit; font-size: 13px; padding: 6px; border: 1.5px solid #e2d9c9; border-radius: 10px; background: #fff; color: #1f1b16; }
.bar { height: 4px; background: #eee5d6; border-radius: 4px; margin-top: 10px; overflow: hidden; }
.bar > i { display: block; height: 100%; width: 0; background: #9a5b1e; transition: width .2s; }
.status { font-size: 12.5px; margin-top: 6px; opacity: .85; }
.status.err { color: #c0392b; opacity: 1; }
.body { flex: 1; overflow: auto; padding: 10px 14px 20px; -webkit-overflow-scrolling: touch; }
.sum { font-size: 13px; margin: 2px 0 10px; }
.res { border: 1.5px solid #e2d9c9; border-radius: 10px; padding: 9px 12px; margin-bottom: 10px; }
.meta { display: flex; justify-content: space-between; font-size: 12px; opacity: .75; }
.cnt { font-weight: 700; color: #9a5b1e; }
.rt { display: block; font-weight: 650; margin: 2px 0 4px; color: inherit; text-decoration: none; }
.rt:hover { text-decoration: underline; }
.snip { font-size: 13.5px; margin: 5px 0; padding-left: 8px; border-left: 3px solid #e2d9c9; color: #3d362d; overflow-wrap: anywhere; }
mark { background: #ffd86b; color: inherit; border-radius: 2px; }
.acts { display: flex; flex-wrap: wrap; gap: 2px 14px; font-size: 13px; margin-top: 4px; }
.acts a, .acts button { color: #9a5b1e; font: inherit; font-weight: 600; background: none; border: 0; padding: 3px 0; cursor: pointer; text-decoration: none; }
.full { font-size: 14px; margin-top: 8px; border-top: 1px dashed #e2d9c9; padding-top: 4px; overflow-wrap: anywhere; }
.full p { margin: .55em 0; }
.foot { border-top: 1px solid #e2d9c9; padding: 8px 14px; display: flex; gap: 14px; font-size: 12.5px; align-items: center; flex-wrap: wrap; }
.foot button, .foot a { font: inherit; color: #9a5b1e; background: none; border: 0; padding: 4px 0; cursor: pointer; font-weight: 600; text-decoration: none; }
.hint { font-size: 12px; opacity: .65; margin-top: 6px; }
.empty { opacity: .7; font-size: 14px; }
`;function ht(e){try{let t=new CSSStyleSheet;t.replaceSync(B),e.adoptedStyleSheets=[t]}catch{let t=document.createElement("style");t.textContent=B,e.appendChild(t)}}var N=e=>e?new Date(e).toLocaleDateString(void 0,{day:"numeric",month:"short",year:"numeric"}):"";function J(){let e=window.__campaignSearch;if(e?.host?.isConnected){e.host.style.display=e.host.style.display==="none"?"":"none",e.focus?.();return}let t=E(location.href),n=document.createElement("div");n.id="campaign-search-panel";let o=n.attachShadow({mode:"open"});ht(o);let a=document.createElement("div");a.className="wrap",o.appendChild(a),document.documentElement.appendChild(n);let r={host:n,data:null,prepared:null};if(window.__campaignSearch=r,!t){I(a,`<div class="head"><div class="top"><div class="title">Campaign Search</div><button class="x" title="Close">\xD7</button></div></div>
      <div class="body"><p>Open a <b>Kickstarter</b> or <b>Gamefound</b> campaign page first, then run this again.</p>
      <p class="empty">Examples:<br>kickstarter.com/projects/<i>creator</i>/<i>campaign</i><br>gamefound.com/en/projects/<i>creator</i>/<i>campaign</i></p></div>`),a.querySelector(".x").onclick=()=>n.remove();return}I(a,`
    <div class="head">
      <div class="top"><div class="title">\u{1F50E} Search updates</div><button class="x" title="Close">\xD7</button></div>
      <div class="sub" data-sub>${C(P[t.platform])}</div>
      <div class="row">
        <input type="search" placeholder="Search all updates\u2026 e.g. eidolon" enterkeyhint="search" data-q>
        <select data-sort title="Sort"><option value="relevance">Most hits</option><option value="newest">Newest</option><option value="oldest">Oldest</option></select>
      </div>
      <div class="hint">"exact phrase" \xB7 -exclude \xB7 ignores case &amp; accents</div>
      <div class="bar" data-barwrap><i data-bar></i></div>
      <div class="status" data-status>Starting\u2026</div>
    </div>
    <div class="body" data-body></div>
    <div class="foot">
      <button data-refresh>\u21BB Refresh</button>
      <button data-save>Save .json</button>
      <a href="${lt}" target="_blank" rel="noopener">About</a>
    </div>`);let s=c=>a.querySelector(`[data-${c}]`),l=s("q"),f=s("body");r.focus=()=>l.focus(),a.querySelector(".x").onclick=()=>n.style.display="none",o.addEventListener("keydown",c=>{c.key==="Escape"&&(n.style.display="none"),c.stopPropagation()}),["keyup","keypress","input"].forEach(c=>o.addEventListener(c,p=>p.stopPropagation()));let g=(c,p=!1)=>{s("status").textContent=c,s("status").className="status"+(p?" err":"")},m=c=>{s("barwrap").style.display=c==null?"none":"",s("bar").style.width=`${Math.round((c||0)*100)}%`};function b(c,p){r.data=c,r.prepared=A(c.updates);let v=c.updates.filter(y=>y.locked).length;s("sub").textContent=`${c.name} \xB7 ${c.updates.length} updates`,g(p+(v?` \xB7 ${v} locked (backers only \u2014 log in as a backer to include them)`:"")),w()}let S=!1;async function d(){if(S)return;S=!0,m(0);let c=r.data?"Showing saved copy \xB7 checking for new updates\u2026":"Fetching updates\u2026";g(c);try{let p=await ut(t,r.data,(k,u)=>{m(u?k/u:.5),g(`${c} ${k}${u?" / "+u:""}`)}),v={id:t.id,platform:t.platform,name:p.name,url:p.url,fetchedAt:new Date().toISOString(),updates:p.updates},y=mt(v);b(v,`Up to date \xB7 ${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}${y?"":" (too big to cache)"}`)}catch(p){console.error("[campaign-search]",p),g((r.data?"Showing saved copy. Refresh failed: ":"Couldn\u2019t fetch updates: ")+(p.message||p),!0)}finally{S=!1,m(null)}}function w(){if(!r.data)return;let{results:c,totalMentions:p,parsed:v}=R(r.prepared,l.value,"all"),y=s("sort").value,k=(u,h)=>(u.update.date||"").localeCompare(h.update.date||"");if(y==="relevance"?c.sort((u,h)=>h.score-u.score||-k(u,h)):y==="newest"?c.sort((u,h)=>-k(u,h)):c.sort(k),!v.terms.length){let u=[...r.data.updates].sort((h,$)=>($.date||"").localeCompare(h.date||""));I(f,`<p class="empty">Type to search ${u.length} updates. All updates, newest first:</p>`+u.map(h=>`<div class="res"><div class="meta"><span>${h.n!=null?"#"+h.n+" \xB7 ":""}${N(h.date)}${h.locked?" \xB7 \u{1F512}":""}</span></div>
          <a class="rt" href="${C(h.url)}" target="_blank" rel="noopener">${C(h.title||"(untitled)")}</a></div>`).join(""));return}r.results=c,I(f,`<p class="sum">${c.length?`In <b>${c.length}</b> of ${r.data.updates.length} updates \xB7 ${p} mention${p===1?"":"s"}`:"No matches."}</p>`+c.map((u,h)=>{let $=u.update,j=U($.text,u.ranges);return`<div class="res" data-i="${h}">
          <div class="meta"><span>${$.n!=null?"#"+$.n+" \xB7 ":""}${N($.date)}${$.locked?" \xB7 \u{1F512}":""}</span><span class="cnt">${u.mentions}\xD7</span></div>
          <a class="rt" href="${C($.url)}" target="_blank" rel="noopener">${O($.title||"(untitled)",u.titleRanges)}</a>
          ${j.slice(0,3).map(X=>`<div class="snip">${X.html}</div>`).join("")}
          <div class="acts">
            ${j.length>3?`<button data-act="more">+${j.length-3} more</button>`:""}
            ${$.text?'<button data-act="full">Read full update</button>':""}
            <a href="${C($.url)}" target="_blank" rel="noopener">Open \u2197</a>
          </div><div class="full" hidden></div></div>`}).join(""))}f.addEventListener("click",c=>{let p=c.target.closest("button[data-act]");if(!p)return;let v=p.closest(".res"),y=r.results?.[+v.dataset.i];if(y)if(p.dataset.act==="more"){let k=U(y.update.text,y.ranges).slice(3),u=[...v.querySelectorAll(".snip")].pop(),h=document.createElement("div");I(h,k.map($=>`<div class="snip">${$.html}</div>`).join("")),u.after(...h.childNodes),p.remove()}else{let k=v.querySelector(".full");if(k.hidden){let u=y.update.text,h=0;I(k,u.split(`

`).map($=>{let j=u.indexOf($,h);return h=j+$.length,`<p>${O(u,y.ranges,j,j+$.length).replace(/\n/g,"<br>")}</p>`}).join("")),k.hidden=!1,p.textContent="Hide full update",k.querySelector("mark")?.scrollIntoView({block:"center"})}else k.hidden=!0,p.textContent="Read full update"}});let i;l.addEventListener("input",()=>{clearTimeout(i),i=setTimeout(w,120)}),s("sort").addEventListener("change",w),s("refresh").onclick=d,s("save").onclick=()=>{if(!r.data)return;let c=new Blob([JSON.stringify(r.data)],{type:"application/json"}),p=document.createElement("a");p.href=URL.createObjectURL(c),p.download=`${t.slug}-updates.json`,o.appendChild(p),p.click(),setTimeout(()=>{URL.revokeObjectURL(p.href),p.remove()},1e3)};let x=ft(t.id);x&&b(x,`Saved copy from ${N(x.fetchedAt)} \u2014 checking for new updates\u2026`),l.focus(),d()}function Q(){let e=!!E(location.href),t=document.getElementById("campaign-search-fab");if(!e){t?.remove();return}t||(t=document.createElement("button"),t.id="campaign-search-fab",t.textContent="\u{1F50E} Search updates",t.setAttribute("style","position:fixed;z-index:2147483645;right:16px;bottom:16px;padding:10px 16px;border:0;border-radius:999px;background:#9a5b1e;color:#fff;font:600 14px/1 -apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.25);cursor:pointer"),t.addEventListener("click",J),document.body.appendChild(t))}Q();var V=location.href;setInterval(()=>{location.href!==V&&(V=location.href,Q())},1e3);})();
