import * as THREE from 'three';
import { GLTFLoader } from 'https://unpkg.com/three@0.155.0/examples/jsm/loaders/GLTFLoader.js';

// --- 1. SETUP & GLOBAL VARIABLES ---
let gameStarted = false;
let player = null;
let mixer = null; // For 3D animations
const clock = new THREE.Clock();
const splashSound = new Audio('assets/splash.mp3');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky Blue

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 12, 12); // Bird's eye view
camera.lookAt(0, 0, -10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- 2. LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

// --- 3. THE WORLD (BANKS & RIVER) ---

// Start Bank
const startBank = new THREE.Mesh(
    new THREE.BoxGeometry(40, 1, 6),
    new THREE.MeshPhongMaterial({ color: 0x2ecc71 })
);
startBank.position.z = 6;
startBank.receiveShadow = true;
scene.add(startBank);

// Finish Bank
const finishBank = new THREE.Mesh(
    new THREE.BoxGeometry(40, 1, 6),
    new THREE.MeshPhongMaterial({ color: 0x2ecc71 })
);
finishBank.position.z = -34;
finishBank.receiveShadow = true;
scene.add(finishBank);

// The River
const riverGeom = new THREE.PlaneGeometry(100, 80);
const riverMat = new THREE.MeshPhongMaterial({ color: 0x0077be, transparent: true, opacity: 0.8 });
const river = new THREE.Mesh(riverGeom, riverMat);
river.rotation.x = -Math.PI / 2;
river.position.y = -0.1;
scene.add(river);

// --- 4. TROPHY ---
const trophyGroup = new THREE.Group();
const goldMat = new THREE.MeshPhongMaterial({ color: 0xffd700, shininess: 100 });
const trophyBase = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.4, 16), goldMat);
const trophyCup = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.2, 16), goldMat);
trophyCup.position.y = 0.8;
trophyCup.rotation.x = Math.PI;
trophyGroup.add(trophyBase, trophyCup);
trophyGroup.position.set(0, 1.5, -34);
scene.add(trophyGroup);

// --- 5. LOADING THE FOX AVATAR ---
const loader = new GLTFLoader();
loader.load('assets/foxpacked.glb', function (gltf) {
    player = gltf.scene;
    player.scale.set(1.2, 1.2, 1.2); 
    player.position.set(0, 0.5, 6); // Start on the green bank
    
    player.traverse(node => {
        if (node.isMesh) node.castShadow = true;
    });
    
    scene.add(player);

    // Animation setup
    if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(player);
        mixer.clipAction(gltf.animations[0]).play();
    }
}, undefined, (err) => console.error("Model failed to load:", err));

// --- 6. OBSTACLES (LOGS, BRANCHES, TIRES) ---
const obstacles = [];
const lanes = [-4, -8, -12, -16, -20, -24, -28];

function createObstacle(z) {
    const type = Math.random();
    let geometry, material;

    if (type < 0.5) { // Log
        geometry = new THREE.CylinderGeometry(0.6, 0.6, 4, 12);
        material = new THREE.MeshPhongMaterial({ color: 0x5d4037 });
    } else { // Tire
        geometry = new THREE.TorusGeometry(0.5, 0.2, 10, 20);
        material = new THREE.MeshPhongMaterial({ color: 0x333333 });
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.z = Math.PI / 2;
    if (type >= 0.5) mesh.rotation.x = Math.PI / 2; // Tires stand up

    mesh.position.set((Math.random() - 0.5) * 30, 0.3, z);
    mesh.userData = { 
        speed: 0.04 + Math.random() * 0.06, 
        direction: z % 8 === 0 ? 1 : -1 
    };
    
    scene.add(mesh);
    obstacles.push(mesh);
}

lanes.forEach(z => {
    for(let i=0; i<3; i++) createObstacle(z);
});

// --- 7. INPUT & WIN/LOSS LOGIC ---
function resetPlayer() {
    if (player) {
        player.position.set(0, 0.5, 6);
    }
}

window.addEventListener('keydown', (e) => {
    if (!gameStarted || !player) return;

    const step = 2;
    if (e.key === "ArrowUp") player.position.z -= step;
    if (e.key === "ArrowDown") player.position.z += step;
    if (e.key === "ArrowLeft") player.position.x -= step;
    if (e.key === "ArrowRight") player.position.x += step;

    // Check Win
    if (player.position.z <= -32) {
        alert("You reached the Trophy! 🏆✨");
        resetPlayer();
    }
});

document.getElementById('start-button').addEventListener('click', () => {
    gameStarted = true;
    document.getElementById('overlay').style.display = 'none';
});

// --- 8. THE GAME LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);

    trophyGroup.rotation.y += 0.03;

    let onPlatform = false;

    obstacles.forEach(obj => {
        // Move obstacles
        obj.position.x += obj.userData.speed * obj.userData.direction;
        if (obj.position.x > 25) obj.position.x = -25;
        if (obj.position.x < -25) obj.position.x = 25;

        // Stick to platform logic
        if (player) {
            const dx = Math.abs(player.position.x - obj.position.x);
            const dz = Math.abs(player.position.z - obj.position.z);
            if (dz < 1.0 && dx < 2.2) {
                player.position.x += obj.userData.speed * obj.userData.direction;
                onPlatform = true;
            }
        }
    });

    // Water Check
    if (player && player.position.z < 3 && player.position.z > -31) {
        if (!onPlatform) {
            splashSound.currentTime = 0;
            splashSound.play();
            resetPlayer();
        }
    }

    // Camera follow (slight)
    if (player) {
        camera.position.x = player.position.x * 0.5;
        camera.position.z = player.position.z + 10;
    }

    renderer.render(scene, camera);
}

animate();

// Handle Window Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});