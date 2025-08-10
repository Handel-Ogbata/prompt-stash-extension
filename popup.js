// popup.js - Google Drive integration with persistent storage
let driveAPI;
let currentPrompts = [];
let isInitialized = false;

// Constants
const STORAGE_KEYS = {
  PROMPTS: 'prompts',
  LAST_SYNC: 'lastSync',
  PENDING_INSERT: 'pendingInsert'
};

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_PROMPT_LENGTH = 10000;
const MAX_NAME_LENGTH = 200;

document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  bindUI();
});

async function initializeApp() {
  try {
    showAuthStatus('loading');
    
    // First, try to load from local storage
    const cachedPrompts = await loadFromStorage();
    if (cachedPrompts && cachedPrompts.length > 0) {
      currentPrompts = cachedPrompts;
      showAuthStatus('success');
      handleSearch(); // Render the cached prompts immediately
      console.log('Loaded prompts from cache:', cachedPrompts.length);
    }
    
    // Initialize Drive API and sync in background
    await initializeDriveAPI();
    
  } catch (error) {
    console.error('Failed to initialize app:', error);
    // If we have cached data, don't show error
    if (currentPrompts.length === 0) {
      showAuthStatus('error');
      showToast('Failed to connect to Google Drive. Please check your authentication.');
    } else {
      showAuthStatus('success');
      showToast('Using cached prompts. Some features may be limited.');
    }
  }
}

async function initializeDriveAPI() {
  try {
    driveAPI = new DriveAPI();
    
    // Test authentication by trying to get prompts
    const drivePrompts = await driveAPI.getPrompts();
    
    // Merge with cached prompts (prefer drive version if timestamps are available)
    if (drivePrompts && drivePrompts.length > 0) {
      const mergedPrompts = mergePrompts(currentPrompts, drivePrompts);
      if (JSON.stringify(mergedPrompts) !== JSON.stringify(currentPrompts)) {
        currentPrompts = mergedPrompts;
        await saveToStorage(currentPrompts);
        handleSearch(); // Re-render with merged data
        console.log('Synced prompts from Google Drive:', drivePrompts.length);
      }
    }
    
    showAuthStatus('success');
    
    // Set up periodic sync only if we successfully connected
    setupBackgroundSync();
    
  } catch (error) {
    console.error('Failed to initialize Drive API:', error);
    // Don't show error if we have cached data
    if (currentPrompts.length === 0) {
      showAuthStatus('error');
      showToast('Failed to connect to Google Drive. Please check your authentication.');
    } else {
      showAuthStatus('success');
      showToast('Using cached prompts. Sync will be retried when connection is restored.');
    }
  }
}

async function loadFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.PROMPTS], (result) => {
      if (result[STORAGE_KEYS.PROMPTS]) {
        console.log('Loaded prompts from storage:', result[STORAGE_KEYS.PROMPTS].length);
        resolve(result[STORAGE_KEYS.PROMPTS]);
      } else {
        resolve([]);
      }
    });
  });
}

async function saveToStorage(prompts) {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      [STORAGE_KEYS.PROMPTS]: prompts,
      [STORAGE_KEYS.LAST_SYNC]: Date.now()
    }, () => {
      console.log('Saved prompts to storage:', prompts.length);
      resolve();
    });
  });
}

function mergePrompts(cachedPrompts, drivePrompts) {
  if (!cachedPrompts || cachedPrompts.length === 0) {
    return drivePrompts;
  }
  
  if (!drivePrompts || drivePrompts.length === 0) {
    return cachedPrompts;
  }
  
  // Create a map of cached prompts by ID
  const cachedMap = new Map(cachedPrompts.map(p => [p.id, p]));
  const driveMap = new Map(drivePrompts.map(p => [p.id, p]));
  
  // Merge prompts, preferring drive version if it exists
  const mergedPrompts = [];
  const allIds = new Set([...cachedMap.keys(), ...driveMap.keys()]);
  
  for (const id of allIds) {
    const drivePrompt = driveMap.get(id);
    const cachedPrompt = cachedMap.get(id);
    
    if (drivePrompt) {
      mergedPrompts.push(drivePrompt);
    } else if (cachedPrompt) {
      mergedPrompts.push(cachedPrompt);
    }
  }
  
  // Sort by ID (which is timestamp-based) to maintain order
  return mergedPrompts.sort((a, b) => b.id - a.id);
}

function setupBackgroundSync() {
  // Only sync if we have a driveAPI instance and it's been more than 5 minutes since last sync
  const syncInterval = setInterval(async () => {
    if (!driveAPI) return;
    
    try {
      // Check if it's been more than 5 minutes since last sync
      const result = await chrome.storage.local.get([STORAGE_KEYS.LAST_SYNC]);
      const timeSinceLastSync = Date.now() - (result[STORAGE_KEYS.LAST_SYNC] || 0);
      
      if (timeSinceLastSync > SYNC_INTERVAL) {
        const drivePrompts = await driveAPI.getPrompts();
        if (drivePrompts && drivePrompts.length > 0) {
          const mergedPrompts = mergePrompts(currentPrompts, drivePrompts);
          if (JSON.stringify(mergedPrompts) !== JSON.stringify(currentPrompts)) {
            currentPrompts = mergedPrompts;
            await saveToStorage(currentPrompts);
            handleSearch(); // Re-render if data changed
            console.log('Background sync completed:', mergedPrompts.length, 'prompts');
          }
        }
      }
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  }, SYNC_INTERVAL);
  
  // Clean up interval when popup closes
  window.addEventListener('beforeunload', () => {
    clearInterval(syncInterval);
  });
}

function bindUI() {
  // Form submission
  const promptForm = document.getElementById('promptForm');
  if (promptForm) {
    promptForm.addEventListener('submit', (e) => {
      e.preventDefault();
      savePrompt();
    });
  }

  // Button event listeners
  document.getElementById('addPromptBtn')?.addEventListener('click', openModal);
  document.getElementById('saveBtn')?.addEventListener('click', savePrompt);
  document.getElementById('cancelBtn')?.addEventListener('click', closeModal);
  document.getElementById('exportBtn')?.addEventListener('click', exportPrompts);
  document.getElementById('refreshBtn')?.addEventListener('click', refreshPrompts);
  document.getElementById('list')?.addEventListener('click', listClickHandler);
  
  // Search functionality
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(handleSearch, 300));
  }
  
  // Close modal when clicking on X or outside the modal
  document.querySelector('.close')?.addEventListener('click', closeModal);
  const modal = document.getElementById('promptModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }
  
  // Close modal with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.style.display === 'block') {
      closeModal();
    }
  });
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showAuthStatus(status) {
  const loadingEl = document.getElementById('auth-loading');
  const errorEl = document.getElementById('auth-error');
  const successEl = document.getElementById('auth-success');
  
  if (loadingEl) loadingEl.style.display = status === 'loading' ? 'block' : 'none';
  if (errorEl) errorEl.style.display = status === 'error' ? 'block' : 'none';
  if (successEl) successEl.style.display = status === 'success' ? 'block' : 'none';
}

function openModal() {
  const modal = document.getElementById('promptModal');
  if (modal) {
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
    // Focus on the first input
    const nameInput = document.getElementById('name');
    if (nameInput) {
      nameInput.focus();
    }
  }
}

function closeModal() {
  const modal = document.getElementById('promptModal');
  if (modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    // Clear the form
    const form = document.getElementById('promptForm');
    if (form) {
      form.reset();
    }
  }
}

function handleSearch() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;
  
  const searchTerm = searchInput.value.toLowerCase().trim();
  const filteredPrompts = searchTerm 
    ? currentPrompts.filter(prompt => 
        prompt.name.toLowerCase().includes(searchTerm) ||
        prompt.text.toLowerCase().includes(searchTerm) ||
        (prompt.tags && prompt.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
      )
    : currentPrompts;
  
  renderList(filteredPrompts);
}

async function loadPrompts() {
  if (!driveAPI) {
    showToast('Google Drive not available. Using cached prompts.');
    return;
  }
  
  try {
    showAuthStatus('loading');
    const drivePrompts = await driveAPI.getPrompts();
    const mergedPrompts = mergePrompts(currentPrompts, drivePrompts);
    
    if (JSON.stringify(mergedPrompts) !== JSON.stringify(currentPrompts)) {
      currentPrompts = mergedPrompts;
      await saveToStorage(currentPrompts);
      handleSearch(); // Re-render with merged data
      showToast('Prompts refreshed from Google Drive');
    } else {
      showToast('Prompts are up to date');
    }
    
    showAuthStatus('success');
  } catch (error) {
    console.error('Error loading prompts:', error);
    showAuthStatus('error');
    showToast('Failed to load prompts from Google Drive. Using cached data.');
  }
}

function validatePrompt(name, text) {
  if (!name || !text) {
    return 'Please provide both name and prompt text';
  }
  
  if (name.length > MAX_NAME_LENGTH) {
    return `Name must be less than ${MAX_NAME_LENGTH} characters`;
  }
  
  if (text.length > MAX_PROMPT_LENGTH) {
    return `Prompt text must be less than ${MAX_PROMPT_LENGTH} characters`;
  }
  
  return null;
}

async function savePrompt() {
  const nameInput = document.getElementById('name');
  const textInput = document.getElementById('text');
  const tagsInput = document.getElementById('tags');
  
  if (!nameInput || !textInput) return;
  
  const name = nameInput.value.trim();
  const text = textInput.value.trim();
  const tags = (tagsInput?.value || '').split(',').map(s => s.trim()).filter(Boolean);

  const validationError = validatePrompt(name, text);
  if (validationError) {
    showToast(validationError);
    return;
  }

  try {
    const newPrompt = { 
      id: Date.now(), 
      name, 
      text, 
      tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Add to local storage first for immediate feedback
    currentPrompts.unshift(newPrompt);
    await saveToStorage(currentPrompts);
    handleSearch();
    
    // Then sync to Google Drive if available
    if (driveAPI) {
      try {
        await driveAPI.addPrompt(newPrompt);
        showToast('Prompt saved to Google Drive');
      } catch (driveError) {
        console.error('Failed to sync to Google Drive:', driveError);
        showToast('Prompt saved locally. Google Drive sync failed.');
      }
    } else {
      showToast('Prompt saved locally. Google Drive not available.');
    }
    
    // Clear form and close modal
    closeModal();
  } catch (error) {
    console.error('Error saving prompt:', error);
    showToast('Failed to save prompt');
  }
}

function renderList(prompts) {
  const container = document.getElementById('list');
  if (!container) return;
  
  const searchInput = document.getElementById('searchInput');
  const searchTerm = searchInput?.value.trim() || '';
  
  if (!prompts.length) {
    if (searchTerm) {
      container.innerHTML = `<div class="empty-state"><p>No prompts found matching "${escapeHtml(searchTerm)}"</p></div>`;
    } else {
      container.innerHTML = `<div class="empty-state"><p>No prompts saved yet</p><p>Click "Add New Prompt" to get started</p></div>`;
    }
    return;
  }
  
  container.innerHTML = prompts.map(p => `
    <div class="card" data-id="${p.id}">
      <div class="card-header">
        <h3 class="card-title">${escapeHtml(p.name)}</h3>
        <button class="card-expand" aria-label="Expand prompt content">
          <svg class="expand-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
        </button>
      </div>
      <div class="card-content" style="display: none;">
        <pre>${escapeHtml(p.text)}</pre>
        ${p.tags && p.tags.length ? `<div class="tags">${p.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="actions">
        <button class="copy" aria-label="Copy prompt">
          <svg class="btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy
        </button>
        <button class="insert" aria-label="Insert prompt">
          <svg class="btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          Insert
        </button>
        <button class="delete" aria-label="Delete prompt">
          <svg class="btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3,6 5,6 21,6"></polyline>
            <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
          Delete
        </button>
      </div>
    </div>
  `).join('');
  
  // Add event listeners for expand/collapse functionality
  container.querySelectorAll('.card-expand').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = button.closest('.card');
      const content = card.querySelector('.card-content');
      const icon = button.querySelector('.expand-icon');
      
      if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.classList.remove('expand-icon-collapsed');
        button.setAttribute('aria-label', 'Collapse prompt content');
      } else {
        content.style.display = 'none';
        icon.classList.add('expand-icon-collapsed');
        button.setAttribute('aria-label', 'Expand prompt content');
      }
    });
  });
}

async function listClickHandler(e) {
  const card = e.target.closest('.card');
  if (!card) return;
  
  const id = Number(card.dataset.id);
  const prompt = currentPrompts.find(x => x.id === id);
  if (!prompt) return;

  // Handle expand/collapse click
  if (e.target.closest('.card-expand')) {
    return; // This is handled separately in renderList
  }

  // Handle card header click to expand/collapse
  if (e.target.closest('.card-header') && !e.target.closest('.card-expand')) {
    const content = card.querySelector('.card-content');
    const button = card.querySelector('.card-expand');
    const icon = button.querySelector('.expand-icon');
    
    if (content.style.display === 'none') {
      content.style.display = 'block';
      icon.classList.remove('expand-icon-collapsed');
      button.setAttribute('aria-label', 'Collapse prompt content');
    } else {
      content.style.display = 'none';
      icon.classList.add('expand-icon-collapsed');
      button.setAttribute('aria-label', 'Expand prompt content');
    }
    return;
  }

  if (e.target.classList.contains('copy')) {
    await copyText(prompt.text);
  } else if (e.target.classList.contains('insert')) {
    await setPendingInsert(prompt.text);
  } else if (e.target.classList.contains('delete')) {
    if (confirm('Are you sure you want to delete this prompt?')) {
      try {
        // Remove from local storage first
        currentPrompts = currentPrompts.filter(p => p.id !== id);
        await saveToStorage(currentPrompts);
        handleSearch();
        
        // Then remove from Google Drive if available
        if (driveAPI) {
          try {
            await driveAPI.deletePrompt(id);
            showToast('Prompt deleted from Google Drive');
          } catch (driveError) {
            console.error('Failed to delete from Google Drive:', driveError);
            showToast('Prompt deleted locally. Google Drive sync failed.');
          }
        } else {
          showToast('Prompt deleted locally. Google Drive not available.');
        }
      } catch (error) {
        console.error('Error deleting prompt:', error);
        showToast('Failed to delete prompt');
      }
    }
  }
}

async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard');
    } else {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast('Copied to clipboard (fallback)');
    }
  } catch (error) {
    console.error('Failed to copy text:', error);
    showToast('Failed to copy to clipboard');
  }
}

async function setPendingInsert(text) {
  // Close the popup first
  window.close();
  
  // Execute the insertion in the active tab
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs && tabs[0];
    if (!tab) {
      return;
    }
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: insertTextIntoPage,
      args: [text]
    });
  } catch (error) {
    console.error('Failed to insert prompt:', error);
    showToast('Failed to insert prompt');
  }
}

// Function to be injected into the page
function insertTextIntoPage(insertText) {
  function tryInsert(targetEl) {
    if (!targetEl) return false;
    
    // Handle contenteditable elements
    if (targetEl.isContentEditable) {
      targetEl.focus();
      if (window.getSelection && window.getSelection().rangeCount > 0) {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(insertText));
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        targetEl.innerText = (targetEl.innerText || '') + insertText;
      }
      return true;
    }
    
    // Handle input and textarea elements
    if ('value' in targetEl) {
      targetEl.focus();
      const start = targetEl.selectionStart || 0;
      const end = targetEl.selectionEnd || 0;
      const currentValue = targetEl.value || '';
      
      const newValue = currentValue.substring(0, start) + insertText + currentValue.substring(end);
      targetEl.value = newValue;
      
      targetEl.selectionStart = targetEl.selectionEnd = start + insertText.length;
      
      // Trigger input event for React/Vue components
      targetEl.dispatchEvent(new Event('input', { bubbles: true }));
      targetEl.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    
    return false;
  }
  
  // Try to insert into the currently focused element first
  const activeElement = document.activeElement;
  if (activeElement && tryInsert(activeElement)) {
    return { success: true, method: 'active-element' };
  }
  
  // Look for common input selectors
  const selectors = [
    'textarea[placeholder*="chat"], textarea[placeholder*="message"], textarea[placeholder*="prompt"]',
    'div[contenteditable="true"][placeholder*="chat"], div[contenteditable="true"][placeholder*="message"]',
    'input[placeholder*="chat"], input[placeholder*="message"], input[placeholder*="prompt"]',
    'div[contenteditable="true"]',
    'textarea',
    'input[type="text"], input[type="search"]',
    '[contenteditable="true"]'
  ];
  
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      if (element.offsetParent !== null && !element.disabled && !element.readOnly) {
        if (tryInsert(element)) {
          return { success: true, method: 'selector', selector };
        }
      }
    }
  }
  
  // Last resort: copy to clipboard
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(insertText).then(() => {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      `;
      notification.textContent = 'Prompt copied to clipboard!';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 3000);
    }).catch(() => {
      alert('Prompt copied to clipboard. Please paste it manually.');
    });
  } else {
    alert('Prompt copied to clipboard. Please paste it manually.');
  }
  
  return { success: false, method: 'clipboard' };
}

async function exportPrompts() {
  try {
    const blob = new Blob([JSON.stringify(currentPrompts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompts-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Prompts exported successfully');
  } catch (error) {
    console.error('Failed to export prompts:', error);
    showToast('Failed to export prompts');
  }
}

async function refreshPrompts() {
  // Clear search when refreshing
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = '';
  }
  
  if (!driveAPI) {
    showToast('Google Drive not available. Using cached prompts.');
    return;
  }
  
  await loadPrompts();
}

function showToast(msg) {
  // Remove existing toasts
  const existingToasts = document.querySelectorAll('.toast');
  existingToasts.forEach(toast => toast.remove());
  
  // Create a new toast notification
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  
  document.body.appendChild(toast);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3000);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
