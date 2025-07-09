# Deployment Guide - Interactive English Learning Book

## Quick Start Deployment

### Option 1: GitHub Pages (Recommended)

1. **Create GitHub Repository**
   ```bash
   # Create a new repository on GitHub named 'interactive-english-learning'
   # Then push this code:
   
   git remote add origin https://github.com/YOUR_USERNAME/interactive-english-learning.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**
   - Go to repository Settings → Pages
   - Source: Deploy from a branch
   - Branch: main / (root)
   - Save

3. **Automatic Deployment**
   - The GitHub Action will automatically deploy your site
   - Visit: `https://YOUR_USERNAME.github.io/interactive-english-learning/`

### Option 2: Firebase Hosting

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login and Initialize**
   ```bash
   firebase login
   firebase init hosting
   ```

3. **Deploy**
   ```bash
   firebase deploy
   ```

## Firebase Configuration

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project
3. Enable Authentication (Email/Password)
4. Create Firestore database

### 2. Get Configuration
1. Project Settings → General → Your apps
2. Add web app
3. Copy configuration object

### 3. Update Configuration
Replace the content in `assets/firebase-config.js`:

```javascript
export const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

### 4. Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## Production Checklist

### Before Deployment
- [ ] Update Firebase configuration
- [ ] Test all features locally
- [ ] Verify responsive design
- [ ] Check console for errors
- [ ] Test authentication flow
- [ ] Validate question types
- [ ] Test progress tracking

### Security Setup
- [ ] Configure Firestore security rules
- [ ] Set up proper authentication
- [ ] Enable HTTPS (automatic with GitHub Pages/Firebase)
- [ ] Configure CORS if needed

### Performance Optimization
- [ ] Minimize CSS/JS files
- [ ] Optimize images
- [ ] Enable caching headers
- [ ] Test loading speed

## Environment Variables

For production deployment, you may want to use environment variables:

```javascript
// assets/firebase-config.js
export const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "fallback-key",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "fallback-domain",
  // ... other config
};
```

## Custom Domain Setup

### GitHub Pages
1. Add CNAME file with your domain
2. Configure DNS records
3. Enable HTTPS in repository settings

### Firebase Hosting
```bash
firebase hosting:channel:deploy live --only hosting
```

## Monitoring and Analytics

### Firebase Analytics
Add to your Firebase configuration:
```javascript
import { getAnalytics } from "firebase/analytics";
const analytics = getAnalytics(app);
```

### Error Monitoring
Consider adding error tracking:
- Sentry
- LogRocket
- Firebase Crashlytics

## Backup and Recovery

### Database Backup
```bash
# Export Firestore data
gcloud firestore export gs://your-bucket/backup-folder
```

### Code Backup
- Repository is automatically backed up on GitHub
- Consider setting up automated backups

## Scaling Considerations

### Performance
- Use Firebase CDN for static assets
- Implement lazy loading for large content
- Consider service workers for offline functionality

### Database
- Monitor Firestore usage
- Optimize queries
- Consider data archiving for old user data

## Troubleshooting

### Common Issues

1. **Firebase Connection Failed**
   - Check API keys
   - Verify domain whitelist
   - Check browser console for errors

2. **Authentication Not Working**
   - Verify email/password provider is enabled
   - Check domain authorization
   - Test with different browsers

3. **Deployment Failed**
   - Check GitHub Actions logs
   - Verify file permissions
   - Check for syntax errors

### Debug Mode
Add to URL: `?debug=true` to enable debug logging

## Support

- GitHub Issues: Create issues for bugs and feature requests
- Documentation: Check README.md for detailed information
- Community: Join discussions in repository

## License

This project is licensed under the MIT License - see LICENSE file for details.

