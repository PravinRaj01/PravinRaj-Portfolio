import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCards, Autoplay, Pagination } from 'swiper/modules';
import { ExternalLink, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Project } from '@/types/cms';
import 'swiper/css';
import 'swiper/css/effect-cards';
import 'swiper/css/pagination';

interface ProjectCarouselProps {
  projects: Project[];
  mode: 'professional' | 'creative';
}

const ProjectCarousel = ({ projects, mode }: ProjectCarouselProps) => {
  const animationRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: animationRef,
    offset: ["0 1", "1.2 1"],
  });
  const scaleProgress = useTransform(scrollYProgress, [0, 1], [0.8, 1]);
  const opacityProgress = useTransform(scrollYProgress, [0, 1], [0.6, 1]);

  if (projects.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">No projects available yet.</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      {/* Content Section - no background card */}
      <div 
        className="flex justify-center items-center py-16 md:py-24"
      >
        <div className="w-full max-w-7xl px-4">
          {/* Title */}
          <motion.div
            ref={animationRef}
            style={{
              scale: scaleProgress,
              opacity: opacityProgress,
            }}
            className="text-center mb-12"
          >
            <p className="text-muted-foreground mb-2">
              <span className="text-primary">&lt;</span>
              Projects
              <span className="text-primary">/&gt;</span>
            </p>
            <h2 className="text-3xl md:text-4xl font-bold">
              {mode === 'professional' ? 'My Projects' : 'My Works'}
            </h2>
          </motion.div>

          {/* Desktop Swiper Carousel */}
          <Swiper
            effect="cards"
            grabCursor={true}
            modules={[EffectCards, Autoplay, Pagination]}
            className="w-full max-w-5xl mx-auto hidden lg:block"
            loop={projects.length > 1}
            autoplay={{
              delay: 5000,
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
                className="bg-card border border-border rounded-2xl p-8 md:p-12 min-h-[450px]"
              >
                <div className="flex flex-row justify-between gap-8">
                  {/* Left Content */}
                  <div className="w-[55%] flex flex-col gap-6 justify-between">
                    <div>
                      <h3 className="text-2xl md:text-3xl font-bold mb-4">{project.title}</h3>
                      <p 
                        className="text-muted-foreground text-base leading-relaxed"
                        style={{ wordBreak: 'keep-all', overflowWrap: 'break-word', hyphens: 'none' }}
                      >
                        {project.description}
                      </p>
                    </div>

                    {/* Technologies */}
                    {project.tags && project.tags.length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold mb-3">Technologies</h4>
                        <div className="flex flex-wrap gap-2">
                          {project.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-4 flex-wrap">
                      {project.live_url && (
                        <Button
                          asChild
                          className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                        >
                          <a href={project.live_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Live Demo
                          </a>
                        </Button>
                      )}
                      {project.github_url && (
                        <Button variant="outline" asChild>
                          <a href={project.github_url} target="_blank" rel="noopener noreferrer">
                            <Github className="w-4 h-4 mr-2" />
                            Github Repository
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Right - Project Image */}
                  {project.image_drive_id ? (
                    <div className="w-[40%] relative h-80 overflow-hidden rounded-xl shadow-2xl group">
                      <img
                        src={project.image_drive_id}
                        alt={project.title}
                        className="w-full h-auto transition-transform duration-[6000ms] group-hover:-translate-y-1/2"
                      />
                    </div>
                  ) : (
                    <div className="w-[40%] h-80 bg-muted rounded-xl flex items-center justify-center">
                      <span className="text-muted-foreground">No Image</span>
                    </div>
                  )}
                </div>
              </SwiperSlide>
            ))}
          </Swiper>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-6">
            {projects.map((project) => (
              <article
                key={project.id}
                className="bg-card border-2 border-border p-6 rounded-xl"
              >
                <h3 className="text-xl font-bold mb-3">{project.title}</h3>
                
                {project.image_drive_id && (
                  <img
                    src={project.image_drive_id}
                    alt={project.title}
                    className="h-48 w-full object-cover object-top rounded-lg mb-4"
                  />
                )}

                <div className="flex gap-3 flex-wrap mb-4">
                  {project.live_url && (
                    <Button size="sm" asChild>
                      <a href={project.live_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Live Demo
                      </a>
                    </Button>
                  )}
                  {project.github_url && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={project.github_url} target="_blank" rel="noopener noreferrer">
                        <Github className="w-4 h-4 mr-1" />
                        Github
                      </a>
                    </Button>
                  )}
                </div>

                <p 
                  className="text-muted-foreground text-sm mb-4"
                  style={{ wordBreak: 'keep-all', overflowWrap: 'break-word', hyphens: 'none' }}
                >
                  {project.description}
                </p>

                {project.tags && project.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {project.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectCarousel;
