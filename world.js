/**
 * 3D MINECRAFT WORLD & CHARACTER ENGINE (Three.js)
 * True blocky Minecraft characters with realistic proportions,
 * animated pulling physics, voxel arena, dynamic sky, and spectators.
 */

class MinecraftWorld {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // Game objects
    this.teamACharacters = []; // Left team
    this.teamBCharacters = []; // Right team
    this.ropeGroup = null;
    this.ropeMesh = null;
    this.ropeRibbon = null;
    this.clouds = [];
    this.spectators = [];
    this.particles = [];

    // State
    this.ropeOffset = 0; // -X pulls left, +X pulls right
    this.targetRopeOffset = 0;
    this.pullingTeam = null; // 'A' or 'B' or null
    this.isVictory = false;
    this.winningTeam = null;

    this.clock = new THREE.Clock();
    this.init();
  }

  init() {
    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x78a7ff); // Bright Minecraft blue sky
    this.scene.fog = new THREE.Fog(0x78a7ff, 35, 75);

    // 2. Camera setup (isometric-style diagonal action view)
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 200);
    this.camera.position.set(0, 7.5, 17.5);
    this.camera.lookAt(0, 1.2, 0);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 4. Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x589b33, 0.75);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffae0, 1.1);
    sunLight.position.set(15, 25, 12);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 70;
    sunLight.shadow.camera.left = -20;
    sunLight.shadow.camera.right = 20;
    sunLight.shadow.camera.top = 20;
    sunLight.shadow.camera.bottom = -10;
    this.scene.add(sunLight);

    // 5. Build Environment
    this.buildSkyElements();
    this.buildTerrain();
    this.buildTreesAndDecor();
    this.buildSpectators();
    this.buildRope();

    // 6. Spawn Teams (5 characters each!)
    this.spawnTeams();

    // 7. Event listeners
    window.addEventListener('resize', () => this.onResize());

    // 8. Start loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // --- SKY & CLOUDS ---
  buildSkyElements() {
    // Cubic Minecraft Sun
    const sunGeo = new THREE.BoxGeometry(3, 3, 0.2);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffea4e });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.position.set(12, 28, -25);
    sunMesh.rotation.y = -0.3;
    this.scene.add(sunMesh);

    // Floating Minecraft 3D Clouds (blocky slabs)
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.88
    });

    for (let i = 0; i < 8; i++) {
      const w = 8 + Math.random() * 12;
      const d = 6 + Math.random() * 8;
      const cloudGeo = new THREE.BoxGeometry(w, 1.2, d);
      const cloud = new THREE.Mesh(cloudGeo, cloudMat);
      cloud.position.set(
        (Math.random() - 0.5) * 80,
        22 + Math.random() * 6,
        -15 + (Math.random() - 0.5) * 40
      );
      cloud.userData = { speed: 0.015 + Math.random() * 0.02 };
      this.clouds.push(cloud);
      this.scene.add(cloud);
    }
  }

  // --- TERRAIN ---
  buildTerrain() {
    const grassTop = mcTextures.getGrassTop();
    const grassSide = mcTextures.getGrassSide();
    const dirt = mcTextures.getDirt();
    const stone = mcTextures.getStone();
    const cobblestone = mcTextures.getCobblestone();

    // Minecraft Grass Block Multi-material
    const grassMat = [
      new THREE.MeshLambertMaterial({ map: grassSide }), // Right
      new THREE.MeshLambertMaterial({ map: grassSide }), // Left
      new THREE.MeshLambertMaterial({ map: grassTop }),  // Top
      new THREE.MeshLambertMaterial({ map: dirt }),      // Bottom
      new THREE.MeshLambertMaterial({ map: grassSide }), // Front
      new THREE.MeshLambertMaterial({ map: grassSide })  // Back
    ];

    // Main Field Ground
    const groundGeo = new THREE.BoxGeometry(50, 2, 20);
    const ground = new THREE.Mesh(groundGeo, grassMat);
    ground.position.set(0, -1, 0);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Tug-of-War Track (Cobblestone / Dirt Path in center)
    const trackGeo = new THREE.BoxGeometry(26, 0.05, 4);
    const trackMat = new THREE.MeshLambertMaterial({ map: cobblestone });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.position.set(0, 0.02, 0);
    track.receiveShadow = true;
    this.scene.add(track);

    // Center dividing line (White Wool)
    const centerLineGeo = new THREE.BoxGeometry(0.4, 0.08, 4.2);
    const whiteWoolMat = new THREE.MeshLambertMaterial({ map: mcTextures.getWool('#f0f0f0') });
    const centerLine = new THREE.Mesh(centerLineGeo, whiteWoolMat);
    centerLine.position.set(0, 0.04, 0);
    this.scene.add(centerLine);

    // Left Team Win Marker (Red Wool)
    const leftMarkerGeo = new THREE.BoxGeometry(0.4, 0.08, 4.2);
    const redWoolMat = new THREE.MeshLambertMaterial({ map: mcTextures.getWool('#cf2828') });
    const leftMarker = new THREE.Mesh(leftMarkerGeo, redWoolMat);
    leftMarker.position.set(-5, 0.04, 0);
    this.scene.add(leftMarker);

    // Right Team Win Marker (Blue Wool)
    const rightMarkerGeo = new THREE.BoxGeometry(0.4, 0.08, 4.2);
    const blueWoolMat = new THREE.MeshLambertMaterial({ map: mcTextures.getWool('#286acf') });
    const rightMarker = new THREE.Mesh(rightMarkerGeo, blueWoolMat);
    rightMarker.position.set(5, 0.04, 0);
    this.scene.add(rightMarker);

    // Wooden sideline fences
    this.buildFences();
  }

  buildFences() {
    const oakLog = mcTextures.getOakLogSide();
    const fenceMat = new THREE.MeshLambertMaterial({ map: oakLog });

    // Back fence posts
    for (let x = -18; x <= 18; x += 3) {
      const postGeo = new THREE.BoxGeometry(0.3, 1.2, 0.3);
      const post = new THREE.Mesh(postGeo, fenceMat);
      post.position.set(x, 0.6, -3.2);
      post.castShadow = true;
      this.scene.add(post);

      if (x < 18) {
        const railGeo = new THREE.BoxGeometry(3, 0.15, 0.15);
        const rail1 = new THREE.Mesh(railGeo, fenceMat);
        rail1.position.set(x + 1.5, 0.45, -3.2);
        const rail2 = new THREE.Mesh(railGeo, fenceMat);
        rail2.position.set(x + 1.5, 0.85, -3.2);
        this.scene.add(rail1);
        this.scene.add(rail2);
      }
    }
  }

  // --- TREES & DECORATIONS ---
  buildTreesAndDecor() {
    const logTex = mcTextures.getOakLogSide();
    const leafTex = mcTextures.getOakLeaves();

    const treePositions = [
      { x: -16, z: -7 },
      { x: -10, z: -9 },
      { x: 10, z: -8 },
      { x: 17, z: -6 },
      { x: -22, z: -2 },
      { x: 22, z: -3 }
    ];

    treePositions.forEach(pos => {
      const treeGroup = new THREE.Group();

      // Trunk (4 oak blocks stacked)
      const trunkMat = new THREE.MeshLambertMaterial({ map: logTex });
      const trunkGeo = new THREE.BoxGeometry(0.8, 3.2, 0.8);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(0, 1.6, 0);
      trunk.castShadow = true;
      treeGroup.add(trunk);

      // Leaves (blocky 3D canopy)
      const leafMat = new THREE.MeshLambertMaterial({ map: leafTex });
      const leafLowerGeo = new THREE.BoxGeometry(3.2, 1.6, 3.2);
      const leafLower = new THREE.Mesh(leafLowerGeo, leafMat);
      leafLower.position.set(0, 3.6, 0);
      leafLower.castShadow = true;
      treeGroup.add(leafLower);

      const leafUpperGeo = new THREE.BoxGeometry(1.8, 1.2, 1.8);
      const leafUpper = new THREE.Mesh(leafUpperGeo, leafMat);
      leafUpper.position.set(0, 4.8, 0);
      leafUpper.castShadow = true;
      treeGroup.add(leafUpper);

      treeGroup.position.set(pos.x, 0, pos.z);
      this.scene.add(treeGroup);
    });

    // Minecraft Flowers (Dandelions & Poppies)
    const redMat = new THREE.MeshLambertMaterial({ color: 0xdb2424 });
    const yellowMat = new THREE.MeshLambertMaterial({ color: 0xf5d42c });

    for (let i = 0; i < 20; i++) {
      const flowerGroup = new THREE.Group();
      const stemGeo = new THREE.BoxGeometry(0.08, 0.4, 0.08);
      const stemMat = new THREE.MeshLambertMaterial({ color: 0x4d7c2a });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = 0.2;
      flowerGroup.add(stem);

      const petalGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
      const petal = new THREE.Mesh(petalGeo, (i % 2 === 0) ? redMat : yellowMat);
      petal.position.y = 0.45;
      flowerGroup.add(petal);

      const fx = (Math.random() - 0.5) * 36;
      const fz = 3.5 + Math.random() * 3.5;
      flowerGroup.position.set(fx, 0, fz);
      this.scene.add(flowerGroup);
    }
  }

  // --- SPECTATORS (Minecraft Pig & Sheep) ---
  buildSpectators() {
    // 2 Cheering Pigs
    const pigTex = mcTextures.getPigTexture();
    const pigMat = new THREE.MeshLambertMaterial({ map: pigTex });

    const createPig = (x, z) => {
      const pig = new THREE.Group();
      // Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.6), pigMat);
      body.position.y = 0.7;
      body.castShadow = true;
      pig.add(body);
      // Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), pigMat);
      head.position.set(0, 1.0, 0.9);
      head.castShadow = true;
      pig.add(head);
      // Legs
      for (let lx of [-0.4, 0.4]) {
        for (let lz of [-0.5, 0.5]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), pigMat);
          leg.position.set(lx, 0.25, lz);
          pig.add(leg);
        }
      }
      pig.position.set(x, 0, z);
      pig.userData = { baseY: 0, hopOffset: Math.random() * 6 };
      this.spectators.push(pig);
      this.scene.add(pig);
    };

    createPig(-8, -4.2);
    createPig(8, -4.2);

    // 2 Cheering Sheep
    const sheepTex = mcTextures.getSheepTexture();
    const sheepMat = new THREE.MeshLambertMaterial({ map: sheepTex });

    const createSheep = (x, z) => {
      const sheep = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 1.7), sheepMat);
      body.position.y = 0.85;
      body.castShadow = true;
      sheep.add(body);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.75), sheepMat);
      head.position.set(0, 1.15, 1.0);
      head.castShadow = true;
      sheep.add(head);

      for (let lx of [-0.4, 0.4]) {
        for (let lz of [-0.5, 0.5]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.6, 0.28), sheepMat);
          leg.position.set(lx, 0.3, lz);
          sheep.add(leg);
        }
      }
      sheep.position.set(x, 0, z);
      sheep.userData = { baseY: 0, hopOffset: Math.random() * 6 };
      this.spectators.push(sheep);
      this.scene.add(sheep);
    };

    createSheep(-13, -4.5);
    createSheep(13, -4.5);
  }

  // --- THE ROPE ---
  buildRope() {
    this.ropeGroup = new THREE.Group();

    // Long braided rope cylinder / block
    const ropeTex = mcTextures.getRope();
    const ropeMat = new THREE.MeshLambertMaterial({ map: ropeTex });
    // Rope length 24 units, diameter 0.18
    const ropeGeo = new THREE.CylinderGeometry(0.09, 0.09, 26, 8);
    ropeGeo.rotateZ(Math.PI / 2); // Lay horizontal along X
    this.ropeMesh = new THREE.Mesh(ropeGeo, ropeMat);
    this.ropeMesh.position.set(0, 0.85, 0);
    this.ropeMesh.castShadow = true;
    this.ropeGroup.add(this.ropeMesh);

    // Center Red Ribbon Marker
    const ribbonGeo = new THREE.BoxGeometry(0.25, 0.55, 0.25);
    const ribbonMat = new THREE.MeshLambertMaterial({ color: 0xee2222 });
    this.ropeRibbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    this.ropeRibbon.position.set(0, 0.72, 0);
    this.ropeRibbon.castShadow = true;
    this.ropeGroup.add(this.ropeRibbon);

    this.scene.add(this.ropeGroup);
  }

  // --- MINECRAFT CHARACTERS CREATION ---
  createMinecraftCharacter(options = {}) {
    const char = new THREE.Group();

    const isSteve = options.type === 'steve';
    const isDiamond = options.armor === 'diamond';
    const isGold = options.armor === 'gold';
    const isIron = options.armor === 'iron';

    // Face / Head textures
    const headMat = isSteve
      ? [
          new THREE.MeshLambertMaterial({ map: mcTextures.getSteveFace() }), // Right
          new THREE.MeshLambertMaterial({ map: mcTextures.getSteveFace() }), // Left
          new THREE.MeshLambertMaterial({ color: 0x4a3219 }), // Top (Hair)
          new THREE.MeshLambertMaterial({ color: 0xbc8b68 }), // Bottom (Neck)
          new THREE.MeshLambertMaterial({ map: mcTextures.getSteveFace() }), // Front (Face)
          new THREE.MeshLambertMaterial({ color: 0x4a3219 })  // Back (Hair)
        ]
      : [
          new THREE.MeshLambertMaterial({ map: mcTextures.getAlexFace() }),
          new THREE.MeshLambertMaterial({ map: mcTextures.getAlexFace() }),
          new THREE.MeshLambertMaterial({ color: 0xb35222 }), // Top
          new THREE.MeshLambertMaterial({ color: 0xf2cead }), // Bottom
          new THREE.MeshLambertMaterial({ map: mcTextures.getAlexFace() }),
          new THREE.MeshLambertMaterial({ color: 0xb35222 })
        ];

    // Armor overlay materials if equipped
    let bodyMat = isSteve
      ? new THREE.MeshLambertMaterial({ map: mcTextures.getSteveBody() })
      : new THREE.MeshLambertMaterial({ map: mcTextures.getAlexBody() });

    if (isDiamond) bodyMat = new THREE.MeshLambertMaterial({ map: mcTextures.getDiamondArmor() });
    if (isGold) bodyMat = new THREE.MeshLambertMaterial({ map: mcTextures.getGoldArmor() });
    if (isIron) bodyMat = new THREE.MeshLambertMaterial({ map: mcTextures.getIronArmor() });

    const armMat = isSteve
      ? new THREE.MeshLambertMaterial({ map: mcTextures.getSteveArm() })
      : new THREE.MeshLambertMaterial({ map: mcTextures.getAlexArm() });

    const legMat = isSteve
      ? new THREE.MeshLambertMaterial({ map: mcTextures.getSteveLeg() })
      : new THREE.MeshLambertMaterial({ map: mcTextures.getAlexLeg() });

    // 1. Torso (0.75w x 1.1h x 0.4d)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.1, 0.4), bodyMat);
    torso.position.y = 1.25;
    torso.castShadow = true;
    char.add(torso);

    // 2. Head (0.7w x 0.7h x 0.7d)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), headMat);
    head.position.y = 2.15;
    head.castShadow = true;
    char.add(head);

    // If helmet
    if (isDiamond || isGold || isIron) {
      const helmetMat = isDiamond ? mcTextures.getDiamondArmor() : (isGold ? mcTextures.getGoldArmor() : mcTextures.getIronArmor());
      const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.5, 0.78), new THREE.MeshLambertMaterial({ map: helmetMat }));
      helmet.position.y = 2.3;
      char.add(helmet);
    }

    // 3. Arms (Pivot at shoulder)
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.52, 1.7, 0);
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.0, 0.35), armMat);
    leftArm.position.y = -0.45;
    leftArm.castShadow = true;
    leftArmGroup.add(leftArm);
    char.add(leftArmGroup);

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.52, 1.7, 0);
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.0, 0.35), armMat);
    rightArm.position.y = -0.45;
    rightArm.castShadow = true;
    rightArmGroup.add(rightArm);
    char.add(rightArmGroup);

    // 4. Legs
    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-0.2, 0.7, 0);
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 0.35), legMat);
    leftLeg.position.y = -0.35;
    leftLeg.castShadow = true;
    leftLegGroup.add(leftLeg);
    char.add(leftLegGroup);

    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(0.2, 0.7, 0);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 0.35), legMat);
    rightLeg.position.y = -0.35;
    rightLeg.castShadow = true;
    rightLegGroup.add(rightLeg);
    char.add(rightLegGroup);

    // References for dynamic animation
    char.userData = {
      baseX: options.x || 0,
      baseZ: options.z || 0,
      team: options.team, // 'A' or 'B'
      torso,
      head,
      leftArmGroup,
      rightArmGroup,
      leftLegGroup,
      rightLegGroup,
      stumble: 0,
      pullExertion: 0
    };

    char.position.set(options.x || 0, 0, options.z || 0);

    return char;
  }

  // --- SPAWN BOTH TEAMS (5 characters each!) ---
  spawnTeams() {
    // Team A (Left side - Steve Team)
    // Pulls to the left (-X)
    const teamAConfigs = [
      { type: 'steve', armor: 'diamond', offset: -2.0, z: 0.1 },
      { type: 'steve', armor: 'none',    offset: -3.6, z: -0.1 },
      { type: 'steve', armor: 'iron',    offset: -5.2, z: 0.1 },
      { type: 'steve', armor: 'none',    offset: -6.8, z: -0.1 },
      { type: 'steve', armor: 'diamond', offset: -8.4, z: 0.05 }
    ];

    teamAConfigs.forEach((cfg, idx) => {
      const char = this.createMinecraftCharacter({
        team: 'A',
        type: cfg.type,
        armor: cfg.armor,
        x: cfg.offset,
        z: cfg.z
      });
      // Facing the rope center (facing +X) with lean backward (-Z/X)
      char.rotation.y = Math.PI / 2; // Face towards center
      this.teamACharacters.push(char);
      this.scene.add(char);
    });

    // Team B (Right side - Alex Team)
    // Pulls to the right (+X)
    const teamBConfigs = [
      { type: 'alex', armor: 'gold', offset: 2.0, z: -0.1 },
      { type: 'alex', armor: 'none', offset: 3.6, z: 0.1 },
      { type: 'alex', armor: 'gold', offset: 5.2, z: -0.1 },
      { type: 'alex', armor: 'none', offset: 6.8, z: 0.1 },
      { type: 'alex', armor: 'gold', offset: 8.4, z: -0.05 }
    ];

    teamBConfigs.forEach((cfg, idx) => {
      const char = this.createMinecraftCharacter({
        team: 'B',
        type: cfg.type,
        armor: cfg.armor,
        x: cfg.offset,
        z: cfg.z
      });
      // Facing towards center (-X)
      char.rotation.y = -Math.PI / 2;
      this.teamBCharacters.push(char);
      this.scene.add(char);
    });
  }

  // --- PULL / TUG MECHANICS ---
  triggerTug(team) {
    this.pullingTeam = team;
    
    // Spawn dust particles from characters' boots
    const characters = (team === 'A') ? this.teamACharacters : this.teamBCharacters;
    characters.forEach(c => {
      c.userData.pullExertion = 1.0;
      this.spawnDust(c.position.x, 0.15, c.position.z);
    });

    // Opposing team stumbles slightly forward
    const opposing = (team === 'A') ? this.teamBCharacters : this.teamACharacters;
    opposing.forEach(c => {
      c.userData.stumble = 0.8;
    });

    // Camera micro-shake
    this.cameraShake = 0.15;
  }

  setRopePosition(value) {
    // value ranges from e.g. -5 (Team A wins) to +5 (Team B wins)
    this.targetRopeOffset = value;
  }

  spawnDust(x, y, z) {
    for (let i = 0; i < 4; i++) {
      const pGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      const pMat = new THREE.MeshBasicMaterial({ color: 0x866043 });
      const p = new THREE.Mesh(pGeo, pMat);
      p.position.set(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4);
      p.userData = {
        vx: (Math.random() - 0.5) * 0.05,
        vy: 0.03 + Math.random() * 0.04,
        vz: (Math.random() - 0.5) * 0.05,
        life: 25
      };
      this.particles.push(p);
      this.scene.add(p);
    }
  }

  spawnFirework() {
    const colors = [0xff2222, 0x22ff22, 0x2288ff, 0xffea00, 0xff00ea, 0x00ffff];
    const fx = (Math.random() - 0.5) * 16;
    const fy = 8 + Math.random() * 6;
    const fz = -2 + (Math.random() - 0.5) * 6;

    for (let i = 0; i < 35; i++) {
      const pGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const col = colors[Math.floor(Math.random() * colors.length)];
      const pMat = new THREE.MeshBasicMaterial({ color: col });
      const p = new THREE.Mesh(pGeo, pMat);
      p.position.set(fx, fy, fz);

      const angle = Math.random() * Math.PI * 2;
      const speed = 0.08 + Math.random() * 0.14;
      p.userData = {
        vx: Math.cos(angle) * speed,
        vy: (Math.random() - 0.2) * speed * 1.5,
        vz: Math.sin(angle) * speed,
        life: 45
      };
      this.particles.push(p);
      this.scene.add(p);
    }
  }

  setVictory(winnerTeam) {
    this.isVictory = true;
    this.winningTeam = winnerTeam;
  }

  reset() {
    this.ropeOffset = 0;
    this.targetRopeOffset = 0;
    this.pullingTeam = null;
    this.isVictory = false;
    this.winningTeam = null;

    // Reset character positions
    this.teamACharacters.forEach(c => {
      c.position.x = c.userData.baseX;
      c.userData.stumble = 0;
      c.userData.pullExertion = 0;
      c.rotation.set(0, Math.PI / 2, 0);
    });

    this.teamBCharacters.forEach(c => {
      c.position.x = c.userData.baseX;
      c.userData.stumble = 0;
      c.userData.pullExertion = 0;
      c.rotation.set(0, -Math.PI / 2, 0);
    });

    if (this.ropeGroup) {
      this.ropeGroup.position.x = 0;
    }
  }

  // --- ANIMATION FRAME LOOP ---
  animate() {
    requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // 1. Smooth rope movement
    this.ropeOffset += (this.targetRopeOffset - this.ropeOffset) * 0.12;
    if (this.ropeGroup) {
      this.ropeGroup.position.x = this.ropeOffset;
      // Slight vertical bounce during movement
      this.ropeGroup.position.y = Math.sin(time * 12) * 0.02;
    }

    // 2. Clouds horizontal drifting
    this.clouds.forEach(cloud => {
      cloud.position.x += cloud.userData.speed;
      if (cloud.position.x > 45) cloud.position.x = -45;
    });

    // 3. Spectator animals hop & cheer
    this.spectators.forEach(sp => {
      const hop = Math.max(0, Math.sin(time * 4 + sp.userData.hopOffset)) * 0.25;
      sp.position.y = sp.userData.baseY + hop;
    });

    // 4. Update Character Animations
    // Team A (Steve)
    this.teamACharacters.forEach((char, idx) => {
      // Follow the rope offset
      char.position.x = char.userData.baseX + this.ropeOffset;

      if (this.isVictory) {
        if (this.winningTeam === 'A') {
          // Jumping victory dance!
          char.position.y = Math.max(0, Math.sin(time * 8 + idx)) * 0.6;
          char.userData.leftArmGroup.rotation.x = -Math.PI * 0.8; // Arms raised high
          char.userData.rightArmGroup.rotation.x = -Math.PI * 0.8;
          char.userData.head.rotation.y = Math.sin(time * 6) * 0.3;
        } else {
          // Defeated sad slump
          char.position.y = 0;
          char.rotation.z = 0.4;
          char.userData.head.rotation.x = 0.4;
        }
      } else {
        // Active Tug-of-war pulling stance
        char.userData.pullExertion *= 0.92;
        char.userData.stumble *= 0.90;

        // Lean back angle (tug of war exertion)
        const baseLean = -0.35 - (char.userData.pullExertion * 0.35) + (char.userData.stumble * 0.4);
        char.rotation.z = baseLean; // leans back along X direction

        // Breathing / tension bob
        const breathe = Math.sin(time * 3 + idx * 0.5) * 0.03;
        char.position.y = breathe;

        // Arms gripping the rope forward
        char.userData.leftArmGroup.rotation.x = -0.9 + Math.sin(time * 6) * 0.05;
        char.userData.rightArmGroup.rotation.x = -0.7 - Math.sin(time * 6) * 0.05;

        // Legs braced apart
        char.userData.leftLegGroup.rotation.x = 0.4;
        char.userData.rightLegGroup.rotation.x = -0.3;
      }
    });

    // Team B (Alex)
    this.teamBCharacters.forEach((char, idx) => {
      char.position.x = char.userData.baseX + this.ropeOffset;

      if (this.isVictory) {
        if (this.winningTeam === 'B') {
          // Jumping victory dance!
          char.position.y = Math.max(0, Math.sin(time * 8 + idx)) * 0.6;
          char.userData.leftArmGroup.rotation.x = -Math.PI * 0.8;
          char.userData.rightArmGroup.rotation.x = -Math.PI * 0.8;
          char.userData.head.rotation.y = Math.sin(time * 6) * 0.3;
        } else {
          // Defeated sad slump
          char.position.y = 0;
          char.rotation.z = -0.4;
          char.userData.head.rotation.x = 0.4;
        }
      } else {
        char.userData.pullExertion *= 0.92;
        char.userData.stumble *= 0.90;

        // Team B leans in opposite direction
        const baseLean = 0.35 + (char.userData.pullExertion * 0.35) - (char.userData.stumble * 0.4);
        char.rotation.z = baseLean;

        const breathe = Math.sin(time * 3 + idx * 0.5) * 0.03;
        char.position.y = breathe;

        char.userData.leftArmGroup.rotation.x = -0.9 + Math.sin(time * 6) * 0.05;
        char.userData.rightArmGroup.rotation.x = -0.7 - Math.sin(time * 6) * 0.05;

        char.userData.leftLegGroup.rotation.x = 0.4;
        char.userData.rightLegGroup.rotation.x = -0.3;
      }
    });

    // 5. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.position.x += p.userData.vx;
      p.position.y += p.userData.vy;
      p.position.z += p.userData.vz;
      p.userData.vy -= 0.002; // gravity
      p.userData.life--;
      if (p.userData.life <= 0) {
        this.scene.remove(p);
        this.particles.splice(i, 1);
      }
    }

    // 6. Camera shake
    if (this.cameraShake > 0) {
      this.camera.position.x = (Math.random() - 0.5) * this.cameraShake;
      this.camera.position.y = 7.5 + (Math.random() - 0.5) * this.cameraShake;
      this.cameraShake *= 0.88;
      if (this.cameraShake < 0.01) {
        this.cameraShake = 0;
        this.camera.position.set(0, 7.5, 17.5);
      }
    }

    // 7. Victory fireworks periodic trigger
    if (this.isVictory && Math.random() < 0.06) {
      this.spawnFirework();
      if (typeof sound !== 'undefined') {
        sound.playFirework();
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}
