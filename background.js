// background.js (service worker)
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
  