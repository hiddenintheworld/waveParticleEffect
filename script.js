// Three.js setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Parameters for hyperbolic paraboloid
const params = {
    a: 0.2,
    b: 0.3,
    tension: 0.5
};
// Create particles in a structured grid to form a hyperbolic paraboloid
const rows = 70;
const cols = 70;
const spacing = 1;
const particlesCount = rows * cols;
const positionArray = new Float32Array(particlesCount * 3);

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

// Hermite interpolation function
function hermiteInterpolation(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
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
        const blendX = smoothstep(0, 1, Math.abs(j - cols / 2) / (cols / 2));
        const blendY = smoothstep(0, 1, Math.abs(i - rows / 2) / (rows / 2));
        const blend = Math.pow(blendX * blendY, params.tension);
  
        // Modifier for gradual bending effect
        let modifier = (i < rows / 2 && j > cols / 2) ? -1 : 1;
        const z = (modifier * blend + (1 - blend)) * ((params.a * x * x / (maxX * maxX) - params.b * y * y / (maxY * maxY)) * maxX);
  
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
