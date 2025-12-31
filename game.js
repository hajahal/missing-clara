/* LAST SEEN: KARA — Haunted 90s Desktop Horror (Weird Web Edition)
   Self-contained, static-host friendly.
   Save via localStorage. No external assets.
*/

const $ = (q) => document.querySelector(q);
const el = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };


const SAVE_KEY = "last-seen-kara-save-v2";

/* ---------------- State ---------------- */

const S = {
  started: false,
  flags: {
    openedCaseFile: false,
    readMailbox: false,
    unlockedDiary: false,
    listenedVoicemail: false,
    decodedPager: false,
    foundBasementKey: false,
    openedBasement: false,
    sawPhotoNegative: false,

    ranLights: false,
    refusedInvite: false,
    everSaidName: false,
    softRebootedOnce: false,
    unlockedDontOpen: false,
    trueEndingSeen: false,
  },
  inventory: [],
  notes: [],
  paranoia: 0,
  lastSignalAt: 0,

  // haunt runtime
  haunt: {
    iconCorruption: 0,    // grows with paranoia
    lastHauntAt: 0,
    startMenuGlitch: false,
  },

  audio: {
    muted: false,
    started: false,
  },

  // idle screensaver
  idle: {
    lastInputAt: Date.now(),
    active: false,
  }
};

/* ---------------- Boot screen text ---------------- */

const bootLines = [
  "KX-OS 95 BIOS v2.31",
  "Copyright (C) 1993-1998 KX Systems",
  "",
  "Memory Test: 16384 KB OK",
  "Detecting IDE Devices... OK",
  "Loading KX-OS 95 ...",
  "",
  "WARNING: Last shutdown was unexpected.",
  "Checking disk for errors... OK",
  "",
  "Mounting DRIVE C: ... OK",
  "Mounting DRIVE D: ... OK",
  "",
  "Starting services:",
  "  - dialup.modem .......... OK",
  "  - mail.client ........... OK",
  "  - audio.driver .......... OK",
  "  - screensaver ........... OK",
  "  - nightmode ............. OK",
  "",
  "NOTE: Case Archive directory flagged 'SENSITIVE'.",
  "",
  "If you are reading this the case file has reached you.",
  "",
  ""
];

function nowClock(){
  const d = new Date();
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  return `${hh}:${mm}`;
}

/* ---------------- Audio Engine (WebAudio) ---------------- */

const AudioEngine = (() => {
  let ctx = null;
  let master = null;
  let humOsc = null;
  let humGain = null;
  let noiseSrc = null;
  let noiseGain = null;

  function ensure(){
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = S.audio.muted ? 0 : 0.9;
    master.connect(ctx.destination);
  }

  function setMuted(m){
    S.audio.muted = !!m;
    if (!ctx) return;
    master.gain.value = S.audio.muted ? 0 : 0.9;
  }

  function startAmbient(){
    ensure();
    if (S.audio.started) return;
    S.audio.started = true;

    // hum
    humOsc = ctx.createOscillator();
    humOsc.type = "sine";
    humOsc.frequency.value = 56;

    humGain = ctx.createGain();
    humGain.gain.value = 0.015; // very low

    // noise
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i=0;i<bufferSize;i++){
      output[i] = (Math.random() * 2 - 1) * 0.18;
    }
    noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    noiseSrc.loop = true;

    noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.004; // extremely low

    const humFilter = ctx.createBiquadFilter();
    humFilter.type = "lowpass";
    humFilter.frequency.value = 260;

    humOsc.connect(humGain).connect(humFilter).connect(master);
    noiseSrc.connect(noiseGain).connect(master);

    humOsc.start();
    noiseSrc.start();

    // occasional modem chirp
    setInterval(()=> {
      if (S.audio.muted) return;
      if (!S.started) return;
      const chance = Math.min(0.06 + S.paranoia*0.02, 0.25);
      if (Math.random() < chance) modemChirp();
    }, 4200);
  }

  function uiClick(){
    // keep the original tiny audio element click too (fallback)
    try { $("#sndClick").currentTime = 0; $("#sndClick").play(); } catch {}
    // add a tiny synth tick
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = 740;
    g.gain.value = 0.02;
    o.connect(g).connect(master);
    o.start();
    o.stop(ctx.currentTime + 0.03);
  }

  function modemChirp(){
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1200;
    f.Q.value = 9;

    o.type = "sawtooth";
    g.gain.value = 0.0;
    o.connect(f).connect(g).connect(master);

    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.03, t+0.02);
    g.gain.linearRampToValueAtTime(0.0, t+0.22);

    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(2100, t+0.14);
    o.frequency.exponentialRampToValueAtTime(640, t+0.22);

    o.start();
    o.stop(t+0.24);
  }

  function scareBurst(){
    if (!ctx || S.audio.muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = 120;
    g.gain.value = 0.0;
    o.connect(g).connect(master);

    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t+0.03);
    g.gain.linearRampToValueAtTime(0, t+0.25);

    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(40, t+0.22);

    o.start();
    o.stop(t+0.26);
  }

  function setHumIntensity(v){
    if (!humGain || !noiseGain) return;
    // v ~ 0..1
    humGain.gain.value = 0.012 + v*0.02;
    noiseGain.gain.value = 0.003 + v*0.01;
  }

  return { ensure, setMuted, startAmbient, uiClick, modemChirp, scareBurst, setHumIntensity };
})();

/* ---------------- Helpers ---------------- */

function setStatus(text, warn=false){
  $("#statusText").textContent = text;
  $("#statusLight").classList.toggle("warn", !!warn);
}

function addNote(t){
  S.notes.push({ t, at: Date.now() });
}

function addInv(item){
  if (!S.inventory.includes(item)) S.inventory.push(item);
}

function hasInv(item){ return S.inventory.includes(item); }

function escapeHtml(s){
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

function flashSignal(title, message, ms=1500, spooky=true){
  const box = $("#signal");
  const t = $("#signalText");
  t.innerHTML = `
    <div class="${spooky ? "glitch" : ""}"><b>${escapeHtml(title)}</b></div>
    <hr />
    <div>${escapeHtml(message).replace(/\n/g,"<br/>")}</div>
  `;
  box.classList.remove("hidden");
  if (spooky) AudioEngine.scareBurst();
  setTimeout(()=>box.classList.add("hidden"), ms);
}

function maybeSignal(tag="..."){
  const now = Date.now();
  if (now - S.lastSignalAt < 8000) return;
  const chance = Math.min(0.10 + S.paranoia*0.05, 0.45);
  if (Math.random() < chance){
    S.lastSignalAt = now;
    S.paranoia += 1;
    setStatus("SIGNAL", true);

    const msg = [
      "…static…",
      "I can see you reading.",
      "Don’t look behind the glass.",
      "She’s not where they said.",
      "Stop typing her name.",
      "The house remembers.",
      "This is not a game."
    ][Math.floor(Math.random()*7)];

    flashSignal(tag, msg, 1200, true);
    setTimeout(()=>setStatus("READY", false), 900);
  }
}

/* ---------------- Save/Load ---------------- */

function saveGame(){
  localStorage.setItem(SAVE_KEY, JSON.stringify(S));
  setStatus("SAVED");
  flashSignal("SYSTEM", "Save written to disk. Don’t forget what you saw.", 1200, false);
}

function loadGame(){
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    flashSignal("SYSTEM", "No save found.", 1000, false);
    return;
  }
  try{
    const data = JSON.parse(raw);
    // shallow merge
    Object.assign(S, data);
    setStatus("LOADED");
    renderDesktopIcons();
    flashSignal("SYSTEM", "Save loaded. The air feels... colder.", 1200, false);
  }catch(e){
    flashSignal("SYSTEM", "Save corrupted.", 1200, true);
  }
}

function hardReset(){
  localStorage.removeItem(SAVE_KEY);
  location.reload();
}

/* ---------------- Window system ---------------- */

let zTop = 10;
const windows = new Map();

function bringToFront(id){
  const w = windows.get(id);
  if (!w) return;
  zTop += 1;
  w.node.style.zIndex = zTop;
  $(".taskItem.active")?.classList.remove("active");
  w.taskNode.classList.add("active");
}

function closeWindow(id){
  const w = windows.get(id);
  if (!w) return;
  w.node.remove();
  w.taskNode.remove();
  windows.delete(id);
  setStatus("READY");
}

function toggleMinimize(id){
  const w = windows.get(id);
  if (!w) return;
  const hidden = w.node.classList.toggle("hidden");
  if (!hidden) bringToFront(id);
}

function createWindow({id, title, icon="■", x=280, y=80, w=620, h=380, contentNode}){
  if (windows.has(id)){
    const existing = windows.get(id);
    existing.node.classList.remove("hidden");
    bringToFront(id);
    return;
  }

  const node = el("div","window bevel");
  node.style.left = x+"px";
  node.style.top = y+"px";
  node.style.width = w+"px";
  node.style.height = h+"px";
  node.style.zIndex = (++zTop);

  const titlebar = el("div","winTitle");
  titlebar.innerHTML = `<span class="dot">${icon}</span><span>${escapeHtml(title)}</span>`;
  const btns = el("div","winBtns");
  const bMin = el("button","winBtn bevelBtn"); bMin.textContent = "_";
  const bClose = el("button","winBtn bevelBtn"); bClose.textContent = "X";
  btns.appendChild(bMin); btns.appendChild(bClose);
  titlebar.appendChild(btns);

  const body = el("div","winBody");
  body.appendChild(contentNode);

  node.appendChild(titlebar);
  node.appendChild(body);
  $("#windows").appendChild(node);

  const task = el("div","taskItem active bevel");
  task.textContent = title;
  $("#taskbarMid").appendChild(task);

  windows.set(id, {node, taskNode: task});
  bringToFront(id);

  // drag
  let dragging=false, ox=0, oy=0;
  titlebar.addEventListener("mousedown",(e)=>{
    if (e.target === bMin || e.target === bClose) return;
    dragging=true; ox=e.clientX-node.offsetLeft; oy=e.clientY-node.offsetTop;
    bringToFront(id);
  });
  window.addEventListener("mousemove",(e)=>{
    if(!dragging) return;
    node.style.left = Math.max(10, e.clientX-ox) + "px";
    node.style.top  = Math.max(40, e.clientY-oy) + "px";
  });
  window.addEventListener("mouseup",()=>dragging=false);

  // buttons
  bClose.addEventListener("click",()=>{ AudioEngine.uiClick(); closeWindow(id); });
  bMin.addEventListener("click",()=>{ AudioEngine.uiClick(); toggleMinimize(id); });

  node.addEventListener("mousedown",()=>bringToFront(id));
  task.addEventListener("click",()=>{ AudioEngine.uiClick(); toggleMinimize(id); });

  setStatus("OPEN");
}

/* ---------------- Weird icon set ---------------- */

function corruptText(s){
  // light glitching when paranoia rises
  const lvl = Math.min(0.08 + S.paranoia*0.02, 0.35);
  if (Math.random() > lvl) return s;

  const chars = s.split("");
  const swaps = Math.max(1, Math.floor(chars.length * lvl));
  for (let i=0;i<swaps;i++){
    const idx = Math.floor(Math.random()*chars.length);
    // combining marks / weirdness
    const mark = ["̷","̸","̶","̴","͟","͞","͝"][Math.floor(Math.random()*7)];
    chars[idx] = chars[idx] + mark;
  }
  return chars.join("");
}

function ICONS(){
  const base = [
    { id:"case",   title:"CASE FILE",   sub:"KARA N. / Missing", glyph:"📁", open:openCaseFile },
    { id:"mail",   title:"MAILBOX",     sub:S.flags.readMailbox ? "0 unread" : "3 unread", glyph:"✉️", open:openMailbox },
    { id:"photos", title:"PHOTOS",      sub:"Darkroom scans", glyph:"🖼️", open:openPhotos },
    { id:"bbs",    title:"DIAL-UP BBS", sub:"northbridge.sys", glyph:"📞", open:openBBS },
    { id:"notes",  title:"NOTES",       sub:"Your notebook", glyph:"🗒️", open:openNotebook },
    { id:"tools",  title:"TOOLS",       sub:"Utilities", glyph:"🧰", open:openTools },
    { id:"trash",  title:"TRASH",       sub:"(don’t.)", glyph:"🗑️", open:openTrash },
  ];

  if (S.flags.unlockedDontOpen){
    base.splice(4,0,{ id:"dont", title:"DONT_OPEN", sub:"D:\\", glyph:"🟥", open:openDontOpen });
  }
  return base;
}

function renderDesktopIcons(){
  const wrap = $("#icons");
  wrap.innerHTML = "";

  for (const ic of ICONS()){
    const row = el("div","icon");
    const t = S.paranoia >= 3 ? corruptText(ic.title) : ic.title;
    const sub = (S.paranoia >= 5 && Math.random()<0.25) ? corruptText(ic.sub) : ic.sub;

    row.innerHTML = `
      <div class="iconGlyph bevel">${ic.glyph}</div>
      <div class="iconLabel">
        <div>${escapeHtml(t)}</div>
        <div class="iconSmall">${escapeHtml(sub)}</div>
      </div>
    `;
    row.addEventListener("dblclick",()=>{ AudioEngine.uiClick(); ic.open(); });
    row.addEventListener("click",()=>{ AudioEngine.uiClick(); });
    wrap.appendChild(row);
  }
}

/* ---------------- Content: Case Files ---------------- */

function openCaseFile(){
  S.flags.openedCaseFile = true;
  maybeSignal("ARCHIVE");

  const c = el("div");
  c.innerHTML = `
    <div><span class="badge blue">SENSITIVE</span> <b>KARA N.</b> — Missing (11/04/1999)</div>
    <div class="muted small">This drive belonged to an investigator who stopped answering calls.</div>
    <hr/>
    <div class="fileList">
      <div class="fileRow bevel" data-file="overview">
        <span class="badge">TXT</span>
        <div>
          <div><b>overview.txt</b></div>
          <div class="small muted">timeline + addresses</div>
        </div>
      </div>
      <div class="fileRow bevel" data-file="diary">
        <span class="badge red">LOCK</span>
        <div>
          <div><b>kara_diary.doc</b></div>
          <div class="small muted">password required</div>
        </div>
      </div>
      <div class="fileRow bevel" data-file="pager">
        <span class="badge">DAT</span>
        <div>
          <div><b>pager_dump.dat</b></div>
          <div class="small muted">numeric fragments / corrupted</div>
        </div>
      </div>
      <div class="fileRow bevel" data-file="basement">
        <span class="badge red">RESTRICTED</span>
        <div>
          <div><b>basement_audio.wav</b></div>
          <div class="small muted">requires KEY</div>
        </div>
      </div>
      <div class="fileRow bevel" data-file="props">
        <span class="badge">SYS</span>
        <div>
          <div><b>file_properties.exe</b></div>
          <div class="small muted">view metadata (recommended)</div>
        </div>
      </div>
    </div>
    <hr/>
    <div class="small muted">Tip: double-click items inside windows too.</div>
  `;

  c.querySelectorAll(".fileRow").forEach(r=>{
    r.addEventListener("dblclick",()=>{
      AudioEngine.uiClick();
      const f = r.getAttribute("data-file");
      if (f==="overview") openOverview();
      if (f==="diary") openDiaryLocked();
      if (f==="pager") openPagerDump();
      if (f==="basement") openBasementAudioLocked();
      if (f==="props") openFileProperties();
    });
  });

  createWindow({ id:"win_case", title:"CASE FILES (C:\\ARCHIVE)", icon:"📁", x:270, y:70, w:720, h:440, contentNode:c });
}

function openOverview(){
  maybeSignal("overview.txt");
  const c = el("div");
  c.innerHTML = `
    <div><b>overview.txt</b></div>
    <hr/>
    <pre class="muted">
KARA N. (17)
Last seen: 11/04/1999 — 19:12
Location: Northbridge / Route 7 bus stop

Notes:
- Reported "shadows" in mirrors at home.
- Kept a disposable camera in her backpack.
- Friend (M. Hale) says Kara mentioned "the humming house"
  at 33 WILLOW GATE.

Recovered items:
- pager (battery dead)
- photo negatives (partially developed)
- voicemail tape (unlabeled)

Investigator log:
"Drive started whispering after midnight.
If anyone finds this: do NOT play the basement tape without the key."
    </pre>
  `;
  addNote("33 WILLOW GATE — 'the humming house'. Friend: M. Hale.");
  createWindow({ id:"win_overview", title:"overview.txt", icon:"📄", x:330, y:110, w:660, h:400, contentNode:c });
}

function openFileProperties(){
  const c = el("div");
  const skew = (S.paranoia>=4 && Math.random()<0.4) ? "11/04/1999 19:12" : "11/04/1999 19:12";
  const mod  = (S.paranoia>=4 && Math.random()<0.4) ? "11/04/1999 19:13" : "11/04/1999 19:12";
  const weird = (S.paranoia>=6 && Math.random()<0.35) ? "11/04/1899 19:12" : "11/04/1999 19:12";

  c.innerHTML = `
    <div><b>File Properties</b></div>
    <hr/>
    <div class="fileList">
      <div class="fileRow bevel">
        <span class="badge">META</span>
        <div>
          <div><b>overview.txt</b></div>
          <div class="small muted">Created: ${skew}</div>
          <div class="small muted">Modified: ${mod}</div>
          <div class="small muted">Accessed: ${weird}</div>
        </div>
      </div>
      <div class="fileRow bevel">
        <span class="badge red">META</span>
        <div>
          <div><b>kara_diary.doc</b></div>
          <div class="small muted">Created: 11/02/1999 22:41</div>
          <div class="small muted">Modified: 11/04/1999 18:59</div>
          <div class="small muted">Owner: KARA</div>
        </div>
      </div>
      <div class="fileRow bevel">
        <span class="badge red">META</span>
        <div>
          <div><b>basement_audio.wav</b></div>
          <div class="small muted">Length: 01:06</div>
          <div class="small muted">Codec: PCM</div>
          <div class="small muted">Comment: "Do not invite it."</div>
        </div>
      </div>
    </div>
    <hr/>
    <div class="small muted">Some timestamps feel… rewritten.</div>
  `;
  createWindow({ id:"win_props", title:"File Properties", icon:"🧾", x:380, y:130, w:680, h:410, contentNode:c });
}

/* ---------------- Diary (password) ---------------- */

function openDiaryLocked(){
  maybeSignal("kara_diary.doc");

  const c = el("div");
  const unlocked = S.flags.unlockedDiary;

  c.innerHTML = unlocked ? diaryContentHtml() : `
    <div><b>kara_diary.doc</b> <span class="badge red">LOCKED</span></div>
    <div class="small muted">This document is protected with a simple password.</div>
    <hr/>
    <div>Enter password:</div>
    <div class="inputRow">
      <input id="diaryPass" type="password" placeholder="••••••" />
      <button class="action" id="diaryTry">Unlock</button>
    </div>
    <div class="small muted" style="margin-top:10px">
      Hint: Kara reused words from her email signature.
    </div>
  `;

  if (!unlocked){
    c.querySelector("#diaryTry").addEventListener("click",()=>{
      AudioEngine.uiClick();
      const p = c.querySelector("#diaryPass").value.trim().toLowerCase();
      if (p === "northbridge"){
        S.flags.unlockedDiary = true;
        addInv("Basement Key (rusted)");
        S.flags.foundBasementKey = true;
        flashSignal("ACCESS GRANTED", "File decrypted.\nA rusted key falls from the disk tray.", 1300, false);
        closeWindow("win_diary");
        openDiaryLocked();
        renderDesktopIcons();
      } else {
        S.paranoia += 1;
        setStatus("DENIED", true);
        flashSignal("ACCESS DENIED", "Wrong password.\nSomething on the other side laughs—quietly.", 1400, true);
        setTimeout(()=>setStatus("READY", false), 900);
      }
    });
  }

  createWindow({ id:"win_diary", title:"kara_diary.doc", icon:"📘", x:310, y:90, w:700, h:430, contentNode:c });
}

function diaryContentHtml(){
  return `
    <div><b>kara_diary.doc</b> <span class="badge green">UNLOCKED</span></div>
    <hr/>
    <pre>
11/02
Mom says I’m “overtired.” But the mirror isn’t me sometimes.
Just for a second: a lag, like the glass is buffering.

11/03
M. says the place at Willow Gate hums because of old wiring.
But the hum follows you home. Like it’s learning your footsteps.

11/04 (afternoon)
I took the camera. If it’s real, film will catch it.
If it’s not real… why does it hate my name?

11/04 (night)
If you find this, don’t come to the house.
And don’t answer if it imitates someone you miss.
It can’t cross a threshold unless you invite it.

I wrote the rule on my pager in numbers so it can’t read it.
    </pre>
    <div class="small muted">Inventory updated: <b>Basement Key (rusted)</b></div>
  `;
}

/* ---------------- Pager dump ---------------- */

function openPagerDump(){
  maybeSignal("pager_dump.dat");

  const c = el("div");
  const decoded = S.flags.decodedPager;

  c.innerHTML = decoded ? `
    <div><b>pager_dump.dat</b> <span class="badge green">DECODED</span></div>
    <hr/>
    <pre>
CODE: 3-3 / 23-9-12-12-15-23 / 7-1-20-5

"… Willow Gate …"

Rule (decoded):
"DO NOT SAY HER NAME ALOUD."
    </pre>
  ` : `
    <div><b>pager_dump.dat</b> <span class="badge">RAW</span></div>
    <div class="small muted">Looks like A1Z26 substitution (1=A, 2=B...)</div>
    <hr/>
    <pre class="muted">
3-3 / 23-9-12-12-15-23 / 7-1-20-5
    </pre>
    <div class="small muted">Decode it to reveal the message.</div>
    <div class="inputRow">
      <input id="pagerAnswer" placeholder="type decoded phrase..." />
      <button class="action" id="pagerTry">Submit</button>
    </div>
    <div class="small muted" style="margin-top:10px">
      
    </div>
  `;

  if (!decoded){
    c.querySelector("#pagerTry").addEventListener("click",()=>{
      AudioEngine.uiClick();
      const ans = c.querySelector("#pagerAnswer").value.trim().toLowerCase().replace(/\s+/g," ");
      if (ans === "cc willow gate"){
        S.flags.decodedPager = true;
        addNote("Pager decoded: 'CC WILLOW GATE'. Also: don't say her name aloud.");
        flashSignal("DECODE OK", "Message recovered.\nYour monitor flickers as if relieved.", 1200, false);
        closeWindow("win_pager");
        openPagerDump();
      } else {
        S.paranoia += 1;
        flashSignal("NO", "That’s not it.\nThe cursor blinks… too slowly.", 1200, true);
      }
    });
  }

  createWindow({ id:"win_pager", title:"pager_dump.dat", icon:"📟", x:350, y:130, w:660, h:380, contentNode:c });
}

/* ---------------- Basement tape ---------------- */

function openBasementAudioLocked(){
  maybeSignal("basement_audio.wav");

  const c = el("div");
  const canOpen = S.flags.foundBasementKey;

  c.innerHTML = canOpen ? `
    <div><b>basement_audio.wav</b> <span class="badge red">DANGEROUS</span></div>
    <div class="small muted">You have the key. The warning remains.</div>
    <hr/>
    <div class="small muted">Play the tape?</div>
    <div class="inputRow">
      <button class="action" id="playTape">Play</button>
      <button class="action" id="refuseTape">Refuse</button>
    </div>
    <div class="small muted" style="margin-top:10px">
      Tip: volume low. (No loud audio—story-only.)
    </div>
  ` : `
    <div><b>basement_audio.wav</b> <span class="badge red">RESTRICTED</span></div>
    <hr/>
    <div class="redText">KEY REQUIRED.</div>
    <div class="small muted">You feel a draft from the disk drive anyway.</div>
  `;

  if (canOpen){
    c.querySelector("#playTape").addEventListener("click",()=>{
      AudioEngine.uiClick();
      openBasementTape();
      closeWindow("win_baudio");
    });
    c.querySelector("#refuseTape").addEventListener("click",()=>{
      AudioEngine.uiClick();
      S.paranoia += 1;
      flashSignal("…", "Smart.\nBut it will try another way.", 1200, true);
    });
  }

  createWindow({ id:"win_baudio", title:"basement_audio.wav", icon:"🔊", x:380, y:110, w:640, h:340, contentNode:c });
}

function openBasementTape(){
  S.flags.openedBasement = true;
  setStatus("PLAYING", true);
  flashSignal("TAPE", "The speaker hisses.\nA voice begins… not from the audio, but from the glass.", 1500, true);

  const c = el("div");
  c.innerHTML = `
    <div><b>Playback: basement_audio.wav</b></div>
    <hr/>
    <pre>
[00:00] (breathing)
[00:07] GIRL: "If you're listening, it's because I failed."
[00:12] GIRL: "The house copies people. It wears their voices."
[00:19] GIRL: "It asked me to invite it in. I said no."
[00:25] (low hum rises)
[00:31] GIRL: "But I opened the door anyway… because it sounded like my dad."

[00:42] (a second voice, same timbre, slightly delayed)
        "Say my name and I can come home."

[00:50] GIRL: "No."
[00:52] (metal scrape)
[00:55] GIRL: "If you want to help, look at the negatives.
              The camera saw what I couldn’t."

[01:06] (silence that feels occupied)
    </pre>
    <div class="small muted">Next step: open <b>PHOTOS</b>, then TOOLS → <b>SpectralView</b> or ImageLab.</div>
  `;
  addNote("Basement tape: house imitates voices; negatives reveal truth.");
  createWindow({ id:"win_tape", title:"Tape Player", icon:"⏵", x:300, y:90, w:720, h:440, contentNode:c });

  S.paranoia += 2;
  setTimeout(()=>setStatus("READY", false), 1200);
}

/* ---------------- Mail ---------------- */

function openMailbox(){
  maybeSignal("MAIL");

  const c = el("div");
  const unread = !S.flags.readMailbox;

  c.innerHTML = `
    <div><b>MAILBOX</b> ${unread ? `<span class="badge blue">3 UNREAD</span>` : `<span class="badge">READ</span>`}</div>
    <hr/>
    <div class="fileList">
      <div class="fileRow bevel" data-mail="m1">
        <span class="badge">MSG</span>
        <div>
          <div><b>Re: Study group</b></div>
          <div class="small muted">From: m.hale@northbridge.edu</div>
        </div>
      </div>
      <div class="fileRow bevel" data-mail="m2">
        <span class="badge">MSG</span>
        <div>
          <div><b>FWD: “Urban legends”</b></div>
          <div class="small muted">From: kara@nbridge.net</div>
        </div>
      </div>
      <div class="fileRow bevel" data-mail="m3">
        <span class="badge">MSG</span>
        <div>
          <div><b>Voicemail notice</b></div>
          <div class="small muted">From: telco@dialup.local</div>
        </div>
      </div>
    </div>
    <hr/>
    <div class="small muted">Hint: Kara’s email signature contains the diary password.</div>
  `;

  c.querySelectorAll(".fileRow").forEach(r=>{
    r.addEventListener("dblclick",()=>{
      AudioEngine.uiClick();
      const m = r.getAttribute("data-mail");
      if (m==="m1") openMail1();
      if (m==="m2") openMail2();
      if (m==="m3") openMail3();
      S.flags.readMailbox = true;
      renderDesktopIcons();
    });
  });

  createWindow({ id:"win_mail", title:"DialUp Mail", icon:"✉️", x:260, y:95, w:700, h:430, contentNode:c });
}

function openMail1(){
  maybeSignal("MSG");
  const c = el("div");
  c.innerHTML = `
    <div><b>Re: Study group</b></div>
    <div class="small muted">From: m.hale@northbridge.edu</div>
    <hr/>
    <pre>
Kara — you can crash at my place if your mom’s being weird again.
But seriously: stop going to Willow Gate. The house is abandoned.

If you HAVE to go, take someone with you.
And don’t go after dark.

— M
    </pre>
  `;
  addNote("M. Hale: Willow Gate house abandoned. Don’t go alone.");
  createWindow({ id:"win_m1", title:"Mail: Study group", icon:"✉", x:340, y:120, w:660, h:380, contentNode:c });
}

function openMail2(){
  maybeSignal("MSG");
  const c = el("div");
  c.innerHTML = `
    <div><b>FWD: “Urban legends”</b></div>
    <div class="small muted">From: kara@nbridge.net</div>
    <hr/>
    <pre>
(Forwarded chain message)
"THE HUMMING HOUSE — 33 WILLOW GATE
If you hear your name from inside, DO NOT answer.
If you see someone you miss in the window, DO NOT wave."

Kara’s note:
"Sometimes I think the legend is just a way to warn kids
about broken glass and old nails. But… why does it know me?"

Signature:
"Kara N., Northbridge"
    </pre>
  `;
  addNote("Diary password hint: 'Northbridge' (from Kara’s signature).");
  createWindow({ id:"win_m2", title:"Mail: Urban legends", icon:"✉", x:360, y:140, w:700, h:410, contentNode:c });
}

function openMail3(){
  maybeSignal("TELCO");
  const c = el("div");
  const listened = S.flags.listenedVoicemail;
  c.innerHTML = listened ? `
    <div><b>Voicemail notice</b> <span class="badge">PLAYED</span></div>
    <hr/>
    <pre>
There is nothing more on the line.
But the line is still open.
    </pre>
  ` : `
    <div><b>Voicemail notice</b> <span class="badge blue">NEW</span></div>
    <div class="small muted">Attached: <b>vm_1104.wav</b></div>
    <hr/>
    <div class="inputRow">
      <button class="action" id="playVm">Play voicemail</button>
    </div>
    <div class="small muted" style="margin-top:10px">
      Some messages shouldn’t be replayed.
    </div>
  `;

  if (!listened){
    c.querySelector("#playVm").addEventListener("click",()=>{
      AudioEngine.uiClick();
      S.flags.listenedVoicemail = true;
      S.paranoia += 1;
      flashSignal("VOICEMAIL", "A girl’s whisper:\n“Please… don’t say my name.”\nThen a second voice copies it, smiling.", 1700, true);
      addNote("Voicemail: whisper warns not to say her name. Second voice imitates.");
      closeWindow("win_m3");
      openMail3();
    });
  }

  createWindow({ id:"win_m3", title:"Mail: Voicemail", icon:"☎", x:380, y:160, w:640, h:340, contentNode:c });
}

/* ---------------- Photos ---------------- */

function openPhotos(){
  maybeSignal("PHOTOS");

  const c = el("div");
  c.innerHTML = `
    <div><b>PHOTOS</b> <span class="badge">D:\\SCANS</span></div>
    <hr/>
    <div class="fileList">
      <div class="fileRow bevel" data-photo="p1">
        <span class="badge">JPG</span>
        <div>
          <div><b>bus_stop.jpg</b></div>
          <div class="small muted">grainy / flash</div>
        </div>
      </div>
      <div class="fileRow bevel" data-photo="p2">
        <span class="badge">JPG</span>
        <div>
          <div><b>willow_gate_front.jpg</b></div>
          <div class="small muted">doorway / long exposure</div>
        </div>
      </div>
      <div class="fileRow bevel" data-photo="neg">
        <span class="badge red">NEG</span>
        <div>
          <div><b>negative_scan.tif</b></div>
          <div class="small muted">requires invert</div>
        </div>
      </div>
    </div>
    <hr/>
    <div class="small muted">Tip: Use TOOLS → ImageLab to invert the negative.</div>
  `;

  c.querySelectorAll(".fileRow").forEach(r=>{
    r.addEventListener("dblclick",()=>{
      AudioEngine.uiClick();
      const p = r.getAttribute("data-photo");
      if (p==="p1") openPhoto1();
      if (p==="p2") openPhoto2();
      if (p==="neg") openNegative();
    });
  });

  createWindow({ id:"win_photos", title:"Photo Viewer", icon:"🖼", x:290, y:110, w:700, h:430, contentNode:c });
}

function openPhoto1(){
  maybeSignal("bus_stop.jpg");
  const c = el("div");
  c.innerHTML = `
    <div><b>bus_stop.jpg</b></div>
    <hr/>
    <pre>
A bus stop at night.
Flash glare blooms across wet pavement.
There’s a figure in the reflection of the ad panel.

It could be Kara.
It could be… someone wearing her outline.
    </pre>
  `;
  createWindow({ id:"win_p1", title:"bus_stop.jpg", icon:"🖼", x:360, y:130, w:660, h:360, contentNode:c });
}

function openPhoto2(){
  maybeSignal("willow_gate_front.jpg");
  const c = el("div");
  c.innerHTML = `
    <div><b>willow_gate_front.jpg</b></div>
    <hr/>
    <pre>
The house at 33 Willow Gate.
A long exposure makes the doorway look like it’s breathing.

In the upstairs window:
a face that isn’t quite attached to a body.
    </pre>
  `;
  createWindow({ id:"win_p2", title:"willow_gate_front.jpg", icon:"🖼", x:380, y:150, w:680, h:380, contentNode:c });
}

function openNegative(){
  maybeSignal("negative_scan.tif");
  const c = el("div");
  c.innerHTML = `
    <div><b>negative_scan.tif</b> <span class="badge red">NEGATIVE</span></div>
    <div class="small muted">Unreadable until inverted.</div>
    <hr/>
    <pre class="muted">
[film density data]
████░░░░██░░░████░░
░░███░░░░░███░░░░░░
    </pre>
    <div class="small muted">Open TOOLS → ImageLab and choose “Invert”.</div>
  `;
  createWindow({ id:"win_neg", title:"negative_scan.tif", icon:"🧪", x:410, y:170, w:660, h:360, contentNode:c });
}

/* ---------------- Notebook ---------------- */

function openNotebook(){
  maybeSignal("NOTES");
  const c = el("div");

  const notes = S.notes.slice(-60).reverse().map(n=>{
    const d = new Date(n.at);
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    return `• [${hh}:${mm}] ${n.t}`;
  }).join("\n");

  c.innerHTML = `
    <div><b>NOTES</b></div>
    <hr/>
    <pre>${notes || "(empty)\nUse Start → New Game to begin.)"}</pre>
  `;
  createWindow({ id:"win_notes", title:"Notebook", icon:"🗒", x:520, y:80, w:560, h:380, contentNode:c });
}

/* ---------------- Tools: ImageLab + SpectralView + Control Panel + Terminal ---------------- */

function openTools(){
  maybeSignal("TOOLS");

  const c = el("div");
  c.innerHTML = `
    <div><b>TOOLS</b></div>
    <hr/>
    <div class="fileList">
      <div class="fileRow bevel" data-tool="imagelab">
        <span class="badge">APP</span>
        <div>
          <div><b>ImageLab</b></div>
          <div class="small muted">invert negatives / enhance contrast</div>
        </div>
      </div>
      <div class="fileRow bevel" data-tool="spectral">
        <span class="badge">APP</span>
        <div>
          <div><b>SpectralView</b></div>
          <div class="small muted">analyze audio “vm_1104.wav” / tape</div>
        </div>
      </div>
      <div class="fileRow bevel" data-tool="control">
        <span class="badge">SYS</span>
        <div>
          <div><b>Control Panel</b></div>
          <div class="small muted">settings (unreliable)</div>
        </div>
      </div>
      <div class="fileRow bevel" data-tool="terminal">
        <span class="badge">APP</span>
        <div>
          <div><b>Terminal</b></div>
          <div class="small muted">type commands (carefully)</div>
        </div>
      </div>
    </div>
  `;

  c.querySelectorAll(".fileRow").forEach(r=>{
    r.addEventListener("dblclick",()=>{
      AudioEngine.uiClick();
      const t = r.getAttribute("data-tool");
      if (t==="imagelab") openImageLab();
      if (t==="spectral") openSpectralView();
      if (t==="control") openControlPanel();
      if (t==="terminal") openTerminal();
    });
  });

  createWindow({ id:"win_tools", title:"Tools", icon:"🧰", x:310, y:160, w:560, h:360, contentNode:c });
}

function openImageLab(){
  maybeSignal("ImageLab");

  const c = el("div");
  c.innerHTML = `
    <div><b>ImageLab</b></div>
    <div class="small muted">Select operation:</div>
    <hr/>
    <div class="inputRow">
      <button class="action" id="invert">Invert Negative</button>
      <button class="action" id="enhance">Enhance</button>
    </div>
    <div class="small muted" style="margin-top:10px">
      Apply “Invert” while negative_scan.tif is open.
    </div>
    <hr/>
    <div id="labOut" class="small muted"></div>
  `;

  const out = () => c.querySelector("#labOut");

  c.querySelector("#invert").addEventListener("click",()=>{
    AudioEngine.uiClick();
    if (!windows.has("win_neg")){
      out().innerHTML = `<span class="redText">No negative loaded.</span> Open <b>negative_scan.tif</b> first.`;
      return;
    }
    S.flags.sawPhotoNegative = true;
    addNote("Negative inverted: reflection shows a second figure holding Kara’s wrist from inside the glass.");
    out().innerHTML = `<span class="greenText">Invert applied.</span> The image resolves into something you wish it hadn’t.`;
    flashSignal("NEGATIVE (INVERTED)",
      "The doorway photo hides a second figure.\nNot behind Kara—\ninside the reflection.\nIts hand is on her wrist.\nAnd it’s looking at you.",
      2200, true
    );
    setStatus("UNSTABLE", true);
    S.paranoia += 2;
    updateAudioMood();
  });

  c.querySelector("#enhance").addEventListener("click",()=>{
    AudioEngine.uiClick();
    if (!S.flags.sawPhotoNegative){
      out().innerHTML = `Enhance did nothing useful. Try <b>Invert</b>.`;
      return;
    }
    out().innerHTML = `<span class="greenText">Contrast boosted.</span> There’s text scratched into the glass: <b>“INVITE ME.”</b>`;
    addNote("Scratched in reflection: 'INVITE ME.'");
    flashSignal("DETAIL",
      "Zoomed detail:\nThe reflection contains writing:\n“INVITE ME.”\nYour cursor hesitates over the keys.",
      2000, true
    );
  });

  createWindow({ id:"win_imagelab", title:"ImageLab", icon:"🧪", x:520, y:170, w:600, h:340, contentNode:c });
}

function openSpectralView(){
  maybeSignal("SpectralView");
  const c = el("div");

  c.innerHTML = `
    <div><b>SpectralView</b> <span class="badge">ANALYZER</span></div>
    <div class="small muted">Fake spectrogram. Real dread.</div>
    <hr/>
    <canvas id="specCanvas" width="640" height="220" style="width:100%; border:1px solid rgba(255,255,255,.12); background:rgba(0,0,0,.35)"></canvas>
    <div class="inputRow">
      <button class="action" id="analyze">Analyze</button>
      <button class="action" id="clear">Clear</button>
    </div>
    <div id="specOut" class="small muted" style="margin-top:10px"></div>
    <hr/>
    <div class="small muted">
      Tip: Analyzing works best after playing the voicemail or basement tape.
    </div>
  `;

  const canvas = c.querySelector("#specCanvas");
  const ctx = canvas.getContext("2d");
  const out = c.querySelector("#specOut");

  function drawNoise(){
    const img = ctx.createImageData(canvas.width, canvas.height);
    for (let i=0;i<img.data.length;i+=4){
      const v = Math.floor(Math.random()*35);
      img.data[i+0] = v;
      img.data[i+1] = v+10;
      img.data[i+2] = v+5;
      img.data[i+3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  function overlayPhrase(phrase){
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "18px " + getComputedStyle(document.documentElement).getPropertyValue("--mono");
    ctx.fillStyle = "rgba(200,255,220,.95)";
    ctx.fillText(phrase, 18, 120);
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.fillText("— hidden in the noise —", 18, 150);
  }

  drawNoise();

  c.querySelector("#clear").addEventListener("click",()=>{
    AudioEngine.uiClick();
    out.textContent = "";
    drawNoise();
  });

  c.querySelector("#analyze").addEventListener("click",()=>{
    AudioEngine.uiClick();
    drawNoise();

    const ok = (S.flags.listenedVoicemail || S.flags.openedBasement);
    if (!ok){
      out.innerHTML = `<span class="redText">No reference signal found.</span> Play voicemail or tape first.`;
      flashSignal("SPECTRALVIEW", "The analyzer finds only your breathing.", 1200, true);
      return;
    }

    // reveal clue
    const phrase = S.flags.sawPhotoNegative ? "RUN THE LIGHTS" : "DO NOT INVITE IT";
    overlayPhrase(phrase);
    out.innerHTML = `<span class="greenText">Recovered phrase:</span> <b>${phrase}</b>`;
    addNote(`SpectralView recovered phrase: ${phrase}`);
    if (phrase === "RUN THE LIGHTS"){
      flashSignal("SPECTRAL", "The phrase repeats under the noise.\nLike a knock in Morse code.", 1400, true);
    } else {
      flashSignal("SPECTRAL", "A warning in the hiss.\nNot for Kara— for you.", 1400, false);
    }
  });

  createWindow({ id:"win_spec", title:"SpectralView", icon:"📈", x:420, y:120, w:760, h:460, contentNode:c });
}

function openControlPanel(){
  maybeSignal("Control Panel");
  const c = el("div");

  const toggles = [
    { k:"screensaver", name:"Screensaver", desc:"Prevents burn-in (supposedly)" },
    { k:"nightmode", name:"Night Mode", desc:"Reduces eye strain (maybe)" },
    { k:"dialup", name:"Dial-up Auto-Redial", desc:"Reconnects to unknown endpoints" },
    { k:"mirror", name:"Mirror Sync", desc:"Improves reflection stability" },
  ];

  c.innerHTML = `
    <div><b>Control Panel</b> <span class="badge">SYS</span></div>
    <div class="small muted">Settings sometimes save. Sometimes they don’t.</div>
    <hr/>
    <div id="toggles" class="fileList"></div>
    <hr/>
    <div class="small muted">Note: “Mirror Sync” is not a standard KX-OS option.</div>
  `;

  const tWrap = c.querySelector("#toggles");
  toggles.forEach(t=>{
    const row = el("div","fileRow bevel");
    const checked = (t.k==="screensaver") ? true : (Math.random() < 0.35);
    row.innerHTML = `
      <span class="badge">OPT</span>
      <div style="flex:1">
        <div><b>${t.name}</b></div>
        <div class="small muted">${t.desc}</div>
      </div>
      <button class="action" data-key="${t.k}">${checked ? "ON" : "OFF"}</button>
    `;
    row.querySelector("button").addEventListener("click",(e)=>{
      AudioEngine.uiClick();
      const key = e.target.getAttribute("data-key");
      const isOn = e.target.textContent === "ON";
      // haunted behavior: mirror sync fights you
      if (key === "mirror" && S.paranoia >= 4 && Math.random()<0.45){
        e.target.textContent = isOn ? "ON" : "OFF";
        flashSignal("CONTROL PANEL", "Mirror Sync refused to change.\nThe cursor pauses as if waiting for permission.", 1400, true);
        return;
      }
      e.target.textContent = isOn ? "OFF" : "ON";
      if (key === "dialup" && !isOn){
        flashSignal("DIAL-UP", "Auto-Redial enabled.\nA call is already in progress.", 1300, true);
        AudioEngine.modemChirp();
      }
      if (key === "nightmode" && !isOn){
        flashSignal("NIGHT MODE", "Enabled.\nThe corners of the screen look darker now.", 1200, false);
      }
    });
    tWrap.appendChild(row);
  });

  createWindow({ id:"win_cp", title:"Control Panel", icon:"⚙️", x:500, y:160, w:660, h:440, contentNode:c });
}

/* ---------------- Terminal (meta commands + true ending) ---------------- */

function openTerminal(){
  maybeSignal("TERMINAL");

  const c = el("div");
  c.innerHTML = `
    <div><b>Terminal</b> <span class="badge">C:\\</span></div>
    <div class="small muted">Commands: <b>help</b>, <b>inventory</b>, <b>open basement</b>, <b>say name</b>, <b>refuse</b>, <b>run the lights</b>, <b>reboot</b></div>
    <hr/>
    <pre id="termLog" class="muted">KX-Terminal ready.\n</pre>
    <div class="inputRow">
      <input id="termIn" placeholder="type command..." style="flex:1" />
      <button class="action" id="termGo">Run</button>
    </div>
  `;

  const log = (t)=>{
    const pre = c.querySelector("#termLog");
    pre.textContent += t + "\n";
    pre.scrollTop = pre.scrollHeight;
  };

  const run = ()=>{
    AudioEngine.uiClick();
    const inp = c.querySelector("#termIn");
    const cmdRaw = inp.value.trim();
    const cmd = cmdRaw.toLowerCase();
    inp.value = "";
    if (!cmd) return;

    log("> " + cmdRaw);

    if (cmd === "help"){
      log("help — show commands");
      log("inventory — list items");
      log("open basement — attempt final sequence");
      log("say name — (danger) speak her name");
      log("refuse — refuse invitation");
      log("run the lights — lock the rule");
      log("reboot — soft reboot (may change desktop)");
      return;
    }

    if (cmd === "inventory"){
      log(S.inventory.length ? S.inventory.map(i=>"- "+i).join("\n") : "(empty)");
      return;
    }

    if (cmd === "run the lights"){
      if (!S.flags.sawPhotoNegative){
        log("Nothing happens. You don’t know what to run yet.");
        log("Hint: invert the negative, then analyze audio.");
        return;
      }
      S.flags.ranLights = true;
      addNote("Terminal: RUN THE LIGHTS");
      flashSignal("LIGHTS", "You refuse the dark.\nThe reflection recedes by one breath.", 1500, false);
      log("OK.");
      updateAudioMood();
      return;
    }

    if (cmd === "open basement"){
      if (!S.flags.sawPhotoNegative){
        log("You don’t know what you’re opening yet.");
        log("Hint: invert the negative scan first.");
        return;
      }
      if (!S.flags.foundBasementKey){
        log("Missing key.");
        return;
      }
      startFinalSequence();
      return;
    }

    if (cmd === "say name"){
      S.flags.everSaidName = true;
      startBadEnding();
      return;
    }

    if (cmd === "refuse"){
      S.flags.refusedInvite = true;
      startGoodEnding();
      updateAudioMood();
      return;
    }

    if (cmd === "reboot"){
      softReboot();
      return;
    }

    log("Unknown command.");
    maybeSignal("TERMINAL");
  };

  c.querySelector("#termGo").addEventListener("click", run);
  c.querySelector("#termIn").addEventListener("keydown",(e)=>{ if(e.key==="Enter") run(); });

  createWindow({ id:"win_term", title:"Terminal", icon:"⌨", x:420, y:90, w:760, h:440, contentNode:c });
}

/* ---------------- BBS (in-game) ---------------- */

function openBBS(){
  maybeSignal("BBS");
  const c = el("div");

  const unlockedThreads = [];
  unlockedThreads.push({ id:"t0", title:"[READ FIRST] Willow Gate rumors", tag:"SYSOP" });

  if (S.flags.readMailbox) unlockedThreads.push({ id:"t1", title:"M. Hale: 'stop going there'", tag:"LOCAL" });
  if (S.flags.listenedVoicemail) unlockedThreads.push({ id:"t2", title:"Voicemail hiss patterns", tag:"AUDIO" });
  if (S.flags.sawPhotoNegative) unlockedThreads.push({ id:"t3", title:"Negative inversion results", tag:"PHOTO" });

  // gated area appears only if you refused + ran lights (true ending path)
  const hasGate = S.flags.refusedInvite && S.flags.ranLights;

  c.innerHTML = `
    <div><b>northbridge.sys</b> <span class="badge">DIAL-UP</span></div>
    <div class="small muted">Connected at 14.4k. Latency feels… human.</div>
    <hr/>
    <div class="fileList" id="bbsList"></div>
    <hr/>
    <div class="small muted">
      ${hasGate ? `Hidden board detected: <b>/underneath</b> (password required).` : `Tip: boards unlock as you discover artifacts.`}
    </div>
  `;

  const list = c.querySelector("#bbsList");
  unlockedThreads.forEach(t=>{
    const row = el("div","fileRow bevel");
    row.innerHTML = `
      <span class="badge">${t.tag}</span>
      <div>
        <div><b>${escapeHtml(t.title)}</b></div>
        <div class="small muted">thread id: ${t.id}</div>
      </div>
    `;
    row.addEventListener("dblclick",()=>{
      AudioEngine.uiClick();
      openBBSThread(t.id);
    });
    list.appendChild(row);
  });

  if (hasGate){
    const gate = el("div","fileRow bevel");
    gate.innerHTML = `
      <span class="badge red">HIDDEN</span>
      <div style="flex:1">
        <div><b>/underneath</b></div>
        <div class="small muted">enter password to view</div>
      </div>
      <button class="action" id="bbsGateBtn">Enter</button>
    `;
    gate.querySelector("#bbsGateBtn").addEventListener("click",()=>{
      AudioEngine.uiClick();
      openBBSUnderneathGate();
    });
    list.appendChild(gate);
  }

  createWindow({ id:"win_bbs", title:"Dial-up BBS", icon:"📞", x:320, y:80, w:760, h:480, contentNode:c });
}

function openBBSThread(id){
  const c = el("div");
  let body = "";

  if (id==="t0"){
    body = `
> Welcome to northbridge.sys
> Keep it short. Keep it true.
> Don’t type names you want back.

Thread:
People say 33 Willow Gate hums because the wires never got replaced.
Others say it hums because the house is busy copying you.

Rule posted by SYSOP:
"If it imitates someone you miss — do not answer.
If it asks for an invitation — do not provide it."
`;
  }
  if (id==="t1"){
    body = `
M. Hale posted (cached):
"Kara wasn’t joking anymore. She was… rehearsing.
Like she knew she'd have one chance to say the right thing."

Reply (deleted):
"it doesn't want her. it wants the door."
`;
  }
  if (id==="t2"){
    body = `
Audio nerds:
"The hiss has a repeating envelope. Like breathing.
Also: there’s a phrase hidden in the noise if you invert the tape."

SYSOP:
"We're not doing 'inversions' on this board. Use your own machine."
`;
  }
  if (id==="t3"){
    body = `
User: darkroom_dan
"Negative inversion shows a second presence INSIDE the reflection.
It's holding her wrist like it's teaching her how to wave."

SYSOP:
"If you can see it, it can see you."
`;
  }

  c.innerHTML = `
    <div><b>Thread: ${escapeHtml(id)}</b></div>
    <hr/>
    <pre class="muted">${escapeHtml(body).replaceAll("&gt;",">")}</pre>
  `;
  createWindow({ id:"win_bbs_"+id, title:"BBS Thread "+id, icon:"🧵", x:380, y:120, w:700, h:420, contentNode:c });
}

function openBBSUnderneathGate(){
  const c = el("div");
  c.innerHTML = `
    <div><b>/underneath</b> <span class="badge red">LOCKED</span></div>
    <div class="small muted">Password required.</div>
    <hr/>
    <div class="inputRow">
      <input id="bbsPass" placeholder="password..." />
      <button class="action" id="bbsTry">Enter</button>
    </div>
    <div class="small muted" style="margin-top:10px">
      Hint: It’s the phrase SpectralView gives you when the negative is inverted.
    </div>
  `;

  c.querySelector("#bbsTry").addEventListener("click",()=>{
    AudioEngine.uiClick();
    const p = c.querySelector("#bbsPass").value.trim().toLowerCase();
    if (p === "run the lights"){
      flashSignal("BBS", "Board unlocked.\nA new file is pushed to your desktop.", 1500, true);
      addNote("BBS /underneath unlocked.");
      S.flags.unlockedDontOpen = true;
      renderDesktopIcons();
      closeWindow("win_bbs_gate");
    } else {
      S.paranoia += 1;
      flashSignal("BBS", "Wrong password.\nThe modem laughs once.", 1400, true);
      AudioEngine.modemChirp();
    }
  });

  createWindow({ id:"win_bbs_gate", title:"/underneath", icon:"🔒", x:460, y:170, w:560, h:300, contentNode:c });
}

/* ---------------- Trash ---------------- */

function openTrash(){
  maybeSignal("TRASH");
  const c = el("div");
  c.innerHTML = `
    <div><b>TRASH</b></div>
    <hr/>
    <pre class="muted">
You find a deleted note:

"She’s not missing.
She’s distributed.
Across reflections."

The file restores itself, then deletes itself again.
    </pre>
  `;
  S.paranoia += 1;
  updateAudioMood();
  createWindow({ id:"win_trash", title:"Trash", icon:"🗑", x:620, y:130, w:540, h:340, contentNode:c });
}

/* ---------------- Final sequences ---------------- */

function startFinalSequence(){
  flashSignal("WILLOW GATE", "The hum climbs through your speakers.\nA prompt appears—uninvited.", 1600, true);

  const c = el("div");
  c.innerHTML = `
    <div><b>Remote Session: 33 WILLOW GATE</b> <span class="badge red">LIVE</span></div>
    <div class="small muted">The drive is dialing something that doesn’t exist.</div>
    <hr/>
    <pre>
A window appears within the window.

You see the upstairs glass.
Behind it: Kara.
But her lips do not move with her whisper.

The other presence is close enough to fog the pane.

It types into your terminal:

"I can bring her home.
Invite me."
    </pre>
    <div class="small muted">Choose carefully.</div>
    <div class="inputRow">
      <button class="action" id="invite">Invite (say her name)</button>
      <button class="action" id="refuse">Refuse</button>
    </div>
    <div class="small muted" style="margin-top:10px">
      Reminder from pager: don’t say her name aloud.
    </div>
  `;

  c.querySelector("#invite").addEventListener("click",()=>{ AudioEngine.uiClick(); S.flags.everSaidName = true; startBadEnding(); });
  c.querySelector("#refuse").addEventListener("click",()=>{ AudioEngine.uiClick(); S.flags.refusedInvite = true; startGoodEnding(); });

  createWindow({ id:"win_final", title:"Connection", icon:"📞", x:300, y:60, w:800, h:480, contentNode:c });
}

function startBadEnding(){
  // BAD END
  setStatus("INVITED", true);
  S.flags.everSaidName = true;
  S.paranoia += 3;
  updateAudioMood();

  flashSignal("THRESHOLD", "You speak her name.\nThe hum stops.\nBecause it has moved.", 2200, true);

  const c = el("div");
  c.innerHTML = `
    <div><b>Ending: THE INVITATION</b> <span class="badge red">BAD</span></div>
    <hr/>
    <pre>
The screen goes perfectly still.
No scanlines.
No cursor.

Then a new window opens:

"THANK YOU."

Your desktop wallpaper becomes a reflection.
You see your own room—behind you—through the monitor.

Kara is not there.
But something wearing her outline waves.

Your Start button clicks itself.
Over and over.
As if knocking.

CASE STATUS: CLOSED
(You were the door.)
    </pre>
    <div class="inputRow">
      <button class="action" id="restart">Hard Reset</button>
      <button class="action" id="save">Save</button>
    </div>
  `;

  c.querySelector("#restart").addEventListener("click",()=>{ AudioEngine.uiClick(); hardReset(); });
  c.querySelector("#save").addEventListener("click",()=>{ AudioEngine.uiClick(); saveGame(); });

  createWindow({ id:"win_end_bad", title:"THE INVITATION", icon:"☒", x:320, y:90, w:760, h:440, contentNode:c });
}

function startGoodEnding(){
  setStatus("REFUSED", false);
  S.paranoia = Math.max(0, S.paranoia-1);
  updateAudioMood();

  flashSignal("RULE", "You refuse.\nYou do not offer a threshold.\nThe hum fractures—then retreats.", 2200, false);

  const c = el("div");
  c.innerHTML = `
    <div><b>Ending: THE RULE HOLDS</b> <span class="badge green">GOOD</span></div>
    <hr/>
    <pre>
You type nothing.
You say nothing.

The presence presses against the glass—furious—
but a rule is a lock.

In the inverted negative, Kara’s eyes shift.
A blink.
A message scratched into the reflection:

"RUN THE LIGHTS."

You flip your desk lamp on.
The CRT glare whitens the room.
For one breath, the monitor shows only you.

Then, a final file appears on the desktop:

"kara_location.txt"

It contains coordinates… and a note:
"NOT INSIDE. UNDERNEATH."

CASE STATUS: OPEN
(But now you know where to dig.)
    </pre>
    <div class="inputRow">
      <button class="action" id="save">Save</button>
      <button class="action" id="reboot">Reboot</button>
    </div>
    <div class="small muted" style="margin-top:10px">
      There’s a feeling this isn’t the last ending.
    </div>
  `;

  c.querySelector("#save").addEventListener("click",()=>{ AudioEngine.uiClick(); saveGame(); });
  c.querySelector("#reboot").addEventListener("click",()=>{ AudioEngine.uiClick(); softReboot(); });

  createWindow({ id:"win_end_good", title:"THE RULE HOLDS", icon:"☑", x:320, y:90, w:760, h:460, contentNode:c });
}

/* ---------------- TRUE ENDING: DONT_OPEN ---------------- */

function openDontOpen(){
  maybeSignal("DONT_OPEN");
  const c = el("div");

  // true ending only if:
  // - refused invite
  // - ran the lights
  // - soft rebooted once
  const canTrue = S.flags.refusedInvite && S.flags.ranLights && S.flags.softRebootedOnce && !S.flags.everSaidName;

  c.innerHTML = `
    <div><b>D:\\DONT_OPEN</b> <span class="badge red">HIDDEN</span></div>
    <div class="small muted">This folder did not exist before the reboot.</div>
    <hr/>
    <div class="fileList">
      <div class="fileRow bevel" data-x="x1">
        <span class="badge">TXT</span>
        <div>
          <div><b>underneath.txt</b></div>
          <div class="small muted">a place, not a house</div>
        </div>
      </div>
      <div class="fileRow bevel" data-x="x2">
        <span class="badge red">SYS</span>
        <div>
          <div><b>mirror.key</b></div>
          <div class="small muted">${canTrue ? "ready" : "corrupted"}</div>
        </div>
      </div>
    </div>
    <hr/>
    <div class="small muted">
      ${canTrue ? `The key looks… accepted.` : `The key looks… rejected.`}
    </div>
  `;

  c.querySelectorAll(".fileRow").forEach(r=>{
    r.addEventListener("dblclick",()=>{
      AudioEngine.uiClick();
      const x = r.getAttribute("data-x");
      if (x==="x1") openUnderneathTxt(canTrue);
      if (x==="x2") openMirrorKey(canTrue);
    });
  });

  createWindow({ id:"win_dont", title:"DONT_OPEN", icon:"🟥", x:340, y:120, w:700, h:430, contentNode:c });
}

function openUnderneathTxt(canTrue){
  const c = el("div");
  c.innerHTML = `
    <div><b>underneath.txt</b></div>
    <hr/>
    <pre class="muted">
If you are reading this, you refused it.
If you refused it, it is still outside.

The house is a mouth.
The basement is a throat.
Underneath is where it keeps what it can’t wear.

Coordinates (approx):
60.2050 N
24.6550 E

Note:
DO NOT DIG ALONE.
DO NOT BRING A MIRROR.
BRING LIGHT.
    </pre>
  `;
  addNote("underneath.txt: coordinates + warning.");
  if (canTrue && !S.flags.trueEndingSeen){
    flashSignal("UNDERNEATH", "You didn’t win.\nYou just kept the door closed long enough to find the hinge.", 1800, false);
  }
  createWindow({ id:"win_under", title:"underneath.txt", icon:"📄", x:420, y:150, w:720, h:420, contentNode:c });
}

function openMirrorKey(canTrue){
  const c = el("div");
  if (!canTrue){
    c.innerHTML = `
      <div><b>mirror.key</b> <span class="badge red">CORRUPT</span></div>
      <hr/>
      <pre class="muted">
The key is incomplete.
A name was spoken somewhere in this timeline.
The lock has learned your voice.
      </pre>
    `;
    createWindow({ id:"win_mkey", title:"mirror.key", icon:"🗝️", x:460, y:170, w:640, h:360, contentNode:c });
    return;
  }

  S.flags.trueEndingSeen = true;

  c.innerHTML = `
    <div><b>mirror.key</b> <span class="badge green">VALID</span></div>
    <hr/>
    <pre>
It never wanted Kara.
It wanted the first person who would keep looking.

You did.

But you didn’t invite it.
You didn’t say the name.

So the drive gives you a key that isn’t for a door—
it’s for a direction.

FINAL NOTE:
"Not inside. Underneath."
    </pre>
    <div class="inputRow">
      <button class="action" id="save">Save</button>
      <button class="action" id="reset">Hard Reset</button>
    </div>
  `;
  c.querySelector("#save").addEventListener("click",()=>{ AudioEngine.uiClick(); saveGame(); });
  c.querySelector("#reset").addEventListener("click",()=>{ AudioEngine.uiClick(); hardReset(); });

  flashSignal("TRUE ENDING", "The system stops trying to scare you.\nBecause now it wants you to go there.", 2000, true);

  createWindow({ id:"win_true", title:"mirror.key", icon:"🗝️", x:420, y:130, w:720, h:420, contentNode:c });
}

/* ---------------- Start Menu ---------------- */

function setupStartMenu(){
  const menu = $("#startMenu");
  $("#startBtn").addEventListener("click",()=>{
    AudioEngine.uiClick();
    menu.classList.toggle("hidden");
  });

  menu.querySelectorAll(".startItem").forEach(btn=>{
    btn.addEventListener("click",()=>{
      AudioEngine.uiClick();
      menu.classList.add("hidden");
      const act = btn.getAttribute("data-action");
      if (act==="newGame") newGame();
      if (act==="load") loadGame();
      if (act==="save") saveGame();
      if (act==="softReboot") softReboot();
      if (act==="reset") hardReset();
      if (act==="about") openAbout();
      if (act==="weird") openWeirdSite();
    });
  });

  window.addEventListener("click",(e)=>{
    const start = $("#startBtn");
    if (!menu.classList.contains("hidden")){
      if (e.target !== start && !menu.contains(e.target)){
        menu.classList.add("hidden");
      }
    }
  });
}

function openAbout(){
  const c = el("div");
  c.innerHTML = `
    <div><b>About</b></div>
    <hr/>
    <pre class="muted">
LAST SEEN: KARA — Weird Web Edition

Controls:
- Double-click desktop icons
- Drag windows by title bar
- TOOLS: ImageLab, SpectralView, Control Panel, Terminal
- Start menu: Save/Load/Reboot

Meta-rule:
Don't say what it wants you to say.
    </pre>
    <div class="small muted">Also online pages exist: about.html / patch-notes.html / bbs.html</div>
  `;
  createWindow({ id:"win_about", title:"About", icon:"ⓘ", x:420, y:120, w:580, h:360, contentNode:c });
}

function openWeirdSite(){
  const c = el("div");
  c.innerHTML = `
    <div><b>Weird Site</b></div>
    <hr/>
    <div class="muted">
      These pages live on the same server:
      <ul>
        <li><b>/about.html</b></li>
        <li><b>/patch-notes.html</b></li>
        <li><b>/bbs.html</b></li>
      </ul>
      (Open them in a new tab.)
    </div>
    <div class="inputRow">
      <button class="action" id="openAbout">Open about.html</button>
      <button class="action" id="openPatch">Open patch-notes.html</button>
      <button class="action" id="openBbs">Open bbs.html</button>
    </div>
  `;
  c.querySelector("#openAbout").addEventListener("click",()=>{ AudioEngine.uiClick(); window.open("about.html","_blank"); });
  c.querySelector("#openPatch").addEventListener("click",()=>{ AudioEngine.uiClick(); window.open("patch-notes.html","_blank"); });
  c.querySelector("#openBbs").addEventListener("click",()=>{ AudioEngine.uiClick(); window.open("bbs.html","_blank"); });
  createWindow({ id:"win_weird", title:"Weird Site", icon:"🕸️", x:480, y:150, w:660, h:360, contentNode:c });
}

/* ---------------- Haunt system ---------------- */

function updateAudioMood(){
  // increase hum/noise with paranoia + key flags
  const v = Math.min(1, (S.paranoia/10) + (S.flags.sawPhotoNegative?0.2:0) + (S.flags.everSaidName?0.35:0));
  AudioEngine.setHumIntensity(v);
}

function hauntTick(){
  if (!S.started) return;
  const now = Date.now();
  if (now - S.haunt.lastHauntAt < 2500) return;

  const p = Math.min(0.08 + S.paranoia*0.03, 0.55);
  if (Math.random() > p) return;

  S.haunt.lastHauntAt = now;
  updateAudioMood();

  // 1) icon corruption refresh
  if (Math.random() < 0.40){
    renderDesktopIcons();
    return;
  }

  // 2) window drift
  if (Math.random() < 0.30 && windows.size){
    const arr = Array.from(windows.values());
    const w = arr[Math.floor(Math.random()*arr.length)].node;
    const dx = (Math.random()<0.5 ? -1 : 1) * (1 + Math.floor(Math.random()*2));
    const dy = (Math.random()<0.5 ? -1 : 1) * (1 + Math.floor(Math.random()*2));
    w.style.left = (w.offsetLeft + dx) + "px";
    w.style.top  = (w.offsetTop + dy) + "px";
    return;
  }

  // 3) fake error popup
  if (Math.random() < 0.30){
    openFakeError();
    return;
  }
}

function openFakeError(){
  const c = el("div");
  const messages = [
    "Mirror sync lost.\nReacquiring reflection…",
    "Disk read error.\nThe sector is breathing.",
    "Dial-up connection established.\nRemote endpoint: UNKNOWN",
    "A process is using your keyboard.\nProcess: INVITE.EXE",
    "System time corrected.\nIt is earlier than it was."
  ];
  const msg = messages[Math.floor(Math.random()*messages.length)];
  c.innerHTML = `
    <div><b>System Alert</b> <span class="badge red">ERROR</span></div>
    <hr/>
    <pre class="muted">${escapeHtml(msg)}</pre>
    <div class="inputRow">
      <button class="action" id="ok">OK</button>
    </div>
  `;
  c.querySelector("#ok").addEventListener("click",()=>{ AudioEngine.uiClick(); closeWindow("win_err"); });
  createWindow({ id:"win_err", title:"System Alert", icon:"⚠️", x:520, y:110, w:520, h:260, contentNode:c });
  S.paranoia += 1;
  updateAudioMood();
}

/* ---------------- Screensaver (idle) ---------------- */

function markInput(){
  S.idle.lastInputAt = Date.now();
  if (S.idle.active){
    S.idle.active = false;
    $("#screensaver").classList.add("hidden");
  }
}

function screensaverTick(){
  if (!S.started) return;
  const idleMs = Date.now() - S.idle.lastInputAt;
  const threshold = 45000; // 45s
  if (!S.idle.active && idleMs > threshold){
    S.idle.active = true;
    $("#screensaver").classList.remove("hidden");

    // occasionally show "movement"
    const ghost = $("#ssGhost");
    if (S.paranoia >= 4 && Math.random()<0.6){
      ghost.style.filter = "brightness(1.2)";
      flashSignal("SCREENSAVER", "Something crosses the reflection.\nNot on your side.", 1500, true);
    } else {
      ghost.style.filter = "none";
    }
  }
}

/* ---------------- Reboot ---------------- */

function softReboot(){
  // If the player refused + ran lights, reboot can unlock hidden folder (true ending path)
  if (S.flags.refusedInvite && S.flags.ranLights){
    S.flags.unlockedDontOpen = true;
  }
  S.flags.softRebootedOnce = true;

  // close all windows
  for (const id of Array.from(windows.keys())) closeWindow(id);

  $("#desktop").classList.add("hidden");
  $("#boot").classList.remove("hidden");

  flashSignal("REBOOT", "The system restarts.\nThe reflection doesn't.", 1200, true);

  // restart boot sequence quickly
  startBoot(true);
}

/* ---------------- Boot -> Desktop ---------------- */

function startBoot(isReboot=false){
  const out = $("#bootText");
  out.textContent = "";
  let i=0;

  const lines = isReboot
    ? ["KX-OS 95", "Restarting services...", "Restoring session...", "Press ENTER to continue."]
    : bootLines;

  const tick = ()=>{
    if (i < lines.length){
      out.textContent += lines[i] + "\n";
      i++;
      setTimeout(tick, 55 + Math.random()*45);
    }
  };
  tick();

  const proceed = () => {
    $("#boot").classList.add("hidden");
    $("#desktop").classList.remove("hidden");
    initDesktop();
  };

  // ensure focus
  window.focus();
  document.body.tabIndex = -1;
  document.body.focus();

  const onKey = (e) => {
    if (e.key === "Enter" || e.key === " "){
      e.preventDefault();
      window.removeEventListener("keydown", onKey);
      proceed();
    }
  };
  window.addEventListener("keydown", onKey);

  $("#boot").addEventListener("click", () => {
    window.removeEventListener("keydown", onKey);
    proceed();
  }, { once:true });
}

function initDesktop(){
  $("#clock").textContent = nowClock();
  // update every second
  if (!window.__clockInt){
    window.__clockInt = setInterval(()=>$("#clock").textContent = nowClock(), 1000);
  }

  setupStartMenu();
  renderDesktopIcons();
  updateAudioMood();

  // Start audio on first interaction to satisfy browser policies
  const startAudioOnce = () => {
    AudioEngine.ensure();
    AudioEngine.startAmbient();
    window.removeEventListener("pointerdown", startAudioOnce);
    window.removeEventListener("keydown", startAudioOnce);
  };
  window.addEventListener("pointerdown", startAudioOnce);
  window.addEventListener("keydown", startAudioOnce);

  // mute toggle
  $("#muteBtn").addEventListener("click",()=>{
    AudioEngine.uiClick();
    S.audio.muted = !S.audio.muted;
    AudioEngine.setMuted(S.audio.muted);
    $("#muteBtn").textContent = S.audio.muted ? "🔇" : "🔊";
  });

  // load hint
  const hasSave = !!localStorage.getItem(SAVE_KEY);
  if (!S.started){
    flashSignal("SYSTEM", hasSave ? "Save detected.\nStart → Load to continue.\nOr New Game." : "Start → New Game", 1500, false);
  }

  // input tracking for screensaver
  if (!window.__inputHooks){
    window.__inputHooks = true;
    ["mousemove","mousedown","keydown","touchstart","wheel"].forEach(ev=>{
      window.addEventListener(ev, markInput, { passive:true });
    });
  }

  // periodic systems
  if (!window.__hauntInt){
    window.__hauntInt = setInterval(hauntTick, 1100);
    window.__signalInt = setInterval(()=>maybeSignal("…"), 4200);
    window.__ssInt = setInterval(screensaverTick, 900);
  }
}

/* ---------------- New Game ---------------- */

function newGame(){
  S.started = true;
  S.notes = [];
  S.inventory = [];
  S.paranoia = 0;
  S.flags.openedCaseFile = false;
  S.flags.readMailbox = false;
  S.flags.unlockedDiary = false;
  S.flags.listenedVoicemail = false;
  S.flags.decodedPager = false;
  S.flags.foundBasementKey = false;
  S.flags.openedBasement = false;
  S.flags.sawPhotoNegative = false;
  S.flags.ranLights = false;
  S.flags.refusedInvite = false;
  S.flags.everSaidName = false;
  S.flags.softRebootedOnce = false;
  S.flags.unlockedDontOpen = false;
  S.flags.trueEndingSeen = false;

  addNote("Booted case drive. The hum is in the speakers.");
  renderDesktopIcons();
  openCaseFile();
  setStatus("READY");
  updateAudioMood();
}

/* ---------------- Start ---------------- */
startBoot(false);
