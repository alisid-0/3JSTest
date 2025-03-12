import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

class Game {
    constructor() {
        // Initialize limb references first
        this.leftLeg = null;
        this.rightLeg = null;
        this.leftArm = null;
        this.rightArm = null;
        this.rightHand = null;
        this.torso = null;

        // Scene setup
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87CEEB); // Sky blue color
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        // Create katana first
        this.katana = this.createKatana();

        // Then create character
        this.character = this.createCharacter();
        
        // Debug log after character creation
        console.log('After character creation:', {
            leftLeg: this.leftLeg,
            rightLeg: this.rightLeg,
            leftArm: this.leftArm,
            rightArm: this.rightArm
        });
        
        console.log('Character group matrix:', this.character.matrix.elements);
        this.character.updateMatrixWorld(true); // Force matrix update
        console.log('Character world matrix:', this.character.matrixWorld.elements);
        
        this.scene.add(this.character);
        // Make character face away from camera by default
        this.character.rotation.y = Math.PI;

        // Beach environment
        this.createBeachEnvironment();

        // Camera setup
        this.camera.position.set(0, 5, 10);
        this.camera.lookAt(0, 0, 0);

        // OrbitControls setup
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 15;
        this.controls.maxPolarAngle = Math.PI / 2;

        // Physics
        this.velocity = new THREE.Vector3();
        this.gravity = -0.0015;  // Reduced from -0.005 for longer hang time
        this.jumpForce = 0.12;  // Adjusted first jump force
        this.doubleJumpForce = 0.10;  // Adjusted second jump force
        this.dashForce = 1.2;
        this.slideForce = 0.8;
        this.isGrounded = true;
        this.groundLevel = 0;
        this.friction = 0.95;
        this.airFriction = 0.99;
        this.isSliding = false;
        this.canSlide = true;
        this.slideCooldown = 0;
        this.canDash = true;
        this.dashCooldown = 0;
        this.isWallRunning = false;
        this.canJump = true;
        this.jumpCooldown = 0;
        this.hasDoubleJump = true;  // Track if double jump is available
        this.isRolling = false;     // Track if doing aerial roll
        this.rollTime = 0;          // Track roll animation progress
        this.rollDuration = 0.5;    // Roll animation duration in seconds

        // Movement constants
        this.maxWalkSpeed = 0.03;      // Very slow walk
        this.maxRunSpeed = 0.06;       // Very slow run
        this.acceleration = 0.01;
        this.deceleration = 0.95;
        this.airControl = 0.4;

        // Combat
        this.katanaBaseRotation = new THREE.Euler(0, 0, Math.PI / 4);
        this.isAttacking = false;
        this.comboCount = 0;
        this.lastAttackTime = 0;
        this.comboResetTime = 800;
        this.attackAnimations = {
            light1: { duration: 150, damage: 10 },
            light2: { duration: 150, damage: 15 },
            light3: { duration: 200, damage: 20 },
            heavy: { duration: 300, damage: 30 },
            aerial: { duration: 200, damage: 25 }
        };
        this.currentAnimation = null;
        this.attackDirection = new THREE.Vector3();
        this.attackMomentum = 0.5;

        // Movement
        this.moveDirection = new THREE.Vector3();
        this.rotationAngle = 0;

        // Animation
        this.clock = new THREE.Clock();
        this.walkingSpeed = 0;

        // Movement states and properties
        this.moveSpeed = 0.15;
        this.sprintSpeed = 0.25;
        this.slideSpeed = 0.35;
        this.momentum = new THREE.Vector3();
        this.slideTime = 0;
        this.maxSlideTime = 0.8; // Slightly shorter slide
        this.maxSlideCooldown = 0.3; // Shorter cooldown
        this.characterState = 'idle'; // Track animation state

        // Setup basic movement controls
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            shift: false,
            ctrl: false  // slide key
        };

        // Debug log before setting up controls
        console.log('Before setting up controls:', {
            leftLeg: this.leftLeg,
            rightLeg: this.rightLeg,
            leftArm: this.leftArm,
            rightArm: this.rightArm
        });

        // Setup keyboard controls
        document.addEventListener('keydown', (event) => {
            switch(event.code) {
                case 'KeyW': this.keys.forward = true; break;
                case 'KeyS': this.keys.backward = true; break;
                case 'KeyA': this.keys.left = true; break;
                case 'KeyD': this.keys.right = true; break;
                case 'KeyE': // Add dash on E key press
                    if (this.canDash) {
                        this.performDash();
                    }
                    break;
                case 'Space':
                    if (this.isGrounded && this.canJump) {
                        // First jump
                        this.velocity.y = this.jumpForce;
                        this.isGrounded = false;
                        this.canJump = false;
                        this.jumpCooldown = 0.2;
                        this.hasDoubleJump = true;  // Reset double jump availability
                    } else if (!this.isGrounded && this.hasDoubleJump && !this.isRolling) {
                        // Double jump with roll
                        this.velocity.y = this.doubleJumpForce;
                        this.hasDoubleJump = false;
                        this.isRolling = true;
                        this.rollTime = 0;
                    }
                    break;
                case 'ShiftLeft': 
                case 'ShiftRight': 
                    this.keys.shift = true; 
                    break;
                case 'ControlLeft':
                    if (this.canSlide && !this.isSliding && this.keys.shift) {
                        this.startSlide();
                    }
                    this.keys.ctrl = true;
                    break;
            }
        });

        document.addEventListener('keyup', (event) => {
            switch(event.code) {
                case 'KeyW': this.keys.forward = false; break;
                case 'KeyS': this.keys.backward = false; break;
                case 'KeyA': this.keys.left = false; break;
                case 'KeyD': this.keys.right = false; break;
                case 'ShiftLeft': 
                case 'ShiftRight': 
                    this.keys.shift = false; 
                    break;
                case 'ControlLeft':
                    this.keys.ctrl = false;
                    if (this.isSliding) {
                        this.cancelSlide();
                    }
                    break;
            }
        });

        // Animation loop
        this.animate();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);

        // Final debug log
        console.log('End of constructor:', {
            leftLeg: this.leftLeg,
            rightLeg: this.rightLeg,
            leftArm: this.leftArm,
            rightArm: this.rightArm
        });
    }

    createCharacter() {
        const character = new THREE.Group();
        
        // Define proportions based on total height of 2 units
        const proportions = {
            totalHeight: 2.0,
            legHeight: 1.0,             // Half of total height
            torsoHeight: 0.75,          // 3/8 of total height
            headRadius: 0.15,           // Head size
            shoulderWidth: 0.5,         // Shoulder width
            hipWidth: 0.33,             // Hip width
            thighLength: 0.55,          // Upper leg length
            shinLength: 0.45,           // Lower leg length
            kneeRadius: 0.08            // Size of knee joint
        };

        // Create torso group
        const torsoGroup = new THREE.Group();
        
        // Upper torso (chest)
        const upperTorso = new THREE.Mesh(
            new THREE.BoxGeometry(
                proportions.shoulderWidth,
                proportions.torsoHeight * 0.55,
                proportions.depth || 0.25
            ),
            new THREE.MeshStandardMaterial({ color: 0x2c3e50 })
        );
        upperTorso.position.y = proportions.torsoHeight * 0.225;
        upperTorso.castShadow = true;  // Enable shadow casting
        torsoGroup.add(upperTorso);

        // Create weapon socket on the back
        const backSocket = new THREE.Group();
        backSocket.name = 'weaponSocketBack';
        backSocket.position.set(0, proportions.torsoHeight * 0.3, -0.2); // Positioned on the upper back
        backSocket.rotation.x = -Math.PI * 0.25; // Angle the weapon slightly
        torsoGroup.add(backSocket);
        this.backSocket = backSocket;

        // Lower torso (abdomen)
        const lowerTorso = new THREE.Mesh(
            new THREE.BoxGeometry(
                proportions.hipWidth,
                proportions.torsoHeight * 0.45,
                proportions.depth || 0.25
            ),
            new THREE.MeshStandardMaterial({ color: 0x2c3e50 })
        );
        lowerTorso.position.y = -proportions.torsoHeight * 0.225;
        lowerTorso.castShadow = true;  // Enable shadow casting
        torsoGroup.add(lowerTorso);

        // Position torso
        torsoGroup.position.y = proportions.legHeight;

        // Create legs with knees
        const createLeg = (isLeft) => {
            const legGroup = new THREE.Group();
            
            // Upper leg (thigh)
            const thighGroup = new THREE.Group();
            const thigh = new THREE.Mesh(
                new THREE.CylinderGeometry(0.1, 0.08, proportions.thighLength, 8),
                new THREE.MeshStandardMaterial({ color: 0x2c3e50 })
            );
            thigh.position.y = -proportions.thighLength/2;
            thigh.castShadow = true;  // Enable shadow casting
            thighGroup.add(thigh);

            // Knee joint
            const knee = new THREE.Mesh(
                new THREE.SphereGeometry(proportions.kneeRadius, 8, 8),
                new THREE.MeshStandardMaterial({ color: 0x2c3e50 })
            );
            knee.position.y = -proportions.thighLength;
            knee.castShadow = true;  // Enable shadow casting
            thighGroup.add(knee);

            // Lower leg (shin)
            const shinGroup = new THREE.Group();
            const shin = new THREE.Mesh(
                new THREE.CylinderGeometry(0.08, 0.06, proportions.shinLength, 8),
                new THREE.MeshStandardMaterial({ color: 0x2c3e50 })
            );
            shin.position.y = -proportions.shinLength/2;
            shin.castShadow = true;  // Enable shadow casting
            shinGroup.add(shin);

            // Position shin group at knee
            shinGroup.position.y = -proportions.thighLength;
            thighGroup.add(shinGroup);

            // Add references for animation
            if (isLeft) {
                this.leftThigh = thighGroup;
                this.leftShin = shinGroup;
                this.leftKnee = knee;
            } else {
                this.rightThigh = thighGroup;
                this.rightShin = shinGroup;
                this.rightKnee = knee;
            }

            // Position entire leg
            legGroup.add(thighGroup);
            legGroup.position.y = proportions.legHeight;
            legGroup.position.x = isLeft ? -proportions.hipWidth/3 : proportions.hipWidth/3;
            
            return legGroup;
        };

        // Create and add legs
        const leftLeg = createLeg(true);
        const rightLeg = createLeg(false);
        character.add(leftLeg);
        character.add(rightLeg);

        // Create arms (existing code...)
        const createArm = (isLeft) => {
            const arm = new THREE.Group();
            
            // Upper arm
            const upperArm = new THREE.Mesh(
                new THREE.CylinderGeometry(0.08, 0.07, proportions.torsoHeight * 0.6),
                new THREE.MeshStandardMaterial({ color: 0x2c3e50 })
            );
            upperArm.position.y = -proportions.torsoHeight * 0.3;
            upperArm.castShadow = true;
            arm.add(upperArm);

            // Forearm
            const forearm = new THREE.Mesh(
                new THREE.CylinderGeometry(0.07, 0.06, proportions.torsoHeight * 0.5),
                new THREE.MeshStandardMaterial({ color: isLeft ? 0xffdbac : 0x00FF00 }) // Right arm green, left arm skin colored
            );
            forearm.position.y = -proportions.torsoHeight * 0.85;
            forearm.castShadow = true;
            arm.add(forearm);

            // Add weapon socket ONLY to right arm
            if (isLeft) {  // This is the left arm
                const handSocket = new THREE.Group();
                handSocket.name = 'weaponSocketHand';
                // Add visible debug sphere to socket
                const socketDebug = new THREE.Mesh(
                    new THREE.SphereGeometry(0.05, 8, 8),
                    new THREE.MeshBasicMaterial({ color: 0xFF0000 })
                );
                handSocket.add(socketDebug);
                // Position socket at the end of the right forearm
                handSocket.position.set(0, -proportions.torsoHeight * 0.1, 0);
                handSocket.rotation.set(1.5, 0, -0.5);
                forearm.add(handSocket);  // Attach to forearm
                this.handSocket = handSocket;
            }

            // Position the entire arm relative to the torso
            arm.position.y = proportions.torsoHeight * 0.5;
            arm.position.x = isLeft ? -proportions.shoulderWidth/2 : proportions.shoulderWidth/2;
            
            return arm;
        };

        // Create arms in correct order
        const leftArm = createArm(true);   // Create left arm first
        const rightArm = createArm(false); // Create right arm second
        torsoGroup.add(leftArm);
        torsoGroup.add(rightArm);
        
        // Swap the references while keeping physical positions the same
        this.rightArm = leftArm;   // The green arm on the left is actually the right arm
        this.leftArm = rightArm;   // The skin-colored arm on the right is actually the left arm

        // Create head (existing code...)
        const head = new THREE.Group();
        const skull = new THREE.Mesh(
            new THREE.SphereGeometry(proportions.headRadius, 24, 24),
            new THREE.MeshStandardMaterial({ color: 0xffdbac })
        );
        skull.castShadow = true;  // Enable shadow casting
        head.add(skull);
        head.position.y = proportions.torsoHeight * 0.55 + 0.1;
        torsoGroup.add(head);
        this.head = head;  // Add head reference

        // Add torso to character
        character.add(torsoGroup);
        this.torso = torsoGroup;

        // Create katana with socket
        if (this.katana) {
            // Position katana relative to hand socket
            this.katana.scale.set(0.8, 0.8, 0.8);
            this.katana.position.set(0, 0, 0);
            this.katana.rotation.set(0, Math.PI * 0.5, 0);

            // Attach katana to hand socket by default
            if (this.handSocket) {
                this.handSocket.add(this.katana);
            }
        }

        return character;
    }

    createBeachEnvironment() {
        // Create a simple flat terrain
        const terrainSize = 200;
        
        // Load grass texture
        const textureLoader = new THREE.TextureLoader();
        const grassTexture = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/terrain/grasslight-big.jpg');
        
        // Make the texture repeat
        grassTexture.wrapS = THREE.RepeatWrapping;
        grassTexture.wrapT = THREE.RepeatWrapping;
        grassTexture.repeat.set(20, 20); // Repeat the texture 20 times
        
        // Create a simple plane geometry
        const geometry = new THREE.PlaneGeometry(terrainSize, terrainSize);
        
        // Create material with grass texture
        const material = new THREE.MeshStandardMaterial({
            map: grassTexture,
            roughness: 0.8,
            metalness: 0.1
        });
        
        // Create the terrain mesh
        const terrain = new THREE.Mesh(geometry, material);
        terrain.rotation.x = -Math.PI / 2; // Rotate to be horizontal
        terrain.position.y = 0; // Place at ground level
        terrain.receiveShadow = true;
        this.scene.add(terrain);

        // Store ground level for physics
        this.groundLevel = 0;

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        
        // Adjust shadow properties for better quality
        directionalLight.shadow.mapSize.width = 4096;  // Increased resolution
        directionalLight.shadow.mapSize.height = 4096;  // Increased resolution
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -50;     // Reduced shadow camera size
        directionalLight.shadow.camera.right = 50;     // for sharper shadows
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        directionalLight.shadow.bias = -0.001;         // Reduce shadow acne
        directionalLight.shadow.normalBias = 0.05;     // Improve contact shadows
        directionalLight.shadow.radius = 1.5;          // Soften shadow edges
        
        this.scene.add(directionalLight);

        // Add trees
        this.addTreeClusters();
    }

    addTreeClusters() {
        // Create several clusters of trees
        const clusterCenters = [];
        const numClusters = 15;

        // Generate cluster centers
        for (let i = 0; i < numClusters; i++) {
            const angle = (i / numClusters) * Math.PI * 2;
            const radius = 30 + Math.random() * 60;
            clusterCenters.push({
                x: Math.cos(angle) * radius,
                z: Math.sin(angle) * radius
            });
        }

        // Add trees around each cluster center
        clusterCenters.forEach(center => {
            const numTrees = 3 + Math.floor(Math.random() * 5);
            for (let i = 0; i < numTrees; i++) {
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * 10;
                const x = center.x + Math.cos(angle) * radius;
                const z = center.z + Math.sin(angle) * radius;
                this.addPalmTree(x, 0, z); // All trees at ground level
            }
        });

        // Add some random solitary trees
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 20 + Math.random() * 80;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            this.addPalmTree(x, 0, z); // All trees at ground level
        }
    }

    addPalmTree(x, y, z) {
        // Create a group for the entire tree
        const treeGroup = new THREE.Group();
        
        // Base scale for variety (apply to entire tree)
        const scale = 0.7 + Math.random() * 0.3;
        
        // Tree trunk
        const trunkHeight = 4 * scale; // Scale height directly
        const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, trunkHeight, 8);
        const trunkMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x4A2F21,
            shininess: 0
        });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        
        // Position trunk with base at y=0
        trunk.position.y = trunkHeight / 2;
        
        // Tree leaves
        const leavesHeight = 3 * scale; // Scale height directly
        const leavesGeometry = new THREE.ConeGeometry(2, leavesHeight, 8);
        const leavesMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x2E7D32,
            shininess: 0
        });
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        
        // Position leaves directly on top of trunk
        leaves.position.y = trunkHeight + (leavesHeight / 2);
        
        // Random rotation for variety
        const rotation = Math.random() * Math.PI * 2;
        treeGroup.rotation.y = rotation;
        
        // Add meshes to group
        treeGroup.add(trunk);
        treeGroup.add(leaves);
        
        // Position entire tree
        treeGroup.position.set(x, 0, z);
        
        // Set shadows
        trunk.castShadow = true;
        leaves.castShadow = true;
        trunk.receiveShadow = true;
        leaves.receiveShadow = true;
        
        this.scene.add(treeGroup);
    }

    createKatana() {
        const katanaGroup = new THREE.Group();
        
        // Blade
        const blade = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 1, 0.1),
            new THREE.MeshPhongMaterial({ color: 0xCCCCCC })
        );
        blade.position.y = 0.5; // Position relative to handle
        blade.castShadow = true;
        
        // Handle
        const handle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8),
            new THREE.MeshPhongMaterial({ color: 0x4A4A4A })
        );
        handle.position.y = 0; // At the base, this is our pivot point
        handle.castShadow = true;
        
        // Guard
        const guard = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.05, 0.05),
            new THREE.MeshPhongMaterial({ color: 0x8B4513 })
        );
        guard.position.y = 0.15; // Just above handle
        guard.castShadow = true;
        
        katanaGroup.add(blade, handle, guard);
        return katanaGroup;
    }

    updateCharacter() {
        if (!this.character) return;

        const time = Date.now() * 0.003;
        const deltaTime = 1/60;  // Assuming 60 FPS
        const speed = this.momentum.length();

        // Apply gravity and update position
        if (!this.isGrounded) {
            this.velocity.y += this.gravity;
            this.character.position.y += this.velocity.y;

            // Update roll animation
            if (this.isRolling) {
                this.rollTime += deltaTime;
                if (this.rollTime >= this.rollDuration) {
                    this.isRolling = false;
                }
            }

            // Check for ground collision
            if (this.character.position.y <= this.groundLevel) {
                this.character.position.y = this.groundLevel;
                this.velocity.y = 0;
                this.isGrounded = true;
                this.isRolling = false;  // End roll when landing
            }
        }

        // Update jump cooldown
        if (!this.canJump) {
            this.jumpCooldown -= deltaTime;
            if (this.jumpCooldown <= 0) {
                this.canJump = true;
            }
        }

        // Determine character state
        if (!this.isGrounded) {
            this.characterState = this.isRolling ? 'rolling' : 'jumping';
        } else if (this.isSliding) {
            this.characterState = 'sliding';
        } else if (this.isDashing) {
            this.characterState = 'dashing';
        } else if (this.keys.shift && speed > 0.002) {
            this.characterState = 'sprinting';
        } else if (speed > 0.001) {
            this.characterState = 'walking';
        } else {
            this.characterState = 'idle';
        }

        // Handle weapon socket based on state
        if (this.characterState === 'sprinting' && this.katana && this.backSocket) {
            if (this.katana.parent !== this.backSocket) {
                this.switchWeaponSocket(true);
            }
        } else if (this.katana && this.handSocket) {
            if (this.katana.parent !== this.handSocket) {
                this.switchWeaponSocket(false);
            }
        }

        // Apply animations based on state
        if (this.leftThigh && this.rightThigh && this.leftShin && this.rightShin) {
            switch (this.characterState) {
                case 'rolling':
                    // Rolling animation
                    const rollProgress = this.rollTime / this.rollDuration;
                    const rollAngle = Math.PI * 2 * rollProgress;  // Full 360-degree rotation
                    
                    // Curl factor increases then decreases during roll
                    const curlProgress = Math.sin(rollProgress * Math.PI); // 0 -> 1 -> 0
                    
                    // Rotate entire character forward from lower torso pivot
                    this.torso.rotation.x = rollAngle;
                    
                    // Curl legs up tight towards chest
                    this.leftThigh.rotation.x = -2.0 * curlProgress;  // Legs curl up tighter
                    this.rightThigh.rotation.x = -2.0 * curlProgress;
                    this.leftShin.rotation.x = 2.4 * curlProgress;   // Knees bend more
                    this.rightShin.rotation.x = 2.4 * curlProgress;
                    
                    // Arms wrap around legs
                    this.leftArm.rotation.x = -2.2 * curlProgress;  // Arms wrap further
                    this.rightArm.rotation.x = -2.2 * curlProgress;
                    this.leftArm.rotation.z = 1.0 * curlProgress;   // Arms hug inward
                    this.rightArm.rotation.z = -1.0 * curlProgress;
                    
                    // Torso curls forward
                    this.torso.rotation.x = 0.8 * curlProgress + rollAngle; // Base curl plus rotation
                    
                    // Head tucks in
                    if (this.head) {
                        this.head.rotation.x = -0.8 * curlProgress; // Tuck chin to chest
                    }
                    
                    // Reset all rotations at end of roll
                    if (rollProgress >= 1) {
                        this.torso.rotation.x = 0;
                        if (this.head) {
                            this.head.rotation.x = 0;
                        }
                    }
                    break;

                case 'jumping':
                    // Existing jumping animation
                    const jumpProgress = Math.max(0, Math.min(1, this.velocity.y / this.jumpForce));
                    
                    // Reset character rotation in case coming from roll
                    this.character.rotation.x = 0;
                    
                    // Legs bend up during jump
                    this.leftThigh.rotation.x = -0.6 * jumpProgress;
                    this.rightThigh.rotation.x = -0.6 * jumpProgress;
                    this.leftShin.rotation.x = 1.2 * jumpProgress;
                    this.rightShin.rotation.x = 1.2 * jumpProgress;
                    
                    // Arms raise up during jump
                    this.leftArm.rotation.x = -0.8 * jumpProgress;
                    this.rightArm.rotation.x = -0.8 * jumpProgress;
                    this.leftArm.rotation.z = 0.3 * jumpProgress;
                    this.rightArm.rotation.z = -0.3 * jumpProgress;
                    
                    // Slight forward lean
                    this.torso.rotation.x = 0.2 * jumpProgress;
                    break;

                case 'idle':
                    // Subtle breathing animation
                    const breatheAmp = 0.005;
                    const breatheSpeed = 1.5;
                    
                    // Torso subtle forward lean and breathing
                    this.torso.rotation.x = 0.1; // Slight combat-ready hunch
                    this.torso.rotation.y = Math.sin(time * breatheSpeed) * breatheAmp;
                    
                    // Slightly bent knees in ready stance
                    this.leftThigh.rotation.x = -0.1;  // Slight bend at hip
                    this.rightThigh.rotation.x = -0.1;
                    this.leftShin.rotation.x = 0.2;   // Compensating bend at knee
                    this.rightShin.rotation.x = 0.2;
                    
                    // Subtle arm positioning - adjusted to prevent clipping
                    this.leftArm.rotation.x = -0.1;
                    this.rightArm.rotation.x = -0.1;
                    this.leftArm.rotation.y = 0.4;    // Rotate around Y-axis to pivot from shoulder
                    this.rightArm.rotation.y = -0.4;  // Negative for right arm to mirror the left
                    this.leftArm.rotation.z = 0;      // Remove Z rotation since we're using Y
                    this.rightArm.rotation.z = 0;     // Remove Z rotation since we're using Y
                    break;

                case 'walking':
                    const walkSpeed = 3.0;      // Increased from 2.0
                    const walkAmp = 0.3;
                    const kneeAmp = 0.4;  // Additional bend for knees
                    
                    // Leg movement
                    this.leftThigh.rotation.x = Math.sin(time * walkSpeed) * walkAmp;
                    this.rightThigh.rotation.x = -Math.sin(time * walkSpeed) * walkAmp;
                    
                    // Knee bending - opposite phase of thigh for natural walking
                    this.leftShin.rotation.x = Math.max(0, Math.sin(time * walkSpeed + Math.PI) * kneeAmp);
                    this.rightShin.rotation.x = Math.max(0, -Math.sin(time * walkSpeed + Math.PI) * kneeAmp);
                    
                    // Arm swing - opposite of legs for natural walking (right arm with left leg)
                    const walkArmBase = 0.25; // Base outward rotation to prevent clipping
                    this.leftArm.rotation.x = Math.sin(time * walkSpeed) * walkAmp * 0.8;  // Changed to match opposite leg
                    this.rightArm.rotation.x = -Math.sin(time * walkSpeed) * walkAmp * 0.8; // Changed to match opposite leg
                    this.leftArm.rotation.y = 0.3 + Math.sin(time * walkSpeed) * 0.1;
                    this.rightArm.rotation.y = -0.3 + Math.sin(time * walkSpeed) * 0.1;
                    this.leftArm.rotation.z = 0;
                    this.rightArm.rotation.z = 0;
                    
                    // Subtle torso movement
                    this.torso.rotation.y = Math.sin(time * walkSpeed) * 0.05;
                    this.torso.rotation.x = 0.05; // Slight forward lean
                    break;

                case 'sprinting':
                    const sprintSpeed = 3.6;    // Increased from 2.4
                    const sprintAmp = 0.5;
                    const sprintKneeAmp = 0.7;  // More pronounced knee bend for running
                    
                    // Leg movement
                    this.leftThigh.rotation.x = Math.sin(time * sprintSpeed) * sprintAmp;
                    this.rightThigh.rotation.x = -Math.sin(time * sprintSpeed) * sprintAmp;
                    
                    // Exaggerated knee bending for running
                    this.leftShin.rotation.x = Math.max(0, Math.sin(time * sprintSpeed + Math.PI) * sprintKneeAmp);
                    this.rightShin.rotation.x = Math.max(0, -Math.sin(time * sprintSpeed + Math.PI) * sprintKneeAmp);
                    
                    // Naruto run arm positioning - arms straight back
                    this.leftArm.rotation.x = 1.2;  // Rotate arms back
                    this.rightArm.rotation.x = 1.2;
                    this.leftArm.rotation.y = 0;    // No side rotation
                    this.rightArm.rotation.y = 0;
                    this.leftArm.rotation.z = 0;    // No Z rotation
                    this.rightArm.rotation.z = 0;
                    
                    // Forward lean
                    this.torso.rotation.x = 0.4; // More pronounced forward lean for Naruto run
                    this.torso.rotation.y = Math.sin(time * sprintSpeed) * 0.08;
                    break;

                case 'sliding':
                    const slideProgress = this.slideTime / this.maxSlideTime;
                    const slideAngle = Math.PI / 3;
                    
                    // Torso lean
                    this.torso.rotation.x = slideAngle;
                    
                    // Leg positioning during slide
                    this.leftThigh.rotation.x = slideAngle * 0.7;
                    this.rightThigh.rotation.x = slideAngle * 0.7;
                    this.leftShin.rotation.x = -slideAngle * 0.3;  // Bend knees inward
                    this.rightShin.rotation.x = -slideAngle * 0.3;
                    
                    // Arm positioning - adjusted to prevent clipping during slide
                    const slideArmBase = 0.4; // Wide outward angle during slide
                    this.leftArm.rotation.x = -slideAngle * 0.5;
                    this.rightArm.rotation.x = -slideAngle * 0.5;
                    this.leftArm.rotation.z = slideArmBase;   // Constant wide position for balance
                    this.rightArm.rotation.z = -slideArmBase;
                    
                    // Recovery animation
                    if (slideProgress > 0.7) {
                        const recovery = (slideProgress - 0.7) / 0.3;
                        const recoveryEase = 1 - recovery;
                        
                        // Smoothly return to normal stance
                        this.torso.rotation.x *= recoveryEase;
                        this.leftThigh.rotation.x *= recoveryEase;
                        this.rightThigh.rotation.x *= recoveryEase;
                        this.leftShin.rotation.x *= recoveryEase;
                        this.rightShin.rotation.x *= recoveryEase;
                        this.leftArm.rotation.x *= recoveryEase;
                        this.rightArm.rotation.x *= recoveryEase;
                        // Maintain minimum outward angle during recovery
                        this.leftArm.rotation.z = slideArmBase * recoveryEase + 0.3;
                        this.rightArm.rotation.z = -slideArmBase * recoveryEase - 0.3;
                    }
                    break;

                case 'dashing':
                    // Dynamic dash animation
                    const dashProgress = Math.min((Date.now() - this.dashStartTime) / 300, 1);
                    
                    // Forward lean during dash
                    this.torso.rotation.x = 0.6;
                    
                    // Arms stretched back like a ninja run
                    this.leftArm.rotation.x = 1.5;
                    this.rightArm.rotation.x = 1.5;
                    this.leftArm.rotation.z = -0.2;
                    this.rightArm.rotation.z = 0.2;
                    
                    // Legs in running position
                    this.leftThigh.rotation.x = -0.4;
                    this.rightThigh.rotation.x = 0.4;
                    this.leftShin.rotation.x = 0.8;
                    this.rightShin.rotation.x = 0;
                    
                    // Add slight body rotation for dynamic effect
                    this.torso.rotation.y = Math.sin(dashProgress * Math.PI) * 0.2;
                    break;
            }
        }

        // Update character rotation based on movement direction
        if (this.momentum.lengthSq() > 0.001) {
            const targetRotation = Math.atan2(this.momentum.x, this.momentum.z);
            this.character.rotation.y = this.smoothAngle(
                this.character.rotation.y,
                targetRotation,
                0.15
            );
        }

        // Update slide mechanics
        if (this.slideCooldown > 0) {
            this.slideCooldown -= 1/60;
            if (this.slideCooldown <= 0) {
                this.canSlide = true;
            }
        }

        // Handle sliding movement
        if (this.isSliding) {
            this.slideTime += 1/60;
            if (this.slideTime >= this.maxSlideTime) {
                this.cancelSlide();
            }

            const slideDecay = 1 - (this.slideTime / this.maxSlideTime);
            this.character.position.add(
                this.momentum.clone().multiplyScalar(slideDecay)
            );
        } else {
            // Normal movement
            const moveDir = new THREE.Vector3(0, 0, 0);
            if (this.keys.forward) moveDir.z += 1;
            if (this.keys.backward) moveDir.z -= 1;
            if (this.keys.left) moveDir.x -= 1;  // Keep negative for left
            if (this.keys.right) moveDir.x += 1;  // Keep positive for right

            if (moveDir.lengthSq() > 0) {
                moveDir.normalize();
                
                const cameraDirection = new THREE.Vector3();
                this.camera.getWorldDirection(cameraDirection);
                cameraDirection.y = 0;
                cameraDirection.normalize();

                const right = new THREE.Vector3();
                right.crossVectors(new THREE.Vector3(0, 1, 0), cameraDirection);

                const movement = new THREE.Vector3();
                movement.addScaledVector(cameraDirection, moveDir.z);
                movement.addScaledVector(right, -moveDir.x);  // Add negative here to fix left/right inversion
                movement.normalize();
                movement.multiplyScalar(this.keys.shift ? this.maxRunSpeed : this.maxWalkSpeed);

                this.momentum.lerp(movement, 0.2);
                this.character.position.add(this.momentum);

                // Update character rotation to face movement direction
                if (this.momentum.lengthSq() > 0.00001) {  // Lower threshold for rotation
                    const targetRotation = Math.atan2(this.momentum.x, this.momentum.z);
                    this.character.rotation.y = this.smoothAngle(
                        this.character.rotation.y,
                        targetRotation,
                        0.3  // Increased smoothing factor for more responsive turning
                    );
                }
            } else {
                this.momentum.multiplyScalar(0.9);
            }
        }

        // Update OrbitControls
        this.controls.target.copy(this.character.position);
        this.controls.update();
    }

    // Helper function for smooth angle interpolation
    smoothAngle(current, target, smoothFactor) {
        let delta = target - current;
        
        // Ensure we rotate the shortest direction
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        
        return current + delta * smoothFactor;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.updateCharacter();
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    performAttack(type) {
        if (this.isAttacking) return;

        const now = Date.now();
        if (now - this.lastAttackTime > this.comboResetTime) {
            this.comboCount = 0;
        }

        this.isAttacking = true;
        this.comboCount++;
        this.lastAttackTime = now;

        // Store attack direction for momentum
        this.attackDirection.copy(this.moveDirection);
        if (this.attackDirection.length() === 0) {
            // If not moving, attack in facing direction
            this.attackDirection.set(
                Math.sin(this.character.rotation.y),
                0,
                Math.cos(this.character.rotation.y)
            );
        }

        let attack;
        if (type === 'light') {
            switch(this.comboCount) {
                case 1: 
                    attack = 'light1';
                    this.velocity.add(this.attackDirection.multiplyScalar(this.attackMomentum));
                    // Animate right arm for horizontal slash
                    this.rightArm.rotation.x = -0.5;
                    this.rightArm.rotation.z = -0.3;
                    break;
                case 2: 
                    attack = 'light2';
                    this.velocity.add(this.attackDirection.multiplyScalar(this.attackMomentum * 1.2));
                    // Animate right arm for upward slash
                    this.rightArm.rotation.x = -1;
                    this.rightArm.rotation.z = 0;
                    break;
                case 3: 
                    attack = 'light3';
                    this.velocity.add(this.attackDirection.multiplyScalar(this.attackMomentum * 1.5));
                    // Animate right arm for spinning slash
                    this.rightArm.rotation.x = -0.8;
                    this.rightArm.rotation.z = 0.3;
                    this.comboCount = 0;
                    break;
                default: 
                    attack = 'light1';
                    this.comboCount = 1;
            }
        } else {
            if (this.isGrounded) {
                attack = 'heavy';
                this.velocity.add(this.attackDirection.multiplyScalar(this.attackMomentum * 2));
                // Animate right arm for heavy attack
                this.rightArm.rotation.x = -1.2;
                this.rightArm.rotation.z = -0.5;
            } else {
                attack = 'aerial';
                this.velocity.y += 0.15;
                this.velocity.add(this.attackDirection.multiplyScalar(this.attackMomentum * 1.5));
                // Animate right arm for aerial attack
                this.rightArm.rotation.x = -1.5;
                this.rightArm.rotation.z = 0;
            }
            this.comboCount = 0;
        }

        this.currentAnimation = this.attackAnimations[attack];
        this.animateAttack(attack);

        // Reset arm position after attack
        setTimeout(() => {
            this.isAttacking = false;
            // Smoothly reset arm position
            const resetDuration = 100;
            const startRotation = {
                x: this.rightArm.rotation.x,
                z: this.rightArm.rotation.z
            };
            const startTime = Date.now();

            const resetArm = () => {
                const progress = (Date.now() - startTime) / resetDuration;
                if (progress < 1) {
                    this.rightArm.rotation.x = startRotation.x * (1 - progress);
                    this.rightArm.rotation.z = startRotation.z * (1 - progress);
                    requestAnimationFrame(resetArm);
                } else {
                    this.rightArm.rotation.x = 0;
                    this.rightArm.rotation.z = 0;
                }
            };
            resetArm();
        }, this.currentAnimation.duration);
    }

    animateAttack(attackType) {
        const originalRotation = this.katanaBaseRotation.clone();
        let targetRotation;

        switch(attackType) {
            case 'light1':
                // Horizontal slash
                targetRotation = new THREE.Euler(0, Math.PI * 1.5, Math.PI / 3);
                break;
            case 'light2':
                // Diagonal upward slash
                targetRotation = new THREE.Euler(-Math.PI / 3, Math.PI, Math.PI / 2);
                break;
            case 'light3':
                // Spinning slash
                targetRotation = new THREE.Euler(0, Math.PI * 3, Math.PI / 4);
                break;
            case 'heavy':
                // Wide spinning slash
                targetRotation = new THREE.Euler(Math.PI / 4, Math.PI * 3, Math.PI / 2);
                break;
            case 'aerial':
                // Overhead spinning slash
                targetRotation = new THREE.Euler(-Math.PI / 2, Math.PI * 2, Math.PI / 3);
                break;
        }

        const duration = this.currentAnimation.duration;
        const startTime = Date.now();

        const animate = () => {
            const progress = (Date.now() - startTime) / duration;
            if (progress < 1) {
                const easedProgress = 1 - Math.pow(1 - progress, 3);
                this.katana.rotation.x = originalRotation.x + (targetRotation.x - originalRotation.x) * easedProgress;
                this.katana.rotation.y = originalRotation.y + (targetRotation.y - originalRotation.y) * easedProgress;
                this.katana.rotation.z = originalRotation.z + (targetRotation.z - originalRotation.z) * easedProgress;
                requestAnimationFrame(animate);
            } else {
                this.katana.rotation.copy(originalRotation);
            }
        };
        animate();
    }

    startSlide() {
        // Remove sprint requirement for sliding
        if (!this.canSlide || this.isSliding) return;
        
        this.isSliding = true;
        this.slideTime = 0;
        this.canSlide = false;
        
        // Store current movement direction for slide
        const moveDir = new THREE.Vector3(0, 0, 0);
        if (this.keys.forward) moveDir.z += 1;
        if (this.keys.backward) moveDir.z -= 1;
        if (this.keys.left) moveDir.x += 1;
        if (this.keys.right) moveDir.x -= 1;
        moveDir.normalize();

        // Get camera direction
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0;
        cameraDirection.normalize();

        // Calculate right vector from camera direction
        const right = new THREE.Vector3();
        right.crossVectors(new THREE.Vector3(0, 1, 0), cameraDirection);

        // Apply slide direction relative to camera
        this.momentum.set(0, 0, 0);
        this.momentum.addScaledVector(cameraDirection, moveDir.z);
        this.momentum.addScaledVector(right, moveDir.x);
        this.momentum.normalize();
        this.momentum.multiplyScalar(this.slideSpeed);
    }

    cancelSlide() {
        this.isSliding = false;
        this.slideCooldown = this.maxSlideCooldown;
        this.momentum.multiplyScalar(0.5); // Maintain some momentum after canceling
    }

    performDash() {
        if (!this.canDash) return;

        this.canDash = false;
        this.isDashing = true;
        this.dashStartTime = Date.now();
        
        const dashDirection = new THREE.Vector3();
        if (this.keys.forward) dashDirection.z += 1;
        if (this.keys.backward) dashDirection.z -= 1;
        if (this.keys.left) dashDirection.x -= 1;
        if (this.keys.right) dashDirection.x += 1;
        
        if (dashDirection.lengthSq() === 0) {
            // If no direction pressed, dash in facing direction
            dashDirection.z = Math.cos(this.character.rotation.y);
            dashDirection.x = Math.sin(this.character.rotation.y);
        }
        
        // Apply dash in the direction of camera
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0;
        cameraDirection.normalize();

        const right = new THREE.Vector3();
        right.crossVectors(new THREE.Vector3(0, 1, 0), cameraDirection);

        this.momentum.set(0, 0, 0);
        this.momentum.addScaledVector(cameraDirection, dashDirection.z);
        this.momentum.addScaledVector(right, dashDirection.x);
        this.momentum.normalize();
        this.momentum.multiplyScalar(this.dashForce);

        // Add slight upward force to dash
        this.velocity.y = this.isGrounded ? 0.1 : 0.2; // Higher upward force when air dashing

        setTimeout(() => {
            this.isDashing = false;
            this.momentum.multiplyScalar(0.7); // Preserve some momentum
            setTimeout(() => {
                this.canDash = true;
            }, 300); // Cooldown duration
        }, 300); // Dash duration
    }

    // Add method to switch weapon position
    switchWeaponSocket(toBack = false) {
        if (!this.katana) return;
        
        // Remove katana from current socket
        if (this.katana.parent) {
            this.katana.parent.remove(this.katana);
        }
        
        // Add to new socket
        if (toBack && this.backSocket) {
            this.backSocket.add(this.katana);
            // Adjust position/rotation for back
            this.katana.position.set(0, 0, 0);
            this.katana.rotation.set(0, 0, Math.PI * 0.75);
        } else if (this.handSocket) {
            this.handSocket.add(this.katana);
            // Position and rotate for hand grip
            this.katana.position.set(0, 0, 0);
            this.katana.rotation.set(0, Math.PI * 0.5, 0);
        }
    }
}

// Start the game
new Game();