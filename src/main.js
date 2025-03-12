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
        
        this.scene.add(this.character);

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
        this.gravity = -0.005;
        this.jumpForce = 0.35;
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

        // Movement constants
        this.maxWalkSpeed = 0.1;
        this.maxRunSpeed = 0.4;
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

        // Setup basic movement controls
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            shift: false
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
                case 'ShiftLeft': 
                case 'ShiftRight': 
                    this.keys.shift = true; 
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
        console.log('Starting character creation');
        const character = new THREE.Group();

        // Materials
        const skinMaterial = new THREE.MeshPhongMaterial({ color: 0xFFD1BA });
        const clothMaterial = new THREE.MeshPhongMaterial({ color: 0x4A90E2 });
        const shoeMaterial = new THREE.MeshPhongMaterial({ color: 0x4A4A4A });
        const hairMaterial = new THREE.MeshPhongMaterial({ color: 0x3D2314 });

        // Create limbs
        this.leftLeg = new THREE.Group();
        this.rightLeg = new THREE.Group();
        this.leftArm = new THREE.Group();
        this.rightArm = new THREE.Group();

        console.log('Created limb groups:', {
            leftLeg: this.leftLeg,
            rightLeg: this.rightLeg,
            leftArm: this.leftArm,
            rightArm: this.rightArm
        });

        // Head and body parts first
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.25, 16, 16),
            skinMaterial
        );
        head.position.y = 1.6;
        character.add(head);

        const hair = new THREE.Mesh(
            new THREE.SphereGeometry(0.27, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
            hairMaterial
        );
        hair.position.y = 1.7;
        character.add(hair);

        const torso = new THREE.Mesh(
            new THREE.CylinderGeometry(0.25, 0.2, 0.6, 8),
            clothMaterial
        );
        torso.position.y = 1.15;
        character.add(torso);
        this.torso = torso;

        // Arms setup
        const createArmMeshes = (arm, isLeft) => {
            const upperArm = new THREE.Mesh(
                new THREE.CylinderGeometry(0.08, 0.07, 0.35),
                clothMaterial
            );
            upperArm.position.y = -0.175;
            arm.add(upperArm);

            const lowerArm = new THREE.Mesh(
                new THREE.CylinderGeometry(0.07, 0.06, 0.35),
                skinMaterial
            );
            lowerArm.position.y = -0.525;
            arm.add(lowerArm);

            arm.position.y = 1.3;
            arm.position.x = isLeft ? -0.35 : 0.35;
        };

        // Create arm meshes
        createArmMeshes(this.leftArm, true);
        createArmMeshes(this.rightArm, false);

        // Add arms to character
        character.add(this.leftArm);
        character.add(this.rightArm);

        console.log('Added arms to character:', {
            leftArm: this.leftArm,
            rightArm: this.rightArm
        });

        // Legs setup
        const createLegMeshes = (leg, isLeft) => {
            const upperLeg = new THREE.Mesh(
                new THREE.CylinderGeometry(0.1, 0.09, 0.4),
                clothMaterial
            );
            upperLeg.position.y = -0.2;
            leg.add(upperLeg);

            const lowerLeg = new THREE.Mesh(
                new THREE.CylinderGeometry(0.09, 0.08, 0.4),
                skinMaterial
            );
            lowerLeg.position.y = -0.6;
            leg.add(lowerLeg);

            const shoe = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 0.1, 0.25),
                shoeMaterial
            );
            shoe.position.y = -0.8;
            shoe.position.z = 0.05;
            leg.add(shoe);

            leg.position.y = 0.85;
            leg.position.x = isLeft ? -0.15 : 0.15;
        };

        // Create leg meshes
        createLegMeshes(this.leftLeg, true);
        createLegMeshes(this.rightLeg, false);

        // Add legs to character
        character.add(this.leftLeg);
        character.add(this.rightLeg);

        // Create and add right hand
        this.rightHand = new THREE.Group();
        this.rightHand.position.set(0, -0.525, 0);
        this.rightArm.add(this.rightHand);

        // Add katana if it exists
        if (this.katana) {
            this.katana.position.set(0.1, 0, 0.2);
            this.katana.rotation.set(0, 0, Math.PI / 4);
            this.rightHand.add(this.katana);
        }

        // Set character position and shadows
        character.position.y = 0;
        character.castShadow = true;
        character.traverse((object) => {
            if (object instanceof THREE.Mesh) {
                object.castShadow = true;
                object.receiveShadow = true;
            }
        });

        console.log('Final limb references before returning character:', {
            leftLeg: this.leftLeg,
            rightLeg: this.rightLeg,
            leftArm: this.leftArm,
            rightArm: this.rightArm,
            rightHand: this.rightHand
        });

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
        
        // Adjust shadow properties
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        
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
        blade.position.y = 0.5;
        
        // Handle
        const handle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8),
            new THREE.MeshPhongMaterial({ color: 0x4A4A4A })
        );
        handle.position.y = -0.1;
        
        // Guard
        const guard = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.05, 0.05),
            new THREE.MeshPhongMaterial({ color: 0x8B4513 })
        );
        
        katanaGroup.add(blade, handle, guard);
        katanaGroup.position.set(0.4, 1.2, 0);
        katanaGroup.rotation.z = Math.PI / 4;
        
        return katanaGroup;
    }

    updateCharacter() {
        if (!this.character) {
            console.error('No character found');
            return;
        }

        // Debug check for limbs
        if (!this.leftLeg || !this.rightLeg || !this.leftArm || !this.rightArm) {
            console.error('Missing limb references:', {
                leftLeg: this.leftLeg,
                rightLeg: this.rightLeg,
                leftArm: this.leftArm,
                rightArm: this.rightArm
            });
            return;
        }

        // Get camera's forward and right vectors
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.camera.quaternion);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3(1, 0, 0);
        right.applyQuaternion(this.camera.quaternion);
        right.y = 0;
        right.normalize();

        // Calculate movement direction
        this.moveDirection.set(0, 0, 0);
        if (this.keys.forward) this.moveDirection.add(forward);
        if (this.keys.backward) this.moveDirection.sub(forward);
        if (this.keys.right) this.moveDirection.add(right);
        if (this.keys.left) this.moveDirection.sub(right);
        this.moveDirection.normalize();

        // Animation state
        const isMoving = this.moveDirection.length() > 0;
        const isRunning = this.keys.shift && isMoving;
        const currentSpeed = isRunning ? this.maxRunSpeed : this.maxWalkSpeed;
        const time = Date.now() * 0.005; // Back to original speed

        if (isMoving) {
            console.log('Moving:', {
                isRunning,
                speed: currentSpeed,
                direction: this.moveDirection
            });
        }

        // Apply movement
        if (isMoving) {
            this.character.position.x += this.moveDirection.x * currentSpeed;
            this.character.position.z += this.moveDirection.z * currentSpeed;

            // Rotate character to face movement direction
            const targetAngle = Math.atan2(this.moveDirection.x, this.moveDirection.z);
            this.rotationAngle = this.smoothAngle(this.rotationAngle, targetAngle, 0.2);
            this.character.rotation.y = this.rotationAngle;

            // Walking animation
            const walkCycle = time;
            const amplitude = isRunning ? 0.5 : 0.3;

            // Apply animations
            this.leftLeg.rotation.x = Math.sin(walkCycle) * amplitude;
            this.rightLeg.rotation.x = -Math.sin(walkCycle) * amplitude;
            this.leftArm.rotation.x = -Math.sin(walkCycle) * amplitude;
            this.rightArm.rotation.x = Math.sin(walkCycle) * amplitude;

            console.log('Animations:', {
                walkCycle,
                leftLegRot: this.leftLeg.rotation.x,
                rightLegRot: this.rightLeg.rotation.x
            });
        } else {
            // Reset to idle pose
            this.leftLeg.rotation.x = 0;
            this.rightLeg.rotation.x = 0;
            this.leftArm.rotation.x = 0;
            this.rightArm.rotation.x = 0;
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
        if (!this.canSlide) return;
        
        this.isSliding = true;
        this.canSlide = false;
        this.character.scale.y = 0.5;
        
        // Preserve current momentum and add slide boost
        const slideDirection = this.moveDirection.clone().normalize();
        const currentHorizontalSpeed = new THREE.Vector3(this.velocity.x, 0, this.velocity.z).length();
        const slideSpeed = Math.max(currentHorizontalSpeed, this.maxRunSpeed) * this.slideForce;
        
        this.velocity.x = slideDirection.x * slideSpeed;
        this.velocity.z = slideDirection.z * slideSpeed;

        setTimeout(() => {
            this.isSliding = false;
            this.character.scale.y = 1;
            // Preserve more momentum after slide
            this.velocity.multiplyScalar(0.85);
            setTimeout(() => {
                this.canSlide = true;
            }, 300); // Shorter cooldown
        }, 800); // Longer slide duration
    }

    performDash() {
        if (!this.canDash) return;

        this.canDash = false;
        this.isDashing = true;
        
        const dashDirection = this.moveDirection.clone().normalize();
        this.velocity.x = dashDirection.x * this.dashForce;
        this.velocity.z = dashDirection.z * this.dashForce;

        // Add slight upward force to dash
        this.velocity.y = 0.1;

        setTimeout(() => {
            this.isDashing = false;
            this.velocity.multiplyScalar(0.7); // Preserve more momentum
            setTimeout(() => {
                this.canDash = true;
            }, 300); // Shorter cooldown
        }, 300); // Longer dash duration
    }

    performAirDash() {
        if (!this.canDash) return;

        this.canDash = false;
        const dashDirection = this.moveDirection.clone().normalize();
        this.velocity.x = dashDirection.x * this.dashForce;
        this.velocity.z = dashDirection.z * this.dashForce;
        this.velocity.y = 0.2;

        setTimeout(() => {
            this.canDash = true;
        }, 1000);
    }
}

// Start the game
new Game();