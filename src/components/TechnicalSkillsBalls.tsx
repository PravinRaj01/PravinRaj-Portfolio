
import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useTechnicalSkills } from '@/hooks/useTechnicalSkills';

interface SkillBallProps {
  skill: {
    id: string;
    name: string;
    color: string;
    position_x: number;
    position_y: number;
    position_z: number;
    icon_url?: string;
  };
  index: number;
}

const PolygonSkillBall: React.FC<SkillBallProps> = ({ skill, index }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const { gl } = useThree();
  
  // Load texture for skill icon - convert SVG to raster for Three.js compatibility
  useEffect(() => {
    if (skill.icon_url) {
      // Convert SVG to canvas for Three.js texture compatibility
      const loadSVGAsTexture = async (url: string) => {
        try {
          // Create an image element
          const img = new Image();
          img.crossOrigin = "anonymous";
          
          return new Promise<THREE.Texture>((resolve, reject) => {
            img.onload = () => {
              // Create canvas to convert SVG to raster
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
              }
              
              // Set canvas size
              canvas.width = 512;
              canvas.height = 512;
              
              // Clear canvas with transparent background
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              
              // Draw the image centered with padding
              const padding = 64;
              const size = canvas.width - (padding * 2);
              ctx.drawImage(img, padding, padding, size, size);
              
              // Create Three.js texture from canvas
              const texture = new THREE.CanvasTexture(canvas);
              texture.needsUpdate = true;
              texture.flipY = false;
              
              console.log('Texture loaded successfully for', skill.name);
              resolve(texture);
            };
            
            img.onerror = () => {
              console.error('Failed to load image for', skill.name);
              reject(new Error('Image load failed'));
            };
            
            img.src = url;
          });
        } catch (error) {
          console.error('Failed to load texture for', skill.name, error);
          throw error;
        }
      };
      
      loadSVGAsTexture(skill.icon_url)
        .then(setTexture)
        .catch(console.error);
    }
  }, [skill.icon_url, skill.name]);

  // Apply rotation to the mesh only when dragging
  useFrame(() => {
    if (meshRef.current && isDragging) {
      meshRef.current.rotation.x = rotation.x;
      meshRef.current.rotation.y = rotation.y;
    }
  });

  const handlePointerDown = (event: any) => {
    event.stopPropagation();
    setIsDragging(true);
    
    const rect = gl.domElement.getBoundingClientRect();
    setDragStart({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  };

  const handlePointerMove = (event: any) => {
    if (!isDragging) return;
    event.stopPropagation();
    
    const rect = gl.domElement.getBoundingClientRect();
    const currentMouse = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    
    const deltaX = (currentMouse.x - dragStart.x) * 0.01;
    const deltaY = (currentMouse.y - dragStart.y) * 0.01;
    
    setRotation(prev => ({
      x: prev.x - deltaY,
      y: prev.y + deltaX
    }));

    setDragStart(currentMouse);
  };

  const handlePointerUp = (event: any) => {
    event.stopPropagation();
    setIsDragging(false);
  };

  return (
    <mesh
      ref={meshRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Icosahedron geometry for polygon look */}
      <icosahedronGeometry args={[1.5, 1]} />
      <meshStandardMaterial
        color={texture ? "#ffffff" : skill.color}
        metalness={texture ? 0.3 : 0.4}
        roughness={texture ? 0.4 : 0.6}
        flatShading={false}
        map={texture}
        transparent={false}
        emissive={texture ? "#000000" : skill.color}
        emissiveIntensity={texture ? 0 : 0.1}
      />
    </mesh>
  );
};

const IndividualSkillBall: React.FC<{ skill: any }> = ({ skill }) => {
  return (
    <div className="h-28 w-28">
      <Canvas 
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ background: 'transparent', pointerEvents: 'auto', touchAction: 'none' }}
      >
        {/* Ambient light for overall illumination */}
        <ambientLight intensity={0.8} />
        
        {/* Key light from top-right */}
        <directionalLight 
          position={[5, 5, 5]} 
          intensity={2.0}
          castShadow
        />
        
        {/* Fill light from bottom-left */}
        <directionalLight 
          position={[-3, -3, 2]} 
          intensity={1.2}
          color="#ffffff"
        />
        
        {/* Point light for glow effect */}
        <pointLight 
          position={[0, 0, 3]} 
          intensity={1.5}
          color="#ffffff"
        />
        
        <PolygonSkillBall 
          skill={skill} 
          index={0}
        />
      </Canvas>
    </div>
  );
};

const TechnicalSkillsBalls = () => {
  const { skills, loading } = useTechnicalSkills();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <section className="px-6 py-10 relative z-0 mx-auto max-w-7xl">
      <div className="flex flex-row flex-wrap justify-center gap-10">
        {skills.slice(0, 12).map((skill) => (
          <IndividualSkillBall 
            key={skill.id} 
            skill={skill}
          />
        ))}
      </div>
      
      {/* Simple instruction */}
      <div className="mt-8 text-xs text-muted-foreground text-center">
        <p>Drag balls to rotate them</p>
      </div>
    </section>
  );
};

export default TechnicalSkillsBalls;
