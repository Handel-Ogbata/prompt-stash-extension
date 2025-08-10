// background.js - Service worker for Prompt Stash extension
'use strict';

// Constants
const STORAGE_KEYS = {
  PENDING_INSERT: 'pendingInsert',
  PROMPTS: 'prompts',
  LAST_SYNC: 'lastSync'
};

// Command handler for keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'insert-prompt') return;

  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.PENDING_INSERT]);
    const text = result[STORAGE_KEYS.PENDING_INSERT];
    
    if (!text) {
      // No prompt selected to insert
      await showNotification('Prompt Stash', 'No prompt selected to insert.');
      return;
    }

    await insertPromptIntoActiveTab(text);
  } catch (error) {
    console.error('Error handling command:', error);
    await showNotification('Prompt Stash', 'Failed to insert prompt.');
  }
});

// Insert prompt into the active tab
async function insertPromptIntoActiveTab(text) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs && tabs[0];
    
    if (!tab) {
      console.error('No active tab found');
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: insertTextIntoPage,
      args: [text]
    });
  } catch (error) {
    console.error('Failed to insert prompt into active tab:', error);
    await showNotification('Prompt Stash', 'Failed to insert prompt into page.');
  }
}

// Function to be injected into the page context
function insertTextIntoPage(insertText) {
  'use strict';
  
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
}

// Show notification
async function showNotification(title, message) {
  try {
    if (chrome.notifications) {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: title,
        message: message
      });
    }
  } catch (error) {
    console.error('Failed to show notification:', error);
  }
}

// Background sync functionality
let syncInterval;

// Start background sync when service worker starts
async function startBackgroundSync() {
  // Clear any existing interval
  if (syncInterval) {
    clearInterval(syncInterval);
  }
  
  // Sync every 15 minutes in the background
  syncInterval = setInterval(async () => {
    try {
      await performMaintenance();
    } catch (error) {
      console.error('Background maintenance failed:', error);
    }
  }, 15 * 60 * 1000); // 15 minutes
}

// Perform background maintenance tasks
async function performMaintenance() {
  try {
    // Get cached prompts and last sync time
    const result = await chrome.storage.local.get([STORAGE_KEYS.PROMPTS, STORAGE_KEYS.LAST_SYNC]);
    const cachedPrompts = result[STORAGE_KEYS.PROMPTS] || [];
    const lastSync = result[STORAGE_KEYS.LAST_SYNC] || 0;
    
    // If we have prompts and it's been more than 24 hours since last sync, 
    // we could potentially trigger a sync, but for now we'll just log
    if (cachedPrompts.length > 0 && (Date.now() - lastSync) > 24 * 60 * 60 * 1000) {
      console.log('Background maintenance: prompts cached for more than 24 hours');
    }
  } catch (error) {
    console.error('Background maintenance error:', error);
  }
}

// Handle extension installation/update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Prompt Stash extension installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    // First time installation
    console.log('First time installation - setting up initial data');
  } else if (details.reason === 'update') {
    // Extension updated
    console.log('Extension updated from version:', details.previousVersion);
  }
  
  startBackgroundSync();
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Prompt Stash extension started');
  startBackgroundSync();
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getStatus') {
    // Return extension status
    sendResponse({ status: 'active', timestamp: Date.now() });
  } else if (request.action === 'setPendingInsert') {
    // Set pending insert text
    chrome.storage.local.set({ [STORAGE_KEYS.PENDING_INSERT]: request.text }, () => {
      sendResponse({ success: true });
    });
    return true; // Indicates async response
  }
});

// Clean up when service worker is terminated
self.addEventListener('beforeunload', () => {
  if (syncInterval) {
    clearInterval(syncInterval);
  }
});
  