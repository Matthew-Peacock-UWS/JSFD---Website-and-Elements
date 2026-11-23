import {
    Animation,
    ArcRotateCamera,
    Color3,
    Engine,
    GlowLayer,
    Mesh,
    MeshBuilder,
    Scene,
    SpotLight,
    TransformNode,
    Vector3
} from "@babylonjs/core";
import { addFlicker, addFog, createNightLighting } from "../shared/environment";
import { fadeInfoPanel, runScene } from "../shared/engine";
import { MaterialLibrary } from "../shared/materials";
import { createBarrel, createCrate, createLampPost, createSandbagWall } from "../shared/props";
import { Zombie } from "../shared/zombie";


// =========================================
// Element 1 - Checkpoint
// =========================================
// Basic shapes, textures, lighting, shadows and motion.
// An abandoned quarantine checkpoint at night: a guard booth with a spinning
// warning beacon, a barrier arm that raises and lowers (keyframe animation),
// a floating infection sample, a flickering lamp and a zombie pacing the fence.

async function createScene(engine: Engine): Promise<Scene> {
    const scene = new Scene(engine);
    addFog(scene, 0.028, "#141816");

    // Camera - orbit the checkpoint with the mouse
    const camera = new ArcRotateCamera(
        "camera",
        -Math.PI / 2.6,
        1.1,
        22,
        new Vector3(0, 1.2, 0),
        scene
    );
    camera.attachControl(true);
    camera.lowerRadiusLimit = 8;
    camera.upperRadiusLimit = 34;
    camera.upperBetaLimit = 1.45;
    camera.wheelDeltaPercentage = 0.01;
    camera.panningSensibility = 0;

    // Lighting: ambient + moonlight with shadows
    const { shadows } = createNightLighting(scene, 0.75, 0.3);
    new GlowLayer("glow", scene).intensity = 0.8;

    const lib = new MaterialLibrary(scene);

    // =========================================
    // Basic shapes with textures
    // =========================================

    // Ground (plane)
    const ground = MeshBuilder.CreateGround("ground", { width: 44, height: 44 }, scene);
    ground.material = lib.concrete;
    ground.receiveShadows = true;

    // Road markings (thin boxes)
    for (let z = -18; z <= 18; z += 4) {
        const line = MeshBuilder.CreateBox(
            "roadLine",
            { width: 0.25, height: 0.02, depth: 2 },
            scene
        );
        line.position.set(0, 0.01, z);
        line.material = lib.white;
        line.receiveShadows = true;
    }

    // Guard booth (boxes)
    const booth = MeshBuilder.CreateBox("booth", { width: 3, height: 2.6, depth: 3 }, scene);
    booth.position.set(-4.5, 1.3, 0);
    booth.material = lib.concreteSmall;
    booth.receiveShadows = true;

    const boothRoof = MeshBuilder.CreateBox(
        "boothRoof",
        { width: 3.6, height: 0.2, depth: 3.6 },
        scene
    );
    boothRoof.position.set(-4.5, 2.7, 0);
    boothRoof.material = lib.blackMetal;

    const boothWindow = MeshBuilder.CreateBox(
        "boothWindow",
        { width: 0.05, height: 0.9, depth: 2 },
        scene
    );
    boothWindow.position.set(-2.98, 1.6, 0);
    boothWindow.material = lib.litWindow;

    // Barrier: post (box), counterweight (cylinder) and striped arm on a pivot
    const post = MeshBuilder.CreateBox(
        "barrierPost",
        { width: 0.5, height: 1.2, depth: 0.5 },
        scene
    );
    post.position.set(-2.3, 0.6, -2.2);
    post.material = lib.blackMetal;

    const pivot = new TransformNode("barrierPivot", scene);
    pivot.position.set(-2.3, 1.1, -2.2);

    const arm = MeshBuilder.CreateBox("barrierArm", { width: 6, height: 0.18, depth: 0.18 }, scene);
    arm.parent = pivot;
    arm.position.x = 3;
    arm.material = lib.hazard;

    const weight = MeshBuilder.CreateCylinder(
        "counterweight",
        { diameter: 0.45, height: 0.4 },
        scene
    );
    weight.parent = pivot;
    weight.rotation.z = Math.PI / 2;
    weight.position.x = -0.45;
    weight.material = lib.blackMetal;

    // Sandbag walls, crates and barrels
    const sandbagsA = createSandbagWall(scene, lib, 7);
    sandbagsA.position.set(5, 0, -3);
    sandbagsA.rotation.y = 0.2;
    const sandbagsB = sandbagsA.clone("sandbagsB");
    sandbagsB.position.set(-9.5, 0, -3.5);
    sandbagsB.rotation.y = -0.3;

    const crates: Mesh[] = [];
    const cratePositions: [number, number, number, number][] = [
        [6, 0, 2, 1.2],
        [7.3, 0, 2.3, 1],
        [6.6, 1.1, 2.1, 1],
        [-7.5, 0, 2.5, 1.2],
        [-8.6, 0, 1.6, 0.9]
    ];
    cratePositions.forEach(([x, y, z, size], i) => {
        const crate = createCrate(scene, lib, size, `crate${i}`);
        crate.position.set(x, y + size / 2, z);
        crate.rotation.y = i * 0.4;
        crates.push(crate);
    });

    const barrels: Mesh[] = [];
    [
        [4, 4.5],
        [4.8, 5.3],
        [3.6, 5.6],
        [-6, -6]
    ].forEach(([x, z], i) => {
        const barrel = createBarrel(scene, lib, `barrel${i}`);
        barrel.position.set(x, 0.55, z);
        barrels.push(barrel);
    });
    // One barrel knocked over
    barrels[3].rotation.z = Math.PI / 2;
    barrels[3].position.y = 0.375;

    // Quarantine fence (thin boxes) behind the checkpoint
    const fencePosts: Mesh[] = [];
    for (let x = -20; x <= 20; x += 2.5) {
        if (Math.abs(x) < 3) continue; // gap for the road
        const fencePost = MeshBuilder.CreateBox(
            "fencePost",
            { width: 0.12, height: 2.4, depth: 0.12 },
            scene
        );
        fencePost.position.set(x, 1.2, 7);
        fencePost.material = lib.blackMetal;
        fencePosts.push(fencePost);
    }
    for (const side of [-1, 1]) {
        const mesh = MeshBuilder.CreatePlane("fenceMesh", { width: 17, height: 2.2 }, scene);
        mesh.position.set(side * 11.5, 1.2, 7);
        const wire = lib.blackMetal.clone("wire");
        wire.alpha = 0.25;
        mesh.material = wire;
    }

    // =========================================
    // Lights
    // =========================================

    // Flickering street lamp (point light)
    const lamp = createLampPost(scene, lib, new Vector3(3, 0, -5), Math.PI);
    addFlicker(scene, lamp.light, 1.1, 0.6);

    // Spinning warning beacon (cylinder + spot light) on the booth roof
    const beaconBase = MeshBuilder.CreateCylinder(
        "beaconBase",
        { diameter: 0.5, height: 0.15 },
        scene
    );
    beaconBase.position.set(-4.5, 2.88, 0);
    beaconBase.material = lib.blackMetal;
    const beacon = MeshBuilder.CreateCylinder("beacon", { diameter: 0.35, height: 0.35 }, scene);
    beacon.position.set(-4.5, 3.1, 0);
    beacon.material = lib.redLight;

    const beaconPivot = new TransformNode("beaconPivot", scene);
    beaconPivot.position.set(-4.5, 3.1, 0);
    const beaconLight = new SpotLight(
        "beaconLight",
        Vector3.Zero(),
        new Vector3(1, -0.35, 0),
        Math.PI / 3,
        6,
        scene
    );
    beaconLight.parent = beaconPivot;
    beaconLight.diffuse = new Color3(1, 0.15, 0.05);
    beaconLight.intensity = 2.5;
    beaconLight.range = 25;

    // Floating infection sample (sphere + torus rings) on a table
    const table = MeshBuilder.CreateCylinder(
        "table",
        { diameter: 1.2, height: 0.9, tessellation: 24 },
        scene
    );
    table.position.set(1.8, 0.45, 3.5);
    table.material = lib.metal;
    const sample = MeshBuilder.CreateSphere("sample", { diameter: 0.45, segments: 24 }, scene);
    sample.position.set(1.8, 1.6, 3.5);
    sample.material = lib.toxic;
    const ringA = MeshBuilder.CreateTorus(
        "ringA",
        { diameter: 0.9, thickness: 0.04, tessellation: 40 },
        scene
    );
    ringA.parent = sample;
    ringA.material = lib.blackMetal;
    const ringB = ringA.clone("ringB");
    ringB.parent = sample;
    ringB.rotation.x = Math.PI / 2;

    // =========================================
    // Shadows
    // =========================================

    for (const mesh of [
        booth,
        boothRoof,
        post,
        arm,
        weight,
        sandbagsA,
        sandbagsB,
        lamp.mesh,
        table,
        sample,
        ...crates,
        ...barrels,
        ...fencePosts
    ]) {
        shadows.addShadowCaster(mesh);
        mesh.receiveShadows = true;
    }

    // =========================================
    // Motion
    // =========================================

    // 1. Keyframe animation: the barrier arm raises, waits, then lowers (Animation class)
    const frameRate = 30;
    const raise = new Animation(
        "barrierRaise",
        "rotation.z",
        frameRate,
        Animation.ANIMATIONTYPE_FLOAT,
        Animation.ANIMATIONLOOPMODE_CYCLE
    );
    raise.setKeys([
        { frame: 0, value: 0 },
        { frame: 2 * frameRate, value: 0 },
        { frame: 3.5 * frameRate, value: Math.PI / 2.3 },
        { frame: 6 * frameRate, value: Math.PI / 2.3 },
        { frame: 7.5 * frameRate, value: 0 }
    ]);
    pivot.animations.push(raise);
    scene.beginAnimation(pivot, 0, 7.5 * frameRate, true);

    // 2. Per-frame motion: spinning beacon, rotating and bobbing sample
    let time = 0;
    scene.registerBeforeRender(() => {
        const dt = engine.getDeltaTime() / 1000;
        time += dt;
        beaconPivot.rotation.y += dt * 3;
        beacon.rotation.y += dt * 3;
        sample.position.y = 1.6 + Math.sin(time * 1.5) * 0.15;
        sample.rotation.y += dt * 0.8;
        ringA.rotation.x += dt * 1.6;
        ringB.rotation.y += dt * 2.2;
        lib.toxic.emissiveColor = new Color3(0.2, 0.9 + Math.sin(time * 4) * 0.1, 0.3).scale(
            0.8 + Math.sin(time * 4) * 0.2
        );
    });

    // 3. A zombie pacing along the fence between two waypoints
    const waypoints = [new Vector3(-14, 0, 9.5), new Vector3(14, 0, 9.5)];
    let next = 0;
    const zombie = new Zombie(scene, {
        position: new Vector3(-10, 0, 9.5),
        target: () => waypoints[next],
        speed: 1.6,
        aggroRange: 100,
        stopDistance: 0.3,
        shadows,
        collisions: false
    });
    scene.onBeforeRenderObservable.add(() => {
        if (zombie.distanceTo(waypoints[next]) < 0.6) next = (next + 1) % waypoints.length;
    });

    return scene;
}

void runScene(createScene).then(() => fadeInfoPanel());
