import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Zap, Trophy, RotateCcw, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocalHighScore, useGlobalLeaderboard } from '@/hooks/useGameScores';

interface Ball {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
}

interface Brick {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  glowColor: string;
  alive: boolean;
  points: number;
}

interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
}

const COLORS = [
  { fill: '#ff6b35', glow: '#ff8c5a' },   // Orange
  { fill: '#00d4ff', glow: '#4de8ff' },   // Cyan
  { fill: '#ff1493', glow: '#ff69b4' },   // Pink
  { fill: '#00ff88', glow: '#66ffaa' },   // Green
  { fill: '#ffd700', glow: '#ffed4a' },   // Gold
];

const NeonBreakout: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'paused' | 'won' | 'lost'>('ready');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [showNicknameInput, setShowNicknameInput] = useState(false);
  const [nickname, setNickname] = useState('');
  
  const ballRef = useRef<Ball>({ x: 400, y: 500, dx: 5, dy: -5, radius: 8 });
  const paddleRef = useRef<Paddle>({ x: 350, y: 550, width: 100, height: 12 });
  const bricksRef = useRef<Brick[]>([]);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  
  const { highScore, updateHighScore } = useLocalHighScore('neon_breakout');
  const { submitScore } = useGlobalLeaderboard('neon_breakout');

  const initBricks = useCallback(() => {
    const bricks: Brick[] = [];
    const rows = 5;
    const cols = 10;
    const brickWidth = 70;
    const brickHeight = 25;
    const padding = 8;
    const offsetTop = 60;
    const offsetLeft = 35;

    for (let row = 0; row < rows; row++) {
      const colorIndex = row % COLORS.length;
      for (let col = 0; col < cols; col++) {
        bricks.push({
          x: offsetLeft + col * (brickWidth + padding),
          y: offsetTop + row * (brickHeight + padding),
          width: brickWidth,
          height: brickHeight,
          color: COLORS[colorIndex].fill,
          glowColor: COLORS[colorIndex].glow,
          alive: true,
          points: (rows - row) * 10,
        });
      }
    }
    bricksRef.current = bricks;
  }, []);

  const resetBall = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    ballRef.current = {
      x: canvas.width / 2,
      y: canvas.height - 80,
      dx: (Math.random() > 0.5 ? 1 : -1) * (4 + level),
      dy: -(4 + level),
      radius: 8,
    };
    paddleRef.current.x = canvas.width / 2 - 50;
  }, [level]);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    livesRef.current = 3;
    setScore(0);
    setLives(3);
    setLevel(1);
    initBricks();
    resetBall();
    setGameState('playing');
  }, [initBricks, resetBall]);

  // Mouse/Touch controls
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMove = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const x = (clientX - rect.left) * scaleX;
      paddleRef.current.x = Math.max(0, Math.min(canvas.width - paddleRef.current.width, x - paddleRef.current.width / 2));
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e.touches[0].clientX);
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || gameState !== 'playing') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gameLoop = () => {
      const ball = ballRef.current;
      const paddle = paddleRef.current;
      const bricks = bricksRef.current;

      // Clear canvas
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid pattern
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.1)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Update ball position
      ball.x += ball.dx;
      ball.y += ball.dy;

      // Wall collisions
      if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvas.width) {
        ball.dx = -ball.dx;
      }
      if (ball.y - ball.radius < 0) {
        ball.dy = -ball.dy;
      }

      // Paddle collision
      if (
        ball.y + ball.radius > paddle.y &&
        ball.y - ball.radius < paddle.y + paddle.height &&
        ball.x > paddle.x &&
        ball.x < paddle.x + paddle.width
      ) {
        ball.dy = -Math.abs(ball.dy);
        // Add angle based on where ball hits paddle
        const hitPos = (ball.x - paddle.x) / paddle.width;
        ball.dx = (hitPos - 0.5) * 12;
      }

      // Ball out of bounds
      if (ball.y > canvas.height) {
        livesRef.current--;
        setLives(livesRef.current);
        
        if (livesRef.current <= 0) {
          setGameState('lost');
          return;
        }
        resetBall();
      }

      // Brick collisions
      let allDestroyed = true;
      for (const brick of bricks) {
        if (!brick.alive) continue;
        allDestroyed = false;

        if (
          ball.x + ball.radius > brick.x &&
          ball.x - ball.radius < brick.x + brick.width &&
          ball.y + ball.radius > brick.y &&
          ball.y - ball.radius < brick.y + brick.height
        ) {
          brick.alive = false;
          ball.dy = -ball.dy;
          scoreRef.current += brick.points;
          setScore(scoreRef.current);
        }
      }

      if (allDestroyed) {
        setGameState('won');
        return;
      }

      // Draw bricks with neon effect
      for (const brick of bricks) {
        if (!brick.alive) continue;

        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = brick.glowColor;
        ctx.fillStyle = brick.color;
        ctx.beginPath();
        ctx.roundRect(brick.x, brick.y, brick.width, brick.height, 4);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Inner highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(brick.x + 2, brick.y + 2, brick.width - 4, 3);
      }

      // Draw paddle with neon effect
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00d4ff';
      const paddleGradient = ctx.createLinearGradient(paddle.x, 0, paddle.x + paddle.width, 0);
      paddleGradient.addColorStop(0, '#00d4ff');
      paddleGradient.addColorStop(0.5, '#00ff88');
      paddleGradient.addColorStop(1, '#00d4ff');
      ctx.fillStyle = paddleGradient;
      ctx.beginPath();
      ctx.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 6);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw ball with neon effect
      ctx.shadowBlur = 25;
      ctx.shadowColor = '#ff6b35';
      const ballGradient = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, ball.radius);
      ballGradient.addColorStop(0, '#ffffff');
      ballGradient.addColorStop(0.5, '#ff8c5a');
      ballGradient.addColorStop(1, '#ff6b35');
      ctx.fillStyle = ballGradient;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState, resetBall]);

  // Handle game end
  useEffect(() => {
    if (gameState === 'won' || gameState === 'lost') {
      const isNewHighScore = updateHighScore(scoreRef.current);
      if (isNewHighScore && scoreRef.current > 0) {
        setShowNicknameInput(true);
      }
    }
  }, [gameState, updateHighScore]);

  const handleSubmitScore = async () => {
    if (nickname.trim()) {
      await submitScore(nickname, scoreRef.current);
    }
    setShowNicknameInput(false);
  };

  const togglePause = () => {
    setGameState(prev => prev === 'playing' ? 'paused' : 'playing');
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50 bg-card/30">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-creative-orange" />
          <h2 className="text-xl font-bold text-foreground">Neon Breakout</h2>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span className="text-foreground font-mono font-bold">{score}</span>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${i < lives ? 'bg-red-500' : 'bg-muted'}`}
              />
            ))}
          </div>
          {gameState === 'playing' && (
            <Button variant="ghost" size="sm" onClick={togglePause}>
              <Pause className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Canvas Container */}
      <div className="flex-grow flex items-center justify-center p-4 bg-[#0a0a0f]">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="border border-primary/30 rounded-lg max-w-full"
          style={{ touchAction: 'none' }}
        />
      </div>

      {/* Ready Screen */}
      {gameState === 'ready' && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <Zap className="w-16 h-16 text-creative-orange mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-foreground mb-4">Neon Breakout</h2>
            <p className="text-muted-foreground mb-6">Move your mouse or finger to control the paddle</p>
            <Button onClick={startGame} size="lg" className="gap-2 bg-gradient-to-r from-creative-orange to-creative-orange-light">
              <Play className="w-5 h-5" />
              Start Game
            </Button>
          </motion.div>
        </div>
      )}

      {/* Paused Screen */}
      {gameState === 'paused' && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <h2 className="text-3xl font-bold text-foreground mb-6">Paused</h2>
            <Button onClick={togglePause} size="lg" className="gap-2">
              <Play className="w-5 h-5" />
              Resume
            </Button>
          </motion.div>
        </div>
      )}

      {/* Game Over Screen */}
      {(gameState === 'won' || gameState === 'lost') && !showNicknameInput && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border border-border rounded-xl p-8 text-center max-w-md"
          >
            <h2 className={`text-3xl font-bold mb-4 ${gameState === 'won' ? 'text-emerald-400' : 'text-destructive'}`}>
              {gameState === 'won' ? '🎉 Victory!' : '💔 Game Over!'}
            </h2>
            <p className="text-muted-foreground mb-6">
              {gameState === 'won' 
                ? 'All bricks destroyed!' 
                : 'Better luck next time!'}
            </p>
            <div className="text-4xl font-bold text-foreground mb-6">
              {score.toLocaleString()} pts
            </div>
            {score > highScore && (
              <p className="text-primary font-medium mb-6">🏆 New High Score!</p>
            )}
            <Button onClick={startGame} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Play Again
            </Button>
          </motion.div>
        </div>
      )}

      {/* Nickname Input Modal */}
      {showNicknameInput && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border border-border rounded-xl p-8 text-center max-w-md"
          >
            <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">New High Score!</h2>
            <p className="text-4xl font-bold text-creative-orange mb-6">{score.toLocaleString()}</p>
            <p className="text-muted-foreground mb-4">Enter your name for the leaderboard:</p>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 10))}
              placeholder="Your nickname"
              className="mb-4 text-center"
              maxLength={10}
              autoFocus
            />
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setShowNicknameInput(false)}>
                Skip
              </Button>
              <Button onClick={handleSubmitScore}>
                Submit Score
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default NeonBreakout;
