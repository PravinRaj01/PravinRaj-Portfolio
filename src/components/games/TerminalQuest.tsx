import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Terminal, Clock, Trophy, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocalHighScore, useGlobalLeaderboard } from '@/hooks/useGameScores';

interface TerminalLine {
  type: 'system' | 'user' | 'output' | 'error' | 'success';
  content: string;
}

interface Challenge {
  prompt: string;
  command: string;
  hint: string;
  successMessage: string;
  points: number;
}

const CHALLENGES: Challenge[] = [
  { prompt: "List all available skills", command: "ls skills", hint: "Use 'ls' to list items", successMessage: "Skills loaded successfully!", points: 100 },
  { prompt: "Show your current directory", command: "pwd", hint: "Print working directory", successMessage: "/home/developer/portfolio", points: 50 },
  { prompt: "Display the readme file", command: "cat readme", hint: "Use 'cat' to display files", successMessage: "README: Welcome to my portfolio!", points: 75 },
  { prompt: "Check the git status", command: "git status", hint: "Version control command", successMessage: "On branch main. Nothing to commit.", points: 100 },
  { prompt: "Install dependencies", command: "npm install", hint: "Package manager command", successMessage: "Dependencies installed successfully!", points: 150 },
  { prompt: "Run the development server", command: "npm run dev", hint: "Start the dev server", successMessage: "Server running on localhost:5173", points: 125 },
  { prompt: "Create a new component", command: "touch component.tsx", hint: "Use 'touch' to create files", successMessage: "component.tsx created!", points: 100 },
  { prompt: "Check node version", command: "node --version", hint: "Check runtime version", successMessage: "v20.10.0", points: 50 },
  { prompt: "Clear the terminal", command: "clear", hint: "Clean up the screen", successMessage: "", points: 25 },
  { prompt: "Show environment variables", command: "env", hint: "Display environment", successMessage: "NODE_ENV=development", points: 75 },
];

const TerminalQuest: React.FC = () => {
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: 'system', content: '╔════════════════════════════════════════╗' },
    { type: 'system', content: '║     TERMINAL QUEST - Developer Edition ║' },
    { type: 'system', content: '╚════════════════════════════════════════╝' },
    { type: 'output', content: '' },
    { type: 'output', content: 'Welcome, developer! Complete the challenges by typing the correct commands.' },
    { type: 'output', content: 'Type "help" for hints or "skip" to skip a challenge (costs 50 points).' },
    { type: 'output', content: '' },
  ]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentChallenge, setCurrentChallenge] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [showNicknameInput, setShowNicknameInput] = useState(false);
  const [nickname, setNickname] = useState('');
  
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  
  const { highScore, updateHighScore } = useLocalHighScore('terminal_quest');
  const { submitScore } = useGlobalLeaderboard('terminal_quest');

  // Timer
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setGameState('lost');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  // Add challenge prompt when challenge changes
  useEffect(() => {
    if (gameState === 'playing' && currentChallenge < CHALLENGES.length) {
      const challenge = CHALLENGES[currentChallenge];
      setLines(prev => [
        ...prev,
        { type: 'output', content: '' },
        { type: 'system', content: `[Challenge ${currentChallenge + 1}/${CHALLENGES.length}] ${challenge.prompt}` },
      ]);
    }
  }, [currentChallenge, gameState]);

  const addLine = useCallback((type: TerminalLine['type'], content: string) => {
    setLines(prev => [...prev, { type, content }]);
  }, []);

  const handleCommand = useCallback((input: string) => {
    const command = input.trim().toLowerCase();
    const challenge = CHALLENGES[currentChallenge];
    
    addLine('user', `$ ${input}`);

    if (command === 'help') {
      addLine('output', `Hint: ${challenge.hint}`);
      return;
    }

    if (command === 'skip') {
      if (score >= 50) {
        setScore(prev => prev - 50);
        addLine('system', 'Challenge skipped! (-50 points)');
        if (currentChallenge < CHALLENGES.length - 1) {
          setCurrentChallenge(prev => prev + 1);
        } else {
          setGameState('won');
        }
      } else {
        addLine('error', 'Not enough points to skip!');
      }
      return;
    }

    if (command === challenge.command.toLowerCase()) {
      const earnedPoints = challenge.points + Math.floor(timeLeft / 10);
      setScore(prev => prev + earnedPoints);
      addLine('success', challenge.successMessage || 'Command executed successfully!');
      addLine('success', `+${earnedPoints} points!`);
      
      if (currentChallenge < CHALLENGES.length - 1) {
        setCurrentChallenge(prev => prev + 1);
      } else {
        setGameState('won');
      }
    } else {
      addLine('error', `Command not recognized. Try again or type "help".`);
    }
  }, [currentChallenge, score, timeLeft, addLine]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInput.trim() || gameState !== 'playing') return;
    
    handleCommand(currentInput);
    setCurrentInput('');
  };

  const handleGameEnd = useCallback(() => {
    const isNewHighScore = updateHighScore(score);
    if (isNewHighScore && score > 0) {
      setShowNicknameInput(true);
    }
  }, [score, updateHighScore]);

  useEffect(() => {
    if (gameState === 'won' || gameState === 'lost') {
      handleGameEnd();
    }
  }, [gameState, handleGameEnd]);

  const handleSubmitScore = async () => {
    if (nickname.trim()) {
      await submitScore(nickname, score);
    }
    setShowNicknameInput(false);
  };

  const resetGame = () => {
    setLines([
      { type: 'system', content: '╔════════════════════════════════════════╗' },
      { type: 'system', content: '║     TERMINAL QUEST - Developer Edition ║' },
      { type: 'system', content: '╚════════════════════════════════════════╝' },
      { type: 'output', content: '' },
      { type: 'output', content: 'Game restarted! Good luck, developer!' },
      { type: 'output', content: '' },
    ]);
    setCurrentChallenge(0);
    setScore(0);
    setTimeLeft(120);
    setGameState('playing');
    setShowNicknameInput(false);
    setNickname('');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50 bg-card/30">
        <div className="flex items-center gap-3">
          <Terminal className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Terminal Quest</h2>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span className="text-foreground font-mono font-bold">{score}</span>
          </div>
          <div className={`flex items-center gap-2 ${timeLeft < 30 ? 'text-destructive animate-pulse' : ''}`}>
            <Clock className="w-5 h-5" />
            <span className="font-mono font-bold">{formatTime(timeLeft)}</span>
          </div>
        </div>
      </div>

      {/* Terminal */}
      <div 
        ref={terminalRef}
        onClick={() => inputRef.current?.focus()}
        className="flex-grow overflow-y-auto p-4 bg-[#0d1117] font-mono text-sm cursor-text"
        style={{ maxHeight: 'calc(100vh - 400px)' }}
      >
        {lines.map((line, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.1 }}
            className={`leading-relaxed ${
              line.type === 'system' ? 'text-purple-400' :
              line.type === 'user' ? 'text-green-400' :
              line.type === 'error' ? 'text-red-400' :
              line.type === 'success' ? 'text-emerald-400' :
              'text-gray-300'
            }`}
          >
            {line.content || '\u00A0'}
          </motion.div>
        ))}
        
        {gameState === 'playing' && (
          <form onSubmit={handleSubmit} className="flex items-center mt-2">
            <span className="text-green-400 mr-2">$</span>
            <input
              ref={inputRef}
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              className="flex-grow bg-transparent text-green-400 outline-none font-mono"
              autoFocus
              spellCheck={false}
            />
          </form>
        )}
      </div>

      {/* Game Over Overlay */}
      {(gameState === 'won' || gameState === 'lost') && !showNicknameInput && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border border-border rounded-xl p-8 text-center max-w-md"
          >
            <h2 className={`text-3xl font-bold mb-4 ${gameState === 'won' ? 'text-emerald-400' : 'text-destructive'}`}>
              {gameState === 'won' ? '🎉 Victory!' : '⏰ Time\'s Up!'}
            </h2>
            <p className="text-muted-foreground mb-6">
              {gameState === 'won' 
                ? 'You completed all challenges!' 
                : 'Better luck next time!'}
            </p>
            <div className="text-4xl font-bold text-foreground mb-6">
              {score.toLocaleString()} pts
            </div>
            {score > highScore && (
              <p className="text-primary font-medium mb-6">🏆 New High Score!</p>
            )}
            <Button onClick={resetGame} className="gap-2">
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
            <p className="text-4xl font-bold text-primary mb-6">{score.toLocaleString()}</p>
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

export default TerminalQuest;
