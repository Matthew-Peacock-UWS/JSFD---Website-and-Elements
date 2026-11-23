import {
    Color3,
    Engine,
    GlowLayer,
    Mesh,
    MeshBuilder,
    PhysicsAggregate,
    PhysicsShapeType,
    PointLight,
    Scene,
    StandardMaterial,
    Vector3
} from "@babylonjs/core";
import { runScene } from "../shared/engine";
import { addFog, createNightLighting } from "../shared/environment";
import { MaterialLibrary } from "../shared/materials";
import { enablePhysics } from "../shared/physics";
import { Player } from "../shared/player";
import { createBarrel, createCrate, createLampPost } from "../shared/props";
import { flatDistance } from "../shared/util";
import { Zombie } from "../shared/zombie";


// =========================================
// Element 3 - Supply Run
// =========================================
// A movable, animated player (imported .glb character) that interacts with physics objects.
// Push the supply crates into the green safe zone and knock over the zombie training dummies.
// Physics: Havok. The player has an animated capsule body that pushes dynamic bodies.

const YARD = 34; // size of the walled yard


async function createScene(engine: Engine): Promise<Scene> {
    const scene = new Scene(engine);
    addFog(scene, 0.02, "#161a18");
    const { shadows } = createNightLighting(scene, 0.8, 0.4);
    new GlowLayer("glow", scene).intensity = 0.6;
    await enablePhysics(scene);
    const lib = new MaterialLibrary(scene);

    // =========================================
    // Yard: static physics ground and walls
    // =========================================

    const ground = MeshBuilder.CreateBox("ground", { width: YARD, height: 1, depth: YARD }, scene);
    ground.position.y = -0.5;
    ground.material = lib.concrete;
    ground.receiveShadows = true;
    new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, scene);

    const wallH = 2.5;
    const walls: [number, number, number, number][] = [
        [0, YARD / 2, YARD, 0.6],
        [0, -YARD / 2, YARD, 0.6],
        [YARD / 2, 0, 0.6, YARD],
        [-YARD / 2, 0, 0.6, YARD]
    ];
    for (const [x, z, w, d] of walls) {
        const wall = MeshBuilder.CreateBox("wall", { width: w, height: wallH, depth: d }, scene);
        wall.position.set(x, wallH / 2, z);
        wall.material = lib.brick(Math.max(w, d), wallH);
        wall.checkCollisions = true; // blocks the player
        wall.receiveShadows = true;
        new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0 }, scene); // blocks physics objects
    }

    // Floodlights in two corners
    for (const [x, z, rot] of [
        [-15, -15, Math.PI / 4],
        [15, 15, -Math.PI * 0.75]
    ] as [number, number, number][]) {
        const lamp = createLampPost(scene, lib, new Vector3(x, 0, z), rot);
        lamp.light.intensity = 1.2;
        lamp.light.range = 22;
        lamp.mesh.checkCollisions = true;
        shadows.addShadowCaster(lamp.mesh);
    }

    // =========================================
    // Safe zone
    // =========================================

    const zoneCentre = new Vector3(0, 0, 11);
    const zoneSize = 6;
    const zone = MeshBuilder.CreateGround("safeZone", { width: zoneSize, height: zoneSize }, scene);
    zone.position.set(zoneCentre.x, 0.02, zoneCentre.z);
    const zoneMat = new StandardMaterial("zoneMat", scene);
    zoneMat.diffuseColor = new Color3(0.1, 0.4, 0.15);
    zoneMat.emissiveColor = new Color3(0.05, 0.35, 0.1);
    zoneMat.alpha = 0.6;
    zone.material = zoneMat;
    const zoneLight = new PointLight("zoneLight", zoneCentre.add(new Vector3(0, 3, 0)), scene);
    zoneLight.diffuse = new Color3(0.3, 1, 0.4);
    zoneLight.intensity = 0.6;
    zoneLight.range = 8;

    // Hazard border around the zone
    for (const [x, z, w, d] of [
        [0, 3, 6.4, 0.2],
        [0, -3, 6.4, 0.2],
        [3, 0, 0.2, 6.4],
        [-3, 0, 0.2, 6.4]
    ]) {
        const edge = MeshBuilder.CreateBox("zoneEdge", { width: w, height: 0.06, depth: d }, scene);
        edge.position.set(zoneCentre.x + x, 0.03, zoneCentre.z + z);
        edge.material = lib.hazard;
    }

    // =========================================
    // Dynamic physics objects
    // =========================================

    const securedMat = lib.crate.clone("securedCrate");
    securedMat.emissiveColor = new Color3(0.05, 0.3, 0.08);

    const crates: Mesh[] = [];
    const cratePositions = [
        [-6, -4],
        [-2, -6],
        [3, -3],
        [7, -7],
        [-9, 3],
        [8, 2]
    ];
    cratePositions.forEach(([x, z], i) => {
        const crate = createCrate(scene, lib, 1, `crate${i}`);
        crate.position.set(x, 0.5, z);
        crate.rotation.y = i;
        new PhysicsAggregate(
            crate,
            PhysicsShapeType.BOX,
            { mass: 1, friction: 0.6, restitution: 0.1 },
            scene
        );
        shadows.addShadowCaster(crate);
        crates.push(crate);
    });

    // A pyramid of crates to knock down
    let n = 0;
    for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 3 - row; i++) {
            const crate = createCrate(scene, lib, 0.9, `stack${n++}`);
            crate.position.set(-10 + i * 0.92 + row * 0.46, 0.45 + row * 0.9, -10);
            new PhysicsAggregate(crate, PhysicsShapeType.BOX, { mass: 0.8, friction: 0.6 }, scene);
            shadows.addShadowCaster(crate);
            crates.push(crate);
        }
    }

    // Barrels that roll over when pushed
    [
        [10, -10],
        [11, -9.2],
        [10.4, -8.3]
    ].forEach(([x, z], i) => {
        const barrel = createBarrel(scene, lib, `barrel${i}`);
        barrel.position.set(x, 0.55, z);
        new PhysicsAggregate(
            barrel,
            PhysicsShapeType.CYLINDER,
            { mass: 1.5, friction: 0.4 },
            scene
        );
        shadows.addShadowCaster(barrel);
    });

    // Zombie training dummies: a zombie model riding on an invisible physics box
    [
        [-4, 5],
        [4, 6],
        [12, -2]
    ].forEach(([x, z], i) => {
        const collider = MeshBuilder.CreateBox(
            `dummyCollider${i}`,
            { width: 0.7, height: 1.8, depth: 0.5 },
            scene
        );
        collider.position.set(x, 0.9, z);
        collider.isVisible = false;
        const zombie = new Zombie(scene, {
            position: new Vector3(0, -0.9, 0),
            shadows,
            collisions: false
        });
        zombie.active = false; // stands still and sways
        zombie.heading = Math.PI;
        zombie.root.parent = collider;
        new PhysicsAggregate(collider, PhysicsShapeType.BOX, { mass: 2, friction: 0.7 }, scene);
    });

    // =========================================
    // Player
    // =========================================

    const player = await Player.create(scene, {
        position: new Vector3(0, 0, -12),
        heading: 0,
        speed: 3,
        physicsPush: true,
        shadows
    });

    // =========================================
    // Interaction: crates in the safe zone
    // =========================================

    const counter = document.getElementById("counter");
    let lastSecured = -1;
    scene.onBeforeRenderObservable.add(() => {
        let secured = 0;
        for (const crate of crates) {
            const inZone =
                Math.abs(crate.position.x - zoneCentre.x) < zoneSize / 2 &&
                Math.abs(crate.position.z - zoneCentre.z) < zoneSize / 2;
            crate.material = inZone ? securedMat : lib.crate;
            if (inZone) secured++;
        }
        if (secured !== lastSecured && counter) {
            counter.textContent = `${secured} / ${crates.length} crates secured`;
            lastSecured = secured;
        }
        // Safe-zone light pulses when the player is inside it
        const inside = flatDistance(player.position, zoneCentre) < zoneSize / 2;
        zoneLight.intensity = inside ? 1.2 + Math.sin(performance.now() / 150) * 0.3 : 0.6;
    });

    return scene;
}

void runScene(createScene);
