import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Terminal, Zap, Gamepad2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { usePortfolio } from '@/contexts/PortfolioContext';
import TerminalQuest from '@/components/games/TerminalQuest';
import NeonBreakout from '@/components/games/NeonBreakout';
import GameLeaderboard from '@/components/games/GameLeaderboard';
import { GameType } from '@/hooks/useGameScores';

const Playground: React.FC = () => {
  const navigate = useNavigate();
  const { mode } = usePortfolio();
  const [activeGame, setActiveGame] = React.useState<GameType>(
    mode === 'creative' ? 'neon_breakout' : 'terminal_quest'
  );

  // Update game when mode changes
  React.useEffect(() => {
    setActiveGame(mode === 'creative' ? 'neon_breakout' : 'terminal_quest');
  }, [mode]);

  const games = [
    {
      id: 'terminal_quest' as GameType,
      name: 'Terminal Quest',
      icon: Terminal,
      description: 'Master the command line',
      color: 'from-purple-500 to-violet-600',
      mode: 'professional',
    },
    {
      id: 'neon_breakout' as GameType,
      name: 'Neon Breakout',
      icon: Zap,
      description: 'Classic arcade action',
      color: 'from-orange-500 to-pink-500',
      mode: 'creative',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(to right, currentColor 1px, transparent 1px),
              linear-gradient(to bottom, currentColor 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <Gamepad2 className="w-6 h-6 text-primary" />
                <h1 className="text-xl font-bold text-foreground">Secret Arcade</h1>
              </div>
            </div>

            {/* Game Switcher */}
            <div className="flex gap-2">
              {games.map((game) => (
                <Button
                  key={game.id}
                  variant={activeGame === game.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveGame(game.id)}
                  className={`gap-2 ${activeGame === game.id ? `bg-gradient-to-r ${game.color}` : ''}`}
                >
                  <game.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{game.name}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Game Area */}
          <motion.div
            key={activeGame}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="lg:col-span-3"
          >
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden relative" style={{ minHeight: '600px' }}>
              {activeGame === 'terminal_quest' ? (
                <TerminalQuest />
              ) : (
                <NeonBreakout />
              )}
            </div>
          </motion.div>

          {/* Leaderboard Sidebar */}
          <div className="lg:col-span-1">
            <GameLeaderboard gameType={activeGame} />
            
            {/* Game Info */}
            <div className="mt-4 bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-4">
              <h3 className="font-semibold text-foreground mb-2">
                {activeGame === 'terminal_quest' ? 'Terminal Quest' : 'Neon Breakout'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {activeGame === 'terminal_quest'
                  ? 'Type commands to complete programming challenges. Use "help" for hints!'
                  : 'Move paddle to bounce the ball and break all bricks. Don\'t let the ball fall!'}
              </p>
              
              <div className="text-xs text-muted-foreground space-y-1">
                <p>🎮 <strong>Controls:</strong></p>
                {activeGame === 'terminal_quest' ? (
                  <>
                    <p>• Type commands and press Enter</p>
                    <p>• "help" for hints</p>
                    <p>• "skip" to skip (-50 pts)</p>
                  </>
                ) : (
                  <>
                    <p>• Mouse/Touch to move paddle</p>
                    <p>• Break all bricks to win</p>
                    <p>• 3 lives per game</p>
                  </>
                )}
              </div>
            </div>

            {/* Easter Egg Hint */}
            <div className="mt-4 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground text-center">
              <span className="opacity-50">Hint: ↑↑↓↓←→←→BA</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Playground;
