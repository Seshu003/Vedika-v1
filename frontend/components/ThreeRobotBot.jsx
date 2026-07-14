'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Float } from '@react-three/drei';
import * as THREE from 'three';

// Fallback loader to show while the GLB model is loading
function RobotLoader() {
  return (
    <mesh>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshStandardMaterial color="#38BDF8" wireframe emissive="#38BDF8" emissiveIntensity={0.5} />
    </mesh>
  );
}

// Inner robot rendering component that has access to Fiber hooks like useFrame
function RobotModel({ action, isError, isThinking }) {
  const { scene } = useGLTF('/models/robot.glb');
  
  // Find the single mesh in the GLB
  const robotMesh = useMemo(() => {
    let mesh = null;
    scene.traverse((child) => {
      if (child.isMesh && !mesh) {
        mesh = child;
      }
    });
    return mesh;
  }, [scene]);

  const originalGeometry = robotMesh?.geometry;
  const robotMaterial = robotMesh?.material;

  // Dynamically partition the 250k-vertex single geometry into independent parts once at load time
  const geometries = useMemo(() => {
    if (!originalGeometry) return null;
    
    const indexAttr = originalGeometry.index;
    const positionAttr = originalGeometry.attributes.position;
    if (!indexAttr || !positionAttr) return null;
    
    const indices = indexAttr.array;
    
    // Arrays to hold indices for each segmented part
    const head = [];
    const leftArm = [];
    const rightArm = [];
    const leftLeg = [];
    const rightLeg = [];
    const torso = [];
    const leftEye = [];
    const rightEye = [];
    const mouth = [];
    
    for (let i = 0; i < indices.length; i += 3) {
      const iA = indices[i];
      const iB = indices[i + 1];
      const iC = indices[i + 2];
      
      // Get vertex positions
      const ax = positionAttr.getX(iA);
      const ay = positionAttr.getY(iA);
      const az = positionAttr.getZ(iA);
      
      const bx = positionAttr.getX(iB);
      const by = positionAttr.getY(iB);
      const bz = positionAttr.getZ(iB);
      
      const cx = positionAttr.getX(iC);
      const cy = positionAttr.getY(iC);
      const cz = positionAttr.getZ(iC);
      
      // Calculate triangle centroid
      const xc = (ax + bx + cx) / 3.0;
      const yc = (ay + by + cy) / 3.0;
      const zc = (az + bz + cz) / 3.0;
      
      // Classify triangles using verified coordinate thresholds
      if (yc > 0.4) {
        if (zc > 0.25) {
          if (yc > 0.5) {
            if (xc < 0) {
              leftEye.push(iA, iB, iC);
            } else {
              rightEye.push(iA, iB, iC);
            }
          } else if (yc > 0.35 && xc > -0.12 && xc < 0.12) {
            mouth.push(iA, iB, iC);
          } else {
            head.push(iA, iB, iC);
          }
        } else {
          head.push(iA, iB, iC);
        }
      } else if (yc < -0.35) {
        if (xc < 0) {
          leftLeg.push(iA, iB, iC);
        } else {
          rightLeg.push(iA, iB, iC);
        }
      } else {
        if (xc < -0.22) {
          leftArm.push(iA, iB, iC);
        } else if (xc > 0.22) {
          rightArm.push(iA, iB, iC);
        } else {
          torso.push(iA, iB, iC);
        }
      }
    }
    
    // Helper to create partitioned BufferGeometry sharing vertex attributes
    const createPartGeometry = (idxArray) => {
      if (idxArray.length === 0) return null;
      const geom = originalGeometry.clone();
      geom.setIndex(new THREE.BufferAttribute(new Uint32Array(idxArray), 1));
      return geom;
    };
    
    return {
      head: createPartGeometry(head),
      leftArm: createPartGeometry(leftArm),
      rightArm: createPartGeometry(rightArm),
      leftLeg: createPartGeometry(leftLeg),
      rightLeg: createPartGeometry(rightLeg),
      torso: createPartGeometry(torso),
      leftEye: createPartGeometry(leftEye),
      rightEye: createPartGeometry(rightEye),
      mouth: createPartGeometry(mouth),
    };
  }, [originalGeometry]);

  // Glow materials for eyes and mouth
  const eyeMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: isError ? 0xff3366 : 0x00f0ff,
      emissive: isError ? 0xff3366 : 0x00f0ff,
      emissiveIntensity: 2.2,
      roughness: 0.1,
      metalness: 0.9,
    });
  }, [isError]);

  const mouthMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 1.8,
      roughness: 0.1,
      metalness: 0.9,
    });
  }, []);

  // Component refs for independent joint rotation controls
  const torsoRef = useRef();
  const headRef = useRef();
  const leftArmRef = useRef();
  const rightArmRef = useRef();
  const leftLegRef = useRef();
  const rightLegRef = useRef();
  const leftEyeRef = useRef();
  const rightEyeRef = useRef();
  const mouthRef = useRef();

  // Floating props visibility states
  const showLaptop = action === 'typing';
  const showBook = action === 'reading';
  const showClipboard = action === 'writing';
  const showTrophy = action === 'celebrating';
  const showMagnifier = action === 'searching';

  // Animation frame loop
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    
    // 1. Reset rotations/positions as a baseline
    torsoRef.current.position.set(0, 0, 0);
    torsoRef.current.rotation.set(0, 0, 0);
    torsoRef.current.scale.set(1, 1, 1);
    
    headRef.current.rotation.set(0, 0, 0);
    leftArmRef.current.rotation.set(0, 0, 0);
    rightArmRef.current.rotation.set(0, 0, 0);
    leftLegRef.current.rotation.set(0, 0, 0);
    rightLegRef.current.rotation.set(0, 0, 0);
    
    leftEyeRef.current.scale.set(1, 1, 1);
    rightEyeRef.current.scale.set(1, 1, 1);
    mouthRef.current.scale.set(1, 1, 1);

    // 2. Cursor tracking for head (look at mouse)
    const targetLookX = state.pointer.x * 0.45;
    const targetLookY = state.pointer.y * 0.35;
    headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, targetLookX, 0.1);
    headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, -targetLookY, 0.1);
    
    // 3. Periodic Blink cycle (every 4 seconds)
    const isBlinking = Math.floor(t) % 4 === 0 && (t % 4 < 0.16);
    if (isBlinking) {
      leftEyeRef.current.scale.y = 0.05;
      rightEyeRef.current.scale.y = 0.05;
    }

    // 4. Map actions to specific part animations
    if (isThinking || action === 'thinking') {
      // Bob head left/right, raise left arm to chin
      headRef.current.rotation.y += Math.sin(t * 1.5) * 0.15;
      headRef.current.rotation.z = 0.15;
      leftArmRef.current.rotation.x = -1.2;
      leftArmRef.current.rotation.z = -0.5;
      leftArmRef.current.rotation.y = Math.sin(t * 3) * 0.1;
    } else if (action === 'typing') {
      // Rapid torso vibration, look down, arms reaching forward typing
      torsoRef.current.position.y = Math.sin(t * 22) * 0.015;
      headRef.current.rotation.x += 0.2;
      leftArmRef.current.rotation.x = -1.0;
      leftArmRef.current.rotation.y = Math.sin(t * 18) * 0.15;
      rightArmRef.current.rotation.x = -1.0;
      rightArmRef.current.rotation.y = Math.cos(t * 18) * 0.15;
    } else if (action === 'wave') {
      // Raise right arm and wave back/forth
      rightArmRef.current.rotation.z = 1.1;
      rightArmRef.current.rotation.x = -0.2 + Math.sin(t * 10) * 0.35;
    } else if (action === 'dance') {
      // Hop torso, tilt head, swing arms and legs out of sync
      torsoRef.current.position.y = Math.abs(Math.sin(t * 5)) * 0.18;
      torsoRef.current.rotation.y = Math.sin(t * 5) * 0.2;
      headRef.current.rotation.z = Math.sin(t * 5) * 0.15;
      leftArmRef.current.rotation.x = Math.sin(t * 6) * 0.6;
      rightArmRef.current.rotation.x = -Math.sin(t * 6) * 0.6;
      leftLegRef.current.rotation.z = Math.max(0, Math.sin(t * 5)) * 0.15;
      rightLegRef.current.rotation.z = -Math.max(0, -Math.sin(t * 5)) * 0.15;
    } else if (action === 'celebrating') {
      // Hop torso, raise both arms up in victory
      torsoRef.current.position.y = Math.abs(Math.sin(t * 6)) * 0.25;
      leftArmRef.current.rotation.z = -2.1;
      rightArmRef.current.rotation.z = 2.1;
      leftArmRef.current.rotation.x = Math.sin(t * 12) * 0.2;
      rightArmRef.current.rotation.x = Math.cos(t * 12) * 0.2;
    } else if (action === 'reading') {
      // Look down, scan left/right, bring both arms in front to hold book
      headRef.current.rotation.x += 0.3;
      headRef.current.rotation.y = Math.sin(t * 1.4) * 0.15; // reading scanning
      leftArmRef.current.rotation.x = -0.8;
      leftArmRef.current.rotation.y = 0.3;
      rightArmRef.current.rotation.x = -0.8;
      rightArmRef.current.rotation.y = -0.3;
    } else if (action === 'writing') {
      // Look down, wiggle right arm to write on board
      headRef.current.rotation.x += 0.3;
      leftArmRef.current.rotation.x = -0.5;
      leftArmRef.current.rotation.y = 0.2;
      rightArmRef.current.rotation.x = -0.8;
      rightArmRef.current.rotation.z = Math.sin(t * 12) * 0.08;
    } else if (action === 'searching') {
      // Scan head side to side slowly, raise right hand with magnifier
      headRef.current.rotation.y = Math.sin(t * 2) * 0.35;
      rightArmRef.current.rotation.x = -0.8;
      rightArmRef.current.rotation.y = Math.sin(t * 2) * 0.2;
    } else if (action === 'jump') {
      // Hop torso high, swing arms up
      const hop = Math.max(0, Math.sin(t * 4)) * 0.4;
      torsoRef.current.position.y = hop;
      leftArmRef.current.rotation.z = -hop * 2;
      rightArmRef.current.rotation.z = hop * 2;
    } else if (action === 'clickSpin') {
      // Spin the entire robot horizontally
      torsoRef.current.rotation.y = t * 12;
      torsoRef.current.position.y = Math.sin(t * 12) * 0.15;
    } else if (action === 'flying') {
      // Tilt body forward, hover up and down, legs bent backward
      torsoRef.current.rotation.x = 0.35;
      torsoRef.current.position.y = Math.sin(t * 2.2) * 0.08;
      leftLegRef.current.rotation.x = 0.45;
      rightLegRef.current.rotation.x = 0.45;
      leftArmRef.current.rotation.x = -0.6;
      rightArmRef.current.rotation.x = -0.6;
    } else {
      // Default Idle: bobbing torso, slight head sway
      torsoRef.current.position.y = Math.sin(t * 1.5) * 0.05;
      headRef.current.rotation.z = Math.sin(t * 0.65) * 0.02;
      leftArmRef.current.rotation.z = Math.sin(t * 1.5) * 0.02;
      rightArmRef.current.rotation.z = -Math.sin(t * 1.5) * 0.02;
    }
  });

  if (!geometries) return <RobotLoader />;

  return (
    <group ref={torsoRef}>
      {/* 1. Torso Segment */}
      {geometries.torso && (
        <mesh geometry={geometries.torso} material={robotMaterial} />
      )}

      {/* 2. Head Group (nested with Eyes and Mouth) */}
      <group ref={headRef} position={[0, 0.4, 0]}>
        {geometries.head && (
          <mesh geometry={geometries.head} position={[0, -0.4, 0]} material={robotMaterial} />
        )}
        
        {/* Left Eye */}
        <group ref={leftEyeRef} position={[-0.15, 0.15, 0.25]}>
          {geometries.leftEye && (
            <mesh geometry={geometries.leftEye} position={[0.15, -0.55, -0.25]} material={eyeMaterial} />
          )}
        </group>
        
        {/* Right Eye */}
        <group ref={rightEyeRef} position={[0.15, 0.15, 0.25]}>
          {geometries.rightEye && (
            <mesh geometry={geometries.rightEye} position={[-0.15, -0.55, -0.25]} material={eyeMaterial} />
          )}
        </group>
        
        {/* Mouth */}
        <group ref={mouthRef} position={[0, 0.05, 0.25]}>
          {geometries.mouth && (
            <mesh geometry={geometries.mouth} position={[0, -0.45, -0.25]} material={mouthMaterial} />
          )}
        </group>
      </group>

      {/* 3. Left Arm Group */}
      <group ref={leftArmRef} position={[-0.28, 0.2, 0]}>
        {geometries.leftArm && (
          <mesh geometry={geometries.leftArm} position={[0.28, -0.2, 0]} material={robotMaterial} />
        )}
      </group>

      {/* 4. Right Arm Group */}
      <group ref={rightArmRef} position={[0.28, 0.2, 0]}>
        {geometries.rightArm && (
          <mesh geometry={geometries.rightArm} position={[-0.28, -0.2, 0]} material={robotMaterial} />
        )}
        
        {/* Magnifying Glass Prop (Search mode) */}
        {showMagnifier && (
          <group position={[0.15, -0.25, 0.2]} rotation={[0.2, 0.2, 0]}>
            {/* handle */}
            <mesh position={[0, -0.15, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 0.15, 8]} />
              <meshStandardMaterial color="#1E293B" metalness={0.6} roughness={0.3} />
            </mesh>
            {/* frame ring */}
            <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.08, 0.012, 8, 24]} />
              <meshStandardMaterial color="#F59E0B" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* lens */}
            <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 0.005, 16]} />
              <meshPhysicalMaterial transparent opacity={0.35} color="#38BDF8" roughness={0.05} transmission={0.9} thickness={0.5} />
            </mesh>
          </group>
        )}
      </group>

      {/* 5. Left Leg Group */}
      <group ref={leftLegRef} position={[-0.16, -0.35, 0]}>
        {geometries.leftLeg && (
          <mesh geometry={geometries.leftLeg} position={[0.16, 0.35, 0]} material={robotMaterial} />
        )}
      </group>

      {/* 6. Right Leg Group */}
      <group ref={rightLegRef} position={[0.16, -0.35, 0]}>
        {geometries.rightLeg && (
          <mesh geometry={geometries.rightLeg} position={[-0.16, 0.35, 0]} material={robotMaterial} />
        )}
      </group>

      {/* 7. Floating 3D Props */}
      {/* Laptop (Typing mode) */}
      {showLaptop && (
        <group position={[0, -0.05, 0.55]} rotation={[0.05, 0, 0]}>
          <Float speed={2.5} rotationIntensity={0.15} floatIntensity={0.2}>
            {/* Base */}
            <mesh position={[0, -0.1, 0]}>
              <boxGeometry args={[0.42, 0.02, 0.28]} />
              <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Screen */}
            <mesh position={[0, 0.01, -0.135]} rotation={[0.48, 0, 0]}>
              <boxGeometry args={[0.42, 0.24, 0.018]} />
              <meshStandardMaterial color="#1E293B" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Glowing Screen display */}
            <mesh position={[0, 0.01, -0.124]} rotation={[0.48, 0, 0]}>
              <planeGeometry args={[0.39, 0.21]} />
              <meshBasicMaterial color="#38BDF8" toneMapped={false} />
            </mesh>
          </Float>
        </group>
      )}

      {/* Open Book (Reading mode) */}
      {showBook && (
        <group position={[0, 0.02, 0.52]} rotation={[0.25, 0, 0]}>
          <Float speed={2.2} rotationIntensity={0.12} floatIntensity={0.25}>
            {/* Left Page */}
            <mesh position={[-0.14, 0, 0]} rotation={[0, 0.28, 0]}>
              <boxGeometry args={[0.24, 0.3, 0.012]} />
              <meshStandardMaterial color="#F8FAFC" roughness={0.7} />
            </mesh>
            {/* Right Page */}
            <mesh position={[0.14, 0, 0]} rotation={[0, -0.28, 0]}>
              <boxGeometry args={[0.24, 0.3, 0.012]} />
              <meshStandardMaterial color="#F8FAFC" roughness={0.7} />
            </mesh>
            {/* Cover Spine */}
            <mesh position={[0, -0.01, -0.01]} rotation={[0, 0, 0]}>
              <boxGeometry args={[0.04, 0.31, 0.018]} />
              <meshStandardMaterial color="#991B1B" metalness={0.3} roughness={0.5} />
            </mesh>
          </Float>
        </group>
      )}

      {/* Clipboard (Writing mode) */}
      {showClipboard && (
        <group position={[0, -0.04, 0.52]} rotation={[0.28, 0, 0]}>
          <Float speed={2.0} rotationIntensity={0.1} floatIntensity={0.2}>
            {/* Board */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.3, 0.4, 0.015]} />
              <meshStandardMaterial color="#D97706" metalness={0.2} roughness={0.8} />
            </mesh>
            {/* Paper */}
            <mesh position={[0, 0.01, 0.01]}>
              <boxGeometry args={[0.26, 0.34, 0.005]} />
              <meshStandardMaterial color="#F8FAFC" roughness={0.8} />
            </mesh>
            {/* Clip */}
            <mesh position={[0, 0.17, 0.015]}>
              <boxGeometry args={[0.12, 0.04, 0.02]} />
              <meshStandardMaterial color="#94A3B8" metalness={0.9} roughness={0.1} />
            </mesh>
          </Float>
        </group>
      )}

      {/* Golden Trophy (Celebrating mode) */}
      {showTrophy && (
        <group position={[0, 0.05, 0.55]}>
          <Float speed={3.0} rotationIntensity={0.25} floatIntensity={0.3}>
            {/* Base */}
            <mesh position={[0, -0.22, 0]}>
              <cylinderGeometry args={[0.1, 0.12, 0.04, 16]} />
              <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.3} />
            </mesh>
            {/* Stem */}
            <mesh position={[0, -0.13, 0]}>
              <cylinderGeometry args={[0.025, 0.025, 0.15, 12]} />
              <meshStandardMaterial color="#EAB308" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Cup Body */}
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.15, 0.08, 0.22, 16]} />
              <meshStandardMaterial color="#EAB308" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Left Handle */}
            <mesh position={[-0.14, 0.05, 0]} rotation={[0, 0, Math.PI / 6]}>
              <torusGeometry args={[0.08, 0.015, 8, 16, Math.PI]} />
              <meshStandardMaterial color="#EAB308" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Right Handle */}
            <mesh position={[0.14, 0.05, 0]} rotation={[0, 0, -Math.PI / 6]}>
              <torusGeometry args={[0.08, 0.015, 8, 16, Math.PI]} />
              <meshStandardMaterial color="#EAB308" metalness={0.9} roughness={0.1} />
            </mesh>
          </Float>
        </group>
      )}
    </group>
  );
}

// Main exported ThreeRobotBot Component
export default function ThreeRobotBot({ 
  action = 'idle', 
  width = 80, 
  height = 80,
  isDragging = false,
  isError = false,
  isThinking = false
}) {
  return (
    <div 
      style={{
        width: width,
        height: height,
        position: 'relative',
        cursor: 'pointer',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible'
      }}
    >
      <Canvas 
        camera={{ position: [0, 0, 2.3], fov: 48 }}
        gl={{ alpha: true, antialias: true }}
        style={{ width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
      >
        <ambientLight intensity={1.1} />
        <directionalLight position={[3, 4, 3]} intensity={1.6} castShadow />
        <pointLight position={[-3, 2, 2]} intensity={0.6} color="#00f0ff" />
        <pointLight position={[0, -2, 1]} intensity={0.4} color="#eab308" />
        
        <Suspense fallback={<RobotLoader />}>
          <RobotModel action={isDragging ? 'flying' : action} isError={isError} isThinking={isThinking} />
        </Suspense>
      </Canvas>
    </div>
  );
}
