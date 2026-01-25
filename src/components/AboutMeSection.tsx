import React, { useRef } from "react";
import { Autoplay, Pagination, Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { motion, useScroll, useTransform } from "framer-motion";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useAboutContent } from "@/hooks/useAboutContent";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";

const AboutMeSection: React.FC = () => {
  const { mode } = usePortfolio();
  const { data: aboutContent = [] } = useAboutContent(mode);
  const progressCircle = useRef<SVGSVGElement | null>(null);
  const progressContent = useRef<HTMLSpanElement | null>(null);
  const animationReference = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: animationReference,
    offset: ["0 1", "1.33 1"],
  });
  const scaleProgress = useTransform(scrollYProgress, [0, 1], [0.8, 1]);
  const opacityProgress = useTransform(scrollYProgress, [0, 1], [0.6, 1]);

  const onAutoplayTimeLeft = (_s: any, time: number, progress: number) => {
    if (progressCircle.current && progressContent.current) {
      progressCircle.current.style.setProperty(
        "--progress",
        String(1 - progress)
      );
      progressContent.current.textContent = `${Math.ceil(time / 1000)}s`;
    }
  };

  // Fallback content if no data
  const displayContent = aboutContent.length > 0 
    ? aboutContent 
    : [{ 
        id: 'fallback', 
        content: mode === 'professional' 
          ? "I am a passionate full-stack developer with expertise in modern web technologies. My journey in software development has led me to work on diverse projects ranging from e-commerce platforms to data visualization tools."
          : "I'm a creative professional specializing in graphic design, video editing, and visual storytelling. I bring ideas to life through innovative design solutions and compelling visual narratives.",
        order_index: 0 
      }];

  return (
    <React.Fragment>
      <section className="about-me relative py-16" id="about-me">
        <div className="title-container flex flex-col gap-4 justify-center items-center px-8 md:px-16 lg:px-32 py-8 w-full max-lg:w-full max-lg:items-start">
          <motion.div
            ref={animationReference}
            style={{
              scale: scaleProgress,
              opacity: opacityProgress,
              textAlign: "left",
            }}
          >
            <p className="text-foreground mb-6">
              <span className={`${mode === 'creative' ? 'text-[hsl(var(--creative-orange))]' : 'text-primary'}`}>&lt;</span>
              About Me
              <span className={`${mode === 'creative' ? 'text-[hsl(var(--creative-orange))]' : 'text-primary'}`}>/&gt;</span>
            </p>

            <h2 className="text-foreground text-center max-lg:text-left text-3xl md:text-4xl font-bold">
              {mode === 'professional' 
                ? 'Learn more about my journey and expertise'
                : 'Discover my creative process and vision'}
            </h2>
          </motion.div>
        </div>
        <div className="flex flex-row justify-center gap-6 items-center px-8 md:px-16 lg:px-32 mb-16 max-lg:flex-col max-lg:p-8">
          <Swiper
            spaceBetween={100}
            centeredSlides={true}
            autoplay={{
              delay: 10000,
              disableOnInteraction: false,
            }}
            pagination={{
              clickable: true,
            }}
            modules={[Autoplay, Pagination, Navigation]}
            onAutoplayTimeLeft={onAutoplayTimeLeft}
            className="w-full pt-8 md:pt-16 lg:pt-24 relative z-2 px-4 md:px-12 lg:px-20 pb-8 md:pb-16 lg:pb-24 max-lg:w-full max-lg:pt-8 max-lg:pb-8 max-lg:px-4"
          >
            {displayContent.map((item, index) => (
              <SwiperSlide
                key={item.id}
                className={`${
                  mode === 'creative' 
                    ? 'bg-[hsl(var(--creative-darkblue))] border-[hsl(var(--creative-lightblue))] hover:border-[hsl(var(--creative-orange))]' 
                    : 'bg-secondary border-border hover:border-primary'
                } text-foreground flex flex-col justify-center items-start gap-8 md:gap-12 lg:gap-16 rounded-2xl p-8 md:p-12 lg:p-16 border-solid border-[0.25rem] md:border-[0.3rem] lg:border-[0.4rem] duration-500 transition-all text-left max-lg:p-6 cursor-grab`}
              >
                <div className="flex gap-6 flex-row justify-start items-center max-lg:flex-col max-lg:justify-center max-lg:text-center">
                  <div>
                    <div className={`w-24 h-24 rounded-full ${
                      mode === 'creative' 
                        ? 'bg-[hsl(var(--creative-orange))]' 
                        : 'bg-primary'
                    } flex items-center justify-center text-white text-4xl font-bold`}>
                      {index + 1}
                    </div>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">
                      {mode === 'professional' ? 'Professional Journey' : 'Creative Vision'}
                    </h2>
                  </div>
                </div>
                <div className="flex flex-row gap-10 max-lg:flex-col">
                  <div className="flex flex-col gap-4 items-center justify-between -mt-10 -mb-10 max-lg:flex-row max-lg:m-0">
                    <p className="text-foreground">
                      <span className={`${mode === 'creative' ? 'text-[hsl(var(--creative-orange))]' : 'text-primary'}`}>&lt;</span>h3
                      <span className={`${mode === 'creative' ? 'text-[hsl(var(--creative-orange))]' : 'text-primary'}`}>/&gt;</span>
                    </p>
                    <div className={`flex justify-between items-center w-1 h-[100%] max-lg:flex-row max-lg:w-[10rem] ${
                      mode === 'creative' 
                        ? 'max-lg:bg-[hsl(var(--creative-lightblue))]' 
                        : 'max-lg:bg-primary'
                    }`}>
                      <div></div>
                      <div className={`w-[0.5rem] ${
                        mode === 'creative' 
                          ? 'bg-[hsl(var(--creative-lightblue))]' 
                          : 'bg-primary'
                      } h-[100%] max-lg:w-10 max-lg:h-[0.25rem]`}></div>
                      <div></div>
                    </div>
                    <p className="text-foreground">
                      <span className={`${mode === 'creative' ? 'text-[hsl(var(--creative-orange))]' : 'text-primary'}`}>&lt;</span>h3
                      <span className={`${mode === 'creative' ? 'text-[hsl(var(--creative-orange))]' : 'text-primary'}`}>/&gt;</span>
                    </p>
                  </div>
                  <div>
                    <p 
                      className="text-foreground text-lg md:text-xl lg:text-2xl max-lg:text-base leading-relaxed"
                      style={{ wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none' }}
                    >
                      {item.content}
                    </p>
                  </div>
                </div>
              </SwiperSlide>
            ))}
            <div
              className={`autoplay-progress absolute right-0 bottom-0 z-10 flex items-center justify-center font-bold ${
                mode === 'creative' 
                  ? 'text-[hsl(var(--creative-orange))]' 
                  : 'text-primary'
              } text-4xl w-24 h-24 max-lg:w-16 max-lg:h-16 max-lg:text-3xl`}
              slot="container-end"
            >
              <svg viewBox="0 0 48 48" ref={progressCircle}>
                <circle cx="24" cy="24" r="20"></circle>
              </svg>
              <span ref={progressContent} className="absolute"></span>
            </div>
          </Swiper>
        </div>
      </section>
    </React.Fragment>
  );
};

export default AboutMeSection;

