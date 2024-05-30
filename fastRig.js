    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // UI Elements
    const uiContainer = document.getElementById('uiContainer');
    const audioInput = document.getElementById('audioInput');
    const startButton = document.getElementById('startButton');
    const saveButton = document.getElementById('saveButton');
    const loadButton = document.getElementById('loadButton');

    // Add a button for creating and exporting mesh
    const createMeshButton = document.getElementById('createMeshButton');
    createMeshButton.addEventListener('click', function () {
        createMeshFromParticles();
    });

    // Add a button for exporting GLB
    const exportGLBButton = document.getElementById('exportGLBButton');
    exportGLBButton.addEventListener('click', function () {
        exportGLB(scene);
    });

    // Web Audio setup
    let audioContext, analyzer, sourceNode, audioReady = false;
    

    audioInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (!file) return;
        startAudioProcessing(file);
    });

    startButton.addEventListener('click', function() {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
        if (audioReady) {
            animate(); // Ensure animation starts only after audio is ready
        }
    });

    function startAudioProcessing(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            if (!audioContext) {
                audioContext = new AudioContext();
            }
            audioContext.decodeAudioData(e.target.result, function(buffer) {
                if (sourceNode) {
                    sourceNode.disconnect();
                }
                sourceNode = audioContext.createBufferSource();
                sourceNode.buffer = buffer;

                analyzer = audioContext.createAnalyser();
                analyzer.fftSize = 512; // Higher fftSize for more detailed audio analysis
                sourceNode.connect(analyzer);
                analyzer.connect(audioContext.destination);
                sourceNode.start(0);
                audioReady = true;
            });
        };
        reader.readAsArrayBuffer(file);
    }
    // Parameters for particle system
    const params = {
        a: 0.2,
        b: 0.3,
        tension: 1.5,
        gravity: 0.6,
        gravityRange: 50,
        forceScale: 8000, // Scaling factor for the force
        row: 100,
        rows: 200,   // Number of particles vertically
        cols: 200,   // Number of particles horizontally
        spacing: 1, // Spacing between particles
        particleSize: 0.5, // Size of each particle
    };
    
    let lineMesh;
    let particlesCount = params.rows * params.cols;
    let positionArray = new Float32Array(particlesCount * 3);
    let forceArray = new Float32Array(particlesCount * 3).fill(0); // Store forces in x, y, z directions

    let particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));

    // Material setup
    let particlesMaterial = new THREE.PointsMaterial({
        size: params.particleSize,
        color: 0xffffff,
        opacity: 0.75,
        transparent: true
    });
    

    
    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);

    // Force points
    const forcePoints = [];
    const forceMaterial = new THREE.PointsMaterial({
        size: 1,
        color: 0x0000ff,
        opacity: 1.0,
        transparent: true
    });

    let mode = 'add'; // Modes: 'add', 'edit'

    // History for undo/redo
    let history = [];
    let historyIndex = -1;


    function saveState() {
        const currentState = {
            params: { ...params },
            forceArray: Array.from(forceArray),
            forcePoints: forcePoints.map(forceMesh => ({
                position: Array.from(forceMesh.geometry.attributes.position.array),
                gravity: forceMesh.userData.gravity,
                gravityRange: forceMesh.userData.gravityRange,
                forceDirection: forceMesh.userData.forceDirection
            }))
        };
        history.push(currentState);
        if (history.length > 500) {
            history.shift();
        } else {
            historyIndex++;
        }
    }

    function createMeshFromParticles() {
        const indices = [];
        const positions = particlesGeometry.attributes.position.array; // Get positions from particle geometry
        const meshGeometry = new THREE.BufferGeometry(); // Create new geometry for the mesh
    
        // Connect each particle to its next neighbor, but not the last to the first
        for (let i = 0; i < params.rows; i++) {
            for (let j = 0; j < params.cols; j++) {
                const currentIndex = i * params.cols + j;
        
                // Connect horizontally to the next particle in the row, if not the last one
                if (j < params.cols - 1) {
                    const rightIndex = currentIndex + 1;
                    indices.push(currentIndex, rightIndex);
                }
        
                // Connect vertically to the next particle in the column, if not the last row
                if (i < params.rows - 1) {
                    const downIndex = currentIndex + params.cols;
                    indices.push(currentIndex, downIndex);
                }
            }
        }
    
        // Remove the old line mesh to avoid memory leaks and visual clutter
        if (lineMesh) {
            scene.remove(lineMesh);
            lineMesh.geometry.dispose(); // Dispose old geometry
            lineMesh.material.dispose(); // Dispose old material
        }
    
        // Update mesh geometry with new indices
        meshGeometry.setIndex(indices);
        meshGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
        const meshMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
        lineMesh = new THREE.LineSegments(meshGeometry, meshMaterial);

        scene.add(lineMesh);

   
    }


    function restoreState(state) {
        Object.assign(params, state.params);
        forceArray.set(state.forceArray);
        forcePoints.forEach(forceMesh => scene.remove(forceMesh));
        forcePoints.length = 0;

        state.forcePoints.forEach(fp => {
            const forceGeometry = new THREE.BufferGeometry();
            const forcePositionArray = new Float32Array(fp.position);
            forceGeometry.setAttribute('position', new THREE.BufferAttribute(forcePositionArray, 3));

            const forceMesh = new THREE.Points(forceGeometry, forceMaterial);
            forceMesh.userData = { gravity: fp.gravity, gravityRange: fp.gravityRange, forceDirection: fp.forceDirection };
            forcePoints.push(forceMesh);
            scene.add(forceMesh);
        });

        updateParticles();
    }

    function undo() {
        if (historyIndex > 0) {
            historyIndex--;
            restoreState(history[historyIndex]);
        }
    }

    function redo() {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            restoreState(history[historyIndex]);
        }
    }

    function smoothstep(edge0, edge1, x) {
        x = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
        return x * x * (3 - 2 * x);
    }

    function blendFactor(x, y) {
        const blendX = smoothstep(0, 1, Math.abs(x - params.cols / 2) / (params.cols / 2));
        const blendY = smoothstep(0, 1, Math.abs(y - params.rows / 2) / (params.rows / 2));
        return Math.pow(blendX * blendY, params.tension);
    }

    let waves = []; // Array to hold multiple wave origins and start times
    let waveStartTime = 0; // Time when the wave is triggered
    let waveCenter = { x: 0, y: 0 };  // Center of the wave effect
    let isWaveActive = false;         // Flag to activate wave mode
    const propagationDuration = 2

    function triggerWave(x, y, amplitude) {
        const wave = {
            center: { x, y },
            startTime: performance.now(),
            amplitude: amplitude
        };
        waves.push(wave);
    }

    let averageVolume = 128; // Example average, should be dynamically calculated
    let volumeHistory = [];
    // Assume we have a mechanism to detect peaks in the audio data
    function generateAudioDrivenWaves(dataArray, currentTime) {
        let currentVolume = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
        volumeHistory.push(currentVolume);
        if (volumeHistory.length > 50) volumeHistory.shift(); // Maintain a manageable history size
    
        let adjustedThreshold = volumeHistory.reduce((acc, val) => acc + val, 0) / volumeHistory.length * 1.5; // Adjust the threshold for beat sensitivity
    
        let previousVolume = volumeHistory[volumeHistory.length - 2] || adjustedThreshold; // Previous volume for rate of change calculation
        for (let i = 0; i < dataArray.length; i++) {
            if (dataArray[i] > adjustedThreshold && dataArray[i] - previousVolume > 10) { // Check for significant change
                let x = (i / dataArray.length) * ( params.cols * params.spacing) - ( params.cols * params.spacing / 2);
                let y = 0; // Center of wave effect
                let amplitude = (dataArray[i] / 255) * 0.3; // Scale wave amplitude based on volume
                triggerWave(x, y, amplitude);
            }
        }
    }

    function updateParticles() {
        let index = 0;
        const now = performance.now();
        const maxX = ( params.cols - 1) * params.spacing / 2;
        const maxY = ( params.rows - 1) * params.spacing / 2;
        const maxDistance = Math.sqrt(maxX * maxX + maxY * maxY);  // furthest distance from the center
        const waveAmplitude = 0.1;
        const waveLength = Math.max(maxX, maxY);
        const decayRate = 0.05; // Decay rate controlling how quickly the wave amplitude falls off with distance

        
        const dataArray = new Uint8Array(analyzer ? analyzer.frequencyBinCount : 0);
        if (analyzer && audioReady) {
            analyzer.getByteFrequencyData(dataArray);
            generateAudioDrivenWaves(dataArray, now); // Dynamically trigger waves based on audio data peaks
        }

        // Filter out waves that have fully dissipated beyond the logical interaction range
        waves = waves.filter(wave => {
            const timeElapsed = (now - wave.startTime) / 1000;
            return waveLength * timeElapsed <= maxDistance + waveLength; // Adjust this logic if needed for longer visible waves
        });

        // Process audio data to smooth it across particles
        const audioInfluence = new Array(params.rows *  params.cols).fill(0);
        if (audioReady && dataArray.length > 0) {
            // Scale audio data smoothly across all particles
            const step = Math.floor(dataArray.length / Math.min(params.rows,  params.cols));
            for (let i = 0; i < params.rows; i++) {
                for (let j = 0; j <  params.cols; j++) {
                    const dataIndex = Math.floor((i *  params.cols + j) / step) % dataArray.length;
                    audioInfluence[i *  params.cols + j] = dataArray[dataIndex] / 128.0 * 2 - 1; // Smaller scale to subtly influence movement
                }
            }
        }

        for (let i = 0; i < params.rows; i++) {
            for (let j = 0; j <  params.cols; j++) {
                const x = (j -  params.cols / 2) * params.spacing;
                const y = (i - params.rows / 2) * params.spacing;
                const blend = blendFactor(j, i);
                let modifier = (i < params.rows / 2 && j >  params.cols / 2) ? -1 : 1;
                const gravityEffect = forceArray[(i *  params.cols + j) * 3 + 2];
                let z = (modifier * blend + (1 - blend)) * ((params.a * x * x / (maxX * maxX) - params.b * y * y / (maxY * maxY)) * maxX) + gravityEffect;

                if (audioReady && dataArray.length > 0) {
                    z += audioInfluence[i *  params.cols + j]; // Apply smoothed audio data
                }

                let waveEffectTotal = 0;
                waves.forEach(wave => {
                    const timeElapsed = (now - wave.startTime) / 1000;
                    const dx = x - wave.center.x;
                    const dy = y - wave.center.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const normalizedTime = timeElapsed - distance / waveLength;
                    if (normalizedTime > 0) {
                        const wavePhase = normalizedTime * Math.PI;
                        const decay = Math.exp(-decayRate * distance);
                        const waveEffect = waveAmplitude * Math.sin(wavePhase) * decay;
                        waveEffectTotal += waveEffect;
                    }
                });

                z += waveEffectTotal;
                positionArray[index++] = x;
                positionArray[index++] = z;
                positionArray[index++] = y;
            }
        }
        particlesGeometry.attributes.position.needsUpdate = true;
    }



    updateParticles(); // Initial update

    // GUI for parameters
    const gui = new dat.GUI();
    gui.add(params, 'a', 0.1, 2).onChange(updateParticles);
    gui.add(params, 'b', 0.1, 2).onChange(updateParticles);
    gui.add(params, 'tension', 0.1, 2).onChange(updateParticles);
    gui.add(params, 'gravity', 0, 1).onChange(updateParticles);
    gui.add(params, 'gravityRange', 1, 1000).onChange(updateParticles);
    gui.add(params, 'forceScale', 1, 10000).onChange(updateParticles);

    gui.add(params, 'spacing', 0.5, 2).onChange(updateParticleSize);
    gui.add(params, 'particleSize', 0.1, 1).onChange(updateParticleSize);

    gui.add(params, 'rows', 0, 1000).step(1).onChange(reinitializeParticles);
    gui.add(params, 'cols', 0, 1000).step(1).onChange(reinitializeParticles);
    
 
    
    function reinitializeParticles() {
        particlesCount = params.rows * params.cols;
        positionArray = new Float32Array(particlesCount * 3);
        forceArray = new Float32Array(particlesCount * 3).fill(0);
    
        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
        particlesGeometry.attributes.position.needsUpdate = true;
    
        updateParticles(); // Reinitialize the particle positions and updates
        saveState(); // Optional: Save the state after reinitialization
    }
    
    function updateParticleSize() {
        particlesMaterial.size = params.particleSize;
        particlesMaterial.needsUpdate = true;
        saveState();
    }
    // Text for displaying mode
    const modeText = document.createElement('div');
    modeText.style.position = 'absolute';
    modeText.style.width = '100%';
    modeText.style.height = '100px';
    modeText.style.color = 'white';
    modeText.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modeText.style.textAlign = 'center';
    modeText.style.top = '50%';
    modeText.style.left = '50%';
    modeText.style.transform = 'translate(-50%, -50%)';
    modeText.style.fontSize = '24px';
    modeText.style.display = 'none';
    document.body.appendChild(modeText);

    function showModeText(text) {
        modeText.innerHTML = text;
        modeText.style.display = 'block';
        setTimeout(() => {
            modeText.style.display = 'none';
        }, 1000);
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowUp') {
            mode = 'add';  // Set mode to add
            forceDirection = 1; // Set direction to upward
            showModeText('Mode: Add Points (Upward)');
        } else if (event.key === 'ArrowDown') {
            mode = 'add';  // Set mode to add
            forceDirection = -1; // Set direction to downward
            showModeText('Mode: Add Points (Downward)');
        } else if (event.key === ' ') {
            mode = mode === 'add' ? 'edit' : 'add';
            showModeText(`Mode: ${mode === 'add' ? 'Add Points' : 'Edit Gravity'}`);
        } else if (event.key === 'ArrowLeft') {
            undo();
        } else if (event.key === 'ArrowRight') {
            redo();
        } else if (event.key === 'd') {
            isWaveActive = true;
            showModeText('Mode: Wave');
        } else if (event.key === 'c') {
            isWaveActive = false;
            showModeText('Mode: Wave Disabled');
        }
    });

    document.addEventListener('click', (event) => {
        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects([particlesMesh, ...forcePoints]);

        if (intersects.length > 0) {
            const intersect = intersects[0];


            if (mode === 'add' && intersect.object === particlesMesh) {
                const particleIndex = intersect.index;
                const selectedParticleX = positionArray[particleIndex * 3];
                const selectedParticleY = positionArray[particleIndex * 3 + 2];

                const forceGeometry = new THREE.BufferGeometry();
                const forcePositionArray = new Float32Array([selectedParticleX, 0, selectedParticleY]);
                forceGeometry.setAttribute('position', new THREE.BufferAttribute(forcePositionArray, 3));

                const forceMesh = new THREE.Points(forceGeometry, forceMaterial);
                forceMesh.userData = { gravity: params.gravity, gravityRange: params.gravityRange, forceDirection };
                forcePoints.push(forceMesh);
                scene.add(forceMesh);

                saveState();
                applyForces();
            } else if (mode === 'edit' && intersect.object !== particlesMesh) {
                const forceMesh = intersect.object;
                const newParams = prompt(`Current settings:\nGravity: ${forceMesh.userData.gravity}\nRange: ${forceMesh.userData.gravityRange}\nEnter new values (gravity, range):`, `${forceMesh.userData.gravity},${forceMesh.userData.gravityRange}`);
                if (newParams) {
                    const [newGravity, newRange] = newParams.split(',').map(Number);
                    forceMesh.userData.gravity = newGravity;
                    forceMesh.userData.gravityRange = newRange;
                    saveState();
                    applyForces(); // Call applyForces after updating gravity or gravity range
                }
            }
        }
    });
    
    // Function to export the scene to GLB
    function exportGLB(scene) {
        forcePoints.forEach(forceMesh => scene.remove(forceMesh));

        const exporter = new THREE.GLTFExporter();
        exporter.parse(scene, function (gltf) {
            console.log('Scene exported!');
            // Here you can handle the exported GLTF data, e.g., download it as a .glb file
            const blob = new Blob([gltf], { type: 'model/gltf-binary' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.style.display = 'none';
            link.href = url;
            link.download = 'scene.glb';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Add forcePoints back to the scene after exporting
            forcePoints.forEach(forceMesh => scene.add(forceMesh));
        }, {
            binary: true
        });
    }
    
    function applyForces() {
        forceArray.fill(0);
        forcePoints.forEach(forceMesh => {
            const [fx, , fy] = forceMesh.geometry.attributes.position.array;
            const gravity = forceMesh.userData.gravity;
            const gravityRange = forceMesh.userData.gravityRange;
            const forceDirection = forceMesh.userData.forceDirection;

            let totalForce = 0;
            const forces = [];

            for (let i = 0; i < params.rows; i++) {
                for (let j = 0; j < params.cols; j++) {
                    const idx = i * params.cols + j;
                    const x = (j - params.cols / 2) * params.spacing;
                    const y = (i - params.rows / 2) * params.spacing;
                    const dx = x - fx;
                    const dy = y - fy;
                    const distanceSquared = dx * dx + dy * dy;

                    if (distanceSquared < gravityRange * gravityRange) {
                        const distance = Math.sqrt(distanceSquared);
                        const forceEffect = Math.exp(-distanceSquared / (2 * gravityRange * gravityRange)) * gravity;
                        totalForce += forceEffect;
                        forces.push({ idx, forceEffect, distance });
                    }
                }
            }

            forces.forEach(({ idx, forceEffect, distance }) => {
                const normalizedForce = (forceEffect / totalForce) * params.forceScale;
                forceArray[idx * 3 + 2] += forceDirection * normalizedForce * (1 - distance / gravityRange);
            });
        });

        updateParticles();
    }

    saveButton.addEventListener('click', () => {
        const config = {
            params,
            forceArray: Array.from(forceArray),
            forcePoints: forcePoints.map(forceMesh => ({
                position: Array.from(forceMesh.geometry.attributes.position.array),
                gravity: forceMesh.userData.gravity,
                gravityRange: forceMesh.userData.gravityRange,
                forceDirection: forceMesh.userData.forceDirection
            }))
        };
        const configString = JSON.stringify(config);
        const blob = new Blob([configString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'configuration.json';
        a.click();
        URL.revokeObjectURL(url);
    });
    
    loadButton.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const config = JSON.parse(e.target.result);
                        Object.assign(params, config.params);
                        forceArray.set(new Float32Array(config.forceArray));
    
                        forcePoints.forEach(forceMesh => scene.remove(forceMesh));
                        forcePoints.length = 0;
    
                        config.forcePoints.forEach(fp => {
                            const forceGeometry = new THREE.BufferGeometry();
                            const forcePositionArray = new Float32Array(fp.position);
                            forceGeometry.setAttribute('position', new THREE.BufferAttribute(forcePositionArray, 3));
    
                            const forceMesh = new THREE.Points(forceGeometry, forceMaterial);
                            forceMesh.userData = { gravity: fp.gravity, gravityRange: fp.gravityRange, forceDirection: fp.forceDirection };
                            forcePoints.push(forceMesh);
                            scene.add(forceMesh);
                        });
    
                        applyForces();
                        gui.updateDisplay();
    
                        // Reset history state
                        history = [];
                        historyIndex = -1;
                        saveState(); // Save this as the initial state after loading
                    } catch (err) {
                        console.error("Failed to parse configuration:", err);
                        alert("Error loading configuration. The file may be corrupted or incorrectly formatted.");
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    });

    // Camera and controls
    camera.position.z = 100;
    camera.position.y = 50;
    camera.lookAt(scene.position);

    // Spherical Coordinates for Camera Control
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let spherical = new THREE.Spherical(450, Math.PI / 4, 0);
    let zoomSensitivity = 0.1;
    document.addEventListener('mousedown', function(e) {
        isDragging = true;
        previousMousePosition.x = e.clientX;
        previousMousePosition.y = e.clientY;
    });

    document.addEventListener('mousemove', (event) => {
        if (isDragging && !isWaveActive) {
            const deltaX = event.clientX - previousMousePosition.x;
            const deltaY = event.clientY - previousMousePosition.y;
            spherical.theta -= deltaX * 0.005;
            spherical.phi -= deltaY * 0.005;
            spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
            camera.position.setFromSpherical(spherical);
            camera.lookAt(scene.position);
            previousMousePosition.x = event.clientX;
            previousMousePosition.y = event.clientY;
        } else if (isWaveActive) {
            const mouse = new THREE.Vector2(
                (event.clientX / window.innerWidth) * 2 - 1,
                -(event.clientY / window.innerHeight) * 2 + 1
            );

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObject(particlesMesh);

            if (intersects.length > 0) {
                const intersect = intersects[0];
                triggerWave(intersect.point.x, intersect.point.z,0.2);
            }
        }
    });

    document.addEventListener('mouseup', function() {
        isDragging = false;
    });
    document.addEventListener('wheel', function(e) {
        spherical.radius += e.deltaY * zoomSensitivity;
        spherical.radius = Math.max(50, Math.min(500, spherical.radius));
        camera.position.setFromSpherical(spherical);
        camera.lookAt(scene.position);
    });
    
    // Animation Variables
    let lastUpdateTime = 0;
    const updateInterval = 10;

    // Animation loop
    function animate(now) {
        requestAnimationFrame(animate);
    
        // Limit updates to every 10ms when audio is playing
        if (audioReady && (now - lastUpdateTime) >= updateInterval) {
            updateParticles(now);
            lastUpdateTime = now;
        } else if (!audioReady) {
            updateParticles(now); // Update normally if not playing audio
        }
        
        renderer.render(scene, camera);
    }
    
    animate(); // Start the animation loop
