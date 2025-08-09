// drive-api.js - Google Drive API integration
class DriveAPI {
  constructor() {
    this.API_BASE = 'https://www.googleapis.com/drive/v3';
    this.UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
    this.FOLDER_NAME = 'Prompt Stash';
    this.FILE_NAME = 'prompts.json';
    this.folderId = null;
    this.fileId = null;
  }

  // Get OAuth2 token
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

  // Find or create the Prompt Stash folder
  async findOrCreateFolder() {
    const token = await this.getAuthToken();
    
    // First, try to find existing folder
    const searchResponse = await fetch(
      `${this.API_BASE}/files?q=name='${this.FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

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

    const folderData = await createResponse.json();
    this.folderId = folderData.id;
    return this.folderId;
  }

  // Find or create the prompts.json file
  async findOrCreateFile() {
    const token = await this.getAuthToken();
    const folderId = await this.findOrCreateFolder();
    
    // Search for existing file
    const searchResponse = await fetch(
      `${this.API_BASE}/files?q=name='${this.FILE_NAME}' and '${folderId}' in parents and trashed=false`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

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
      throw new Error(`Failed to create file: ${createResponse.status}`);
    }

    const fileData = await createResponse.json();
    this.fileId = fileData.id;
    
    // Initialize with empty array
    await this.updateFileContent([]);
    return this.fileId;
  }

  // Get prompts from Google Drive
  async getPrompts() {
    try {
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
    } catch (error) {
      console.error('Error getting prompts:', error);
      return [];
    }
  }

  // Save prompts to Google Drive
  async savePrompts(prompts) {
    try {
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
    } catch (error) {
      console.error('Error saving prompts:', error);
      throw error;
    }
  }

  // Update file content
  async updateFileContent(content) {
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
  }

  // Add a new prompt
  async addPrompt(prompt) {
    const prompts = await this.getPrompts();
    prompts.unshift(prompt);
    await this.savePrompts(prompts);
    return prompts;
  }

  // Delete a prompt
  async deletePrompt(promptId) {
    const prompts = await this.getPrompts();
    const filteredPrompts = prompts.filter(p => p.id !== promptId);
    await this.savePrompts(filteredPrompts);
    return filteredPrompts;
  }

  // Update a prompt
  async updatePrompt(promptId, updatedPrompt) {
    const prompts = await this.getPrompts();
    const index = prompts.findIndex(p => p.id === promptId);
    if (index !== -1) {
      prompts[index] = { ...prompts[index], ...updatedPrompt };
      await this.savePrompts(prompts);
    }
    return prompts;
  }
}

// Export for use in other files
window.DriveAPI = DriveAPI;
