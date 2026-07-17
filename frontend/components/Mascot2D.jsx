'use client';

import { useEffect, useRef } from 'react';

export default function Mascot2D({ action, isError, isThinking, isDragging }) {
    const containerRef = useRef(null);
    const jointsRef = useRef({});

    useEffect(() => {
        const joints = jointsRef.current;
        let animationFrameId;
        const startTime = Date.now();

        // Mouse pointer coordinates
        const pointer = { x: 0, y: 0 };

        const currentAngles = {};
        const targetAngles = {};
        
        const lerpKeys = [
            'torsoY', 'torsoRot', 'headRot', 'headX', 'headY',
            'lShoulder', 'rShoulder', 'lElbow', 'rElbow', 'lHand', 'rHand',
            'lHip', 'rHip', 'lKnee', 'rKnee',
            'f_lThumb', 'f_lIndex', 'f_lMiddle', 'f_lPinky',
            'f_rThumb', 'f_rIndex', 'f_rMiddle', 'f_rPinky'
        ];

        // Initialize angles
        lerpKeys.forEach(k => {
            targetAngles[k] = 0;
            currentAngles[k] = 0;
        });

        // Mouse look listener
        const handleMouseMove = (e) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            
            // Normalized offset [-1.0, 1.0] with 300px radius
            pointer.x = Math.max(-1.0, Math.min(1.0, (e.clientX - cx) / 300.0));
            pointer.y = Math.max(-1.0, Math.min(1.0, -(e.clientY - cy) / 300.0));
        };

        window.addEventListener('mousemove', handleMouseMove);

        // Core animation tick
        const animate = () => {
            const t = (Date.now() - startTime) / 1000.0;
            const activeAction = 'idle';
            const isThinking = false;
            const isError = false;

            // Reset targets to default baseline values
            lerpKeys.forEach(k => {
                targetAngles[k] = 0;
            });

            // Set default baseline arm angles (arms hang naturally at the sides)
            targetAngles.lShoulder = 3;
            targetAngles.rShoulder = -3;
            targetAngles.lElbow = 0;
            targetAngles.rElbow = 0;

            // Show/Hide Props based on active action
            if (joints.propLaptop) joints.propLaptop.style.display = (activeAction === 'typing' || activeAction === 'gaming' || activeAction === 'youtube') ? 'block' : 'none';
            if (joints.propBook) joints.propBook.style.display = (activeAction === 'reading') ? 'block' : 'none';
            if (joints.propClipboard) joints.propClipboard.style.display = (activeAction === 'writing') ? 'block' : 'none';
            if (joints.propTrophy) joints.propTrophy.style.display = (activeAction === 'celebrating') ? 'block' : 'none';
            if (joints.propMagnifier) joints.propMagnifier.style.display = (activeAction === 'searching') ? 'block' : 'none';

            // Props float motion
            if (activeAction === 'typing' || activeAction === 'gaming' || activeAction === 'youtube') {
                if (joints.propLaptop) joints.propLaptop.setAttribute('transform', `translate(110, ${185 + Math.sin(t * 2.5) * 1.5})`);
            } else if (activeAction === 'reading') {
                if (joints.propBook) joints.propBook.setAttribute('transform', `translate(110, ${155 + Math.sin(t * 2.2) * 2.0})`);
            } else if (activeAction === 'writing') {
                if (joints.propClipboard) joints.propClipboard.setAttribute('transform', `translate(110, ${168 + Math.sin(t * 2.0) * 1.5})`);
                
                // Sliding paper animation
                const loopTime = (t % 5.0);
                let slide = 0;
                if (loopTime < 2.0) {
                    slide = loopTime / 2.0;
                } else if (loopTime < 3.5) {
                    slide = 1.0;
                } else {
                    slide = 1.0 - (loopTime - 3.5) / 1.5;
                }
                if (joints.propClipboardPaper) joints.propClipboardPaper.setAttribute('transform', `translate(0, ${-slide * 15})`);
            } else if (activeAction === 'celebrating') {
                if (joints.propTrophy) joints.propTrophy.setAttribute('transform', `translate(110, ${150 + Math.sin(t * 3.0) * 2.2})`);
            }

            // Head tracking calculations (mouse look coords)
            let lookX = pointer.x;
            let lookY = pointer.y;

            // Dampen look tracking if in special focused animations
            if (activeAction === 'sleep') {
                lookX = 0;
                lookY = -0.5;
            } else if (activeAction === 'typing' || activeAction === 'reading' || activeAction === 'writing') {
                lookX = lookX * 0.25;
                lookY = (lookY * 0.2) - 0.4;
            }

            targetAngles.headRot = 0;  // Head rotations/translations removed completely for static look
            targetAngles.headX = 0;
            targetAngles.headY = 0;

            // Dampened eye offsets mapping looking direction (so eyes don't go outside the visor)
            const ex = lookX * 2.0;
            const ey = -lookY * 1.5;
            if (joints.eyeLeftGroup) joints.eyeLeftGroup.setAttribute('transform', `translate(${-9 + ex}, ${-15 + ey})`);
            if (joints.eyeRightGroup) joints.eyeRightGroup.setAttribute('transform', `translate(${9 + ex}, ${-15 + ey})`);

            // Energy reactor core pulsing effect
            const pulse = 0.8 + Math.sin(t * (activeAction === 'sleep' ? 1.1 : 3.0)) * 0.25;
            if (joints.energyCore) joints.energyCore.setAttribute('opacity', pulse);

            // --- State Action Dispatcher (FK Target solver) ---
            if (isThinking || activeAction === 'thinking') {
                targetAngles.headRot += Math.sin(t * 1.5) * 6;
                targetAngles.headY += 3;
                targetAngles.lShoulder = -70;
                targetAngles.lElbow = 65;
                targetAngles.lHand = Math.sin(t * 4) * 8;
            } 
            else if (activeAction === 'sleep') {
                const breathing = Math.sin(t * 1.1);
                targetAngles.torsoY = 4 + breathing * 1.8;
                targetAngles.torsoRot = 8 + breathing * 1.5;
                targetAngles.headRot = -2 + breathing * 0.8;
                targetAngles.headY = 5 - breathing * 0.5;
                
                targetAngles.lShoulder = 15 + breathing * 0.5;
                targetAngles.rShoulder = -15 - breathing * 0.5;
                targetAngles.lElbow = 5;
                targetAngles.rElbow = -5;
            } 
            else if (activeAction === 'jolt') {
                targetAngles.torsoY = -12;
                targetAngles.torsoRot = -4;
                targetAngles.headY = -5;
                targetAngles.lShoulder = -90;
                targetAngles.rShoulder = 90;
                targetAngles.lElbow = 35;
                targetAngles.rElbow = -35;
            } 
            else if (activeAction === 'gaming') {
                const shake = Math.abs(Math.sin(t * 8)) * 3;
                targetAngles.torsoY = shake;
                targetAngles.torsoRot = Math.sin(t * 5) * 5;
                targetAngles.headRot = Math.cos(t * 6) * 4;
                targetAngles.headY = -2;

                targetAngles.lShoulder = -65 + Math.sin(t * 36) * 4;
                targetAngles.rShoulder = -65 + Math.cos(t * 36) * 4;
                targetAngles.lElbow = 80 + Math.cos(t * 30) * 8;
                targetAngles.rElbow = 80 + Math.sin(t * 30) * 8;

                // Typing fingers jitter
                targetAngles.f_lThumb = Math.sin(t * 40) * 12;
                targetAngles.f_lIndex = Math.cos(t * 44) * 12;
                targetAngles.f_lMiddle = Math.sin(t * 42) * 12;
                targetAngles.f_lPinky = Math.cos(t * 38) * 12;
                
                targetAngles.f_rThumb = Math.cos(t * 40) * 12;
                targetAngles.f_rIndex = Math.sin(t * 44) * 12;
                targetAngles.f_rMiddle = Math.cos(t * 42) * 12;
                targetAngles.f_rPinky = Math.sin(t * 38) * 12;
            } 
            else if (activeAction === 'youtube') {
                targetAngles.torsoY = Math.sin(t * 1.5) * 0.8;
                targetAngles.headRot = Math.sin(t * 0.8) * 4;
                targetAngles.headY = 2;
                targetAngles.lShoulder = 12 + Math.sin(t * 0.5) * 1;
                targetAngles.rShoulder = -12 - Math.cos(t * 0.5) * 1;
            } 
            else if (activeAction === 'typing') {
                targetAngles.torsoY = Math.sin(t * 1.5) * 0.8 + Math.sin(t * 28) * 0.2;
                targetAngles.torsoRot = 3 + Math.sin(t * 1.5) * 0.6;
                targetAngles.headRot = Math.sin(t * 0.8) * 3;
                targetAngles.headY = 4 + Math.sin(t * 1.2) * 0.8;

                targetAngles.lShoulder = -55 + Math.sin(t * 30) * 2;
                targetAngles.rShoulder = -55 + Math.cos(t * 30) * 2;
                targetAngles.lElbow = 70 + Math.cos(t * 26) * 5;
                targetAngles.rElbow = 70 + Math.sin(t * 26) * 5;

                // Typing fingers wiggles
                targetAngles.f_lThumb = Math.sin(t * 32) * 8;
                targetAngles.f_lIndex = Math.cos(t * 35) * 8;
                targetAngles.f_lMiddle = Math.sin(t * 33) * 8;
                targetAngles.f_lPinky = Math.cos(t * 29) * 8;

                targetAngles.f_rThumb = Math.cos(t * 32) * 8;
                targetAngles.f_rIndex = Math.sin(t * 35) * 8;
                targetAngles.f_rMiddle = Math.cos(t * 33) * 8;
                targetAngles.f_rPinky = Math.sin(t * 29) * 8;
            } 
            else if (activeAction === 'wave') {
                targetAngles.rShoulder = -110;
                targetAngles.rElbow = -45 + Math.sin(t * 12) * 22;
                targetAngles.rHand = Math.cos(t * 15) * 12;
            } 
            else if (activeAction === 'dance') {
                const tempo = t * 5.0;
                targetAngles.torsoY = Math.abs(Math.sin(tempo)) * 14;
                targetAngles.torsoRot = Math.sin(tempo) * 8;
                targetAngles.headRot = -Math.sin(tempo) * 5;

                targetAngles.lShoulder = -30 + Math.sin(t * 6) * 35;
                targetAngles.rShoulder = 30 + Math.cos(t * 6) * 35;
                targetAngles.lElbow = 35 + Math.sin(t * 6) * 15;
                targetAngles.rElbow = -35 - Math.cos(t * 6) * 15;

                targetAngles.lHip = Math.sin(tempo) * 15;
                targetAngles.rHip = -Math.sin(tempo) * 15;
                targetAngles.lKnee = Math.max(0, Math.sin(tempo)) * 12;
                targetAngles.rKnee = Math.max(0, -Math.sin(tempo)) * 12;
            } 
            else if (activeAction === 'celebrating') {
                const bounce = Math.abs(Math.sin(t * 6.5)) * 18;
                targetAngles.torsoY = bounce;
                targetAngles.lShoulder = -120 + Math.sin(t * 12) * 8;
                targetAngles.rShoulder = 120 + Math.cos(t * 12) * 8;
                targetAngles.lElbow = 45;
                targetAngles.rElbow = -45;
            } 
            else if (activeAction === 'reading') {
                targetAngles.torsoRot = 4;
                targetAngles.headRot = Math.sin(t * 2.2) * 8; // Scanning pages left/right
                targetAngles.headY = 5;
                
                targetAngles.lShoulder = -45;
                targetAngles.rShoulder = 45;
                targetAngles.lElbow = 65;
                targetAngles.rElbow = -65;
            } 
            else if (activeAction === 'writing') {
                targetAngles.headRot = Math.sin(t * 6.0) * 3;
                targetAngles.headY = 4;
                
                // Left arm holds clipboard
                targetAngles.lShoulder = -35;
                targetAngles.lElbow = 55;
                
                // Right arm wiggles pen
                targetAngles.rShoulder = -50;
                targetAngles.rElbow = 70 + Math.sin(t * 16) * 5;
                targetAngles.rHand = Math.cos(t * 16) * 12;
            } 
            else if (activeAction === 'searching') {
                targetAngles.headRot = Math.sin(t * 2.0) * 6;
                targetAngles.headY = 3 + Math.cos(t * 2.0) * 2;
                targetAngles.torsoRot = Math.sin(t * 2.0) * 4;

                // Right arm raises magnifier to face
                targetAngles.rShoulder = -60 + Math.sin(t * 2.0) * 6;
                targetAngles.rElbow = 50 + Math.cos(t * 2.0) * 4;
            } 
            else {
                // Default Idle Bob (shoulders sway slightly, torso bob handled by overlay)
                targetAngles.lShoulder = 3 + Math.sin(t * 0.8) * 0.5;
                targetAngles.rShoulder = -3 - Math.sin(t * 0.8) * 0.5;
            }

            // Add procedural weightless hover overlay to torso (subtle vertical bob only, almost imperceptible)
            const floatY = Math.sin(t * 0.8) * 1.5;   // small slow bob

            targetAngles.torsoY += floatY;
            // Pose stays predominantly upright (no torsoRot or headX sway overlays)

            // Normal smile (invisible unless speaking)
            if (joints.mouth) joints.mouth.setAttribute('d', "M -9 -7 Q 0 -3.5 9 -7");

            // --- Apply Smooth Lerping & SVG Transforms ---
            lerpKeys.forEach(k => {
                const speed = (k.startsWith('f_') || k === 'rHand' || k === 'lHand') ? 0.35 : 0.16;
                currentAngles[k] = currentAngles[k] + (targetAngles[k] - currentAngles[k]) * speed;
            });

            // Update SVG elements via direct DOM modifications for high performance
            if (joints.torso) joints.torso.setAttribute('transform', `translate(0, ${currentAngles.torsoY}) rotate(${currentAngles.torsoRot}, 110, 150)`);
            if (joints.head) joints.head.setAttribute('transform', `translate(${110 + currentAngles.headX}, ${98 + currentAngles.headY}) rotate(${currentAngles.headRot})`);
            
            if (joints.leftShoulder) joints.leftShoulder.setAttribute('transform', `translate(72, 134) rotate(${currentAngles.lShoulder})`);
            if (joints.rightShoulder) joints.rightShoulder.setAttribute('transform', `translate(148, 134) rotate(${currentAngles.rShoulder})`);
            
            if (joints.leftElbow) joints.leftElbow.setAttribute('transform', `translate(0, 24) rotate(${currentAngles.lElbow})`);
            if (joints.rightElbow) joints.rightElbow.setAttribute('transform', `translate(0, 24) rotate(${currentAngles.rElbow})`);
            
            if (joints.leftHand) joints.leftHand.setAttribute('transform', `translate(0, 18) rotate(${currentAngles.lHand})`);
            if (joints.rightHand) joints.rightHand.setAttribute('transform', `translate(0, 18) rotate(${currentAngles.rHand})`);
 
            if (joints.leftHip) joints.leftHip.setAttribute('transform', `translate(95, 170) rotate(${currentAngles.lHip})`);
            if (joints.rightHip) joints.rightHip.setAttribute('transform', `translate(125, 170) rotate(${currentAngles.rHip})`);
            
            if (joints.leftKnee) joints.leftKnee.setAttribute('transform', `translate(0, 20) rotate(${currentAngles.lKnee})`);
            if (joints.rightKnee) joints.rightKnee.setAttribute('transform', `translate(0, 20) rotate(${currentAngles.rKnee})`);

            // Apply finger rotations
            if (joints.lfThumb) joints.lfThumb.setAttribute('transform', `rotate(${currentAngles.f_lThumb}, -3.5, 3)`);
            if (joints.lfIndex) joints.lfIndex.setAttribute('transform', `rotate(${currentAngles.f_lIndex}, -1.5, 4)`);
            if (joints.lfMiddle) joints.lfMiddle.setAttribute('transform', `rotate(${currentAngles.f_lMiddle}, 0.5, 4)`);
            if (joints.lfPinky) joints.lfPinky.setAttribute('transform', `rotate(${currentAngles.f_lPinky}, 2.5, 3)`);

            if (joints.rfThumb) joints.rfThumb.setAttribute('transform', `rotate(${currentAngles.f_rThumb}, 3.5, 3)`);
            if (joints.rfIndex) joints.rfIndex.setAttribute('transform', `rotate(${currentAngles.f_rIndex}, 1.5, 4)`);
            if (joints.rfMiddle) joints.rfMiddle.setAttribute('transform', `rotate(${currentAngles.f_rMiddle}, -0.5, 4)`);
            if (joints.rfPinky) joints.rfPinky.setAttribute('transform', `rotate(${currentAngles.f_rPinky}, -2.5, 3)`);

            // Eyeball expressions
            updateEyeExpressions(t);

            animationFrameId = requestAnimationFrame(animate);
        };

        const updateEyeExpressions = (t) => {
            if (!joints.eyeLeft || !joints.eyeRight) return;

            // Default: Oval eyes visible and look tracking!
            joints.eyeLeft.setAttribute('rx', '5');
            joints.eyeLeft.setAttribute('opacity', '1');
            joints.eyeRight.setAttribute('rx', '5');
            joints.eyeRight.setAttribute('opacity', '1');

            // Periodic blinking loop (blink for 150ms every ~3s)
            if (Math.floor(t * 1.3) % 4 === 0 && (t % 1.0 < 0.15)) {
                joints.eyeLeft.setAttribute('ry', '0.8');
                joints.eyeRight.setAttribute('ry', '0.8');
            } else {
                joints.eyeLeft.setAttribute('ry', '8.5');
                joints.eyeRight.setAttribute('ry', '8.5');
            }
        };

        // Cache DOM elements
        const root = containerRef.current;
        if (root) {
            jointsRef.current = {
                torso: root.querySelector('#robot-torso'),
                head: root.querySelector('#robot-head'),
                leftShoulder: root.querySelector('#left-shoulder'),
                rightShoulder: root.querySelector('#right-shoulder'),
                leftElbow: root.querySelector('#left-elbow'),
                rightElbow: root.querySelector('#right-elbow'),
                leftHand: root.querySelector('#left-hand'),
                rightHand: root.querySelector('#right-hand'),
                leftHip: root.querySelector('#left-hip'),
                rightHip: root.querySelector('#right-hip'),
                leftKnee: root.querySelector('#left-knee'),
                rightKnee: root.querySelector('#right-knee'),
                energyCore: root.querySelector('#energy-core'),
                eyeLeft: root.querySelector('#eye-left'),
                eyeRight: root.querySelector('#eye-right'),
                eyeLeftGroup: root.querySelector('#eye-left-group'),
                eyeRightGroup: root.querySelector('#eye-right-group'),
                mouth: root.querySelector('#mouth'),
                
                lfThumb: root.querySelector('#left-finger-t'),
                lfIndex: root.querySelector('#left-finger-i'),
                lfMiddle: root.querySelector('#left-finger-m'),
                lfPinky: root.querySelector('#left-finger-p'),
                rfThumb: root.querySelector('#right-finger-t'),
                rfIndex: root.querySelector('#right-finger-i'),
                rfMiddle: root.querySelector('#right-finger-m'),
                rfPinky: root.querySelector('#right-finger-p'),

                propLaptop: root.querySelector('#prop-laptop'),
                propBook: root.querySelector('#prop-book'),
                propClipboard: root.querySelector('#prop-clipboard'),
                propClipboardPaper: root.querySelector('#prop-clipboard-paper'),
                propTrophy: root.querySelector('#prop-trophy'),
                propMagnifier: root.querySelector('#prop-magnifier')
            };

            // Start animation loop
            animate();
        }

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [action, isError, isThinking, isDragging]);

    return (
        <svg ref={containerRef} viewBox="0 0 220 220" style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
            <defs>
                <filter id="glowReact" x="-25%" y="-25%" width="150%" height="150%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                <filter id="softGlowReact" x="-15%" y="-15%" width="130%" height="130%">
                    <feGaussianBlur stdDeviation="1.8" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>

                {/* Dark Visor Blue-Grey Gradient from Image */}
                <linearGradient id="visorGradReact" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#162235" />
                    <stop offset="100%" stopColor="#090f1a" />
                </linearGradient>

                {/* ClipPaths for Astronaut Eyes to ensure script compatibility */}
                <clipPath id="eyeLeftClipReact">
                    <ellipse id="eye-left" cx="0" cy="0" rx="0" ry="0" />
                </clipPath>
                <clipPath id="eyeRightClipReact">
                    <ellipse id="eye-right" cx="0" cy="0" rx="0" ry="0" />
                </clipPath>
            </defs>

            <g id="robot-torso" transform="translate(0, 0)">
                {/* Body (Solid white rounded chibi egg torso) */}
                <path d="M 77,126 C 70,126 70,155 82,168 C 90,173 100,173 110,173 C 120,173 130,173 138,168 C 150,155 150,126 143,126 Z" fill="#ffffff" stroke="#000000" strokeWidth="8" strokeLinejoin="round" />

                {/* Waist belt - horizontal black bar */}
                <rect x="80" y="158" width="60" height="5.5" fill="#000000" />

                {/* Chest Module Pack */}
                <rect x="95" y="132" width="30" height="26" rx="4.5" fill="#ffffff" stroke="#000000" strokeWidth="4.5" />
                {/* Curved line on left of button */}
                <path d="M100,138 C100,145 105,143 105,150" fill="none" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" />
                {/* Single Blue Button (maps to energy core for talk pulsing) */}
                <circle id="energy-core" cx="114" cy="145" r="3.5" fill="#3b82f6" stroke="#000000" strokeWidth="2.5" />

                {/* LEFT HIP AND LEG - Flared bell bottom leg with horizontal black boot base */}
                <g id="left-hip" transform="translate(95, 170)">
                    <path d="M-6,0 L6,0 L9,16 L-9,16 Z" fill="#ffffff" stroke="#000000" strokeWidth="6" strokeLinejoin="round" />
                    <path d="M-12,14 L12,14 L10,20 L-10,20 Z" fill="#000000" stroke="#000000" strokeWidth="1.5" strokeLinejoin="round" />
                    {/* Dummy joint knee for script compatibility */}
                    <g id="left-knee" />
                </g>

                {/* RIGHT HIP AND LEG - Flared bell bottom leg with horizontal black boot base */}
                <g id="right-hip" transform="translate(125, 170)">
                    <path d="M-6,0 L6,0 L9,16 L-9,16 Z" fill="#ffffff" stroke="#000000" strokeWidth="6" strokeLinejoin="round" />
                    <path d="M-12,14 L12,14 L10,20 L-10,20 Z" fill="#000000" stroke="#000000" strokeWidth="1.5" strokeLinejoin="round" />
                    {/* Dummy joint knee for script compatibility */}
                    <g id="right-knee" />
                </g>

                {/* LEFT SHOULDER AND ARM - Unified single rounded shape capsule */}
                <g id="left-shoulder" transform="translate(72, 134)">
                    <rect x="-7" y="0" width="14" height="26" rx="7" fill="#ffffff" stroke="#000000" strokeWidth="6" strokeLinejoin="round" />
                    {/* Dummy joint elbow & hand for script compatibility */}
                    <g id="left-elbow">
                        <g id="left-hand">
                            <g id="left-finger-t" />
                            <g id="left-finger-i" />
                            <g id="left-finger-m" />
                            <g id="left-finger-p" />
                        </g>
                    </g>
                </g>

                {/* RIGHT SHOULDER AND ARM - Unified single rounded shape capsule */}
                <g id="right-shoulder" transform="translate(148, 134)">
                    <rect x="-7" y="0" width="14" height="26" rx="7" fill="#ffffff" stroke="#000000" strokeWidth="6" strokeLinejoin="round" />
                    {/* Dummy joint elbow & hand for script compatibility */}
                    <g id="right-elbow">
                        <g id="right-hand">
                            <g id="right-finger-t" />
                            <g id="right-finger-i" />
                            <g id="right-finger-m" />
                            <g id="right-finger-p" />
                            {/* Magnifier Prop */}
                            <g id="prop-magnifier" style={{ display: 'none' }}>
                                <line x1="0" y1="3" x2="8" y2="15" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" />
                                <circle cx="8" cy="15" r="7.5" fill="none" stroke="#f5a95b" strokeWidth="2" filter="url(#softGlowReact)" />
                                <circle cx="8" cy="15" r="6.5" fill="#38bdf8" opacity="0.3" />
                            </g>
                        </g>
                    </g>
                </g>

                {/* HEAD GROUP */}
                <g id="robot-head" transform="translate(110, 98)">
                    {/* Left Side Cylindrical Pad module - outlined in black with white fill */}
                    <rect x="-53" y="-26" width="9" height="22" rx="4.5" fill="#ffffff" stroke="#000000" strokeWidth="5.5" />

                    {/* Right Side Cylindrical Pad module - outlined in black with white fill */}
                    <rect x="44" y="-26" width="9" height="22" rx="4.5" fill="#ffffff" stroke="#000000" strokeWidth="5.5" />

                    {/* Main White Helmet Sphere - Smooth top, perfectly round */}
                    <circle cx="0" cy="-15" r="44" fill="#ffffff" stroke="#000000" strokeWidth="8" />

                    {/* Visor group */}
                    <g id="visor-group">
                        {/* Circular Visor */}
                        <circle cx="0" cy="-15" r="34" fill="url(#visorGradReact)" stroke="#000000" strokeWidth="6" />

                        {/* Visor Gloss Highlights - Crescent shape on left and dots on right */}
                        <path d="M-22,-30 A26,26 0 0,0 -22,0" fill="none" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" opacity="0.22" />
                        <circle cx="16" cy="-24" r="3.8" fill="#ffffff" opacity="0.9" />
                        <circle cx="17.5" cy="-17" r="1.8" fill="#ffffff" opacity="0.9" />

                        {/* Eyes inside visor (symmetrical, centered and vertical white ovals) */}
                        <g id="eye-left-group" transform="translate(-9, -15)">
                            <ellipse id="eye-left" cx="0" cy="0" rx="2" ry="4.5" fill="#ffffff" />
                        </g>
                        <g id="eye-right-group" transform="translate(9, -15)">
                            <ellipse id="eye-right" cx="0" cy="0" rx="2" ry="4.5" fill="#ffffff" />
                        </g>
                    </g>

                    {/* Mouth (digital indicator - hidden unless speaking) */}
                    <path id="mouth" d="M -9 -7 Q 0 -3.5 9 -7" fill="none" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" opacity="0" />
                </g>

                {/* PROPS GROUPS */}
                <g id="prop-laptop" transform="translate(110, 185)" style={{ display: 'none' }}>
                    <polygon points="-38,8 38,8 30,17 -30,17" fill="#334155" stroke="#111827" strokeWidth="1.2" />
                    <line x1="-28" y1="15" x2="28" y2="15" stroke="#111827" strokeWidth="1" />
                    <polygon points="-34,-12 34,-12 38,8 -38,8" fill="#090d16" stroke="#111827" strokeWidth="1.2" />
                    <polygon points="-32,-10 32,-10 35,6 -35,6" fill="#0284c7" opacity="0.18" filter="url(#glowReact)" />
                </g>

                <g id="prop-book" transform="translate(110, 155)" style={{ display: 'none' }}>
                    <rect x="-2.5" y="-11" width="5" height="22" rx="1.5" fill="#991b1b" />
                    <path d="M-2.5,-9 Q-14,-11 -26,-8 L-26,8 Q-14,6 -2.5,8 Z" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.8" />
                    <path d="M2.5,-9 Q14,-11 26,-8 L26,8 Q14,6 2.5,8 Z" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.8" />
                </g>

                <g id="prop-clipboard" transform="translate(110, 168)" style={{ display: 'none' }}>
                    <rect x="-20" y="-25" width="40" height="50" rx="3.5" fill="#b45309" stroke="#78350f" strokeWidth="1.2" />
                    <rect x="-7" y="-26" width="14" height="7" rx="1.5" fill="#94a3b8" stroke="#475569" strokeWidth="0.8" />
                    <g id="prop-clipboard-paper">
                        <rect x="-16" y="-18" width="32" height="38" fill="#f8fafc" />
                    </g>
                </g>

                <g id="prop-trophy" transform="translate(110, 150)" style={{ display: 'none' }}>
                    <path d="M-8,16 L8,16 L5,12 L-5,12 Z" fill="#fbbf24" />
                    <rect x="-1.5" y="5" width="3" height="7" fill="#fbbf24" />
                    <path d="M-12,-9 L12,-9 Q12,7 0,7 Q-12,7 -12,-9 Z" fill="#fbbf24" stroke="#d97706" strokeWidth="0.8" />
                </g>
            </g>
        </svg>
    );
}
