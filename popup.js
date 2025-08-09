// popup.js
const STORAGE_AREA = chrome.storage.sync; // change to chrome.storage.local if you prefer
const DEFAULTS = { prompts: [] };

document.addEventListener('DOMContentLoaded', () => {
  bindUI();
  loadPrompts();
});

function bindUI(){
  document.getElementById('saveBtn').addEventListener('click', savePrompt);
  document.getElementById('exportBtn').addEventListener('click', exportPrompts);
  document.getElementById('importInput').addEventListener('change', importPrompts);
  document.getElementById('list').addEventListener('click', listClickHandler);
}

function loadPrompts(){
  STORAGE_AREA.get(DEFAULTS, res => {
    renderList(res.prompts || []);
  });
}

function savePrompt(){
  const name = document.getElementById('name').value.trim();
  const text = document.getElementById('text').value;
  const tags = (document.getElementById('tags').value || '').split(',').map(s=>s.trim()).filter(Boolean);

  if(!name || !text){ alert('Please provide name and prompt text'); return; }

  STORAGE_AREA.get(DEFAULTS, res => {
    const prompts = res.prompts || [];
    prompts.unshift({ id: Date.now(), name, text, tags });
    STORAGE_AREA.set({ prompts }, () => {
      document.getElementById('name').value = '';
      document.getElementById('text').value = '';
      document.getElementById('tags').value = '';
      renderList(prompts);
    });
  });
}

function renderList(prompts){
  const container = document.getElementById('list');
  if(!prompts.length) { container.innerHTML = '<small>No prompts saved yet</small>'; return; }
  container.innerHTML = prompts.map(p => `
    <div class="card" data-id="${p.id}">
      <strong>${escapeHtml(p.name)}</strong>
      <pre>${escapeHtml(p.text)}</pre>
      <div class="actions">
        <button class="copy">Copy</button>
        <button class="insert">Insert</button>
        <button class="delete">Delete</button>
      </div>
    </div>
  `).join('');
}

function listClickHandler(e){
  const card = e.target.closest('.card');
  if(!card) return;
  const id = Number(card.dataset.id);
  STORAGE_AREA.get(DEFAULTS, res => {
    const prompts = res.prompts || [];
    const p = prompts.find(x=>x.id===id);
    if(!p) return;
    if(e.target.classList.contains('copy')) {
      copyText(p.text);
    } else if(e.target.classList.contains('insert')) {
      setPendingInsert(p.text);
    } else if(e.target.classList.contains('delete')) {
      const newList = prompts.filter(x=>x.id!==id);
      STORAGE_AREA.set({prompts: newList}, () => renderList(newList));
    }
  });
}

function copyText(text){
  // copy from popup context (works reliably)
  navigator.clipboard?.writeText(text).then(()=> {
    showToast('Copied to clipboard');
  }).catch(() => {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
    showToast('Copied to clipboard (fallback)');
  });
}

function setPendingInsert(text){
  // store text for the background worker to insert when the user hits the keyboard shortcut
  chrome.storage.local.set({ pendingInsert: text }, () => {
    alert('Prompt ready to insert. Click the page input you want, then press Ctrl+Shift+Y (or your configured shortcut).');
    window.close();
  });
}

function exportPrompts(){
  STORAGE_AREA.get(DEFAULTS, res => {
    const blob = new Blob([JSON.stringify(res.prompts||[], null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'prompts.json'; a.click();
    URL.revokeObjectURL(url);
  });
}

function importPrompts(e){
  const file = e.target.files?.[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if(!Array.isArray(data)) throw new Error('Invalid file');
      // Merge: put imported prompts at top
      STORAGE_AREA.get(DEFAULTS, res => {
        const prompts = [...data.map(d=>({ ...d, id: Date.now()+Math.random() })), ...(res.prompts||[])];
        STORAGE_AREA.set({prompts}, () => { renderList(prompts); });
      });
    } catch(err){ alert('Invalid JSON file'); }
  };
  reader.readAsText(file);
}

/* tiny helpers */
function showToast(msg){ console.log(msg); /* implement nicer toast if you want */ }
function escapeHtml(str){ return String(str).replace(/[&<>"']/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[s]); }
