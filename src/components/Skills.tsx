import React from 'react';
import { motion } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { useSkills } from '@/hooks/useSkills';
import { useStats } from '@/hooks/useStats';

interface SkillsProps {
  mode: 'professional' | 'creative';
}

const Skills = ({ mode }: SkillsProps) => {
  const { data: skills = [] } = useSkills(mode);
  const { data: stats = [] } = useStats(mode);

  // Fallback skills if no data is available
  const fallbackSkills = mode === 'professional' ? [
    {
      id: 'fallback-1',
      category: "Frontend Development",
      icon: "Code",
      skills: ["React", "TypeScript", "Next.js", "Tailwind CSS", "Three.js"],
      color: "from-blue-500 to-cyan-500"
    },
    {
      id: 'fallback-2',
      category: "Backend Development", 
      icon: "Settings",
      skills: ["Node.js", "Python", "PostgreSQL", "MongoDB", "Supabase"],
      color: "from-green-500 to-emerald-500"
    }
  ] : [
    {
      id: 'fallback-3',
      category: "Graphic Design",
      icon: "Palette",
      skills: ["Adobe Photoshop", "Illustrator", "Figma", "Canva", "Brand Identity"],
      color: "from-pink-500 to-rose-500"
    },
    {
      id: 'fallback-4',
      category: "Video Editing",
      icon: "Star",
      skills: ["Adobe Premiere", "After Effects", "DaVinci Resolve", "Motion Graphics", "Color Grading"],
      color: "from-blue-500 to-indigo-500"
    }
  ];

  const displaySkills = skills.length > 0 ? skills : fallbackSkills;

  // Fallback stats if no data is available
  const fallbackStats = [
    { number: "50+", label: mode === 'professional' ? "Projects Completed" : "Designs Created" },
    { number: "3+", label: "Years Experience" },
    { number: "25+", label: mode === 'professional' ? "Technologies" : "Tools Mastered" },
    { number: "100%", label: "Client Satisfaction" }
  ];

  const displayStats = stats.length > 0 ? stats.map(stat => ({
    number: stat.value,
    label: stat.label
  })) : fallbackStats;

  const getIcon = (iconName: string) => {
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent ? <IconComponent className="w-8 h-8" /> : <LucideIcons.Settings className="w-8 h-8" />;
  };

  return (
    <section className="relative py-8 md:py-12 px-4">
      <div className="container mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 md:mb-4">
            {mode === 'professional' ? 'TechStack & Skills' : 'TechStack & Skills'}
          </h2>
          <p className="text-sm md:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            {mode === 'professional' 
              ? 'My technical expertise and skills'
              : 'Diverse creative skills to bring your vision to life'
            }
          </p>
        </motion.div>

        {/* Combined TechStack & Skills - Card Style Layout */}
        <div className="space-y-8">
          {/* Skills Categories Grid - Card Style */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {displaySkills.map((skillCategory, index) => (
              <motion.div
                key={skillCategory.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
                className="group"
              >
                <div className="bg-transparent border border-border/50 rounded-xl p-4 md:p-6 h-full hover:shadow-xl transition-all duration-300 relative">
                  {/* Icon with gradient background */}
                  <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl bg-gradient-to-r ${skillCategory.color} p-2 md:p-3 mb-3 md:mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <div className="text-white w-full h-full flex items-center justify-center">
                      {getIcon(skillCategory.icon)}
                    </div>
                  </div>

                  {/* Category title */}
                  <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 group-hover:text-primary transition-colors">
                    {skillCategory.category}
                  </h3>

                  {/* Skills list */}
                  <div className="space-y-2">
                    {skillCategory.skills.map((skill, skillIndex) => (
                      <motion.div
                        key={skill}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: (index * 0.1) + (skillIndex * 0.05) }}
                        viewport={{ once: true }}
                        className="flex items-center space-x-2"
                      >
                        <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${skillCategory.color}`} />
                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                          {skill}
                        </span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Hover effect overlay */}
                  <div className={`absolute inset-0 rounded-xl bg-gradient-to-r ${skillCategory.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Stats section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8 mt-16 md:mt-20 mb-8 md:mb-12"
        >
          {displayStats.map((stat, index) => (
            <div key={stat.label} className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className={`text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r ${
                  mode === 'creative' 
                    ? 'from-orange-500 to-orange-600' 
                    : 'from-blue-600 to-purple-600'
                } bg-clip-text text-transparent mb-2`}
              >
                {stat.number}
              </motion.div>
              <p className="text-xs md:text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Skills;
