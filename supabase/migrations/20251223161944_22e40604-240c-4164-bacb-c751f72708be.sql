-- Add more chatbot settings to site_settings
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS chatbot_welcome_message text DEFAULT 'Hi there! 👋 I can help you learn about my skills, projects, and experience.',
ADD COLUMN IF NOT EXISTS chatbot_name text DEFAULT 'Portfolio Assistant',
ADD COLUMN IF NOT EXISTS chatbot_default_state text DEFAULT 'mini';