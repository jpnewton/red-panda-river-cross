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

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 18, 12); 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

// --- 2. THE SPLAT EFFECT ---
const splatGeom = new THREE.CircleGeometry(1.5, 32);
const splatMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0 });
const splat = new THREE.Mesh(splatGeom, splatMat);
splat.rotation.x = -Math.PI / 2;
splat.position.y = 0.05;
scene.add(splat);

function triggerSplat(pos) {
    splat.position.x = pos.x;
    splat.position.z = pos.z;
    splat.material.opacity = 1;
    setTimeout(() => {
        const fade = setInterval(() => {
            splat.material.opacity -= 0.1;
            if (splat.material.opacity <= 0) clearInterval(fade);
        }, 50);
    }, 1000);
}

// --- 3. VEHICLE FACTORY ---
function createVehicle(z, direction) {
    const group = new THREE.Group();
    const type = Math.random();
    const colors = [0xd32f2f, 0x1976d2, 0x388e3c, 0xfbc02d, 0x7b1fa2];
    const bodyMat = new THREE.MeshPhongMaterial({ color: colors[Math.floor(Math.random()*colors.length)] });
    const glassMat = new THREE.MeshPhongMaterial({ color: 0x222222 });
    const tireMat = new THREE.MeshPhongMaterial({ color: 0x111111 });

    if (type < 0.4) { // Sedan
        const base = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.5, 1.2), bodyMat);
        base.position.y = 0.4;
        group.add(base);
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.1), glassMat);
        cabin.position.set(-0.2, 0.9, 0);
        group.add(cabin);
    } else if (type < 0.7) { // SUV
        const base = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.8, 1.3), bodyMat);
        base.position.y = 0.5;
        group.add(base);
        const top = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 1.2), glassMat);
        top.position.set(-0.2, 1.1, 0);
        group.add(top);
    } else { // Truck
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 1.4), bodyMat);
        cabin.position.set(1, 0.9, 0);
        group.add(cabin);
        const cargo = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.8, 1.4), new THREE.MeshPhongMaterial({color: 0xeeeeee}));
        cargo.position.set(-1.4, 1.0, 0);
        group.add(cargo);
    }

    const wheelGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.3, 16);
    [[1, 0.3, 0.6], [1, 0.3, -0.6], [-1, 0.3, 0.6], [-1, 0.3, -0.6]].forEach(pos => {
        const w = new THREE.Mesh(wheelGeom, tireMat);
        w.rotation.x = Math.PI/2;
        w.position.set(pos[0], pos[1], pos[2]);
        group.add(w);
    });

    const speed = 0.08 + Math.random() * 0.1; 
    group.position.set(Math.random() * 60 - 30, 0, z);
    if (direction < 0) group.rotation.y = Math.PI;
    group.userData = { speed, direction, type: 'car' };
    scene.add(group);
    return group;
}

function createRealisticLog(z, direction) {
    const group = new THREE.Group();
    const log = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.6, 4, 12),
        new THREE.MeshPhongMaterial({ color: 0x5d4037 })
    );
    log.rotation.z = Math.PI / 2;
    log.position.y = 0.3;
    group.add(log);
    
    const speed = 0.04 + Math.random() * 0.05; 
    
    group.position.set(Math.random() * 60 - 30, 0, z);
    group.userData = { speed, direction, type: 'log' };
    scene.add(group);
    return group;
}

// --- 4. WORLD GENERATION ---
const obstacles = [];
LANES.forEach(lane => {
    const color = lane.type === 'grass' ? 0x2ecc71 : (lane.type === 'water' ? 0x0077be : 0x222222);
    const ground = new THREE.Mesh(new THREE.BoxGeometry(60, 1, GRID_SIZE), new THREE.MeshPhongMaterial({ color }));
    ground.position.set(0, -0.5, lane.z);
    scene.add(ground);

    const direction = Math.random() > 0.5 ? 1 : -1;

    if (lane.type === 'water') {
        for (let i = 0; i < 4; i++) {
            obstacles.push(createRealisticLog(lane.z, direction));
        }
    } else if (lane.type === 'road') {
        for (let i = 0; i < 2; i++) {
            obstacles.push(createVehicle(lane.z, direction));
        }
    }
});

const trophy = new THREE.Mesh(new THREE.TorusKnotGeometry(0.5, 0.2, 64, 8), new THREE.MeshPhongMaterial({ color: 0xffd700 }));
trophy.position.set(0, 1, -16);
scene.add(trophy);

// --- 5. PLAYER & COLLISION (CHICKEN UPDATE) ---
const loader = new GLTFLoader();
// Updated to load Chicken.glb
loader.load('assets/Chicken.glb', (gltf) => {
    player = gltf.scene;
    // Adjust scale: Chickens are usually smaller than foxes in 3D files
    player.scale.set(0.8, 0.8, 0.8); 
    player.position.set(0, 0, 6);
    scene.add(player);
    if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(player);
        mixer.clipAction(gltf.animations[0]).play();
    }
}, undefined, (error) => {
    console.error("Error loading Chicken.glb. Make sure the file is in the assets folder.", error);
});

function handleCollision(type) {
    if (isDead) return;
    isDead = true;
    if (type === 'car') {
        crashSound.play();
        triggerSplat(player.position);
        player.traverse(n => { if(n.isMesh) { 
            n.material.emissive = new THREE.Color(0xff0000); 
            n.material.emissiveIntensity = 2; 
        }});
        setTimeout(() => {
            player.traverse(n => { if(n.isMesh) n.material.emissive.setHex(0x000000); });
            reset();
            isDead = false;
        }, 800);
    } else { splashSound.play(); reset(); isDead = false; }
}

function reset() { player.position.set(0, 0, 6); }

window.addEventListener('keydown', (e) => {
    if (!gameStarted || !player || isDead) return;
    if (e.key === "ArrowUp") player.position.z -= GRID_SIZE;
    if (e.key === "ArrowDown") player.position.z += GRID_SIZE;
    if (e.key === "ArrowLeft") player.position.x -= GRID_SIZE;
    if (e.key === "ArrowRight") player.position.x += GRID_SIZE;
    if (player.position.z <= -16) { alert("The Chicken made it!"); reset(); }
});

document.getElementById('start-button').addEventListener('click', () => {
    gameStarted = true;
    document.getElementById('overlay').style.display = 'none';
});

// --- 6. GAME LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    trophy.rotation.y += 0.02;

    let onLog = false;
    if (player) {
        const lane = LANES.find(l => Math.abs(l.z - player.position.z) < 0.5);
        obstacles.forEach(obj => {
            obj.position.x += obj.userData.speed * obj.userData.direction;
            if (obj.position.x > 30) obj.position.x = -30;
            if (obj.position.x < -30) obj.position.x = 30;

            const dx = Math.abs(player.position.x - obj.position.x);
            const dz = Math.abs(player.position.z - obj.position.z);

            if (dz < 0.9 && !isDead) {
                if (obj.userData.type === 'car' && dx < 2.5) handleCollision('car');
                if (obj.userData.type === 'log' && dx < 2.2) { 
                    onLog = true; 
                    player.position.x += obj.userData.speed * obj.userData.direction; 
                }
            }
        });
        if (lane && lane.type === 'water' && !onLog && !isDead) handleCollision('water');

        camera.position.z = player.position.z + 10;
        camera.position.x = 0;
        camera.lookAt(0, 0, player.position.z - 5);

        if (isDead) {
            camera.position.x += (Math.random()-0.5) * 0.8;
            camera.position.y += (Math.random()-0.5) * 0.8;
        } else {
            camera.position.y = 18;
        }
    }
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize',
