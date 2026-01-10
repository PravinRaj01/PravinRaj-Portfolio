import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, EffectCards, Pagination } from 'swiper/modules';
import { ExternalLink, Github, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { generateDriveImageUrl } from '@/utils/googleDrive';
import { Project } from '@/types/cms';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import TinderProjectCards from './TinderProjectCards';

// Swiper styles
import 'swiper/css';
import 'swiper/css/effect-cards';
import 'swiper/css/pagination';

interface ProjectSliderProps {
  projects: Project[];
  mode: 'professional' | 'creative';
}

const ProjectSlider = ({ projects, mode }: ProjectSliderProps) => {
  const animationReference = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: animationReference,
    offset: ['1 1', '1.3 1'],
  });
  const scaleProgress = useTransform(scrollYProgress, [0, 1], [0.8, 1]);
  const opacityProgress = useTransform(scrollYProgress, [0, 1], [0.6, 1]);

  if (projects.length === 0) {
    return (
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <p className="text-muted-foreground">No projects available</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative overflow-x-clip py-12"
      id="projects"
    >
      {/* Title - styled like TechStack & Skills */}
      <motion.div
        ref={animationReference}
        style={{
          scale: scaleProgress,
          opacity: opacityProgress,
          textAlign: 'center',
        }}
        className="mb-12"
      >
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 md:mb-4">
          {mode === 'professional' ? 'Recent Projects' : 'Recent Works'}
        </h2>
        <p className="text-sm md:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
          {mode === 'professional' 
            ? 'Some of my recent work and contributions'
            : 'Creative projects and designs I\'ve worked on'
          }
        </p>
      </motion.div>

      {/* Desktop Swiper - Cards Effect */}
      <div className="hidden lg:block">
        <Swiper
          effect="cards"
          grabCursor={true}
          modules={[EffectCards, Autoplay, Pagination]}
          className="w-[70vw] max-w-5xl mx-auto"
          loop={true}
          autoplay={{
            delay: 7000,
            disableOnInteraction: true,
            pauseOnMouseEnter: true,
          }}
          pagination={{
            clickable: true,
          }}
        >
          {projects.map((project) => (
            <SwiperSlide
              key={project.id}
              className={`quote-outer-container flex flex-row justify-between rounded-2xl p-8 lg:p-12 text-left ${
                mode === 'creative' 
                  ? 'bg-gradient-to-br from-[hsl(226,45%,14%)] via-[hsl(20,60%,12%)] to-[hsl(226,45%,10%)] text-white border border-orange-500/30' 
                  : 'bg-gradient-to-br from-[hsl(260,50%,18%)] via-[hsl(240,40%,14%)] to-[hsl(222,60%,10%)] text-white border border-purple-500/30'
              }`}
            >
              {/* Left Content */}
              <div className="w-[55%] flex flex-col gap-6 justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-2xl lg:text-3xl font-bold">{project.title}</h2>
                    {project.featured && (
                      <Badge className={`bg-gradient-to-r ${
                        mode === 'creative' 
                          ? 'from-orange-500 to-orange-600' 
                          : 'from-blue-600 to-purple-600'
                      } text-white`}>
                        Featured
                      </Badge>
                    )}
                  </div>
                  <p 
                    className="text-muted-foreground leading-relaxed mb-4"
                    style={{ wordBreak: 'keep-all', overflowWrap: 'break-word', hyphens: 'none' }}
                  >
                    {project.description}
                  </p>
                  {project.tags && project.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {project.tags.map((tag) => (
                        <Badge 
                          key={tag} 
                          variant="outline" 
                          className={`text-xs ${
                            mode === 'creative'
                              ? 'border-orange-500/50 text-orange-300'
                              : 'border-purple-500/50 text-purple-300'
                          }`}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>


                {/* Action Buttons - like Reference 1 */}
                <div className="flex gap-4">
                {project.live_url && (
                    <Button
                      asChild
                      className={`${
                        mode === 'creative'
                          ? 'bg-orange-500 hover:bg-orange-600 text-white'
                          : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                      }`}
                    >
                      <a href={project.live_url} target="_blank" rel="noopener noreferrer">
                        <Link2 className="w-4 h-4 mr-2" />
                        Live Demo
                      </a>
                    </Button>
                  )}
                  {project.github_url && (
                    <Button
                      variant="outline"
                      asChild
                      className={`border-2 ${
                        mode === 'creative'
                          ? 'border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white'
                          : 'border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white'
                      }`}
                    >
                      <a href={project.github_url} target="_blank" rel="noopener noreferrer">
                        <Github className="w-4 h-4 mr-2" />
                        Github Repository
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {/* Right Content - Image with optional scroll effect */}
              <div className="relative h-[22rem] overflow-hidden rounded-xl w-[40%] shadow-2xl group">
                {project.image_drive_id ? (
                  <img
                    src={project.image_drive_id.startsWith('http') 
                      ? project.image_drive_id 
                      : generateDriveImageUrl(project.image_drive_id, 'large')}
                    alt={`${project.title} mockup`}
                    className={`w-full transition-all duration-[6000ms] ${
                      project.image_scroll_enabled ? 'h-auto transform hover:translate-y-[-50%]' : 'h-full object-cover'
                    }`}
                    style={!project.image_scroll_enabled ? {
                      objectPosition: `${project.crop_landscape?.x ?? 50}% ${project.crop_landscape?.y ?? 50}%`,
                      transform: `scale(${(project.crop_landscape?.zoom ?? 100) / 100})`,
                      transformOrigin: `${project.crop_landscape?.x ?? 50}% ${project.crop_landscape?.y ?? 50}%`
                    } : undefined}
                  />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center ${
                    mode === 'creative'
                      ? 'bg-gradient-to-br from-orange-900/20 to-[hsl(226,45%,8%)]'
                      : 'bg-gradient-to-br from-purple-900/30 to-[hsl(222,60%,8%)]'
                  }`}>
                    <span className="text-muted-foreground">No Image</span>
                  </div>
                )}
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {/* Mobile/Tablet View - Tinder Cards */}
      <div className="lg:hidden px-4">
        <TinderProjectCards projects={projects} mode={mode} />
      </div>

      {/* View All Button */}
      <div className="py-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Button
            size="lg"
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground px-8 py-3 shadow-lg hover:shadow-xl transition-all duration-300"
            asChild
          >
            <Link to="/projects">
              View All {mode === 'professional' ? 'Projects' : 'Works'}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default ProjectSlider;
