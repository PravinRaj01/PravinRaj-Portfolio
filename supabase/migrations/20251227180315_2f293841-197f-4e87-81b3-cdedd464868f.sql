-- Create game_scores table for anonymous leaderboard
CREATE TABLE public.game_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname VARCHAR(10) NOT NULL,
  game_type VARCHAR(20) NOT NULL,
  score INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read scores (public leaderboard)
CREATE POLICY "Allow public read access on game_scores"
ON public.game_scores
FOR SELECT
USING (true);

-- Allow anyone to insert scores (anonymous submissions)
CREATE POLICY "Allow public insert on game_scores"
ON public.game_scores
FOR INSERT
WITH CHECK (true);

-- Create index for efficient leaderboard queries
CREATE INDEX idx_game_scores_game_type_score ON public.game_scores(game_type, score DESC);