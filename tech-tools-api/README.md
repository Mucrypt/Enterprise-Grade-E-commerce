# 🚀 TechTools API - Enterprise E-commerce Platform

A production-ready, enterprise-grade RESTful API built with Node.js, TypeScript, PostgreSQL, Redis, and Docker. Designed for scalability, security, and easy deployment.

## ✨ Features

- 🔐 **Authentication & Authorization**: JWT-based auth with refresh tokens
- 📦 **Product Management**: Full CRUD operations with categories
- 🛒 **Order Management**: Order processing and tracking
- 💳 **Payment Integration**: Ready for Stripe/PayPal integration
- 👥 **User Management**: Customer and admin roles
- 🏢 **Supplier Management**: Supplier portal and inventory
- 📧 **Email Notifications**: Automated emails for orders, registration
- 🎨 **RESTful API**: Clean, versioned API structure
- 🐳 **Docker Support**: Full containerization for dev and production
- 🔒 **SSL/HTTPS**: Automated Let's Encrypt certificates
- 🚀 **Nginx**: Reverse proxy with load balancing and rate limiting
- 💾 **Database Migrations**: Version-controlled schema changes
- 📊 **Redis Caching**: Fast caching and session management
- 🛡️ **Security**: Rate limiting, CORS, security headers, input validation
- 📝 **Logging**: Structured logging with Winston
- 🔄 **Auto-backup**: Automated database backups

## 🏗️ Tech Stack

- **Runtime**: Node.js 20
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Reverse Proxy**: Nginx
- **Containerization**: Docker & Docker Compose
- **SSL**: Let's Encrypt (Certbot)

## 📋 Prerequisites

- Node.js 18+ (for local development)
- Docker & Docker Compose (for containerized deployment)
- Git

## 🚀 Quick Start

### Local Development (Docker)

```bash
# Clone the repository
git clone <your-repo-url>
cd tech-tools-api

# Copy environment variables
cp .env.example .env

# Start development environment
npm run docker:dev:up

# API will be available at:
# - Direct: http://localhost:9000
# - Via Nginx: http://localhost:80
# - PgAdmin: http://localhost:8080
# - Redis Commander: http://localhost:8081
```

### Local Development (Non-Docker)

```bash
# Install dependencies
npm install

# Setup PostgreSQL and Redis locally
# Update .env with your database credentials

# Run migrations
npm run migrate:up

# Start development server
npm run dev
```

## 📁 Project Structure

```
tech-tools-api/
├── src/
│   ├── api/
│   │   ├── middleware/          # Global middleware
│   │   └── v1/                  # API version 1
│   │       ├── auth/           # Authentication endpoints
│   │       ├── users/          # User management
│   │       ├── products/       # Product management
│   │       ├── categories/     # Category management
│   │       ├── orders/         # Order management
│   │       ├── payments/       # Payment processing
│   │       └── suppliers/      # Supplier management
│   ├── config/                 # Configuration files
│   ├── database/               # Database setup
│   │   ├── connection.ts      # Database connection
│   │   ├── migrations/        # SQL migrations
│   │   └── seeds/             # Seed data
│   ├── middleware/            # Route middleware
│   ├── types/                 # TypeScript types
│   ├── utils/                 # Utility functions
│   ├── app.ts                 # Express app setup
│   ├── server.ts              # Server configuration
│   └── index.ts               # Entry point
├── infra/                      # Infrastructure files
│   ├── docker/                # Docker configurations
│   ├── nginx/                 # Nginx configurations
│   ├── database/              # Database init scripts
│   ├── scripts/               # Deployment scripts
│   └── README.md              # Infrastructure guide
├── .env.example               # Environment template (dev)
├── .env.production.example    # Environment template (prod)
├── tsconfig.json              # TypeScript configuration
└── package.json               # Node.js dependencies
```

## 🔧 Available Scripts

```bash
# Development
npm run dev                    # Start development server
npm run docker:dev:up          # Start Docker dev environment
npm run docker:dev:down        # Stop Docker dev environment
npm run docker:dev:restart     # Restart Docker dev environment

# Production
npm run docker:prod:deploy     # Deploy to production
npm run ssl:setup              # Setup SSL certificate

# Database
npm run migrate:up             # Run migrations
npm run migrate:down           # Rollback migrations
npm run seed                   # Seed database
npm run docker:backup          # Backup database

# Code Quality
npm run build                  # Build TypeScript
npm run test                   # Run tests
npm run lint                   # Lint code
npm run format                 # Format code
npm run type-check             # Check types
```

## 🌐 API Endpoints

### Base URL

- Development: `http://localhost:9000/api/v1`
- Production: `https://api.yourdomain.com/api/v1`

### Authentication

```
POST   /auth/register          # Register new user
POST   /auth/login             # Login user
POST   /auth/logout            # Logout user
POST   /auth/refresh           # Refresh access token
POST   /auth/verify-email      # Verify email
POST   /auth/forgot-password   # Request password reset
POST   /auth/reset-password    # Reset password
```

### Products

```
GET    /products               # Get all products
GET    /products/:id           # Get single product
POST   /products               # Create product (admin)
PUT    /products/:id           # Update product (admin)
DELETE /products/:id           # Delete product (admin)
```

### Categories

```
GET    /categories             # Get all categories
POST   /categories             # Create category (admin)
PUT    /categories/:id         # Update category (admin)
DELETE /categories/:id         # Delete category (admin)
```

### Orders

```
GET    /orders                 # Get user orders
GET    /orders/:id             # Get single order
POST   /orders                 # Create order
PUT    /orders/:id/status      # Update order status (admin)
```

### Users

```
GET    /users/profile          # Get user profile
PUT    /users/profile          # Update user profile
GET    /users                  # Get all users (admin)
PUT    /users/:id/role         # Update user role (admin)
```

## 🚀 Production Deployment

### Deploy to Hetzner Server

1. **Purchase Domain from Hostinger**

   - Buy your domain (e.g., yourdomain.com)
   - Configure DNS to point to Hetzner server IP

2. **Setup Hetzner VPS**

   ```bash
   # Choose: Ubuntu 22.04, 2GB RAM minimum
   # Get server IP address
   ```

3. **Initial Server Setup**

   ```bash
   ssh root@your-server-ip

   # Update system
   apt update && apt upgrade -y

   # Install Docker
   curl -fsSL https://get.docker.com | sh
   apt install docker-compose -y

   # Create app directory
   mkdir -p /opt/techtools-api
   cd /opt/techtools-api
   ```

4. **Deploy Application**

   ```bash
   # Clone repository
   git clone <your-repo-url> .

   # Setup environment
   cp .env.production.example .env.production
   nano .env.production  # Update with your settings

   # Deploy
   npm run docker:prod:deploy

   # Setup SSL
   npm run ssl:setup
   ```

5. **Configure Firewall**

   ```bash
   ufw allow 22     # SSH
   ufw allow 80     # HTTP
   ufw allow 443    # HTTPS
   ufw enable
   ```

6. **Verify Deployment**

   ```bash
   # Check health
   curl https://api.yourdomain.com/health

   # Check logs
   cd infra/docker/production
   docker-compose logs -f
   ```

📖 **Full deployment guide**: See [infra/README.md](infra/README.md)

## 🔒 Security

- ✅ JWT authentication with refresh tokens
- ✅ Password hashing with bcrypt
- ✅ Rate limiting on API endpoints
- ✅ CORS configuration
- ✅ Security headers (Helmet)
- ✅ Input validation and sanitization
- ✅ SQL injection prevention (parameterized queries)
- ✅ HTTPS/SSL encryption
- ✅ Environment variable protection

## 📱 Frontend Integration

### React/Next.js Example

```javascript
// api.js
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL

export const api = {
  async login(email, password) {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    return response.json()
  },

  async getProducts() {
    const response = await fetch(`${API_BASE_URL}/api/v1/products`)
    return response.json()
  },

  async createOrder(orderData, token) {
    const response = await fetch(`${API_BASE_URL}/api/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderData),
    })
    return response.json()
  },
}
```

### Mobile App Example (React Native)

```javascript
import axios from 'axios'

const api = axios.create({
  baseURL: 'https://api.yourdomain.com/api/v1',
  timeout: 10000,
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = AsyncStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api
```

## 🔄 Database Migrations

```bash
# Create new migration
# Create file in src/database/migrations/00X_migration_name.sql

# Run migrations
npm run migrate:up

# Rollback migration
npm run migrate:down
```

## 📊 Monitoring & Logs

```bash
# View API logs
cd infra/docker/production
docker-compose logs -f api

# View Nginx logs
docker-compose logs -f nginx

# View PostgreSQL logs
docker-compose logs -f postgres

# View all logs
docker-compose logs -f
```

## 💾 Database Backups

```bash
# Manual backup
npm run docker:backup

# Restore from backup
./infra/scripts/restore-db.sh <backup-file>

# Automated backups (add to crontab)
0 2 * * * cd /opt/techtools-api && npm run docker:backup
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

## 📝 Environment Variables

See `.env.example` for all available options:

**Required**:

- `DB_PASSWORD` - Database password
- `REDIS_PASSWORD` - Redis password (production)
- `JWT_SECRET` - JWT signing secret
- `JWT_REFRESH_SECRET` - JWT refresh token secret

**Optional**:

- `SMTP_*` - Email configuration
- `AWS_*` - S3 file uploads
- `STRIPE_SECRET_KEY` - Payment processing

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

Your Name - Building enterprise solutions for a better future.

## 🙏 Acknowledgments

- Built with passion to quit the 9-5 grind
- Designed for easy integration with admin dashboard, store, and mobile apps
- Production-ready for scaling your e-commerce empire

---

**Ready to quit your 9-5?** Deploy this API and start building your empire! 🚀

For detailed infrastructure setup, see [infra/README.md](infra/README.md)
