const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Parameters for hyperbolic paraboloid
const params = {
    a: 0.2,
    b: 0.3,
    tension: 1.5,
    gravity: 0.6,
    gravityRange: 10,
    forceScale: 100 // Scaling factor for the force
};
// Create particles in a structured grid to form a hyperbolic paraboloid
const rows = 70;
const cols = 70;
const spacing = 1;
const particlesCount = rows * cols;
const positionArray = new Float32Array(particlesCount * 3);
const forceArray = new Float32Array(particlesCount * 3).fill(0); // Store forces in x, y, z directions

const particlesGeometry = new THREE.BufferGeometry();

// Material setup
const particlesMaterial = new THREE.PointsMaterial({
    size: 0.5,
    color: 0xffffff,
    opacity: 0.75,
    transparent: true
});

const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particlesMesh);

// Smoothstep function
function smoothstep(edge0, edge1, x) {
    x = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return x * x * (3 - 2 * x);
}

// Function to calculate the smooth blend factor
function blendFactor(x, y) {
    const blendX = smoothstep(0, 1, Math.abs(x - cols / 2) / (cols / 2));
    const blendY = smoothstep(0, 1, Math.abs(y - rows / 2) / (rows / 2));
    return Math.pow(blendX * blendY, params.tension);
}

function updateParticles() {
    let index = 0;
    const maxX = (cols - 1) * spacing / 2;
    const maxY = (rows - 1) * spacing / 2;
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const x = (j - cols / 2) * spacing;
            const y = (i - rows / 2) * spacing;

            // Blending factor to smoothly transition the surface
            const blend = blendFactor(j, i);

            // Modifier for gradual bending effect
            let modifier = (i < rows / 2 && j > cols / 2) ? -1 : 1;
            const gravityEffect = forceArray[(i * cols + j) * 3 + 2]; // Use the forceArray directly
            const z = (modifier * blend + (1 - blend)) * ((params.a * x * x / (maxX * maxX) - params.b * y * y / (maxY * maxY)) * maxX) + gravityEffect;

            positionArray[index++] = x;
            positionArray[index++] = z;
            positionArray[index++] = y;
        }
    }
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
    particlesGeometry.attributes.position.needsUpdate = true;
}
updateParticles(); // Initial update

// GUI for parameters
const gui = new dat.GUI();
gui.add(params, 'a', 0.1, 2).onChange(updateParticles);
gui.add(params, 'b', 0.1, 2).onChange(updateParticles);
gui.add(params, 'tension', 0.1, 2).onChange(updateParticles);
gui.add(params, 'gravity', 0, 1).onChange(updateParticles);
gui.add(params, 'gravityRange', 1, 20).onChange(updateParticles);
gui.add(params, 'forceScale', 1, 200).onChange(updateParticles);

// Mode Control
let mode = 'none';

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
        mode = 'upward';
        showModeText('Mode: Upward');
    } else if (event.key === 'ArrowDown') {
        mode = 'downward';
        showModeText('Mode: Downward');
    }
});

document.addEventListener('click', (event) => {
    if (mode === 'upward' || mode === 'downward') {
        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(particlesMesh);

        if (intersects.length > 0) {
            const intersect = intersects[0];
            const particleIndex = intersect.index;
            const forceDirection = mode === 'upward' ? 1 : -1;

            const selectedParticleX = positionArray[particleIndex * 3];
            const selectedParticleY = positionArray[particleIndex * 3 + 2];

            // Apply force to the surrounding particles using a smoother decay function
            let totalForce = 0;
            const forces = [];

            for (let i = 0; i < rows; i++) {
                for (let j = 0; j < cols; j++) {
                    const idx = i * cols + j;
                    const x = (j - cols / 2) * spacing;
                    const y = (i - rows / 2) * spacing;
                    const dx = x - selectedParticleX;
                    const dy = y - selectedParticleY;
                    const distanceSquared = dx * dx + dy * dy;

                    if (distanceSquared < params.gravityRange * params.gravityRange) {
                        const distance = Math.sqrt(distanceSquared);
                        const forceEffect = Math.exp(-distanceSquared / (2 * params.gravityRange * params.gravityRange)) * params.gravity;
                        totalForce += forceEffect;
                        forces.push({ idx, forceEffect, distance });
                    }
                }
            }

            // Normalize and apply forces
            forces.forEach(({ idx, forceEffect, distance }) => {
                const normalizedForce = (forceEffect / totalForce) * params.forceScale;
                forceArray[idx * 3 + 2] += forceDirection * normalizedForce * (1 - distance / params.gravityRange);
            });

            updateParticles();
        }
    }
});

// Save and Load Configuration
const saveButton = document.createElement('button');
saveButton.innerHTML = 'Save Configuration';
saveButton.style.position = 'absolute';
saveButton.style.top = '10px';
saveButton.style.left = '10px';
document.body.appendChild(saveButton);

const loadButton = document.createElement('button');
loadButton.innerHTML = 'Load Configuration';
loadButton.style.position = 'absolute';
loadButton.style.top = '10px';
loadButton.style.left = '150px';
document.body.appendChild(loadButton);

saveButton.addEventListener('click', () => {
    const config = {
        params,
        forceArray: Array.from(forceArray)
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
        const reader = new FileReader();
        reader.onload = (e) => {
            const config = JSON.parse(e.target.result);
            Object.assign(params, config.params);
            forceArray.set(config.forceArray);
            updateParticles();
            gui.updateDisplay();
        };
        reader.readAsText(file);
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
document.addEventListener('mousemove', function(e) {
    if (isDragging) {
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;
        spherical.theta -= deltaX * 0.005;
        spherical.phi -= deltaY * 0.005;
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
        camera.position.setFromSpherical(spherical);
        camera.lookAt(scene.position);
        previousMousePosition.x = e.clientX;
        previousMousePosition.y = e.clientY;
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

// Animation loop
const animate = () => {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
};

animate(); // Start the animation loop
