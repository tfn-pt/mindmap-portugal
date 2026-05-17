# Deployment Guide - MindMap Portugal Web

## Prerequisites
- Node.js 18+
- npm or yarn package manager
- Git (optional, for version control)

## Local Development Setup

### 1. Installation
```bash
cd web
npm install
```

### 2. Development Server
```bash
npm run dev
```
Access at: `http://localhost:3000`

### 3. Building for Production
```bash
npm run build
npm run start
```

## Deployment Options

### Option 1: Vercel (Recommended for Next.js)
**Benefits**: Optimized for Next.js, automatic deployments, edge functions

1. Push your code to GitHub
2. Connect repository to Vercel (vercel.com)
3. Import the `/web` directory as root
4. Configure environment variables if needed
5. Click "Deploy"

**Environment Variables** (if using .env):
```
NEXT_PUBLIC_APP_NAME=MindMap Portugal
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Option 2: Netlify
**Benefits**: Simple configuration, good for static/hybrid sites

1. Connect GitHub repository
2. Set build command: `npm run build`
3. Set publish directory: `.next`
4. Deploy

**Note**: May require additional configuration for API routes

### Option 3: Docker
**Benefits**: Reproducible deployments, works anywhere

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Build application
COPY . .
RUN npm run build

# Remove development dependencies
RUN npm prune --omitempty --production

EXPOSE 3000

CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t mindmap-portugal .
docker run -p 3000:3000 mindmap-portugal
```

### Option 4: Self-Hosted (VPS/Dedicated Server)
**Requirements**:
- Node.js 18+ installed
- PM2 or similar process manager
- Nginx/Apache as reverse proxy

**Setup**:
```bash
# SSH into your server
ssh user@your-server.com

# Clone repository
git clone <repo-url>
cd web

# Install dependencies
npm install

# Build application
npm run build

# Install PM2 globally
npm install -g pm2

# Start application with PM2
pm2 start npm --name "mindmap" -- start

# Setup autostart
pm2 startup
pm2 save
```

**Nginx Configuration**:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Environment Configuration

### Production Environment Variables
Create `.env.production` or set in hosting platform:

```
NEXT_PUBLIC_APP_NAME=MindMap Portugal
NEXT_PUBLIC_APP_URL=https://mindmap-portugal.pt
NEXT_PUBLIC_DATA_PATH=/data
```

## Performance Optimization

### Build Optimization
```bash
npm run build
```
Outputs optimized production bundle to `.next/`

### Image Optimization
- Images are automatically optimized via Next.js Image component
- Configure in `next.config.js` if needed

### Cache Configuration
```javascript
// Headers for CDN caching
Cache-Control: public, max-age=31536000, immutable  // Static assets
Cache-Control: public, max-age=3600, s-maxage=86400 // HTML pages
```

## Monitoring & Logging

### Vercel Monitoring
- Automatic error tracking via Sentry integration
- Real-time analytics and performance metrics
- Deployment logs available in Vercel dashboard

### Self-Hosted Monitoring
```bash
# Use PM2 Plus for monitoring
pm2 plus

# View logs
pm2 logs mindmap

# Monitor CPU/Memory
pm2 monit
```

## SSL/TLS Certificate

### Using Let's Encrypt (Free)
```bash
# On Ubuntu with Certbot
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
sudo certbot renew --dry-run  # Test renewal
```

### Auto-renewal with Cron
```bash
# Add to crontab
0 12 * * * /usr/bin/certbot renew --quiet
```

## Database/Data Setup

If using dynamic data:

1. **CSV Files**: Place in `public/data/` directory
2. **JSON Files**: Place in `public/data/` directory
3. **API Integration**: Configure endpoints in `lib/dataLoader.ts`

## Backup & Recovery

### Code Backup
```bash
# Daily backup
0 2 * * * tar -czf /backup/mindmap-$(date +\%Y\%m\%d).tar.gz /app/web/
```

### Database Backup (if applicable)
```bash
# Configure automated backups per your database system
```

## Security Checklist

- [ ] SSL/TLS certificate installed
- [ ] Environment variables not committed to git
- [ ] `.gitignore` properly configured
- [ ] Headers set for security (CSP, X-Frame-Options, etc.)
- [ ] Regular npm security audits: `npm audit`
- [ ] Dependencies kept up to date
- [ ] Error logging configured
- [ ] Rate limiting enabled
- [ ] DDoS protection enabled
- [ ] Regular backups scheduled

## Performance Benchmarks

Target metrics:
- **Lighthouse Score**: 90+
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **Time to Interactive**: < 3.5s

## Post-Deployment Testing

### Functional Testing
```bash
# Test hero section
✓ Page loads
✓ Neural mesh animates
✓ Navigation responsive
✓ Scroll animations trigger
✓ All links functional
```

### Accessibility Testing
```bash
✓ Keyboard navigation works
✓ Screen reader compatible
✓ Color contrast acceptable
✓ Focus indicators visible
✓ Skip link functional
```

### Performance Testing
```bash
✓ Lighthouse score > 90
✓ Page load < 2 seconds
✓ Images optimized
✓ Bundle size reasonable
```

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### Build Failures
```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Memory Issues
```bash
# Increase Node memory
NODE_OPTIONS=--max_old_space_size=4096 npm run build
```

## Support & Documentation

- Next.js Docs: https://nextjs.org/docs
- Vercel Deployment: https://vercel.com/docs
- Tailwind CSS: https://tailwindcss.com
- Framer Motion: https://www.framer.com/motion/

---

**Last Updated**: May 2026
**Next.js Version**: 14.0+
**Node.js Version**: 18+
