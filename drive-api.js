// drive-api.js - Google Drive API integration
'use strict';

class DriveAPI {
  constructor() {
    this.API_BASE = 'https://www.googleapis.com/drive/v3';
    this.UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
    this.FOLDER_NAME = 'Prompt Stash';
    this.FILE_NAME = 'prompts.json';
    this.folderId = null;
    this.fileId = null;
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  // Get OAuth2 token with retry logic
  async getAuthToken() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(token);
        }
      });
    });
  }

  // Retry wrapper for API calls
  async retryOperation(operation, retries = this.maxRetries) {
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === retries - 1) throw error;
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (i + 1)));
      }
    }
  }

  // Find or create the Prompt Stash folder
  async findOrCreateFolder() {
    if (this.folderId) return this.folderId;

    return this.retryOperation(async () => {
      const token = await this.getAuthToken();
      
      // First, try to find existing folder
      const searchResponse = await fetch(
        `${this.API_BASE}/files?q=name='${encodeURIComponent(this.FOLDER_NAME)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!searchResponse.ok) {
        throw new Error(`Failed to search for folder: ${searchResponse.status} ${searchResponse.statusText}`);
      }

      const searchData = await searchResponse.json();
      
      if (searchData.files && searchData.files.length > 0) {
        this.folderId = searchData.files[0].id;
        return this.folderId;
      }

      // Create new folder if not found
      const createResponse = await fetch(`${this.API_BASE}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: this.FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder'
        })
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create folder: ${createResponse.status} ${createResponse.statusText}`);
      }

      const folderData = await createResponse.json();
      this.folderId = folderData.id;
      return this.folderId;
    });
  }

  // Find or create the prompts.json file
  async findOrCreateFile() {
    if (this.fileId) return this.fileId;

    return this.retryOperation(async () => {
      const token = await this.getAuthToken();
      const folderId = await this.findOrCreateFolder();
      
      // Search for existing file
      const searchResponse = await fetch(
        `${this.API_BASE}/files?q=name='${encodeURIComponent(this.FILE_NAME)}' and '${folderId}' in parents and trashed=false`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!searchResponse.ok) {
        throw new Error(`Failed to search for file: ${searchResponse.status} ${searchResponse.statusText}`);
      }

      const searchData = await searchResponse.json();
      
      if (searchData.files && searchData.files.length > 0) {
        this.fileId = searchData.files[0].id;
        return this.fileId;
      }

      // Create new file if not found
      const createResponse = await fetch(`${this.API_BASE}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: this.FILE_NAME,
          parents: [folderId],
          mimeType: 'application/json'
        })
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create file: ${createResponse.status} ${createResponse.statusText}`);
      }

      const fileData = await createResponse.json();
      this.fileId = fileData.id;
      
      // Initialize with empty array
      await this.updateFileContent([]);
      return this.fileId;
    });
  }

  // Get prompts from Google Drive
  async getPrompts() {
    try {
      return await this.retryOperation(async () => {
        const token = await this.getAuthToken();
        const fileId = await this.findOrCreateFile();
        
        const response = await fetch(`${this.API_BASE}/files/${fileId}?alt=media`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          if (response.status === 404) {
            // File doesn't exist yet, return empty array
            return [];
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const content = await response.text();
        return content ? JSON.parse(content) : [];
      });
    } catch (error) {
      console.error('Error getting prompts:', error);
      return [];
    }
  }

  // Save prompts to Google Drive
  async savePrompts(prompts) {
    if (!Array.isArray(prompts)) {
      throw new Error('Prompts must be an array');
    }

    return this.retryOperation(async () => {
      const token = await this.getAuthToken();
      const fileId = await this.findOrCreateFile();
      
      const response = await fetch(`${this.UPLOAD_BASE}/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(prompts, null, 2)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return true;
    });
  }

  // Update file content
  async updateFileContent(content) {
    return this.retryOperation(async () => {
      const token = await this.getAuthToken();
      const fileId = await this.findOrCreateFile();
      
      const response = await fetch(`${this.UPLOAD_BASE}/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(content, null, 2)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    });
  }

  // Add a new prompt
  async addPrompt(prompt) {
    if (!prompt || typeof prompt !== 'object') {
      throw new Error('Invalid prompt object');
    }

    if (!prompt.name || !prompt.text) {
      throw new Error('Prompt must have name and text properties');
    }

    return this.retryOperation(async () => {
      const prompts = await this.getPrompts();
      prompts.unshift(prompt);
      await this.savePrompts(prompts);
      return prompts;
    });
  }

  // Delete a prompt
  async deletePrompt(promptId) {
    if (!promptId) {
      throw new Error('Prompt ID is required');
    }

    return this.retryOperation(async () => {
      const prompts = await this.getPrompts();
      const filteredPrompts = prompts.filter(p => p.id !== promptId);
      await this.savePrompts(filteredPrompts);
      return filteredPrompts;
    });
  }

  // Update a prompt
  async updatePrompt(promptId, updatedPrompt) {
    if (!promptId) {
      throw new Error('Prompt ID is required');
    }

    if (!updatedPrompt || typeof updatedPrompt !== 'object') {
      throw new Error('Invalid updated prompt object');
    }

    return this.retryOperation(async () => {
      const prompts = await this.getPrompts();
      const index = prompts.findIndex(p => p.id === promptId);
      if (index !== -1) {
        prompts[index] = { ...prompts[index], ...updatedPrompt, updatedAt: new Date().toISOString() };
        await this.savePrompts(prompts);
      }
      return prompts;
    });
  }

  // Validate prompt data
  validatePrompt(prompt) {
    if (!prompt || typeof prompt !== 'object') {
      return 'Prompt must be an object';
    }

    if (!prompt.name || typeof prompt.name !== 'string' || prompt.name.trim().length === 0) {
      return 'Prompt name is required and must be a non-empty string';
    }

    if (!prompt.text || typeof prompt.text !== 'string' || prompt.text.trim().length === 0) {
      return 'Prompt text is required and must be a non-empty string';
    }

    if (prompt.name.length > 200) {
      return 'Prompt name must be less than 200 characters';
    }

    if (prompt.text.length > 10000) {
      return 'Prompt text must be less than 10,000 characters';
    }

    if (prompt.tags && (!Array.isArray(prompt.tags) || prompt.tags.some(tag => typeof tag !== 'string'))) {
      return 'Tags must be an array of strings';
    }

    return null;
  }

  // Clear cached IDs (useful for testing or when files are moved)
  clearCache() {
    this.folderId = null;
    this.fileId = null;
  }
}

// Export for use in other files
if (typeof window !== 'undefined') {
  window.DriveAPI = DriveAPI;
}
