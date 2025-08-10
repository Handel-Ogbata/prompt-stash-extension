# Prompt Stash - Chrome Extension

A professional Chrome extension that stores and manages prompts in Google Drive for easy access across devices. Built following Chrome extension best practices with modern design and robust error handling.

## ✨ Features

- ✅ **Google Drive Integration** - Store prompts in Google Drive folder with automatic sync
- ✅ **Cross-Device Sync** - Access your prompts from any device
- ✅ **Smart Insert** - Insert prompts into web forms with intelligent field detection
- ✅ **Tag Organization** - Organize prompts with tags for easy searching
- ✅ **Export/Import** - Backup and restore prompts as JSON
- ✅ **Real-time Sync** - Automatic background synchronization
- ✅ **Keyboard Shortcuts** - Quick access with customizable shortcuts
- ✅ **Modern UI** - Clean, accessible, and responsive design
- ✅ **Offline Support** - Works with cached data when offline

## 🏗️ Architecture & Best Practices

This extension follows Chrome extension Manifest V3 best practices:

### Security
- **Content Security Policy** - Strict CSP for extension pages
- **Input Validation** - All user inputs are validated and sanitized
- **XSS Prevention** - Proper HTML escaping and safe DOM manipulation
- **Permission Minimization** - Only requests necessary permissions

### Performance
- **Service Worker** - Efficient background processing
- **Caching Strategy** - Intelligent local storage with sync
- **Lazy Loading** - Resources loaded on demand
- **Error Handling** - Comprehensive error handling with retry logic

### User Experience
- **Accessibility** - WCAG compliant with ARIA labels and keyboard navigation
- **Responsive Design** - Works on various screen sizes
- **Modern UI** - Material Design inspired interface
- **Loading States** - Clear feedback during operations

## 🚀 Installation

### Prerequisites
- Google Chrome 88+ (or Chromium-based browser)
- Google account for Drive integration

### Setup Instructions

#### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Drive API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"

#### 2. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Chrome Extension" as application type
4. Enter your extension ID (found in `chrome://extensions/` after loading)
5. Download the client configuration

#### 3. Update Extension Configuration

1. Open `manifest.json`
2. Replace the `client_id` in the `oauth2` section with your actual client ID
3. Save the file

#### 4. Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked" and select the extension folder
4. The extension should now appear in your extensions list

#### 5. First Time Setup

1. Click the extension icon in your browser toolbar
2. You'll be prompted to authenticate with Google
3. Grant the necessary permissions for Google Drive access
4. The extension will create a "Prompt Stash" folder in your Google Drive
5. All prompts will be stored in `prompts.json` within that folder

## 📖 Usage

### Adding Prompts
1. Click the extension icon
2. Click "Add New Prompt"
3. Enter a name for your prompt
4. Type or paste your prompt text
5. Add optional tags (comma-separated)
6. Click "Save Prompt"

### Managing Prompts
- **Copy**: Copy prompt to clipboard
- **Insert**: Prepare prompt for insertion (use Ctrl+Shift+Y to insert)
- **Delete**: Remove prompt from Google Drive
- **Refresh**: Sync with Google Drive to get latest changes

### Keyboard Shortcuts
- `Ctrl+Shift+Y` (Windows/Linux) or `Cmd+Shift+Y` (Mac): Insert the selected prompt into the active field

### Search & Filter
- Use the search bar to find prompts by name, content, or tags
- Real-time filtering as you type

## 🏗️ Project Structure

```
prompt-stash/
├── manifest.json          # Extension configuration (Manifest V3)
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality and UI logic
├── background.js         # Service worker for background tasks
├── drive-api.js          # Google Drive API integration
├── style.css             # Modern styling and responsive design
├── icons/                # Extension icons (16, 32, 48, 128px)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # This file
```

## 🔧 Technical Details

### Manifest V3 Features
- **Service Worker**: Efficient background processing
- **Content Security Policy**: Enhanced security
- **Web Accessible Resources**: Controlled resource access
- **Commands API**: Keyboard shortcuts support

### API Integration
The extension uses the Google Drive API v3 to:
- Create and manage a "Prompt Stash" folder
- Store prompts in a `prompts.json` file
- Sync data across devices
- Handle authentication via OAuth 2.0

### Data Storage
- **Local Storage**: Chrome storage API for caching
- **Google Drive**: Cloud storage for cross-device sync
- **Automatic Sync**: Background synchronization every 5 minutes

### Error Handling
- **Retry Logic**: Automatic retry for failed API calls
- **Graceful Degradation**: Works offline with cached data
- **User Feedback**: Clear error messages and status indicators

## 🎨 Design System

### Colors
- **Primary**: #1a73e8 (Google Blue)
- **Success**: #34a853 (Google Green)
- **Warning**: #fbbc04 (Google Yellow)
- **Error**: #ea4335 (Google Red)
- **Background**: #ffffff (White)
- **Surface**: #f8f9fa (Light Gray)

### Typography
- **Font Family**: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
- **Font Sizes**: 12px, 14px, 16px, 18px, 20px
- **Font Weights**: 400 (Regular), 500 (Medium), 600 (Semi-bold)

### Components
- **Buttons**: Consistent styling with hover and focus states
- **Cards**: Clean card design for prompt display
- **Modal**: Accessible modal for adding prompts
- **Toast**: Non-intrusive notifications

## 🔒 Security Considerations

### Data Protection
- **Local Storage**: Encrypted storage for sensitive data
- **API Security**: Secure OAuth 2.0 authentication
- **Input Sanitization**: All user inputs are properly sanitized
- **CSP**: Content Security Policy prevents XSS attacks

### Privacy
- **Minimal Permissions**: Only requests necessary permissions
- **Data Ownership**: Users own their data stored in Google Drive
- **No Tracking**: No analytics or tracking code
- **Transparent**: Open source and auditable

## 🐛 Troubleshooting

### Authentication Issues
- Make sure you've correctly configured the OAuth 2.0 client ID
- Check that the Google Drive API is enabled
- Try refreshing the extension and re-authenticating
- Clear browser cache and cookies if needed

### Sync Issues
- Check your internet connection
- Verify that you're signed into the correct Google account
- Try clicking the "Refresh from Drive" button
- Check browser console for error messages

### Permission Issues
- Ensure the extension has the necessary permissions
- Check that the OAuth scopes are correctly configured
- Try reinstalling the extension

### Performance Issues
- Clear extension storage if sync is slow
- Check for large prompt files
- Restart the browser if needed

## 🚀 Development

### Prerequisites
- Node.js 16+ (for development tools)
- Chrome DevTools
- Google Cloud Console access

### Development Setup
1. Clone the repository
2. Install dependencies (if any)
3. Load the extension in Chrome
4. Make changes and reload the extension
5. Test thoroughly before committing

### Code Quality
- **ESLint**: Code linting and formatting
- **Prettier**: Code formatting
- **TypeScript**: Type safety (optional)
- **Testing**: Unit and integration tests

### Building for Production
1. Update version in `manifest.json`
2. Test all functionality
3. Create production build
4. Submit to Chrome Web Store

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

- **Issues**: Report bugs on GitHub
- **Documentation**: Check this README and inline code comments
- **Community**: Join our Discord or GitHub Discussions

## 🔄 Changelog

### Version 1.0.0
- Initial release with Google Drive integration
- Modern UI design
- Comprehensive error handling
- Accessibility improvements
- Security enhancements

---

**Built with ❤️ following Chrome extension best practices**
