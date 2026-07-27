/* ═══════════════════════════════════════════════
   Ellipi Messenger — app.js
   Full interactive logic: navigation, messaging,
   search, emoji picker, real-time clock
   ═══════════════════════════════════════════════ */

'use strict';

// ── Data ─────────────────────────────────────────────────────────────────────

const conversations = [
  { id:1, name:"سارة أحمد",  msg:"تمام، نشوف بكرة إن شاء الله 👍", time:"الآن",     unread:3, color:"#FF6B6B", online:true  },
  { id:2, name:"محمد علي",   msg:"وصلت الصورة؟",                    time:"٢ د",     unread:0, color:"#4ECDC4", online:true  },
  { id:3, name:"نورا خالد",  msg:"شكراً جزيلاً 🙏",                 time:"١٥ د",    unread:1, color:"#A29BFE", online:false },
  { id:4, name:"خالد ناصر",  msg:"حلوة الفكرة، بنفذها",            time:"١ س",     unread:0, color:"#FD79A8", online:false },
  { id:5, name:"ريم سعد",    msg:"هل أنت متاح الآن؟",              time:"٢ س",     unread:0, color:"#FDCB6E", online:true  },
  { id:6, name:"أحمد يوسف",  msg:"تم الإرسال ✓",                   time:"أمس",     unread:0, color:"#6C5CE7", online:false },
  { id:7, name:"هند فيصل",   msg:"ما وصلني شي",                    time:"أمس",     unread:2, color:"#00B894", online:false },
  { id:8, name:"فيصل عمر",   msg:"اوكي تمام",                       time:"الثلاثاء",unread:0, color:"#E17055", online:false },
];

const groups = [
  { id:101, name:"فريق العمل",    msg:"متى الاجتماع القادم؟",   time:"١ س",  unread:5, color:"#0984E3", online:false },
  { id:102, name:"العائلة 👨‍👩‍👧‍👦",     msg:"اتصل بي على الجوال",   time:"٣ س",  unread:0, color:"#6C5CE7", online:false },
  { id:103, name:"مجموعة الأصحاب", msg:"وين الوناسة؟ 🎉",        time:"أمس",  unread:1, color:"#00B894", online:false },
];

// Per-conversation message history
const allMessages = {
  1: [
    { id:1, text:"أهلاً! كيف حالك؟",                                                   mine:false, time:"١٠:٣٠" },
    { id:2, text:"الحمد لله بخير، وأنت؟ 😊",                                            mine:true,  time:"١٠:٣١", seen:true  },
    { id:3, text:"تمام الحمد لله. شو أخبار المشروع؟",                                   mine:false, time:"١٠:٣١" },
    { id:4, text:"ماشي الأمور، خلصنا من الجزء الأول وبكرة نبدأ بالثاني إن شاء الله",   mine:true,  time:"١٠:٣٣", seen:true  },
    { id:5, text:"ممتاز! هل تحتاج مساعدة في شي؟",                                      mine:false, time:"١٠:٣٣" },
    { id:6, text:"لا يعطيك العافية، الأمور تمام 🙏",                                     mine:true,  time:"١٠:٣٥", seen:true  },
    { id:7, text:"إن شاء الله دايماً بخير",                                              mine:false, time:"١٠:٣٦" },
    { id:8, text:"تمام، نشوف بكرة إن شاء الله 👍",                                      mine:false, time:"١٠:٣٨" },
  ],
  2: [
    { id:1, text:"مرحبا محمد",                                                           mine:true,  time:"٩:١٠", seen:true },
    { id:2, text:"أهلاً! كيف أقدر أساعدك؟",                                             mine:false, time:"٩:١٢" },
    { id:3, text:"أرسلت لك الصورة على الإيميل",                                          mine:true,  time:"٩:١٥", seen:true },
    { id:4, text:"وصلت الصورة؟",                                                          mine:false, time:"٩:٢٠" },
  ],
  3: [
    { id:1, text:"مساء الخير نورا",                                                      mine:true,  time:"٨:٠٠", seen:true },
    { id:2, text:"مساء النور! كيف حالك؟",                                                mine:false, time:"٨:٠٢" },
    { id:3, text:"بخير الحمد لله، أردت أشكرك على مساعدتك أمس",                          mine:true,  time:"٨:٠٥", seen:true },
    { id:4, text:"شكراً جزيلاً 🙏",                                                       mine:false, time:"٨:٠٧" },
  ],
};

const EMOJIS = [
  "😊","😂","❤️","👍","🙏","😍","🎉","🔥","💯","✨",
  "😎","🥰","😢","😭","🤔","👏","💪","🤣","😅","🥳",
  "👋","🙌","💬","📱","✅","❌","⭐","💡","🎯","🚀",
];

const tabs = [
  { icon:"💬", label:"الرسائل",  screen:"messages" },
  { icon:"📞", label:"المكالمات",screen:"calls"    },
  { icon:"👥", label:"المجموعات",screen:"groups"   },
  { icon:"⚙️", label:"الإعدادات",screen:"profile"  },
];

// ── State ─────────────────────────────────────────────────────────────────────
let currentConvId = null;
let nextMsgId = 100;

// ── Helpers ───────────────────────────────────────────────────────────────────
function nowTime() {
  const d = new Date();
  const h = d.getHours().toString().padStart(2,'0');
  const m = d.getMinutes().toString().padStart(2,'0');
  return `${h}:${m}`;
}

function svgChevronLeft() {
  return `<svg width="8" height="14" viewBox="0 0 8 14" fill="none"
    stroke="rgba(235,235,245,0.3)" stroke-width="2" stroke-linecap="round">
    <polyline points="1 1 7 7 1 13"/>
  </svg>`;
}

function seenSvg(seen) {
  if (seen === undefined) return '';
  const blue = '#007AFF', grey = 'rgba(235,235,245,0.4)';
  const c = seen ? blue : grey;
  return `<svg width="14" height="10" viewBox="0 0 16 12" fill="none">
    <path d="M1 6l4 4L15 1" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    ${seen ? `<path d="M5 6l4 4" stroke="${blue}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
  </svg>`;
}

// ── Render conversation list ──────────────────────────────────────────────────
function renderConvList(filter = '') {
  const container = document.getElementById('conv-list');
  container.innerHTML = '';
  const filtered = conversations.filter(c =>
    !filter || c.name.includes(filter) || c.msg.includes(filter)
  );
  if (filtered.length === 0) {
    container.innerHTML = `<div style="padding:40px;text-align:center;color:rgba(235,235,245,0.3);font-size:15px">لا توجد نتائج</div>`;
    return;
  }
  filtered.forEach(c => {
    const item = document.createElement('div');
    item.className = 'conv-item';
    item.innerHTML = `
      <div class="avatar" style="background:${c.color};box-shadow:0 2px 12px ${c.color}44">
        ${c.name.charAt(0)}
        ${c.online ? '<div class="online-dot"></div>' : ''}
      </div>
      <div class="conv-content">
        <div class="conv-row" style="margin-bottom:3px">
          <span class="conv-time">${c.time}</span>
          <span class="conv-name">${c.name}</span>
        </div>
        <div class="conv-row">
          ${c.unread > 0
            ? `<div class="unread-badge">${c.unread}</div>`
            : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(235,235,245,0.25)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`}
          <span class="conv-msg">${c.msg}</span>
        </div>
      </div>`;
    item.addEventListener('click', () => openChat(c));
    container.appendChild(item);
  });
}

// ── Render groups list ────────────────────────────────────────────────────────
function renderGroupsList() {
  const container = document.getElementById('groups-list');
  if (!container) return;
  container.innerHTML = '';
  groups.forEach(g => {
    const item = document.createElement('div');
    item.className = 'conv-item';
    item.innerHTML = `
      <div class="avatar" style="background:${g.color};box-shadow:0 2px 12px ${g.color}44;font-size:18px">
        ${g.name.charAt(0)}
      </div>
      <div class="conv-content">
        <div class="conv-row" style="margin-bottom:3px">
          <span class="conv-time">${g.time}</span>
          <span class="conv-name">${g.name}</span>
        </div>
        <div class="conv-row">
          ${g.unread > 0
            ? `<div class="unread-badge">${g.unread}</div>`
            : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(235,235,245,0.25)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`}
          <span class="conv-msg">${g.msg}</span>
        </div>
      </div>`;
    container.appendChild(item);
  });
}

// ── Open chat ─────────────────────────────────────────────────────────────────
function openChat(conv) {
  currentConvId = conv.id;

  // Update header
  const headerAvatar = document.getElementById('chat-avatar-header');
  headerAvatar.style.background = conv.color;
  headerAvatar.style.boxShadow = `0 2px 12px ${conv.color}44`;
  headerAvatar.childNodes[0].textContent = conv.name.charAt(0);
  document.getElementById('chat-name-header').textContent = conv.name;
  document.getElementById('chat-status-header').textContent = conv.online ? 'نشطة الآن' : 'آخر ظهور اليوم';
  document.getElementById('chat-status-header').style.color = conv.online ? '#34C759' : 'rgba(235,235,245,0.4)';

  // Back button unread count
  const totalUnread = conversations.reduce((s, c) => s + (c.id !== conv.id ? c.unread : 0), 0);
  const backEl = document.getElementById('back-unread-count');
  backEl.textContent = totalUnread > 0 ? String(totalUnread) : '';

  // Clear unread for this conv
  const c = conversations.find(x => x.id === conv.id);
  if (c) c.unread = 0;

  renderMessages();
  showScreen('chat');
  document.getElementById('msg-input').focus();
}

// ── Render messages ───────────────────────────────────────────────────────────
function renderMessages() {
  const area = document.getElementById('messages-area');
  area.innerHTML = '';
  const msgs = allMessages[currentConvId] || [];
  msgs.forEach((m, i) => {
    const prev = msgs[i - 1];
    const showGap = !prev || prev.mine !== m.mine;
    appendMessageBubble(area, m, showGap, false);
  });
  area.scrollTop = area.scrollHeight;
}

function appendMessageBubble(area, m, showGap, animate) {
  const wrap = document.createElement('div');
  wrap.style.cssText = `display:flex;flex-direction:column;align-items:${m.mine ? 'flex-end' : 'flex-start'};margin-top:${showGap ? '8' : '2'}px`;
  if (animate) wrap.classList.add('msg-new');
  wrap.innerHTML = `
    <div class="bubble ${m.mine ? 'mine' : 'other'}">${escapeHtml(m.text)}</div>
    <div class="msg-meta">
      <span class="msg-time">${m.time}</span>
      ${m.mine ? seenSvg(m.seen) : ''}
    </div>`;
  area.appendChild(wrap);
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Send message ──────────────────────────────────────────────────────────────
function sendMessage() {
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if (!text || currentConvId === null) return;

  input.value = '';
  closeEmojiPicker();

  const t = nowTime();
  const msg = { id: nextMsgId++, text, mine: true, time: t, seen: false };

  if (!allMessages[currentConvId]) allMessages[currentConvId] = [];
  const msgs = allMessages[currentConvId];
  msgs.push(msg);

  const area = document.getElementById('messages-area');
  const prev = msgs[msgs.length - 2];
  const showGap = !prev || !prev.mine;
  appendMessageBubble(area, msg, showGap, true);
  area.scrollTop = area.scrollHeight;

  // Update conversation preview
  const conv = conversations.find(c => c.id === currentConvId);
  if (conv) {
    conv.msg = text;
    conv.time = 'الآن';
  }

  // Simulate reply after 1-2 s
  const replies = [
    "حسناً، فهمت 👍",
    "شكراً!",
    "سأتحقق من ذلك",
    "موافق، بكرة إن شاء الله",
    "تمام! 😊",
    "حسناً، انتظرني قليلاً",
  ];
  const delay = 900 + Math.random() * 700;
  setTimeout(() => {
    if (currentConvId === null) return;
    const reply = { id: nextMsgId++, text: replies[Math.floor(Math.random() * replies.length)], mine: false, time: nowTime() };
    allMessages[currentConvId].push(reply);
    const a = document.getElementById('messages-area');
    const p = allMessages[currentConvId][allMessages[currentConvId].length - 2];
    appendMessageBubble(a, reply, p ? p.mine !== reply.mine : true, true);
    a.scrollTop = a.scrollHeight;
    // update preview
    if (conv) { conv.msg = reply.text; conv.time = 'الآن'; }
  }, delay);
}

// ── Emoji picker ──────────────────────────────────────────────────────────────
function closeEmojiPicker() {
  document.getElementById('emoji-picker').classList.remove('open');
}

function initEmojiPicker() {
  const grid = document.getElementById('emoji-grid');
  EMOJIS.forEach(e => {
    const span = document.createElement('span');
    span.textContent = e;
    span.addEventListener('click', () => {
      const input = document.getElementById('msg-input');
      input.value += e;
      input.focus();
      closeEmojiPicker();
    });
    grid.appendChild(span);
  });

  document.getElementById('emoji-btn').addEventListener('click', (ev) => {
    ev.stopPropagation();
    document.getElementById('emoji-picker').classList.toggle('open');
  });

  document.addEventListener('click', () => closeEmojiPicker());
  document.getElementById('emoji-picker').addEventListener('click', e => e.stopPropagation());
}

// ── Tab bars ──────────────────────────────────────────────────────────────────
function buildTabBar(containerId, activeScreen) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  tabs.forEach(t => {
    const item = document.createElement('div');
    item.className = 'tab-item';
    const isActive = t.screen === activeScreen;
    item.innerHTML = `
      <span class="tab-icon">${t.icon}</span>
      <span class="tab-label ${isActive ? 'active' : ''}">${t.label}</span>`;
    item.addEventListener('click', () => showScreen(t.screen));
    container.appendChild(item);
  });
}

// ── Screen navigation ─────────────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('screen-' + name);
  if (target) target.classList.add('active');
  // refresh list on return
  if (name === 'messages') renderConvList(document.getElementById('search-input').value);
  if (name === 'groups') renderGroupsList();
  closeEmojiPicker();
}

// ── Live clock ────────────────────────────────────────────────────────────────
function updateClocks() {
  const now = new Date();
  const h = now.getHours().toString().padStart(2,'0');
  const m = now.getMinutes().toString().padStart(2,'0');
  const display = `${h}:${m}`;
  document.querySelectorAll('.status-time').forEach(el => { el.textContent = display; });
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Build initial lists
  renderConvList();
  renderGroupsList();

  // Build all tab bars
  buildTabBar('tabbar-messages', 'messages');
  buildTabBar('tabbar-calls',    'calls');
  buildTabBar('tabbar-groups',   'groups');
  buildTabBar('tabbar-profile',  'profile');

  // Search
  document.getElementById('search-input').addEventListener('input', e => {
    renderConvList(e.target.value.trim());
  });

  // Chat back button
  document.getElementById('chat-back-btn').addEventListener('click', () => {
    currentConvId = null;
    showScreen('messages');
  });

  // Send button
  document.getElementById('send-btn').addEventListener('click', sendMessage);

  // Send on Enter
  document.getElementById('msg-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // Emoji picker
  initEmojiPicker();

  // Live clock — update every 30 s
  updateClocks();
  setInterval(updateClocks, 30000);
});
