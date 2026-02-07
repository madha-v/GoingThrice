# GoingThrice Installation & Deployment Guide

## Table of Contents
1. [Local Development Setup](#local-development-setup)
2. [Database Configuration](#database-configuration)
3. [Running the Application](#running-the-application)
4. [Testing with Sample Data](#testing-with-sample-data)
5. [Production Deployment](#production-deployment)
6. [Troubleshooting](#troubleshooting)

---

## Local Development Setup

### Prerequisites

Ensure you have the following installed:

```bash
# Check versions
node --version    # Should be v16 or higher
npm --version     # Should be v8 or higher
mongo --version   # MongoDB v4.4 or higher
psql --version    # PostgreSQL v12 or higher
```

### Step 1: Install Dependencies

```bash
cd goingthrice
npm install
```

This will install all required packages:
- express
- mongoose
- pg
- socket.io
- bcryptjs
- jsonwebtoken
- cors
- dotenv
- and more...

---

## Database Configuration

### MongoDB Setup

#### Option 1: Local MongoDB

```bash
# Start MongoDB service
sudo systemctl start mongod

# Verify MongoDB is running
sudo systemctl status mongod

# Connect to MongoDB shell
mongosh
```

#### Option 2: MongoDB Atlas (Cloud)

1. Create account at https://www.mongodb.com/cloud/atlas
2. Create a new cluster
3. Get connection string
4. Update `.env` with:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/goingthrice
```

### PostgreSQL Setup

#### Option 1: Local PostgreSQL

```bash
# Start PostgreSQL service
sudo systemctl start postgresql

# Login as postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE goingthrice;
CREATE USER goingthrice_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE goingthrice TO goingthrice_user;

# Exit
\q
```

Update `.env`:
```env
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=goingthrice
PG_USER=goingthrice_user
PG_PASSWORD=your_password
```

#### Option 2: Cloud PostgreSQL

**Heroku Postgres:**
```bash
heroku addons:create heroku-postgresql:hobby-dev
heroku config:get DATABASE_URL
```

**AWS RDS:**
1. Create RDS PostgreSQL instance
2. Configure security groups
3. Get connection details
4. Update `.env`

---

## Running the Application

### Start Backend Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

You should see:
```
╔═══════════════════════════════════════╗
║   🎯 GoingThrice API Server          ║
║   📡 Port: 5000                      ║
║   🌍 Environment: development        ║
║   ✅ Status: Running                  ║
╚═══════════════════════════════════════╝
```

### Start Frontend

#### Option 1: Python HTTP Server

```bash
cd frontend
python3 -m http.server 3000
```

#### Option 2: Node HTTP Server

```bash
npm install -g http-server
cd frontend
http-server -p 3000 -c-1
```

#### Option 3: Live Server (VS Code Extension)

1. Install "Live Server" extension
2. Right-click `frontend/index.html`
3. Select "Open with Live Server"

### Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

---

## Testing with Sample Data

### Seed the Database

```bash
npm run seed
```

This creates:
- 4 test users (buyer, seller, committee, admin)
- 6 sample auctions (various categories)
- Initial wallet balances
- Sample bids

### Test Credentials

**Buyer Account:**
- Email: `alice@example.com`
- Password: `password123`
- Wallet: ₹500,000

**Seller Account:**
- Email: `bob@example.com`
- Password: `password123`

**Admin Account:**
- Email: `admin@goingthrice.com`
- Password: `admin123`

### Manual Testing Flow

1. **Register/Login**
   - Navigate to http://localhost:3000
   - Click "Sign In"
   - Use test credentials above

2. **Browse Auctions**
   - View live auctions on homepage
   - Click on an auction to see details
   - Filter by categories

3. **Place a Bid**
   - Login as buyer (alice@example.com)
   - Click on a live auction
   - Enter bid amount
   - Click "Place Bid"
   - Watch real-time updates

4. **Create Auction (Seller)**
   - Login as seller (bob@example.com)
   - Use API endpoint or create UI form
   - Set auction parameters
   - Submit

5. **Test Real-Time Features**
   - Open two browser windows
   - Login as different users
   - Place bid in one window
   - See instant update in other window

---

## Production Deployment

### Prepare for Production

1. **Update Environment Variables**

```env
NODE_ENV=production
JWT_SECRET=use_strong_random_secret_here_min_32_characters
FRONTEND_URL=https://your-domain.com
```

2. **Security Enhancements**

Install additional packages:
```bash
npm install helmet express-rate-limit compression
```

Update `server.js`:
```javascript
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';

app.use(helmet());
app.use(compression());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);
```

3. **Build Frontend Assets**

Minify and optimize:
```bash
# Install build tools
npm install -g minify

# Minify CSS/JS
cd frontend
minify app.js > app.min.js
minify style.css > style.min.css
```

### Deployment Options

#### Option 1: Heroku

```bash
# Login to Heroku
heroku login

# Create app
heroku create goingthrice-api

# Add databases
heroku addons:create heroku-postgresql:hobby-dev
heroku addons:create mongolab:sandbox

# Set environment variables
heroku config:set JWT_SECRET=your_secret
heroku config:set NODE_ENV=production

# Deploy
git push heroku main

# Open
heroku open
```

#### Option 2: DigitalOcean

1. Create droplet (Ubuntu 20.04)
2. SSH into server
3. Install Node.js, MongoDB, PostgreSQL
4. Clone repository
5. Configure environment
6. Setup PM2 for process management
7. Configure Nginx as reverse proxy
8. Setup SSL with Let's Encrypt

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start server.js --name goingthrice

# Setup auto-restart
pm2 startup
pm2 save
```

#### Option 3: AWS

**Services:**
- EC2 for backend
- RDS for PostgreSQL
- DocumentDB for MongoDB
- S3 for static frontend
- CloudFront for CDN
- Route 53 for DNS

#### Option 4: Vercel (Frontend) + Render (Backend)

**Frontend (Vercel):**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel
```

**Backend (Render):**
1. Connect GitHub repository
2. Create Web Service
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables

### SSL Certificate Setup

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

### Performance Optimization

1. **Enable Caching**
```javascript
import redis from 'redis';
const redisClient = redis.createClient();
```

2. **Database Indexing**
```javascript
// Already included in models, but verify:
db.auctions.createIndex({ status: 1, end_time: 1 });
db.auctions.createIndex({ category: 1 });
```

3. **Compression**
```javascript
app.use(compression());
```

4. **Load Balancing**
- Use Nginx for load balancing
- Setup multiple server instances
- Configure health checks

---

## Troubleshooting

### Common Issues

#### MongoDB Connection Error

```
Error: MongoServerError: Authentication failed
```

**Solution:**
```bash
# Check MongoDB is running
sudo systemctl status mongod

# Restart MongoDB
sudo systemctl restart mongod

# Verify connection string in .env
```

#### PostgreSQL Connection Error

```
Error: password authentication failed
```

**Solution:**
```bash
# Update pg_hba.conf
sudo nano /etc/postgresql/12/main/pg_hba.conf

# Change to:
local   all             all                                     md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

#### Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::5000
```

**Solution:**
```bash
# Find process using port
lsof -i :5000

# Kill process
kill -9 <PID>

# Or use different port
PORT=5001 npm start
```

#### Socket.IO Connection Failed

```
WebSocket connection failed
```

**Solution:**
- Check firewall settings
- Verify CORS configuration
- Ensure frontend URL matches backend
- Check browser console for errors

#### JWT Token Expired

```
Error: Token expired
```

**Solution:**
- User needs to login again
- Increase JWT_EXPIRE in .env
- Implement refresh token mechanism

### Performance Issues

If experiencing slow responses:

1. **Check Database Indexes**
```javascript
db.auctions.getIndexes();
```

2. **Monitor Database Queries**
```javascript
mongoose.set('debug', true);
```

3. **Check Server Resources**
```bash
top
htop
free -h
df -h
```

4. **Enable Caching**
- Implement Redis
- Cache frequent queries
- Use CDN for static assets

### Getting Help

- **Documentation**: See README.md
- **API Reference**: See API_DOCUMENTATION.md
- **Issues**: Open GitHub issue
- **Email**: support@goingthrice.com

---

## Health Checks

### Backend Health

```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "GoingThrice API is running",
  "timestamp": "2026-02-07T..."
}
```

### Database Health

```bash
# MongoDB
mongosh --eval "db.adminCommand('ping')"

# PostgreSQL
psql -U goingthrice_user -d goingthrice -c "SELECT 1;"
```

---

## Monitoring & Logging

### Setup Application Logging

```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### Setup Error Tracking

Consider using:
- Sentry for error tracking
- LogRocket for session replay
- New Relic for APM
- Datadog for infrastructure monitoring

---

**🎉 Congratulations! Your GoingThrice platform is now ready for production!**
