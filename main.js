// --- 5. PLAYER LOAD (WITH AUTOMATIC RESIZING & MATERIAL FIX) ---
const loader = new GLTFLoader();

loader.load('assets/Chicken.glb', (gltf) => {
    player = gltf.scene;

    // REDUCE SIZE: Set to 0.3 or 0.2 if 0.8 was way too large
    player.scale.set(0.25, 0.25, 0.25); 
    player.position.set(0, 0, 6);
    
    // MATERIAL FIXER: This removes the "black mask" look
    player.traverse((node) => {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            
            // If the chicken is black, this forces it to use standard lighting
            if (node.material) {
                node.material.metalness = 0; // High metalness can make models look black
                node.material.roughness = 0.8;
                // Ensure the material isn't stuck on a "Basic" black color
                if (node.material.color.getHex() === 0x000000) {
                    node.material.color.setHex(0xffffff); // Force to white/natural if it's pure black
                }
            }
        }
    });

    scene.add(player);

    if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(player);
        mixer.clipAction(gltf.animations[0]).play();
    }
}, undefined, (error) => {
    console.warn("Chicken.glb failed to load correctly.");
    createDefaultPlayer();
});
