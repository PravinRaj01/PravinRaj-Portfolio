
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Download, ExternalLink, Calendar, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Navigation from '@/components/Navigation';
import CursorFollower from '@/components/CursorFollower';
import RadialGradient from '@/components/RadialGradient';
import { usePortfolio } from '@/contexts/PortfolioContext';

const Podcast = () => {
  const { mode, darkMode } = usePortfolio();
  const [playingEpisode, setPlayingEpisode] = useState<string | null>(null);

  const podcastEpisodes = [
    {
      id: '1',
      title: 'The Future of Creative Technology',
      description: 'Exploring how AI and new technologies are shaping the creative industry and what it means for designers and content creators.',
      duration: '45:23',
      publishDate: '2024-01-15',
      category: 'Technology',
      featured: true,
      audioUrl: '#',
      guests: ['Sarah Johnson', 'Mike Chen']
    },
    {
      id: '2', 
      title: 'Building a Creative Brand in 2024',
      description: 'Strategies for building and maintaining a strong creative brand in today\'s digital landscape.',
      duration: '38:17',
      publishDate: '2024-01-08',
      category: 'Branding',
      featured: false,
      audioUrl: '#',
      guests: ['Emma Davis']
    },
    {
      id: '3',
      title: 'Video Content That Converts',
      description: 'Deep dive into creating video content that not only looks great but actually drives results for businesses.',
      duration: '42:56',
      publishDate: '2024-01-01',
      category: 'Video Marketing',
      featured: true,
      audioUrl: '#',
      guests: ['Alex Rodriguez', 'Lisa Thompson']
    },
    {
      id: '4',
      title: 'The Art of Visual Storytelling',
      description: 'How to tell compelling stories through visual media and why it matters more than ever.',
      duration: '36:12',
      publishDate: '2023-12-25',
      category: 'Storytelling',
      featured: false,
      audioUrl: '#',
      guests: ['David Park']
    }
  ];

  const handlePlayPause = (episodeId: string) => {
    if (playingEpisode === episodeId) {
      setPlayingEpisode(null);
    } else {
      setPlayingEpisode(episodeId);
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      <CursorFollower />
      <RadialGradient 
        scale="scale-y-100" 
        opacity={darkMode ? "opacity-30" : "opacity-30"} 
      />
      <Navigation />

      <div className="pt-16 sm:pt-20 px-3 sm:px-4">
        <div className="container mx-auto py-6 sm:py-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-8 sm:mb-16"
          >
            <h1 className={`text-2xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 bg-gradient-to-r ${
              mode === 'creative' 
                ? 'from-orange-500 to-orange-600' 
                : 'from-blue-600 to-purple-600'
            } bg-clip-text text-transparent`}>
              Creative Conversations
            </h1>
            <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6 sm:mb-8 px-2">
              A podcast exploring the intersection of creativity, technology, and business with industry leaders and innovators.
            </p>
            
            <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
              <Button size="sm" className="h-8 sm:h-10 text-xs sm:text-sm" asChild>
                <a href="#" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Spotify
                </a>
              </Button>
              <Button size="sm" variant="outline" className="h-8 sm:h-10 text-xs sm:text-sm" asChild>
                <a href="#" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Apple
                </a>
              </Button>
              <Button size="sm" variant="outline" className="h-8 sm:h-10 text-xs sm:text-sm" asChild>
                <a href="#" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Google
                </a>
              </Button>
            </div>
          </motion.div>

          {/* Podcast Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-6 mb-8 sm:mb-12"
          >
            <Card className="text-center">
              <CardContent className="p-3 sm:p-4 md:pt-6">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-primary mb-1 sm:mb-2">25+</div>
                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">Episodes</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-3 sm:p-4 md:pt-6">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-primary mb-1 sm:mb-2">10K+</div>
                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">Listeners</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-3 sm:p-4 md:pt-6">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-primary mb-1 sm:mb-2">50+</div>
                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">Guests</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Episodes List */}
          <div className="space-y-3 sm:space-y-4 md:space-y-6">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-4 sm:mb-6 md:mb-8">Latest Episodes</h2>
            {podcastEpisodes.map((episode, index) => (
              <motion.div
                key={episode.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader className="p-3 sm:p-4 md:p-6">
                    <div className="flex flex-col gap-2 sm:gap-3">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                          <CardTitle className="text-sm sm:text-base md:text-xl">{episode.title}</CardTitle>
                          {episode.featured && <Badge className="text-[10px] sm:text-xs">Featured</Badge>}
                        </div>
                        <CardDescription className="text-xs sm:text-sm md:text-base mb-2 sm:mb-3 line-clamp-2">
                          {episode.description}
                        </CardDescription>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs md:text-sm text-muted-foreground">
                          <div className="flex items-center">
                            <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                            {new Date(episode.publishDate).toLocaleDateString()}
                          </div>
                          <div className="flex items-center">
                            <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                            {episode.duration}
                          </div>
                          <Badge variant="outline" className="text-[10px] sm:text-xs">{episode.category}</Badge>
                        </div>
                        {episode.guests.length > 0 && (
                          <div className="mt-1.5 sm:mt-2">
                            <span className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">
                              Guests: {episode.guests.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handlePlayPause(episode.id)}
                        className="h-7 sm:h-8 text-xs sm:text-sm"
                      >
                        {playingEpisode === episode.id ? (
                          <Pause className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        ) : (
                          <Play className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        )}
                        {playingEpisode === episode.id ? 'Pause' : 'Play'}
                      </Button>
                      
                      <Button size="sm" variant="outline" className="h-7 sm:h-8 text-xs sm:text-sm hidden sm:flex">
                        <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        Download
                      </Button>
                      
                      <Button size="sm" variant="outline" className="h-7 sm:h-8 text-xs sm:text-sm" asChild>
                        <a href="#" target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                          <span className="hidden sm:inline">Share</span>
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Subscribe Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className={`mt-8 sm:mt-12 md:mt-16 text-center bg-gradient-to-r ${
              mode === 'creative' 
                ? 'from-orange-500/10 to-orange-600/10' 
                : 'from-blue-600/10 to-purple-600/10'
            } rounded-xl p-4 sm:p-6 md:p-8`}
          >
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 sm:mb-4">Never Miss an Episode</h3>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground mb-4 sm:mb-6 max-w-2xl mx-auto">
              Subscribe to get notified when new episodes are available and join our community of creative professionals.
            </p>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
              <Button size="sm" className="h-8 sm:h-10 text-xs sm:text-sm">Subscribe Now</Button>
              <Button size="sm" variant="outline" className="h-8 sm:h-10 text-xs sm:text-sm">Join Newsletter</Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Podcast;
