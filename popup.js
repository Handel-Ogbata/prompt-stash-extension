// popup.js - Google Drive integration with persistent storage
let driveAPI;
let currentPrompts = [];
let isInitialized = false;

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
    chrome.storage.local.get(['prompts', 'lastSync'], (result) => {
      if (result.prompts) {
        console.log('Loaded prompts from storage:', result.prompts.length);
        resolve(result.prompts);
      } else {
        resolve([]);
      }
    });
  });
}

async function saveToStorage(prompts) {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      prompts: prompts,
      lastSync: Date.now()
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
  const lastSync = Date.now();
  const syncInterval = setInterval(async () => {
    if (!driveAPI) return;
    
    try {
      // Check if it's been more than 5 minutes since last sync
      const result = await chrome.storage.local.get(['lastSync']);
      const timeSinceLastSync = Date.now() - (result.lastSync || 0);
      
      if (timeSinceLastSync > 5 * 60 * 1000) { // 5 minutes
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
  }, 5 * 60 * 1000); // Check every 5 minutes
  
  // Clean up interval when popup closes
  window.addEventListener('beforeunload', () => {
    clearInterval(syncInterval);
  });
}

function bindUI() {
  document.getElementById('addPromptBtn').addEventListener('click', openModal);
  document.getElementById('saveBtn').addEventListener('click', savePrompt);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('exportBtn').addEventListener('click', exportPrompts);
  document.getElementById('refreshBtn').addEventListener('click', refreshPrompts);
  document.getElementById('list').addEventListener('click', listClickHandler);
  
  // Search functionality
  document.getElementById('searchInput').addEventListener('input', handleSearch);
  
  // Close modal when clicking on X or outside the modal
  document.querySelector('.close').addEventListener('click', closeModal);
  document.getElementById('promptModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('promptModal')) {
      closeModal();
    }
  });
  
  // Close modal with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('promptModal').style.display === 'block') {
      closeModal();
    }
  });
}

function showAuthStatus(status) {
  const loadingEl = document.getElementById('auth-loading');
  const errorEl = document.getElementById('auth-error');
  const successEl = document.getElementById('auth-success');
  
  loadingEl.style.display = status === 'loading' ? 'block' : 'none';
  errorEl.style.display = status === 'error' ? 'block' : 'none';
  successEl.style.display = status === 'success' ? 'block' : 'none';
}

function openModal() {
  document.getElementById('promptModal').style.display = 'block';
  // Focus on the first input
  document.getElementById('name').focus();
}

function closeModal() {
  document.getElementById('promptModal').style.display = 'none';
  // Clear the form
  document.getElementById('name').value = '';
  document.getElementById('text').value = '';
  document.getElementById('tags').value = '';
}

function handleSearch() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
  const filteredPrompts = searchTerm 
    ? currentPrompts.filter(prompt => 
        prompt.name.toLowerCase().includes(searchTerm)
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

async function savePrompt() {
  const name = document.getElementById('name').value.trim();
  const text = document.getElementById('text').value;
  const tags = (document.getElementById('tags').value || '').split(',').map(s => s.trim()).filter(Boolean);

  if (!name || !text) {
    alert('Please provide name and prompt text');
    return;
  }

  try {
    const newPrompt = { id: Date.now(), name, text, tags };
    
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
  const searchTerm = document.getElementById('searchInput').value.trim();
  
  if (!prompts.length) {
    if (searchTerm) {
      container.innerHTML = '<small>No prompts found matching "' + escapeHtml(searchTerm) + '"</small>';
    } else {
      container.innerHTML = '<small>No prompts saved yet</small>';
    }
    return;
  }
  
  container.innerHTML = prompts.map(p => `
    <div class="card" data-id="${p.id}">
      <strong>${escapeHtml(p.name)}</strong>
      <pre>${escapeHtml(p.text)}</pre>
      ${p.tags && p.tags.length ? `<div class="tags">${p.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
      <div class="actions">
        <button class="copy">Copy</button>
        <button class="insert">Insert</button>
        <button class="delete">Delete</button>
      </div>
    </div>
  `).join('');
}

async function listClickHandler(e) {
  const card = e.target.closest('.card');
  if (!card) return;
  
  const id = Number(card.dataset.id);
  const prompt = currentPrompts.find(x => x.id === id);
  if (!prompt) return;

  if (e.target.classList.contains('copy')) {
    copyText(prompt.text);
  } else if (e.target.classList.contains('insert')) {
    setPendingInsert(prompt.text);
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

function copyText(text) {
  navigator.clipboard?.writeText(text).then(() => {
    showToast('Copied to clipboard');
  }).catch(() => {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast('Copied to clipboard (fallback)');
  });
}

function setPendingInsert(text) {
  // Close the popup first
  window.close();
  
  // Execute the insertion in the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab) {
      return;
    }
    
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (insertText) => {
        // Enhanced insertion logic
        function tryInsert(targetEl) {
          if (!targetEl) return false;
          
          // Handle contenteditable elements
          if (targetEl.isContentEditable) {
            targetEl.focus();
            // Insert at cursor position or append to existing content
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
            
            // Insert at cursor position or append
            const newValue = currentValue.substring(0, start) + insertText + currentValue.substring(end);
            targetEl.value = newValue;
            
            // Set cursor position after inserted text
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
        
        // Look for common input selectors in order of preference
        const selectors = [
          // AI Chat applications
          'textarea[placeholder*="chat"], textarea[placeholder*="message"], textarea[placeholder*="prompt"]',
          'div[contenteditable="true"][placeholder*="chat"], div[contenteditable="true"][placeholder*="message"]',
          'input[placeholder*="chat"], input[placeholder*="message"], input[placeholder*="prompt"]',
          
          // Document editors
          'div[contenteditable="true"]',
          'textarea',
          'input[type="text"], input[type="search"]',
          
          // Generic contenteditable
          '[contenteditable="true"]'
        ];
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            // Check if element is visible and not disabled
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
            // Show a notification that text was copied
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
      },
      args: [text]
    }).catch((error) => {
      console.error('Failed to insert prompt:', error);
    });
  });
}

async function exportPrompts() {
  const blob = new Blob([JSON.stringify(currentPrompts, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'prompts.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Prompts exported');
}

async function refreshPrompts() {
  // Clear search when refreshing
  document.getElementById('searchInput').value = '';
  
  if (!driveAPI) {
    showToast('Google Drive not available. Using cached prompts.');
    return;
  }
  
  await loadPrompts();
}

function showToast(msg) {
  // Create a simple toast notification
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  toast.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #333;
    color: white;
    padding: 10px 15px;
    border-radius: 4px;
    z-index: 1000;
    font-size: 12px;
  `;
  
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3000);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s]);
}
