import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import { Points as ThreePoints } from 'three';
import { usePortfolio } from '@/contexts/PortfolioContext';

// Professional mode: Subtle rotating particle field
const ProfessionalParticles = () => {
  const ref = useRef<ThreePoints>(null);

  const particlesPosition = useMemo(() => {
    const positions = new Float32Array(2000 * 3);
    for (let i = 0; i < 2000; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 10;
      positions[i3 + 1] = (Math.random() - 0.5) * 10;
      positions[i3 + 2] = (Math.random() - 0.5) * 10;
    }
    return positions;
  }, []);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.1;
      ref.current.rotation.y = state.clock.elapsedTime * 0.05;
    }
  });

  return (
    <Points ref={ref} positions={particlesPosition} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#8b5cf6"
        size={0.005}
        sizeAttenuation={true}
        depthWrite={false}
      />
    </Points>
  );
};

// Professional mode: Floating wireframe shapes
const FloatingGeometry = ({ position }: { position: [number, number, number] }) => {
  const meshRef = useRef<any>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime + position[0]) * 0.1;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.1;
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5 + position[0]) * 0.1;
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <icosahedronGeometry args={[0.1, 0]} />
      <meshStandardMaterial color="#3b82f6" wireframe transparent opacity={0.6} />
    </mesh>
  );
};

// Creative mode: Flowing wave particles
const CreativeWaveParticles = () => {
  const ref = useRef<ThreePoints>(null);
  const count = 3000;

  const particlesPosition = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 12;
      positions[i3 + 1] = (Math.random() - 0.5) * 8;
      positions[i3 + 2] = (Math.random() - 0.5) * 6;
    }
    return positions;
  }, []);

  const originalPositions = useMemo(() => [...particlesPosition], [particlesPosition]);

  useFrame((state) => {
    if (ref.current) {
      const positions = ref.current.geometry.attributes.position.array as Float32Array;
      const time = state.clock.elapsedTime;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const x = originalPositions[i3];
        const y = originalPositions[i3 + 1];
        
        // Create flowing wave effect
        positions[i3 + 1] = y + Math.sin(x * 0.5 + time * 0.8) * 0.3;
        positions[i3] = x + Math.sin(y * 0.3 + time * 0.5) * 0.1;
      }

      ref.current.geometry.attributes.position.needsUpdate = true;
      ref.current.rotation.z = Math.sin(time * 0.1) * 0.05;
    }
  });

  return (
    <Points ref={ref} positions={particlesPosition} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#ff6a3d"
        size={0.008}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.8}
      />
    </Points>
  );
};

// Creative mode: Orbiting accent particles
const OrbitingParticles = () => {
  const ref = useRef<ThreePoints>(null);
  const count = 500;

  const particlesPosition = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 2 + Math.random() * 2;
      const i3 = i * 3;
      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = (Math.random() - 0.5) * 4;
      positions[i3 + 2] = Math.sin(angle) * radius;
    }
    return positions;
  }, []);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.2;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.2;
    }
  });

  return (
    <Points ref={ref} positions={particlesPosition} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#9daaf2"
        size={0.012}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.6}
      />
    </Points>
  );
};

// Creative mode: Floating creative shapes (more organic)
const CreativeShape = ({ position, color }: { position: [number, number, number]; color: string }) => {
  const meshRef = useRef<any>(null);

  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.elapsedTime;
      meshRef.current.rotation.x = Math.sin(t * 0.5 + position[0]) * 0.3;
      meshRef.current.rotation.y = t * 0.15;
      meshRef.current.rotation.z = Math.cos(t * 0.3 + position[1]) * 0.2;
      meshRef.current.position.y = position[1] + Math.sin(t * 0.4 + position[0]) * 0.2;
      meshRef.current.position.x = position[0] + Math.cos(t * 0.3 + position[1]) * 0.1;
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <torusKnotGeometry args={[0.15, 0.05, 64, 8]} />
      <meshStandardMaterial color={color} wireframe transparent opacity={0.4} />
    </mesh>
  );
};

const ThreeBackground = () => {
  const { mode } = usePortfolio();
  const isCreative = mode === 'creative';

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none">
      <Canvas camera={{ position: [0, 0, 1] }} style={{ pointerEvents: 'none' }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={isCreative ? 0.8 : 1} />
        
        {isCreative ? (
          <>
            <CreativeWaveParticles />
            <OrbitingParticles />
            <CreativeShape position={[-2.5, 1, -1.5]} color="#ff6a3d" />
            <CreativeShape position={[2.5, -0.5, -1]} color="#9daaf2" />
            <CreativeShape position={[0, 1.5, -2]} color="#ff6a3d" />
          </>
        ) : (
          <>
            <ProfessionalParticles />
            <FloatingGeometry position={[-2, 1, -1]} />
            <FloatingGeometry position={[2, -1, -1]} />
            <FloatingGeometry position={[0, 2, -2]} />
            <FloatingGeometry position={[-3, -2, -1]} />
            <FloatingGeometry position={[3, 1, -2]} />
          </>
        )}
      </Canvas>
    </div>
  );
};

export default ThreeBackground;
