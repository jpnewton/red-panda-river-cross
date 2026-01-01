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

// --- 3. HIGH-DEF LIGHTING ---
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0); // Sky light
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5); // Sun light
dirLight.position.set(5, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
scene.add(dirLight);

// --- 4. ADVANCED CAR GENERATION (EXTRUSION) ---
function createCarShape() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(2.4, 0);   // Bottom
    shape.lineTo(2.4, 0.3); // Rear Bumper
    shape.lineTo(2.0, 0.3); 
    shape.lineTo(1.7, 0.9); // Rear Window
    shape.lineTo(0.8, 0.9); // Roof
    shape.lineTo(0.5, 0.4); // Windshield
    shape.lineTo(0.0, 0.3); // Hood
    return shape;
}

function createVehicle(z, direction) {
    const group = new THREE.Group();
    
    // 1. Create Aerodynamic Body
    const extrudeSettings = { steps: 1, depth: 1.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 };
    const carColor = [0xd32f2f, 0x1976d2, 0x2e7d32, 0xf9a825][Math.floor(Math.random() * 4)];
    const bodyMat = new THREE.MeshStandardMaterial({ color: carColor, roughness: 0.2, metalness: 0.5 });
    
    const geometry = new THREE.ExtrudeGeometry(createCarShape(), extrudeSettings);
    const body = new THREE.Mesh(geometry, bodyMat);
    
    // Center the geometry
    geometry.center(); 
    body.position.y = 0.5;
    group.add(body);

    // 2. Add Wheels
    const wheelGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.3, 24);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const positions = [[0.8, 0.3, 0.6], [0.8, 0.3, -0.6], [-0.8, 0.3, 0.6], [-0.8, 0.3, -0.6]];
    positions.forEach(pos => {
        const w = new THREE.Mesh(wheelGeom, wheelMat);
        w.rotation.x =
