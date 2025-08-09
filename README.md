# Prompt Stash - Google Drive Integration

A Chrome extension that stores and manages prompts in Google Drive for easy access across devices.

## Features

- ✅ Store prompts in Google Drive folder
- ✅ Sync prompts across all devices
- ✅ Copy prompts to clipboard
- ✅ Insert prompts into web forms
- ✅ Tag and organize prompts
- ✅ Export/Import prompts as JSON
- ✅ Real-time sync with Google Drive

## Setup Instructions

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Drive API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"

### 2. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Chrome Extension" as application type
4. Enter your extension ID (you can find this in `chrome://extensions/` after loading the extension)
5. Download the client configuration

### 3. Update Extension Configuration

1. Open `manifest.json`
2. Replace `YOUR_CLIENT_ID.apps.googleusercontent.com` with your actual client ID from step 2
3. Save the file

### 4. Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked" and select the extension folder
4. The extension should now appear in your extensions list

### 5. First Time Setup

1. Click the extension icon in your browser toolbar
2. You'll be prompted to authenticate with Google
3. Grant the necessary permissions for Google Drive access
4. The extension will create a "Prompt Stash" folder in your Google Drive
5. All prompts will be stored in `prompts.json` within that folder

## Usage

### Adding Prompts
1. Click the extension icon
2. Enter a name for your prompt
3. Type or paste your prompt text
4. Add optional tags (comma-separated)
5. Click "Save prompt"

### Managing Prompts
- **Copy**: Copy prompt to clipboard
- **Insert**: Prepare prompt for insertion (use Ctrl+Shift+Y to insert)
- **Delete**: Remove prompt from Google Drive
- **Refresh**: Sync with Google Drive to get latest changes

### Keyboard Shortcuts
- `Ctrl+Shift+Y`: Insert the selected prompt into the active field

## File Structure

```
prompt-stash/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
├── background.js         # Background service worker
├── drive-api.js          # Google Drive API integration
├── style.css             # Styling
└── icons/                # Extension icons
```

## API Integration

The extension uses the Google Drive API v3 to:
- Create and manage a "Prompt Stash" folder
- Store prompts in a `prompts.json` file
- Sync data across devices
- Handle authentication via OAuth 2.0

## Troubleshooting

### Authentication Issues
- Make sure you've correctly configured the OAuth 2.0 client ID
- Check that the Google Drive API is enabled
- Try refreshing the extension and re-authenticating

### Sync Issues
- Check your internet connection
- Verify that you're signed into the correct Google account
- Try clicking the "Refresh from Drive" button

### Permission Issues
- Ensure the extension has the necessary permissions
- Check that the OAuth scopes are correctly configured

## Development

To modify the extension:
1. Make your changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes

## License

This project is open source and available under the MIT License.
