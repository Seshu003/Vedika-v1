'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ThreeAstronautBot({ 
  action = 'idle', 
  width = 80, 
  height = 80,
  isDragging = false,
  isError = false,
  isThinking = false
}) {
  const containerRef = useRef(null);
  const [eyePos, setEyePos] = useState({ x: 0, y: 0 });
  const [eyeScaleY, setEyeScaleY] = useState(1);
  const [internalAction, setInternalAction] = useState(action);
  const [particles, setParticles] = useState([]);

  // Sync action prop and environmental states to internal state
  useEffect(() => {
    if (isDragging) {
      setInternalAction('flying');
    } else if (isThinking) {
      setInternalAction('thinking');
    } else {
      setInternalAction(action);
    }
  }, [action, isDragging, isThinking]);

  // Track cursor relative to bot position
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      
      // Calculate angle and distance for smooth eye cursor tracking (max 14px shift)
      const angle = Math.atan2(dy, dx);
      const dist = Math.min(14, Math.sqrt(dx * dx + dy * dy) * 0.05);
      
      setEyePos({
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist
      });
    };

    const handleMouseLeave = () => {
      setEyePos({ x: 0, y: 0 });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, []);

  // Periodic Blink Cycle
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setEyeScaleY(0.05);
      setTimeout(() => setEyeScaleY(1), 150);
    }, 4500);
    return () => clearInterval(blinkInterval);
  }, []);

  // Spawn star particles
  const spawnParticles = (count = 6) => {
    const colors = ['#38BDF8', '#EF4444', '#10B981', '#F59E0B', '#A78BFA'];
    const newParticles = Array.from({ length: count }).map(() => {
      const angle = Math.random() * Math.PI * 2;
      const velocity = Math.random() * 80 + 60;
      return {
        id: Math.random(),
        x: 256,
        y: 350, // Spawn around torso height (SVG space)
        targetX: 256 + Math.cos(angle) * velocity,
        targetY: 350 + Math.sin(angle) * velocity - 90, // float upwards
        scale: Math.random() * 0.5 + 0.4,
        color: colors[Math.floor(Math.random() * colors.length)]
      };
    });
    setParticles(prev => [...prev, ...newParticles]);
  };

  // Sparkles during dance
  useEffect(() => {
    if (internalAction === 'dance') {
      const interval = setInterval(() => {
        spawnParticles(2);
      }, 350);
      return () => clearInterval(interval);
    }
  }, [internalAction]);

  // Click handler
  const handleBotClick = () => {
    spawnParticles(8);
    if (internalAction === 'idle' || internalAction === 'wave') {
      setInternalAction('clickSpin');
      setTimeout(() => {
        setInternalAction(action);
      }, 800);
    }
  };



  // Thinking and Error visor reflections shift
  let eyeX = eyePos.x;
  let eyeY = eyePos.y;

  if (internalAction === 'thinking') {
    eyeX = eyePos.x + Math.sin(Date.now() * 0.005) * 4;
  } else if (internalAction === 'lookLeft') {
    eyeX = -12;
  } else if (internalAction === 'lookRight') {
    eyeX = 12;
  }

  // If there's an error, make eyes look downwards (concerned)
  if (isError) {
    eyeY = eyeY + 6;
  }

  return (
    <div
      ref={containerRef}
      onClick={handleBotClick}
      style={{
        width: width,
        height: height,
        position: 'relative',
        cursor: 'pointer',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      title="Click me to spin and release star sparkles! ✨"
    >
      {/* 2D Sparkles Overlay */}
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ x: p.x * (width / 512) - 12, y: p.y * (height / 512) - 12, scale: 0.1, opacity: 1 }}
            animate={{ x: p.targetX * (width / 512) - 12, y: p.targetY * (height / 512) - 12, scale: p.scale, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              color: p.color,
              zIndex: 10
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4Z" />
            </svg>
          </motion.div>
        ))}
      </AnimatePresence>

      <svg
        width="100%"
        height="100%"
        viewBox="0 0 512 512"
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
          <linearGradient id="helmetGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
          <linearGradient id="visorGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#090d16" />
          </linearGradient>
          <linearGradient id="controlBoxGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
          <linearGradient id="laptopScreenGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <linearGradient id="laptopBaseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
        </defs>

        {/* Drop shadow under feet (neutral semi-transparent black for general page backdrop) */}
        <ellipse cx="256" cy="485" rx="75" ry="8" fill="rgba(15,23,42,0.14)" />

        {/* Master Robot motion group */}
        <motion.g
          variants={botVariants}
          animate={internalAction}
          originX={0.5}
          originY={0.5375}
        >
          {/* Collar / Neck Connector */}
          <path d="M 200,275 C 200,290 312,290 312,275" fill="url(#bodyGrad)" stroke="#000000" strokeWidth="14" strokeLinecap="round" />

          {/* Left Leg group */}
          <motion.g
            variants={leftLegVariants}
            animate={internalAction}
            originX={0.583}
            originY={0.0}
          >
            <path d="M 195,412 L 195,455 C 195,475 175,470 175,485 L 235,485 C 235,465 225,450 225,412 Z" fill="url(#bodyGrad)" stroke="#000000" strokeWidth="14" strokeLinejoin="round" />
            <path d="M 180,473 C 195,473 215,473 230,473" fill="none" stroke="#000000" strokeWidth="9" strokeLinecap="round" />
          </motion.g>

          {/* Right Leg group */}
          <motion.g
            variants={rightLegVariants}
            animate={internalAction}
            originX={0.417}
            originY={0.0}
          >
            <path d="M 317,412 L 317,455 C 317,475 337,470 337,485 L 277,485 C 277,465 287,450 287,412 Z" fill="url(#bodyGrad)" stroke="#000000" strokeWidth="14" strokeLinejoin="round" />
            <path d="M 332,473 C 317,473 297,473 282,473" fill="none" stroke="#000000" strokeWidth="9" strokeLinecap="round" />
          </motion.g>

          {/* Torso/Body block */}
          <path
            d="M 180,300 C 180,270 332,270 332,300 L 338,380 C 338,410 320,430 256,430 C 192,430 174,410 174,380 Z"
            fill="url(#bodyGrad)"
            stroke="#000000"
            strokeWidth="14"
            strokeLinejoin="round"
          />

          {/* Helmet cast shadow on torso */}
          <path
            d="M 180,300 C 220,320 292,320 332,300 C 320,315 292,325 256,325 C 220,325 192,315 180,300 Z"
            fill="rgba(0, 0, 0, 0.12)"
          />

          {/* Waist Belt */}
          <rect x="186" y="385" width="140" height="18" rx="9" fill="url(#bodyGrad)" stroke="#000000" strokeWidth="14" strokeLinejoin="round" />

          {/* Chest Control Box */}
          <rect x="210" y="315" width="92" height="60" rx="12" fill="url(#controlBoxGrad)" stroke="#000000" strokeWidth="14" strokeLinejoin="round" />
          <path d="M 235,315 L 235,340 C 235,350 250,350 250,360 L 250,375" fill="none" stroke="#000000" strokeWidth="8" stroke-linecap="round" />
          <circle cx="270" cy="345" r="9" fill="#0066ff" stroke="#000000" strokeWidth="6" />

          {/* Environmental Reactivity: Tiny Red Warning light blinks when an error occurs */}
          {isError && (
            <motion.circle
              cx="225"
              cy="330"
              r="6"
              fill="#ef4444"
              stroke="#000000"
              strokeWidth="4"
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 0.7 }}
            />
          )}

          {/* Left Arm group with distinct Wrist Cuff */}
          <motion.g
            variants={leftArmVariants}
            animate={internalAction}
            originX={0.625}
            originY={0.0}
          >
            <path d="M 178,292 C 155,315 155,365 170,385 C 180,395 195,385 195,372 C 195,350 190,320 182,295" fill="url(#bodyGrad)" stroke="#000000" strokeWidth="14" strokeLinejoin="round" stroke-linecap="round" />
            <path d="M 170,370 C 162,370 160,360 168,355" fill="none" stroke="#000000" strokeWidth="10" stroke-linecap="round" />
            {/* Wrist Cuff dividing line */}
            <path d="M 160,358 C 170,363 182,363 190,356" fill="none" stroke="#000000" strokeWidth="10" stroke-linecap="round" />
          </motion.g>

          {/* Right Arm group with distinct Wrist Cuff */}
          <motion.g
            variants={rightArmVariants}
            animate={internalAction}
            originX={0.375}
            originY={0.0}
          >
            <path d="M 334,292 C 357,315 357,365 342,385 C 332,395 317,385 317,372 C 317,350 322,320 330,295" fill="url(#bodyGrad)" stroke="#000000" strokeWidth="14" strokeLinejoin="round" stroke-linecap="round" />
            <path d="M 342,370 C 350,370 352,360 344,355" fill="none" stroke="#000000" strokeWidth="10" stroke-linecap="round" />
            {/* Wrist Cuff dividing line */}
            <path d="M 352,358 C 342,363 330,363 322,356" fill="none" stroke="#000000" strokeWidth="10" stroke-linecap="round" />

            {/* Pencil for writing */}
            {internalAction === 'writing' && (
              <g transform="translate(332, 365) scale(1.55) translate(-332, -365)">
                <line x1="332" y1="365" x2="276" y2="395" stroke="#000000" strokeWidth="11" strokeLinecap="round" />
                <line x1="332" y1="365" x2="276" y2="395" stroke="#eab308" strokeWidth="7" strokeLinecap="round" />
                <polygon points="276,395 281,388 286,392" fill="#000000" />
              </g>
            )}

            {/* Magnifying Glass for searching */}
            {internalAction === 'searching' && (
              <g transform="translate(332, 365) scale(1.55) translate(-332, -365)">
                <line x1="332" y1="365" x2="310" y2="345" stroke="#000000" strokeWidth="11" strokeLinecap="round" />
                <line x1="332" y1="365" x2="310" y2="345" stroke="#d97706" strokeWidth="7" strokeLinecap="round" />
                <circle cx="300" cy="335" r="20" fill="rgba(56, 189, 248, 0.25)" stroke="#000000" strokeWidth="8" />
                <path d="M 290,325 A 14,14 0 0,1 310,325" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
              </g>
            )}
          </motion.g>

          {/* Head & Helmet Group with 2.5D Parallax Shift and Head Tilt */}
          <motion.g
            animate={{ x: eyeX * 0.4, y: eyeY * 0.4, rotate: eyePos.x * 0.8 }}
            transition={{ type: 'spring', damping: 16, stiffness: 140 }}
            originX={0.5}
            originY={0.5}
          >
            {/* Left Ear Receiver */}
            <rect x="115" y="165" width="30" height="70" rx="15" fill="url(#bodyGrad)" stroke="#000000" strokeWidth="14" strokeLinejoin="round" />
            <rect x="125" y="180" width="12" height="40" rx="6" fill="#cbd5e1" />
            
            {/* Right Ear Receiver */}
            <rect x="367" y="165" width="30" height="70" rx="15" fill="url(#bodyGrad)" stroke="#000000" strokeWidth="14" strokeLinejoin="round" />
            <rect x="375" y="180" width="12" height="40" rx="6" fill="#cbd5e1" />

            {/* Helmet base */}
            <circle cx="256" cy="195" r="110" fill="url(#helmetGrad)" stroke="#000000" strokeWidth="14" />

            {/* Helmet Visor (black faceplate) */}
            <circle cx="256" cy="195" r="92" fill="url(#visorGrad)" stroke="#000000" strokeWidth="14" />

            {/* Visor Left Crescent Reflection */}
            <path d="M 185,195 A 71,71 0 0,1 230,130 A 92,92 0 0,0 164,195 Z" fill="#ffffff" opacity="0.12" />

            {/* Glowing Digital Eyes (inside helmet, reacts to cursor with higher sensitivity) - Tiny White Oval Eyes */}
            <motion.g
              animate={{ x: eyeX * 1.25, y: eyeY * 1.25, scaleY: eyeScaleY }}
              transition={{ type: 'spring', damping: 14, stiffness: 160 }}
              style={{ originX: '256px', originY: '195px' }}
            >
              {/* Left digital eye (white normal, red error) - tiny vertical oval */}
              <ellipse 
                cx="225" 
                cy="195" 
                rx="4.5" 
                ry="9.5" 
                fill={isError ? '#ff3366' : '#ffffff'} 
              />
              {/* Right digital eye (white normal, red error) - tiny vertical oval */}
              <ellipse 
                cx="287" 
                cy="195" 
                rx="4.5" 
                ry="9.5" 
                fill={isError ? '#ff3366' : '#ffffff'} 
              />
            </motion.g>

            {/* Visor reflections (white glossy reflections shift with intermediate sensitivity, overlaying eyes) */}
            <motion.g
              animate={{ x: eyeX * 0.7, y: eyeY * 0.7, scaleY: eyeScaleY }}
              transition={{ type: 'spring', damping: 15, stiffness: 180 }}
              style={{ originX: '308px', originY: '195px' }}
            >
              {/* Glossy round reflection on the right side matching reference */}
              <circle cx="310" cy="170" r="14" fill="#ffffff" opacity="0.8" />
              {/* Smaller round reflection below it */}
              <circle cx="292" cy="208" r="8" fill="#ffffff" opacity="0.8" />
            </motion.g>
          </motion.g>

          {/* Glowing Laptop overlay inside the Master Robot group */}
          <AnimatePresence>
            {internalAction === 'typing' && (
              <motion.g
                initial={{ opacity: 0, scale: 0.8, y: 15 }}
                animate={{ opacity: 1, scale: 1.55, y: -25 }}
                exit={{ opacity: 0, scale: 0.8, y: 15 }}
                transition={{ type: 'spring', stiffness: 200, damping: 16 }}
                style={{ originX: '256px', originY: '395px' }}
              >
                {/* Laptop Screen */}
                <polygon points="220,395 292,395 304,345 208,345" fill="url(#laptopScreenGrad)" stroke="#000000" strokeWidth="10" strokeLinejoin="round" />
                <polygon points="224,391 288,391 298,351 214,351" fill="#0b0f19" />
                {/* Code lines */}
                <rect x="222" y="357" width="35" height="3" rx="1.5" fill="#38BDF8" opacity="0.8" />
                <rect x="222" y="364" width="55" height="3" rx="1.5" fill="#34D399" opacity="0.8" />
                <rect x="222" y="371" width="25" height="3" rx="1.5" fill="#FBBF24" opacity="0.8" />
                <rect x="222" y="378" width="45" height="3" rx="1.5" fill="#38BDF8" opacity="0.8" />
                <rect x="235" y="385" width="20" height="3" rx="1.5" fill="#A78BFA" opacity="0.8" />
                
                {/* Screen Reflection */}
                <path d="M 214,351 L 255,351 L 225,391 L 214,391 Z" fill="#ffffff" opacity="0.08" />

                {/* Laptop Base */}
                <polygon points="208,395 304,395 316,415 196,415" fill="url(#laptopBaseGrad)" stroke="#000000" strokeWidth="10" strokeLinejoin="round" />
                <polygon points="214,398 298,398 308,411 204,411" fill="#1e293b" />
                {/* Keyboard Grid */}
                <line x1="220" y1="404" x2="292" y2="404" stroke="rgba(56, 189, 248, 0.4)" strokeWidth="3" strokeLinecap="round" />
                <rect x="246" y="406" width="20" height="4" rx="1" fill="#000000" />
              </motion.g>
            )}
          </AnimatePresence>

          {/* Open Book overlay */}
          <AnimatePresence>
            {internalAction === 'reading' && (
              <motion.g
                initial={{ opacity: 0, scale: 0.8, y: 15 }}
                animate={{ opacity: 1, scale: 1.55, y: -25 }}
                exit={{ opacity: 0, scale: 0.8, y: 15 }}
                transition={{ type: 'spring', stiffness: 200, damping: 16 }}
                style={{ originX: '256px', originY: '395px' }}
              >
                {/* Book cover (dark red) */}
                <path d="M 210,410 C 225,405 245,412 256,415 C 267,412 287,405 302,410 L 302,390 C 287,385 267,392 256,395 C 245,392 225,385 210,390 Z" fill="#991b1b" stroke="#000000" strokeWidth="8" strokeLinejoin="round" />
                {/* Pages */}
                <path d="M 214,406 C 225,401 243,407 254,410 L 254,390 C 243,387 225,381 214,386 Z" fill="#f8fafc" stroke="#000000" strokeWidth="5" strokeLinejoin="round" />
                <path d="M 258,410 C 269,407 287,401 298,406 L 298,386 C 287,381 269,387 258,390 Z" fill="#f8fafc" stroke="#000000" strokeWidth="5" strokeLinejoin="round" />
                {/* Reading lines */}
                <line x1="220" y1="392" x2="246" y2="395" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="220" y1="398" x2="246" y2="401" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="220" y1="404" x2="240" y2="406" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="266" y1="395" x2="292" y2="392" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="266" y1="401" x2="292" y2="398" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="266" y1="406" x2="286" y2="404" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
              </motion.g>
            )}
          </AnimatePresence>

          {/* Writing Clipboard overlay */}
          <AnimatePresence>
            {internalAction === 'writing' && (
              <motion.g
                initial={{ opacity: 0, scale: 0.8, y: 15 }}
                animate={{ opacity: 1, scale: 1.55, y: -25 }}
                exit={{ opacity: 0, scale: 0.8, y: 15 }}
                transition={{ type: 'spring', stiffness: 200, damping: 16 }}
                style={{ originX: '256px', originY: '395px' }}
              >
                {/* Clipboard deck */}
                <rect x="220" y="375" width="72" height="48" rx="4" fill="#d97706" stroke="#000000" strokeWidth="8" strokeLinejoin="round" />
                {/* Paper */}
                <rect x="226" y="381" width="60" height="38" rx="2" fill="#ffffff" stroke="#000000" strokeWidth="4" />
                {/* Metal Clip */}
                <rect x="246" y="370" width="20" height="10" rx="2" fill="#94a3b8" stroke="#000000" strokeWidth="4" />
                {/* Writing lines */}
                <line x1="234" y1="390" x2="278" y2="390" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="234" y1="396" x2="278" y2="396" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="234" y1="402" x2="262" y2="402" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
              </motion.g>
            )}
          </AnimatePresence>

          {/* Golden Trophy overlay */}
          <AnimatePresence>
            {internalAction === 'celebrating' && (
              <motion.g
                initial={{ opacity: 0, scale: 0.8, y: 15 }}
                animate={{ opacity: 1, scale: 1.55, y: -25 }}
                exit={{ opacity: 0, scale: 0.8, y: 15 }}
                transition={{ type: 'spring', stiffness: 200, damping: 16 }}
                style={{ originX: '256px', originY: '395px' }}
              >
                {/* Base */}
                <rect x="238" y="415" width="36" height="10" rx="3" fill="#64748b" stroke="#000000" strokeWidth="7" />
                <polygon points="250,415 262,415 259,400 253,400" fill="#d97706" stroke="#000000" strokeWidth="7" />
                {/* Handles */}
                <path d="M 230,375 C 220,375 220,390 232,390" fill="none" stroke="#eab308" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M 282,375 C 292,375 292,390 280,390" fill="none" stroke="#eab308" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
                {/* Cup */}
                <path d="M 230,370 L 282,370 L 274,400 C 268,410 244,410 238,400 Z" fill="#eab308" stroke="#000000" strokeWidth="8" strokeLinejoin="round" />
                {/* Sparkles */}
                <polygon points="234,360 237,353 234,346 231,353" fill="#ffffff" />
                <polygon points="278,355 281,348 278,341 275,348" fill="#ffffff" />
              </motion.g>
            )}
          </AnimatePresence>
        </motion.g>
      </svg>
    </div>
  );
}

// Framer Motion Variants for each segment (moved outside component to prevent re-creation and animation freeze)
const botVariants = {
  idle: {
    y: [0, -6, 0],
    rotate: [0, -1, 1, 0],
    scaleX: 1,
    transition: {
      y: { repeat: Infinity, duration: 2.2, ease: "easeInOut" },
      rotate: { repeat: Infinity, duration: 4.4, ease: "easeInOut" }
    }
  },
  lookLeft: {
    y: [0, -4, 0],
    rotate: -6,
    scaleX: 1,
    transition: {
      y: { repeat: Infinity, duration: 2.2, ease: "easeInOut" }
    }
  },
  lookRight: {
    y: [0, -4, 0],
    rotate: 6,
    scaleX: 1,
    transition: {
      y: { repeat: Infinity, duration: 2.2, ease: "easeInOut" }
    }
  },
  wave: {
    y: [0, -4, 0],
    rotate: [-3, 3, -3],
    scaleX: 1,
    transition: {
      y: { repeat: Infinity, duration: 1.0, ease: "easeInOut" },
      rotate: { repeat: Infinity, duration: 1.0, ease: "easeInOut" }
    }
  },
  dance: {
    y: [0, -18, 0],
    rotate: [-5, 5, -5],
    scaleX: 1,
    transition: {
      y: { repeat: Infinity, duration: 0.6, ease: "easeInOut" },
      rotate: { repeat: Infinity, duration: 0.6, ease: "easeInOut" }
    }
  },
  thinking: {
    y: [0, -3, 0],
    rotate: [0, 2, -2, 0],
    scaleX: 1,
    transition: {
      y: { repeat: Infinity, duration: 2.5, ease: "easeInOut" },
      rotate: { repeat: Infinity, duration: 3.5, ease: "easeInOut" }
    }
  },
  typing: {
    y: [0, -3, 0],
    rotate: [0, 1.5, -1.5, 0],
    scaleX: 1,
    transition: {
      y: { repeat: Infinity, duration: 0.8, ease: "easeInOut" },
      rotate: { repeat: Infinity, duration: 0.8, ease: "easeInOut" }
    }
  },
  reading: {
    y: [0, -2, 0],
    rotate: 1.5,
    scaleX: 1,
    transition: {
      y: { repeat: Infinity, duration: 2.2, ease: "easeInOut" }
    }
  },
  writing: {
    y: [0, -2, 0],
    rotate: -1.5,
    scaleX: 1,
    transition: {
      y: { repeat: Infinity, duration: 2.0, ease: "easeInOut" }
    }
  },
  searching: {
    y: [0, -4, 0],
    rotate: [-4, 4, -4],
    scaleX: 1,
    transition: {
      y: { repeat: Infinity, duration: 2.2, ease: "easeInOut" },
      rotate: { repeat: Infinity, duration: 2.2, ease: "easeInOut" }
    }
  },
  celebrating: {
    y: [0, -16, 0],
    rotate: [-4, 4, -4],
    scaleY: [1, 0.96, 1.04, 1],
    scaleX: 1,
    transition: {
      y: { repeat: Infinity, duration: 0.6, ease: "easeInOut" },
      rotate: { repeat: Infinity, duration: 0.6, ease: "easeInOut" },
      scaleY: { repeat: Infinity, duration: 0.6, ease: "easeInOut" }
    }
  },
  jump: {
    y: [0, -55, 0],
    rotate: 0,
    scaleX: 1,
    transition: {
      y: { type: 'spring', stiffness: 220, damping: 14 }
    }
  },
  clickSpin: {
    scaleX: [1, -1, 1, -1, 1],
    y: [0, -25, 0],
    transition: {
      scaleX: { duration: 0.8 },
      y: { duration: 0.8, ease: "easeOut" }
    }
  },
  flying: {
    y: [0, -4, 0],
    rotate: -15, // tilt forward
    scaleX: 1,
    transition: {
      y: { repeat: Infinity, duration: 1.0, ease: "easeInOut" }
    }
  }
};

const leftArmVariants = {
  idle: {
    rotate: [0, -6, 0],
    x: 0,
    y: 0,
    transition: { repeat: Infinity, duration: 2.2, ease: "easeInOut" }
  },
  lookLeft: {
    rotate: -15,
    x: 0,
    y: 0
  },
  lookRight: {
    rotate: 5,
    x: 0,
    y: 0
  },
  wave: {
    rotate: [-35, -80, -35, -80, -35],
    x: 0,
    y: 0,
    transition: { duration: 1.5, ease: "easeInOut" }
  },
  dance: {
    rotate: [-55, 20, -55],
    x: 0,
    y: 0,
    transition: { repeat: Infinity, duration: 0.6, ease: "easeInOut" }
  },
  thinking: {
    rotate: 20,
    x: 5,
    y: 0
  },
  typing: {
    rotate: [18, 24, 18],
    x: [10, 14, 10],
    y: [6, 9, 6],
    transition: { repeat: Infinity, duration: 0.16, ease: "linear" }
  },
  reading: {
    rotate: 22,
    x: 12,
    y: 10
  },
  writing: {
    rotate: 22,
    x: 14,
    y: 8
  },
  searching: {
    rotate: -15,
    x: 0,
    y: 0
  },
  celebrating: {
    rotate: [-45, -60, -45],
    x: 0,
    y: 0,
    transition: { repeat: Infinity, duration: 0.8, repeatType: "reverse", ease: "easeInOut" }
  },
  jump: {
    rotate: -40,
    x: 0,
    y: 0
  },
  clickSpin: {
    rotate: [0, -30, 0],
    x: 0,
    y: 0
  },
  flying: {
    rotate: -120, // reach forward
    x: 5,
    y: -10
  }
};

const rightArmVariants = {
  idle: {
    rotate: [0, 6, 0],
    x: 0,
    y: 0,
    transition: { repeat: Infinity, duration: 2.2, ease: "easeInOut" }
  },
  lookLeft: {
    rotate: -5,
    x: 0,
    y: 0
  },
  lookRight: {
    rotate: 15,
    x: 0,
    y: 0
  },
  wave: {
    rotate: [35, 80, 35, 80, 35],
    x: 0,
    y: 0,
    transition: { duration: 1.5, ease: "easeInOut" }
  },
  dance: {
    rotate: [55, -20, 55],
    x: 0,
    y: 0,
    transition: { repeat: Infinity, duration: 0.6, ease: "easeInOut" }
  },
  thinking: {
    rotate: 125,
    x: -12,
    y: -10,
    transition: { type: 'spring', damping: 12 }
  },
  typing: {
    rotate: [-18, -24, -18],
    x: [-10, -14, -10],
    y: [6, 9, 6],
    transition: { repeat: Infinity, duration: 0.16, ease: "linear" }
  },
  reading: {
    rotate: -22,
    x: -12,
    y: 10
  },
  writing: {
    rotate: [-10, -18, -10],
    x: [-15, -20, -15],
    y: [10, 14, 10],
    transition: { repeat: Infinity, duration: 0.18, ease: "linear" }
  },
  searching: {
    rotate: [45, 60, 45],
    x: [-10, -15, -10],
    y: [10, 6, 10],
    transition: { repeat: Infinity, duration: 1.8, ease: "easeInOut" }
  },
  celebrating: {
    rotate: [45, 60, 45],
    x: 0,
    y: 0,
    transition: { repeat: Infinity, duration: 0.8, repeatType: "reverse", ease: "easeInOut" }
  },
  jump: {
    rotate: 40,
    x: 0,
    y: 0
  },
  clickSpin: {
    rotate: [0, 30, 0],
    x: 0,
    y: 0
  },
  flying: {
    rotate: 120, // reach forward
    x: -5,
    y: -10
  }
};

const leftLegVariants = {
  idle: { rotate: 0, y: 0 },
  lookLeft: { rotate: -4, y: 0 },
  lookRight: { rotate: 2, y: 0 },
  wave: { rotate: 0, y: 0 },
  dance: {
    rotate: [0, -15, 10, 0],
    y: [0, -6, 0],
    transition: { repeat: Infinity, duration: 0.6 }
  },
  thinking: { rotate: 0, y: 0 },
  typing: { rotate: 6, y: -1 },
  reading: { rotate: 2, y: 0 },
  writing: { rotate: 3, y: 0 },
  searching: {
    rotate: [-5, 5, -5],
    transition: { repeat: Infinity, duration: 2.2, ease: "easeInOut" }
  },
  celebrating: {
    rotate: [0, -22, 0],
    y: [0, -4, 0],
    transition: { repeat: Infinity, duration: 0.6, ease: "easeInOut" }
  },
  jump: { rotate: -12, y: -4 },
  clickSpin: { rotate: 0, y: 0 },
  flying: { rotate: 45, y: -8, x: 5 }
};

const rightLegVariants = {
  idle: { rotate: 0, y: 0 },
  lookLeft: { rotate: -2, y: 0 },
  lookRight: { rotate: 4, y: 0 },
  wave: { rotate: 0, y: 0 },
  dance: {
    rotate: [0, 15, -10, 0],
    y: [0, -6, 0],
    transition: { repeat: Infinity, duration: 0.6 }
  },
  thinking: { rotate: 0, y: 0 },
  typing: { rotate: -6, y: -1 },
  reading: { rotate: -2, y: 0 },
  writing: { rotate: -3, y: 0 },
  searching: {
    rotate: [5, -5, 5],
    transition: { repeat: Infinity, duration: 2.2, ease: "easeInOut" }
  },
  celebrating: {
    rotate: [0, 22, 0],
    y: [0, -4, 0],
    transition: { repeat: Infinity, duration: 0.6, ease: "easeInOut" }
  },
  jump: { rotate: 12, y: -4 },
  clickSpin: { rotate: 0, y: 0 },
  flying: { rotate: -45, y: -8, x: -5 }
};
