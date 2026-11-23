import {
    ArcRotateCamera,
    Engine,
    GlowLayer,
    InstancedMesh,
    Mesh,
    MeshBuilder,
    Scene,
    Vector3
} from "@babylonjs/core";
import { AUDIO } from "../shared/assets";
import { SoundBank } from "../shared/audio";
import { fadeInfoPanel, runScene } from "../shared/engine";
import {
    addFlicker,
    addFog,
    createFire,
    createNightLighting,
    createSkybox,
    createTerrain
} from "../shared/environment";
import { addCornerSoundButton, createUI } from "../shared/gui";
import { MaterialLibrary } from "../shared/materials";
import {
    createCarWreck,
    createChurch,
    createDeadTree,
    createFenceSegment,
    createHouse,
    createLampPost,
    createTombstone
} from "../shared/props";
import { seededRandom } from "../shared/util";
import { Zombie } from "../shared/zombie";


// =========================================
// Element 2 - Dead Town
// =========================================
// A 3D environment: height-map terrain with a texture, a 360-degree night skybox,
// houses / trees / gravestones built by merging meshes and then cloned or instanced,
// atmospheric lighting and fog, a constrained camera and ambient audio.

async function createScene(engine: Engine): Promise<Scene> {
    const scene = new Scene(engine);
    addFog(scene, 0.016, "#1a201c");
    createSkybox(scene);
    const { shadows } = createNightLighting(scene, 0.75, 0.32);
    new GlowLayer("glow", scene).intensity = 0.6;
    const lib = new MaterialLibrary(scene);
    const random = seededRandom(42);

    // =========================================
    // Height-map terrain
    // =========================================

    const terrain = await createTerrain(scene, {
        size: 140,
        subdivisions: 140,
        maxHeight: 16,
        material: lib.ground(14)
    });
    const heightAt = (x: number, z: number) => terrain.getHeightAtCoordinates(x, z);
    const onGround = (mesh: Mesh | InstancedMesh, x: number, z: number) =>
        mesh.position.set(x, heightAt(x, z), z);

    // Dirt road through the town
    const road = MeshBuilder.CreateGround("road", { width: 6, height: 64 }, scene);
    road.position.y = 0.26;
    const roadMat = lib.ground(1).clone("roadMat");
    roadMat.diffuseColor.set(0.6, 0.55, 0.5);
    road.material = roadMat;
    road.receiveShadows = true;

    // =========================================
    // Constrained camera
    // =========================================

    const camera = new ArcRotateCamera(
        "camera",
        -Math.PI / 2.3,
        1.1,
        48,
        new Vector3(0, 2, 0),
        scene
    );
    camera.attachControl(true);
    camera.lowerRadiusLimit = 14; // can't zoom inside buildings
    camera.upperRadiusLimit = 62; // can't leave the valley
    camera.lowerBetaLimit = 0.4;
    camera.upperBetaLimit = 1.38; // can't go under the ground
    camera.panningSensibility = 0; // target stays on the town
    camera.wheelDeltaPercentage = 0.01;
    camera.useAutoRotationBehavior = true;
    if (camera.autoRotationBehavior) {
        camera.autoRotationBehavior.idleRotationSpeed = 0.06;
        camera.autoRotationBehavior.idleRotationWaitTime = 4000;
    }

    // =========================================
    // Houses: merged mesh, then clones and instances
    // =========================================

    const house = createHouse(scene, lib);
    const housePlots: [number, number, number][] = [
        [-7, -20, Math.PI / 2],
        [-7, -12, Math.PI / 2],
        [-7, 4, Math.PI / 2],
        [-7, 12, Math.PI / 2],
        [7, -18, -Math.PI / 2],
        [7, -9, -Math.PI / 2],
        [7, 6, -Math.PI / 2],
        [7, 15, -Math.PI / 2]
    ];
    housePlots.forEach(([x, z, rot], i) => {
        // The first house is the original, a few are full clones (so they can be scaled
        // independently), the rest are cheap instances that share the original's geometry.
        const h =
            i === 0
                ? house
                : i % 3 === 0
                  ? house.clone(`houseClone${i}`)
                  : house.createInstance(`house${i}`);
        onGround(h, x, z);
        h.rotation.y = rot;
        if (i % 3 === 0 && i > 0) h.scaling.set(1.2, 1.25, 1.1);
        h.checkCollisions = true;
        shadows.addShadowCaster(h);
    });

    // Church as the town's focal point
    const church = createChurch(scene, lib);
    onGround(church, 0, 27);
    church.rotation.y = Math.PI;
    shadows.addShadowCaster(church);

    // =========================================
    // Dead trees: one merged tree, many instances
    // =========================================

    const tree = createDeadTree(scene, lib);
    tree.position.y = -100; // the original stays out of sight; only its instances are placed
    for (let i = 0; i < 60; i++) {
        const angle = random() * Math.PI * 2;
        const radius = 20 + random() * 30;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        if (Math.abs(x) < 10 && z > -26 && z < 32) continue; // keep the town clear
        const t = tree.createInstance(`tree${i}`);
        onGround(t, x, z);
        t.rotation.y = random() * Math.PI * 2;
        t.rotation.z = (random() - 0.5) * 0.2;
        t.scaling.setAll(0.7 + random() * 0.8);
        shadows.addShadowCaster(t);
    }

    // =========================================
    // Graveyard: instanced gravestones + cloned fence
    // =========================================

    const tombstone = createTombstone(scene, lib, 0);
    const cross = createTombstone(scene, lib, 1);
    tombstone.position.y = -100;
    cross.position.y = -100;
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 5; col++) {
            const stone =
                (row + col) % 3 === 0
                    ? cross.createInstance(`grave${row}_${col}`)
                    : tombstone.createInstance(`grave${row}_${col}`);
            const x = 15 + col * 1.6 + (random() - 0.5) * 0.4;
            const z = 18 + row * 2 + (random() - 0.5) * 0.4;
            onGround(stone, x, z);
            stone.rotation.set(
                (random() - 0.5) * 0.25,
                Math.PI + (random() - 0.5) * 0.3,
                (random() - 0.5) * 0.25
            );
            shadows.addShadowCaster(stone);
        }
    }
    const fence = createFenceSegment(scene, lib);
    const fenceSides: [number, number, number][] = [];
    for (let i = 0; i < 5; i++) fenceSides.push([14.2 + i * 2, 16.4, 0], [14.2 + i * 2, 26.4, 0]);
    for (let i = 0; i < 5; i++)
        fenceSides.push([13.2, 17.4 + i * 2, Math.PI / 2], [23.2, 17.4 + i * 2, Math.PI / 2]);
    fenceSides.forEach(([x, z, rot], i) => {
        if (i === 0) return; // gap for the gate
        const f = fence.clone(`fence${i}`);
        onGround(f, x, z);
        f.rotation.y = rot;
    });
    fence.position.y = -100;

    // =========================================
    // Wrecked cars and a bonfire
    // =========================================

    const car = createCarWreck(scene, lib);
    onGround(car, -1.5, -6);
    car.rotation.y = 0.5;
    shadows.addShadowCaster(car);
    const car2 = car.clone("car2");
    onGround(car2, 2, 9);
    car2.rotation.y = -2.4;
    shadows.addShadowCaster(car2);

    createFire(scene, new Vector3(-12, heightAt(-12, -3), -3), 1.2);
    const logs = MeshBuilder.CreateCylinder(
        "logs",
        { diameter: 1.4, height: 0.3, tessellation: 10 },
        scene
    );
    logs.position.set(-12, heightAt(-12, -3) + 0.15, -3);
    logs.material = lib.bark;

    // =========================================
    // Lighting along the road
    // =========================================

    for (const [x, z, rot] of [
        [3.5, -14, Math.PI],
        [-3.5, 9, 0]
    ] as [number, number, number][]) {
        const lamp = createLampPost(scene, lib, new Vector3(x, heightAt(x, z), z), rot);
        addFlicker(scene, lamp.light, 1, 0.5);
        shadows.addShadowCaster(lamp.mesh);
    }

    // =========================================
    // A few zombies wandering the streets
    // =========================================

    for (const [x, z] of [
        [2, -2],
        [-3, 16],
        [18, 14]
    ]) {
        new Zombie(scene, {
            position: new Vector3(x, 0, z),
            wanderRadius: 6,
            speed: 1.5,
            heightAt,
            shadows
        });
    }

    // =========================================
    // Audio (starts off - use the SOUND button)
    // =========================================

    new SoundBank(scene)
        .add("wind", AUDIO.wind, { loop: true, volume: 0.8 })
        .add("music", AUDIO.music, { loop: true, volume: 0.35 });
    addCornerSoundButton(scene, createUI(scene));

    return scene;
}

void runScene(createScene).then(() => fadeInfoPanel());
