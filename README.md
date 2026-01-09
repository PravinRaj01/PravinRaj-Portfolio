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

- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui
- **Backend**: Supabase (Database, Auth, Storage, Edge Functions)
- **Animations**: Framer Motion
- **3D Graphics**: Three.js, React Three Fiber

## Getting Started

```bash
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project directory
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Set up environment variables
# Create a .env file with your Supabase credentials:
# VITE_SUPABASE_URL=your_supabase_url
# VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key

# Start development server
npm run dev
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

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Configure build settings:
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. Add environment variables
4. Deploy

### Environment Variables
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon/public key
- `VITE_SUPABASE_PROJECT_ID` - Supabase project reference ID

## License

MIT License
