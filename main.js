import * as THREE from 'three';
import { GLTFLoader } from 'https://unpkg.com/three@0.155.0/examples/jsm/loaders/GLTFLoader.js';

// --- 1. CONFIGURATION ---
const GRID_SIZE = 2; 
const LANES = [
    { type: 'grass', z: 6 },
    { type: 'road',  z: 4 },
    { type: 'road',  z: 2 },
    { type: 'grass', z: 0 },
    { type: 'water', z: -2 },
    { type: 'water', z: -4 },
    { type: 'grass', z: -6 },
    { type: 'road',  z: -8 },
    { type: 'water', z: -10 },
    { type: 'grass', z: -12 },
    { type: 'trophy', z: -16 }
];

let gameStarted = false;
let player = null;
let mixer = null;
let isDead = false;
const clock = new THREE.Clock();

const splashSound = new Audio('assets/splash.mp3');
const crashSound = new Audio('https://actions.google.com/sounds/v1/impacts/crash_metal.ogg');

// --- 2. SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 18, 12); 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// --- 3. LIGHTING (Enhanced for definition) ---
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

// Kirby Spotlight (Follows Kirby to ensure he is never invisible)
const spotLight = new THREE.SpotLight(0xffffff, 10);
spotLight.angle = Math.PI / 6;
spotLight.penumbra = 0.5;
scene.add(spotLight);

// --- 4. HIGH-DEF VEHICLE FACTORY ---
function createVehicle(z, direction) {
    const group = new THREE.Group();
    const type = Math.random();
    const colors = [0xd32f2f, 0x1976d2, 0x388e3c, 0xfbc02d];
    const carMat = new THREE.MeshStandardMaterial({ color: colors[Math.floor(Math.random()*4)], roughness: 0.2, metalness: 0.3 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x222222 });

    if (type < 0.4) { // Sedan
        const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 1.4), carMat);
        b.position.y = 0.4; group.add(b);
        const c = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1.2), glassMat);
        c.position.set(-0.2, 0.9, 0); group.add(c);
    } else if (type < 0.7) { // SUV
        const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 1.4), carMat);
        b.position.y = 0.5; group.add(b);
        const t = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 1.3), glassMat);
        t.position.set(-0.1, 1.1, 0); group.add(t);
    } else { // Semi Truck
        const cab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 1.5), carMat);
        cab.position.set(1.2, 0.8, 0); group.add(cab);
        const cargo = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.0, 1.5), new THREE.MeshStandardMaterial({color: 0xeeeeee}));
        cargo.position.set(-1.4, 1.0, 0); group.add(cargo);
    }

    const wheelGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 16);
    [[1, 0.3, 0.7], [1, 0.3, -0.7], [-1, 0.3, 0.7], [-1, 0.3, -0.7]].forEach(p => {
        const w = new THREE.Mesh(wheelGeom, new THREE.MeshStandardMaterial({color: 0x111111}));
        w.rotation.x = Math.PI/2; w.position.set(p[0], p[1], p[2]);
        group.add(w);
    });

    group.position.set(Math.random() * 40 - 20, 0, z);
    if (direction < 0) group.rotation.y = Math.PI;
    group.userData = { speed: 0.08 + Math.random() * 0.1, direction, type: 'car' };
    group.traverse(n => { if(n.isMesh) n.castShadow = true; });
    scene.add(group);
    return group;
}

function createRealisticLog(z, direction) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 4, 16), new THREE.MeshStandardMaterial({ color: 0x5d4037 }));
    log.rotation.z = Math.PI / 2;
    log.position.set(Math.random() * 40 - 20, 0.3, z);
    log.userData = { speed: 0.04 + Math.random() * 0.05, direction, type: 'log' };
    log.castShadow = true;
    scene.add(log);
    return log;
}

// --- 5. WORLD GEN ---
const obstacles = [];
LANES.forEach(lane => {
    const color = lane.type === 'grass' ? 0x2ecc71 : (lane.type === 'water' ? 0x0077be : 0x222222);
    const ground = new THREE.Mesh(new THREE.BoxGeometry(60, 1, GRID_SIZE), new THREE.MeshStandardMaterial({ color }));
    ground.position.set(0, -0.5, lane.z);
    ground.receiveShadow = true;
    scene.add(ground);
    const dir = Math.random() > 0.5 ? 1 : -1;
    if (lane.type === 'water') for (let i=0; i<4; i++) obstacles.push(createRealisticLog(lane.z, dir));
    else if (lane.type === 'road') for (let i=0; i<2; i++) obstacles.push(createVehicle(lane.z, dir));
});

// --- 6. KIRBY LOAD & POSITION FIX ---
const loader = new GLTFLoader();
loader.load('assets/Kirby.glb', (gltf) => {
    player = gltf.scene;
    player.scale.set(0.05, 0.05, 0.05); 
    
    // Position Fix (Shifted left and up to center him)
    player.position.set(-1.5, 0.8, 6); 

    player.traverse((node) => {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            // Material Override to ensure visibility
            node.material.metalness = 0;
            node.material.roughness = 0.5;
            node.material.transparent = false;
            node.material.opacity = 1;
        }
    });

    scene.add(player);
    if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(player);
        mixer.clipAction(gltf.animations[0]).play();
    }
}, undefined, (error) => { console.error("Load Error:", error); });

// --- 7. LOGIC ---
function reset() { if(player) player.position.set(-1.5, 0.8, 6); }

window.addEventListener('keydown', (e) => {
    if (!gameStarted || !player || isDead) return;
    if (e.key === "ArrowUp") player.position.z -= GRID_SIZE;
    if (e.key === "ArrowDown") player.position.z += GRID_SIZE;
    if (e.key === "ArrowLeft") player.position.x -= GRID_SIZE;
    if (e.key === "ArrowRight") player.position.x += GRID_SIZE;
});

document.getElementById('start-button').addEventListener('click', () => {
    gameStarted = true;
    document.getElementById('overlay').style.display = 'none';
});

// --- 8. ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);

    if (player && gameStarted) {
        // Spotlight follows Kirby so he's never in the dark
        spotLight.position.set(player.position.x, 10, player.position.z + 5);
        spotLight.target = player;

        const lane = LANES.find(l => Math.abs(l.z - player.position.z) < 0.5);
        let onLog = false;

        obstacles.forEach(obj => {
            obj.position.x += obj.userData.speed * obj.userData.direction;
            if (obj.position.x > 30) obj.position.x = -30;
            if (obj.position.x < -30) obj.position.x = 30;

            const dx = Math.abs(player.position.x - obj.position.x);
            const dz = Math.abs(player.position.z - obj.position.z);

            if (dz < 0.9 && !isDead) {
                if (obj.userData.type === 'car' && dx < 2.5) { crashSound.play(); reset(); }
                if (obj.userData.type === 'log' && dx < 2.2) { 
                    onLog = true; player.position.x += obj.userData.speed * obj.userData.direction; 
                }
            }
        });
        if (lane && lane.type === 'water' && !onLog) { splashSound.play(); reset(); }

        camera.position.z = player.position.z + 10;
        camera.lookAt(0, 0, player.position.z - 5);
    }
    renderer.render(scene, camera);
}
animate();
