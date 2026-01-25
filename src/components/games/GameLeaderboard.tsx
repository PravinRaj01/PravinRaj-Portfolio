import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Award, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GameType, useGlobalLeaderboard, useLocalHighScore } from '@/hooks/useGameScores';
import { usePortfolio } from '@/contexts/PortfolioContext';

interface GameLeaderboardProps {
  gameType: GameType;
  currentScore?: number;
}

const GameLeaderboard: React.FC<GameLeaderboardProps> = ({ gameType, currentScore }) => {
  const { mode } = usePortfolio();
  const { highScore } = useLocalHighScore(gameType);
  const { leaderboard, isLoading, refreshLeaderboard } = useGlobalLeaderboard(gameType);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 1:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 2:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 text-center text-muted-foreground font-mono">{index + 1}</span>;
    }
  };

  const accentColor = mode === 'creative' 
    ? 'from-creative-orange to-creative-orange-light' 
    : 'from-primary to-primary-light';

  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          Leaderboard
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={refreshLeaderboard}
          disabled={isLoading}
          className="h-8 w-8 p-0"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Personal Best */}
      <div className={`bg-gradient-to-r ${accentColor} p-3 rounded-lg mb-4`}>
        <div className="flex items-center justify-between">
          <span className="text-primary-foreground text-sm font-medium">Your Best</span>
          <span className="text-primary-foreground text-xl font-bold">{highScore.toLocaleString()}</span>
        </div>
        {currentScore !== undefined && currentScore > 0 && (
          <div className="flex items-center justify-between mt-1 pt-1 border-t border-primary-foreground/20">
            <span className="text-primary-foreground/80 text-xs">Current</span>
            <span className="text-primary-foreground/80 text-sm font-medium">{currentScore.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Global Leaderboard */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No scores yet!</p>
            <p className="text-xs mt-1">Be the first to set a record</p>
          </div>
        ) : (
          leaderboard.map((score, index) => (
            <motion.div
              key={score.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                index < 3 ? 'bg-muted/50' : 'hover:bg-muted/30'
              }`}
            >
              <div className="flex-shrink-0">{getRankIcon(index)}</div>
              <div className="flex-grow min-w-0">
                <span className="text-foreground font-medium truncate block">
                  {score.nickname}
                </span>
              </div>
              <div className="flex-shrink-0 text-right">
                <span className="text-foreground font-mono font-bold">
                  {score.score.toLocaleString()}
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default GameLeaderboard;
