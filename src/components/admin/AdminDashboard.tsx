
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, FileText, Image, Users, Calendar, Mic, LogOut, Share2, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import Navigation from '@/components/Navigation';
import CursorFollower from '@/components/CursorFollower';
import RadialGradient from '@/components/RadialGradient';
import ProjectManager from './ProjectManager';
import ExperienceManager from './ExperienceManager';
import GoogleDriveConfig from './GoogleDriveConfig';
import ContactManager from './ContactManager';
import AcademicManager from './AcademicManager';
import SiteSettingsManager from './SiteSettingsManager';
import HeroContentManager from './HeroContentManager';
import SkillsManager from './SkillsManager';
import ServicesManager from './ServicesManager';
import StatsManager from './StatsManager';
import AboutContentManager from './AboutContentManager';
import ResumeManager from './ResumeManager';
import ModeSettingsManager from './ModeSettingsManager';
import GithubTickerManager from './GithubTickerManager';
import ChatbotSettingsManager from './ChatbotSettingsManager';
import { useProjects } from '@/hooks/useProjects';
import { useExperience } from '@/hooks/useExperience';
import { useStats } from '@/hooks/useStats';
import { getFileCount } from '@/services/googleDriveService';
import { signOutAdmin } from '@/services/authService';
import { usePortfolio } from '@/contexts/PortfolioContext';

const AdminDashboard = () => {
  const { mode, darkMode, handleModeToggle, professionalModeEnabled, creativeModeEnabled } = usePortfolio();
  const { projects: allProjects } = useProjects(mode); // Filter by mode
  const { experiences: allExperiences } = useExperience(mode); // Filter by mode
  const { data: stats = [] } = useStats(mode); // Filter stats by mode
  const [driveFileCount, setDriveFileCount] = useState<number>(0);

  useEffect(() => {
    const fetchDriveFileCount = async () => {
      const count = await getFileCount();
      setDriveFileCount(count);
    };
    fetchDriveFileCount();
  }, []);

  const handleLogout = async () => {
    try {
      await signOutAdmin();
    } catch (error) {
      console.error('Failed to logout:', error);
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
      
      <div className="pt-20 px-4">
        <div className="container mx-auto py-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between">
              <div>
                <h1 className={`text-4xl font-bold mb-4 bg-gradient-to-r ${
                  mode === 'creative' 
                    ? 'from-orange-500 to-orange-600' 
                    : 'from-blue-600 to-purple-600'
                } bg-clip-text text-transparent`}>
                  Admin Dashboard
                </h1>
                <p className="text-lg text-muted-foreground">
                  Manage your portfolio content with the hybrid CMS
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Editing mode:</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleModeToggle}
                    disabled={!professionalModeEnabled || !creativeModeEnabled}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      mode === 'professional' 
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                        : 'bg-orange-500 text-white hover:bg-orange-600'
                    }`}
                  >
                    {mode === 'professional' ? 'Professional' : 'Creative'}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    (Click to switch mode)
                  </span>
                </div>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </motion.div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Projects</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{allProjects.length}</div>
                <p className="text-xs text-muted-foreground">Active projects</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Experience</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{allExperiences.length}</div>
                <p className="text-xs text-muted-foreground">Work experiences</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Media Files</CardTitle>
                <Image className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{driveFileCount}</div>
                <p className="text-xs text-muted-foreground">Google Drive files</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Stats ({mode})</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.length}</div>
                <p className="text-xs text-muted-foreground">Statistics items</p>
              </CardContent>
            </Card>
          </div>

          {/* Content Management Tabs */}
          <Tabs defaultValue="projects" className="space-y-6">
            <TabsList className="grid w-full grid-cols-8">
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="experience">Experience</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="skills">Skills</TabsTrigger>
              <TabsTrigger value="academic">Academic</TabsTrigger>
              <TabsTrigger value="podcast">Podcast</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="projects">
              <ProjectManager />
            </TabsContent>

            <TabsContent value="experience">
              <ExperienceManager />
            </TabsContent>

            <TabsContent value="content" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Content Management</CardTitle>
                  <CardDescription>Manage all content that appears on your portfolio</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="site-settings" className="space-y-6">
                    <TabsList className="grid grid-cols-9 w-full">
                      <TabsTrigger value="site-settings">Site</TabsTrigger>
                      <TabsTrigger value="mode-settings">Modes</TabsTrigger>
                      <TabsTrigger value="chatbot">Chatbot</TabsTrigger>
                      <TabsTrigger value="resume">Resume</TabsTrigger>
                      <TabsTrigger value="hero-content">Hero</TabsTrigger>
                      <TabsTrigger value="about-content">About</TabsTrigger>
                      <TabsTrigger value="github-ticker">GitHub</TabsTrigger>
                      <TabsTrigger value="services">Services</TabsTrigger>
                      <TabsTrigger value="stats">Stats</TabsTrigger>
                    </TabsList>

                    <TabsContent value="site-settings">
                      <SiteSettingsManager />
                    </TabsContent>

                    <TabsContent value="mode-settings">
                      <ModeSettingsManager />
                    </TabsContent>

                    <TabsContent value="chatbot">
                      <ChatbotSettingsManager />
                    </TabsContent>

                    <TabsContent value="resume">
                      <ResumeManager />
                    </TabsContent>

                    <TabsContent value="hero-content">
                      <HeroContentManager />
                    </TabsContent>

                    <TabsContent value="about-content">
                      <AboutContentManager />
                    </TabsContent>

                    <TabsContent value="github-ticker">
                      <GithubTickerManager />
                    </TabsContent>

                    <TabsContent value="services">
                      <ServicesManager />
                    </TabsContent>

                    <TabsContent value="stats">
                      <StatsManager />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="skills" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Skills Management</CardTitle>
                  <CardDescription>Manage your technical and creative skills</CardDescription>
                </CardHeader>
                <CardContent>
                  <SkillsManager />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="academic" className="space-y-6">
              <AcademicManager />
            </TabsContent>

            <TabsContent value="podcast" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Podcast Episodes</CardTitle>
                  <CardDescription>Manage podcast content and episodes</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Podcast manager coming soon...</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contact" className="space-y-6">
              <ContactManager />
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <GoogleDriveConfig />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
