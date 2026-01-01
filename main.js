// --- 6. KIRBY "RE-CENTERED" LOAD ---
const loader = new GLTFLoader();
loader.load('assets/Kirby.glb', (gltf) => {
    player = gltf.scene;

    // --- NEW: RE-CENTER GEOMETRY FIX ---
    // This looks at all the parts of the model and forces them to be centered at (0,0,0)
    const box = new THREE.Box3().setFromObject(player);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Shift the internal model parts so the "center" is actually (0,0,0)
    player.traverse((node) => {
        if (node.isMesh) {
            // Re-align the mesh so the bottom of Kirby sits at Y = 0
            node.position.x -= center.x;
            node.position.y -= (center.y - size.y / 2); 
            node.position.z -= center.z;

            // Material Fix
            const oldTexture = node.material.map;
            node.material = new THREE.MeshToonMaterial({
                map: oldTexture,
                color: oldTexture ? 0xffffff : 0xffb6c1,
                side: THREE.DoubleSide
            });
            node.castShadow = true;
        }
    });

    // AUTO-SCALE to 1.5 units wide
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 1.5 / maxDim;
    player.scale.set(scale, scale, scale);

    // Set the Starting Position
    player.position.set(0, 0, 6); 
    scene.add(player);
    
    if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(player);
        mixer.clipAction(gltf.animations[0]).play();
    }
    console.log("Kirby re-centered and grounded.");
}, undefined, (error) => {
    console.error("Load Error:", error);
});

// --- 7. LOGIC ---
function reset() { 
    if(player) {
        player.position.set(0, 0, 6); // Reset exactly to the start lane center
    }
}
