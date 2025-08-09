// background.js (service worker) - Updated for persistent storage
chrome.commands.onCommand.addListener((command) => {
    if (command !== 'insert-prompt') return;
  
    chrome.storage.local.get(['pendingInsert'], (res) => {
      const text = res.pendingInsert;
      if (!text) {
        // nothing pending
        chrome.notifications?.create({ type:'basic', title:'Prompt Stash', message:'No prompt selected to insert.' });
        return;
      }
  
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab) return;
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (insertText) => {
            // runs in page context
            const el = document.activeElement;
            function tryInsert(targetEl) {
              if (!targetEl) return false;
              if (targetEl.isContentEditable) {
                targetEl.focus();
                targetEl.innerText = (targetEl.innerText || '') + insertText;
                return true;
              }
              if ('value' in targetEl) {
                targetEl.value = (targetEl.value || '') + insertText;
                targetEl.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
              }
              return false;
            }
  
            if (!tryInsert(el)) {
              // try find any visible input/textarea
              const fallback = document.querySelector('textarea, input[type="text"], [contenteditable="true"]');
              if (tryInsert(fallback)) {
                return;
              }
              // last resort: copy to clipboard and ask user to paste
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(insertText).then(() => {
                  alert('Prompt copied to clipboard. Paste it where you want.');
                }).catch(() => {
                  alert('Unable to insert or copy automatically. Please paste manually.');
                });
              } else {
                alert('No target field found. Paste the prompt manually.');
              }
            }
          },
          args: [text]
        });
      });
    });
  });

// Background sync functionality - simplified version that just manages local storage
let syncInterval;

// Start background sync when service worker starts
async function startBackgroundSync() {
  // Clear any existing interval
  if (syncInterval) {
    clearInterval(syncInterval);
  }
  
  // Sync every 15 minutes in the background (just to keep the service worker alive)
  syncInterval = setInterval(async () => {
    try {
      // Just check if we need to clean up old data or perform any maintenance
      await performMaintenance();
    } catch (error) {
      console.error('Background maintenance failed:', error);
    }
  }, 15 * 60 * 1000); // 15 minutes
}

async function performMaintenance() {
  try {
    // Get cached prompts and last sync time
    const result = await chrome.storage.local.get(['prompts', 'lastSync']);
    const cachedPrompts = result.prompts || [];
    const lastSync = result.lastSync || 0;
    
    // If we have prompts and it's been more than 24 hours since last sync, 
    // we could potentially trigger a sync, but for now we'll just log
    if (cachedPrompts.length > 0 && (Date.now() - lastSync) > 24 * 60 * 60 * 1000) {
      console.log('Background maintenance: prompts cached for more than 24 hours');
    }
  } catch (error) {
    console.error('Background maintenance error:', error);
  }
}

// Start background sync when service worker initializes
startBackgroundSync();

// Handle extension installation/update
chrome.runtime.onInstalled.addListener(() => {
  console.log('Prompt Stash extension installed/updated');
  startBackgroundSync();
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Prompt Stash extension started');
  startBackgroundSync();
});
  