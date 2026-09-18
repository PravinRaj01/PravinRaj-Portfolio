# Portfolio Website

A modern, dual-mode portfolio website showcasing professional and creative work.

## Features

- **Dual Mode System**: Switch between Professional and Creative modes for different audiences
- **Dynamic Content**: CMS-powered content management through admin dashboard
- **Project Showcase**: Timeline and card views for displaying projects
- **Experience Timeline**: Professional work history with achievements
- **Academic Section**: Education, certifications, and achievements
- **AI Chatbot**: Interactive portfolio assistant
- **Responsive Design**: Optimized for all device sizes
- **Dark Mode**: Sleek dark theme throughout

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Bun
- **Styling**: Tailwind CSS, shadcn/ui
- **Backend**: FastAPI (Python, async), Neon Postgres, Cloudflare R2 storage
- **Animations**: Framer Motion
- **3D Graphics**: Three.js, React Three Fiber

See `MIGRATION_PLAN.md` for the full backend architecture and schema.

## Getting Started

### Frontend

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd gg-portfolio

# Install dependencies
bun install

# Optional: point at a non-default backend URL (defaults to
# http://localhost:8000/api/v1 in dev, https://api.pravinraj.dev/api/v1
# in production builds)
# echo "VITE_API_BASE_URL=http://localhost:8000/api/v1" > .env.local

# Start development server
bun run dev
```

### Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate   # .venv/bin/activate on macOS/Linux

pip install -e .
cp .env.example .env     # fill in DATABASE_URL, R2, JWT, etc.

alembic upgrade head
python scripts/create_admin.py

uvicorn main:app --reload
```

## Project Structure

```
src/
├── components/     # Reusable UI components
│   ├── admin/      # Admin dashboard components
│   ├── chatbot/    # AI chatbot components
│   ├── games/      # Interactive games
│   └── ui/         # shadcn/ui components
├── contexts/       # React context providers
├── hooks/          # Custom React hooks
├── pages/          # Page components
├── services/       # API services
├── types/          # TypeScript types
└── utils/          # Utility functions
```

## Admin Dashboard

Access the admin dashboard at `/admin` to manage:
- Hero content
- About section
- Projects
- Experience
- Skills
- Services
- Site settings
- Mode configuration

## Deployment

The frontend and backend deploy as **two separate Vercel projects** from this same repository.

### Frontend (Vercel)
1. Connect this GitHub repository to a Vercel project (Root Directory: repo root)
2. Framework: Vite, Build Command: `bun run build`, Output Directory: `dist`
3. No environment variables are required — the production API URL is baked into `src/services/apiClient.ts`. Set `VITE_API_BASE_URL` only to override it.
4. Deploy

### Backend (Vercel)
1. Connect the same repository to a **second** Vercel project, with Root Directory `backend`
2. FastAPI is auto-detected (see `backend/vercel.json`)
3. Add environment variables from `backend/.env.example`: `DATABASE_URL`, `DATABASE_URL_DIRECT`, `JWT_SECRET`, `R2_*`, `CORS_ORIGINS`, `CORS_ORIGIN_REGEX`, `GOOGLE_DRIVE_API_KEY`, `LOVABLE_API_KEY`, and `ENVIRONMENT=production`
4. Add a custom domain (e.g. `api.pravinraj.dev`) and point a CNAME at it from your DNS provider
5. Run `alembic upgrade head` against `DATABASE_URL_DIRECT` before the first deploy

## License

MIT License
