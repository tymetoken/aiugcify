# AI UGCify

Generate AI-powered UGC marketing videos from TikTok Shop products.

## Tech Stack

- **Extension:** React, TypeScript, Tailwind, Zustand, Chrome Manifest V3
- **Backend:** Node.js, Express, TypeScript, Prisma, PostgreSQL
- **Queue:** BullMQ + Redis
- **APIs:** OpenAI ChatGPT (scripts), Kie.ai Sora 2 (videos)
- **Storage:** Cloudinary
- **Payments:** Stripe

## Prerequisites

- Node.js >= 20
- pnpm >= 8
- Docker & Docker Compose
- PostgreSQL (or use Docker)
- Redis (or use Docker)

## Getting Started

### 1. Clone and Install Dependencies

```bash
cd aiugcify
pnpm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example apps/api/.env
```

Edit `apps/api/.env` with your credentials:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aiugcify?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_ACCESS_SECRET="your-secret-here"
JWT_REFRESH_SECRET="your-secret-here"

# Stripe (get from stripe.com/dashboard)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_STARTER="price_..."
STRIPE_PRICE_CREATOR="price_..."
STRIPE_PRICE_PRO="price_..."
STRIPE_PRICE_AGENCY="price_..."

# OpenAI (for ChatGPT script generation)
OPENAI_API_KEY="sk-..."

# Kie.ai (for Sora 2 video generation)
KIE_API_KEY="your-kie-api-key"
KIE_API_BASE_URL="https://api.kie.ai"

# Cloudinary
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."

# Freemium (free credits on signup)
FREE_CREDITS_ON_SIGNUP="2"
```

### 3. Start Database and Redis

```bash
docker-compose up -d postgres redis
```

### 4. Set Up Database

```bash
cd apps/api
pnpm db:push      # Push schema to database
pnpm db:seed      # Seed credit packages
```

### 5. Start Development Servers

In separate terminals:

```bash
# Terminal 1 - API Server
pnpm dev:api

# Terminal 2 - Video Worker
cd apps/api && pnpm worker:dev

# Terminal 3 - Extension (optional, for hot reload)
pnpm dev:extension
```

### 6. Load Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `apps/extension/dist` folder

## Project Structure

```
aiugcify/
├── apps/
│   ├── api/                 # Express backend
│   │   ├── src/
│   │   │   ├── config/      # Database, Redis, env config
│   │   │   ├── routes/      # API routes
│   │   │   ├── controllers/ # Request handlers
│   │   │   ├── services/    # Business logic
│   │   │   ├── workers/     # BullMQ workers
│   │   │   ├── queues/      # Queue definitions
│   │   │   ├── middleware/  # Auth, validation, errors
│   │   │   └── utils/       # Helpers
│   │   └── prisma/          # Database schema
│   │
│   └── extension/           # Chrome Extension
│       ├── src/
│       │   ├── background/  # Service worker
│       │   ├── content/     # TikTok scraper
│       │   ├── popup/       # React UI
│       │   └── shared/      # API client, storage
│       └── public/          # Manifest, icons
│
└── packages/
    └── shared-types/        # TypeScript types
```

## API Endpoints

### Auth
- `POST /api/v1/auth/register` - Create account
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/logout` - Logout
- `GET /api/v1/auth/me` - Get current user

### Credits
- `GET /api/v1/credits/packages` - List packages
- `GET /api/v1/credits/balance` - Get balance
- `POST /api/v1/credits/checkout` - Create Stripe session
- `GET /api/v1/credits/history` - Transaction history

### Videos
- `POST /api/v1/videos/generate-script` - Generate script
- `PUT /api/v1/videos/:id/script` - Update script
- `POST /api/v1/videos/:id/confirm` - Start generation
- `GET /api/v1/videos/:id` - Get video status
- `GET /api/v1/videos/:id/download` - Get download URL
- `GET /api/v1/videos` - List videos

## Credit Packages

| Package | Credits | Price |
|---------|---------|-------|
| Free (signup) | 2 | $0 |
| Starter | 5 | $15 |
| Creator | 25 | $59 |
| Pro | 100 | $199 |
| Agency | 500 | $749 |

## User Flow

1. User installs extension
2. Creates account (receives 2 free credits)
3. Optionally purchases more credits via Stripe
4. Navigates to TikTok Shop product page
5. Clicks extension popup
6. Extension scrapes product data
7. Selects video style (Product Showcase, Talking Head, or Lifestyle)
8. OpenAI ChatGPT generates UGC script
9. User reviews/edits script
10. Confirms generation (1 credit)
11. Kie.ai Sora 2 generates video
12. Video uploaded to Cloudinary
13. Download available for 7 days

## Development

### Database Commands

```bash
pnpm db:push      # Push schema changes
pnpm db:migrate   # Create migration
pnpm db:seed      # Seed data
pnpm db:studio    # Open Prisma Studio
```

### Building for Production

```bash
# Build everything
pnpm build

# Build API only
pnpm build:api

# Build extension only
pnpm build:extension
```

### Docker Production Build

```bash
docker-compose --profile production up -d
```

## Deployment

### Backend (Railway/Render)

1. Connect your repository
2. Set environment variables
3. Deploy `apps/api` with start command: `node dist/index.js`
4. Deploy worker with: `node dist/workers/index.js`

### Chrome Extension

1. Run `pnpm build:extension`
2. Zip the `apps/extension/dist` folder
3. Submit to Chrome Web Store

## License

Private - All rights reserved
