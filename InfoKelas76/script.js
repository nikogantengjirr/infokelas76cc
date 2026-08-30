/* =========================================================================
   KONFIGURASI — tempel link Google Sheet kamu di sini.
   Lihat panduan setup untuk cara mendapatkan link-link ini.
   ========================================================================= */
const SCHEDULE_CSV_URL      = https: '//docs.google.com/spreadsheets/d/e/2PACX-1vThdeu-PqOwByyUXnCYm6Gaxff5lXeYhT8DEai2SClIeb12UUfjctDjVHuCeAbr7lppNYjBUwMcMhKB/pub?gid=0&single=true&output=csv';
const ASSIGNMENTS_CSV_URL   = https: '//docs.google.com/spreadsheets/d/e/2PACX-1vThdeu-PqOwByyUXnCYm6Gaxff5lXeYhT8DEai2SClIeb12UUfjctDjVHuCeAbr7lppNYjBUwMcMhKB/pub?gid=859589409&single=true&output=csv';
const ANNOUNCEMENTS_CSV_URL = https: '//docs.google.com/spreadsheets/d/e/2PACX-1vThdeu-PqOwByyUXnCYm6Gaxff5lXeYhT8DEai2SClIeb12UUfjctDjVHuCeAbr7lppNYjBUwMcMhKB/pub?gid=1729448970&single=true&output=csv';

// Link EDIT ini HARUS link Google Sheet biasa (bukan link "publish to web"),
// contoh: https://docs.google.com/spreadsheets/d/xxxxx/edit
// Hanya orang yang kamu kasih akses "Editor" di Share Sheet ini yang bisa mengedit —
// itu dijaga oleh sistem akun Google, bukan oleh kode di website ini.
const EDIT_SHEET_URL = '';
/* ========================================================================= */

// Parser CSV sederhana yang menangani kolom berisi koma di dalam tanda kutip.
function parseCSV(text){
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for(let i = 0; i < text.length; i++){
    const c = text[i], next = text[i+1];
    if(inQuotes){
      if(c === '"' && next === '"'){ field += '"'; i++; }
      else if(c === '"'){ inQuotes = false; }
      else{ field += c; }
    } else {
      if(c === '"'){ inQuotes = true; }
      else if(c === ','){ row.push(field); field = ''; }
      else if(c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; }
      else if(c === '\r'){ /* skip */ }
      else{ field += c; }
    }
  }
  if(field.length || row.length){ row.push(field); rows.push(row); }
  if(!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).filter(r => r.some(v => v.trim() !== '')).map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = (r[i] || '').trim());
    return obj;
  });
}

async function fetchSheet(url){
  if(!url || url.startsWith('PASTE_')) throw new Error('belum diatur');
  const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'cachebust=' + Date.now());
  if(!res.ok) throw new Error('gagal mengambil data');
  return parseCSV(await res.text());
}

function escapeHtml(str){
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ---------- Reveal saat discroll ----------
function initReveal(){
  const els = document.querySelectorAll('[data-reveal]');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('is-visible'); io.unobserve(e.target); } });
  }, { threshold: 0.1 });
  els.forEach(el => io.observe(el));
}

// ---------- Tombol Edit ----------
function initEditButton(){
  document.querySelectorAll('.edit-btn').forEach(btn => {
    if(EDIT_SHEET_URL && !EDIT_SHEET_URL.startsWith('PASTE_')){
      btn.href = EDIT_SHEET_URL;
      btn.target = '_blank';
      btn.rel = 'noopener';
    } else {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        alert('Link edit belum diatur. Tempel link Google Sheet kamu di script.js pada EDIT_SHEET_URL.');
      });
    }
  });
}

// ---------- Modal ----------
const modalDetails = {};
let modalCounter = 0;
function registerModal(tag, tagText, title, body){
  const id = 'm' + (modalCounter++);
  modalDetails[id] = { tag, tagText, title, body };
  return id;
}
function attachModalHandlers(){
  document.querySelectorAll('[data-modal]').forEach(el => {
    el.onclick = () => {
      const d = modalDetails[el.dataset.modal];
      if(!d) return;
      const overlay = document.getElementById('modal-overlay');
      document.getElementById('modal-tag').textContent = d.tagText;
      document.getElementById('modal-tag').className = 'modal-tag ' + d.tag;
      document.getElementById('modal-title').textContent = d.title;
      document.getElementById('modal-body').textContent = d.body;
      overlay.classList.add('open');
    };
  });
}
function initModal(){
  const overlay = document.getElementById('modal-overlay');
  if(!overlay) return;
  const close = () => overlay.classList.remove('open');
  document.getElementById('modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if(e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => { if(e.key === 'Escape') close(); });
}

// ---------- Countdown "Selanjutnya" ----------
let nextDueDate = null;
function computeUpcoming(rows){
  const now = new Date();
  return rows
    .map(r => ({ ...r, _date: new Date(r.DueDateISO) }))
    .filter(r => !isNaN(r._date) && r._date > now)
    .sort((a,b) => a._date - b._date);
}
function computePast(rows){
  const now = new Date();
  return rows
    .map(r => ({ ...r, _date: new Date(r.DueDateISO) }))
    .filter(r => !isNaN(r._date) && r._date <= now)
    .sort((a,b) => b._date - a._date);
}
function setCountdownFromRows(upcomingRows){
  const nameEl = document.getElementById('next-name');
  const timerEl = document.getElementById('countdown-timer');
  if(!nameEl) return;
  if(upcomingRows.length){
    nameEl.textContent = upcomingRows[0].Name;
    nextDueDate = upcomingRows[0]._date;
  } else {
    nameEl.textContent = 'Tidak ada tugas mendatang';
    if(timerEl) timerEl.textContent = '🎉';
  }
}
function tickCountdown(){
  const timerEl = document.getElementById('countdown-timer');
  if(!timerEl || !nextDueDate) return;
  const diff = nextDueDate - new Date();
  if(diff <= 0){ timerEl.textContent = 'Sudah lewat'; return; }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  timerEl.textContent = d + 'h ' + h + 'j ' + m + 'm';
}
setInterval(tickCountdown, 30000);

document.addEventListener('DOMContentLoaded', () => {
  initReveal();
  initEditButton();
  initModal();
});
