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
let isDead = false; // New state to prevent multiple hits
const clock = new THREE.Clock();

const splashSound = new Audio('assets/splash.mp3');
const crashSound = new Audio('https://actions.google.com/sounds/v1/impacts/crash_metal.ogg');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 15, 15); 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

// --- 2. DETAILED MODELS ---
function createRealisticCar(z, speed, direction) {
    const group = new THREE.Group();
    const carColor = [0xff4444, 0x3333ff, 0x222222, 0xffffff][Math.floor(Math.random()*4)];
    const bodyMat = new THREE.MeshPhongMaterial({ color: carColor });
    const glassMat = new THREE.MeshPhongMaterial({ color: 0x88ccff, transparent: true, opacity: 0.6 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.6, 1.5), bodyMat);
    body.position.y = 0.5;
    group.add(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 1.3), glassMat);
    cabin.position.set(-0.2, 1.0, 0);
    group.add(cabin);

    const wheels = [[1, 0.35, 0.7], [1, 0.35, -0.7], [-1, 0.35, 0.7], [-1, 0.35, -0.7]];
    wheels.forEach(pos => {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.3, 16), new THREE.MeshPhongMaterial({color: 0x111111}));
        w.rotation.x = Math.PI / 2;
        w.position.set(pos[0], pos[1], pos[2]);
        group.add(w);
    });

    group.position.set(Math.random() * 40 - 20, 0, z);
    if (direction < 0) group.rotation.y = Math.PI;
    group.userData = { speed, direction, type: 'car' };
    return group;
}

function createTire(z, speed, direction) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.25, 12, 24), new THREE.MeshPhongMaterial({ color: 0x111111 }));
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(Math.random() * 40 - 20, 0.1, z);
    mesh.userData = { speed, direction, type: 'tire' };
    return mesh;
}

function createRealisticLog(z, speed, direction) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 4, 12), new THREE.MeshPhongMaterial({ color: 0x5d4037 }));
    log.rotation.z = Math.PI / 2;
    log.position.set(Math.random() * 40 - 20, 0.3, z);
    log.userData = { speed, direction, type: 'log' };
    return log;
}

// --- 3. WORLD GENERATION ---
const obstacles = [];
LANES.forEach(lane => {
    const color = lane.type === 'grass' ? 0x2ecc71 : (lane.type === 'water' ? 0x0077be : 0x222222);
    const ground = new THREE.Mesh(new THREE.BoxGeometry(60, 1, GRID_SIZE), new THREE.MeshPhongMaterial({ color }));
    ground.position.set(0, -0.5, lane.z);
    scene.add(ground);

    const speed = 0.06 + Math.random() * 0.04;
    const direction = Math.random() > 0.5 ? 1 : -1;

    if (lane.type === 'water') {
        for (let i = 0; i < 4; i++) {
            const obj = Math.random() > 0.4 ? createRealisticLog(lane.z, speed, direction) : createTire(lane.z, speed, direction);
            obstacles.push(obj); scene.add(obj);
        }
    } else if (lane.type === 'road') {
        for (let i = 0; i < 2; i++) {
            const car = createRealisticCar(lane.z, speed * 1.8, direction);
            obstacles.push(car); scene.add(car);
        }
    }
});

const trophy = new THREE.Mesh(new THREE.TorusKnotGeometry(0.5, 0.2, 64, 8), new THREE.MeshPhongMaterial({ color: 0xffd700 }));
trophy.position.set(0, 1, -16);
scene.add(trophy);

// --- 4. PLAYER & HIT EFFECTS ---
const loader = new GLTFLoader();
loader.load('assets/foxpacked.glb', (gltf) => {
    player = gltf.scene;
    player.scale.set(0.6, 0.6, 0.6);
    player.position.set(0, 0, 6);
    scene.add(player);
    if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(player);
        mixer.clipAction(gltf.animations[0]).play();
    }
});

function handleCollision(type) {
    if (isDead) return;
    isDead = true;

    if (type === 'car') {
        crashSound.play();
        // 1. Red Flash Effect
        player.traverse(node => {
            if (node.isMesh) node.material.emissive.setHex(0xff0000);
        });
        
        // 2. Short Delay before reset
        setTimeout(() => {
            player.traverse(node => {
                if (node.isMesh) node.material.emissive.setHex(0x000000);
            });
            reset();
            isDead = false;
        }, 500);
    } else {
        splashSound.play();
        reset();
        isDead = false;
    }
}

function reset() { player.position.set(0, 0, 6); }

window.addEventListener('keydown', (e) => {
    if (!gameStarted || !player || isDead) return;
    if (e.key === "ArrowUp") player.position.z -= GRID_SIZE;
    if (e.key === "ArrowDown") player.position.z += GRID_SIZE;
    if (e.key === "ArrowLeft") player.position.x -= GRID_SIZE;
    if (e.key === "ArrowRight") player.position.x += GRID_SIZE;
    if (player.position.z <= -16) { alert("Goal!"); reset(); }
});

document.getElementById('start-button').addEventListener('click', () => {
    gameStarted = true;
    document.getElementById('overlay').style.display = 'none';
});

// --- 5. GAME LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    trophy.rotation.y += 0.02;

    let onPlatform = false;

    if (player) {
        const lane = LANES.find(l => Math.abs(l.z - player.position.z) < 0.5);
        
        obstacles.forEach(obj => {
            obj.position.x += obj.userData.speed * obj.userData.direction;
            if (obj.position.x > 25) obj.position.x = -25;
            if (obj.position.x < -25) obj.position.x = 25;

            const dx = Math.abs(player.position.x - obj.position.x);
            const dz = Math.abs(player.position.z - obj.position.z);

            if (dz < 0.9 && !isDead) {
                if (obj.userData.type === 'car' && dx < 2.5) {
                    handleCollision('car');
                }
                if ((obj.userData.type === 'log' && dx < 2.2) || (obj.userData.type === 'tire' && dx < 1.0)) {
                    onPlatform = true;
                    player.position.x += obj.userData.speed * obj.userData.direction;
                }
            }
        });

        if (lane && lane.type === 'water' && !onPlatform && !isDead) {
            handleCollision('water');
        }

        // Camera Logic
        camera.position.z = player.position.z + 12;
        // Screen Shake Effect when dead
        if (isDead) {
            camera.position.x = (Math.random() - 0.5) * 0.5;
            camera.position.y = 15 + (Math.random() - 0.5) * 0.5;
        } else {
            camera.position.x = 0;
            camera.position.y = 15;
        }
        camera.lookAt(player.position.x, 0, player.position.z);
    }
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
