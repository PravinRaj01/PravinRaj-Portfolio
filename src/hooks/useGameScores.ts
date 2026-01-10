import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type GameType = 'terminal_quest' | 'neon_breakout';

interface GameScore {
  id: string;
  nickname: string;
  game_type: string;
  score: number;
  created_at: string;
}

const LOCAL_STORAGE_KEY = 'portfolio_arcade_scores';

interface LocalScores {
  terminal_quest: number;
  neon_breakout: number;
}

// Local high scores (personal bests)
export const useLocalHighScore = (gameType: GameType) => {
  const [highScore, setHighScore] = useState<number>(0);

  useEffect(() => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const scores: LocalScores = JSON.parse(stored);
        setHighScore(scores[gameType] || 0);
      } catch {
        setHighScore(0);
      }
    }
  }, [gameType]);

  const updateHighScore = useCallback((newScore: number) => {
    if (newScore > highScore) {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      let scores: LocalScores = { terminal_quest: 0, neon_breakout: 0 };
      
      if (stored) {
        try {
          scores = JSON.parse(stored);
        } catch {
          // Keep default
        }
      }
      
      scores[gameType] = newScore;
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(scores));
      setHighScore(newScore);
      return true;
    }
    return false;
  }, [gameType, highScore]);

  return { highScore, updateHighScore };
};

// Global leaderboard (anonymous)
export const useGlobalLeaderboard = (gameType: GameType) => {
  const [leaderboard, setLeaderboard] = useState<GameScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('game_scores')
        .select('*')
        .eq('game_type', gameType)
        .order('score', { ascending: false })
        .limit(10);

      if (error) throw error;
      setLeaderboard(data || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      setLeaderboard([]);
    } finally {
      setIsLoading(false);
    }
  }, [gameType]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const submitScore = useCallback(async (nickname: string, score: number) => {
    try {
      // Validate nickname (max 10 chars, alphanumeric + spaces)
      const cleanNickname = nickname.slice(0, 10).replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Anonymous';
      
      // Use the RPC function to bypass RLS restrictions
      const { error } = await supabase.rpc('submit_game_score', {
        p_game_type: gameType,
        p_nickname: cleanNickname,
        p_score: Math.floor(score),
      });

      if (error) throw error;
      
      // Refresh leaderboard
      await fetchLeaderboard();
      return true;
    } catch (error) {
      console.error('Failed to submit score:', error);
      return false;
    }
  }, [gameType, fetchLeaderboard]);

  return { leaderboard, isLoading, submitScore, refreshLeaderboard: fetchLeaderboard };
};
