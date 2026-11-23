import {
    ActionManager,
    Color3,
    Engine,
    ExecuteCodeAction,
    GlowLayer,
    Mesh,
    MeshBuilder,
    PointLight,
    Scene,
    Vector3
} from "@babylonjs/core";
import { AUDIO } from "../shared/assets";
import { SoundBank } from "../shared/audio";
import {
    addFog,
    createFire,
    createNightLighting,
    createSkybox,
    createTerrain
} from "../shared/environment";
import { Hud } from "../shared/hud";
import { MaterialLibrary } from "../shared/materials";
import { Player } from "../shared/player";
import {
    createCarWreck,
    createCrate,
    createDeadTree,
    createHouse,
    createMedkit,
    createSandbagWall
} from "../shared/props";
import { SceneManager } from "../shared/sceneManager";
import { flatDistance, seededRandom } from "../shared/util";
import { Zombie } from "../shared/zombie";
import { gameState, SCENES } from "./gameState";
import { Level } from "./level";


// =========================================
// Scene 1 - the Outskirts
// =========================================
// Night-time terrain outside the town. Find the keycard by the burning car,
// then walk into the bunker door. The door is a trigger mesh: an ActionManager
// intersection event switches to the Bunker scene (scene switch from a scene event).

export async function createOutskirtsScene(engine: Engine, manager: SceneManager): Promise<Scene> {
    const scene = new Scene(engine);
    addFog(scene, 0.03, "#171c19");
    createSkybox(scene);
    const { shadows } = createNightLighting(scene, 0.7, 0.32);
    new GlowLayer("glow", scene).intensity = 0.9;
    const lib = new MaterialLibrary(scene);
    const random = seededRandom(7);

    // =========================================
    // Terrain
    // =========================================

    const terrain = await createTerrain(scene, {
        size: 140,
        subdivisions: 120,
        maxHeight: 16,
        material: lib.ground(14)
    });
    const heightAt = (x: number, z: number) => terrain.getHeightAtCoordinates(x, z);
    const place = (mesh: { position: Vector3 }, x: number, z: number, lift = 0) =>
        mesh.position.set(x, heightAt(x, z) + lift, z);

    const road = MeshBuilder.CreateGround("road", { width: 5, height: 56 }, scene);
    road.position.set(0, 0.26, -3);
    road.material = lib.concrete;
    road.receiveShadows = true;

    const blockers: Mesh[] = [];

    // =========================================
    // The bunker entrance (goal)
    // =========================================

    const bunker = MeshBuilder.CreateBox("bunker", { width: 9, height: 4, depth: 6 }, scene);
    place(bunker, 0, 29, 1.6);
    bunker.material = lib.concreteSmall;
    blockers.push(bunker);
    const frame = MeshBuilder.CreateBox("doorFrame", { width: 3, height: 3, depth: 0.3 }, scene);
    place(frame, 0, 25.9, 1.5);
    frame.material = lib.hazard;
    const door = MeshBuilder.CreateBox(
        "bunkerDoor",
        { width: 2.2, height: 2.6, depth: 0.2 },
        scene
    );
    place(door, 0, 25.8, 1.3);
    door.material = lib.metal;
    const doorLamp = MeshBuilder.CreateSphere("doorLamp", { diameter: 0.3 }, scene);
    place(doorLamp, 0, 25.7, 3.3);
    doorLamp.material = lib.redLight;
    const doorLight = new PointLight(
        "doorLight",
        doorLamp.position.add(new Vector3(0, 0, -0.6)),
        scene
    );
    doorLight.diffuse = new Color3(1, 0.2, 0.1);
    doorLight.range = 10;
    doorLight.intensity = 1.2;

    // Sandbags and crates guarding the entrance
    for (const [x, z, r] of [
        [-4.5, 22.5, 0.3],
        [4.5, 22.5, -0.3]
    ]) {
        const bags = createSandbagWall(scene, lib, 6);
        place(bags, x, z);
        bags.rotation.y = r;
        blockers.push(bags);
    }

    // =========================================
    // Town edge: houses, cars, trees
    // =========================================

    const house = createHouse(scene, lib);
    [
        [-9, -16, Math.PI / 2],
        [9, -6, -Math.PI / 2],
        [-10, 16, Math.PI / 2],
        [11, 14, -Math.PI / 2]
    ].forEach(([x, z, r], i) => {
        const h = i === 0 ? house : house.clone(`house${i}`);
        place(h, x, z);
        h.rotation.y = r;
        blockers.push(h);
    });

    const car = createCarWreck(scene, lib);
    place(car, -11, 4);
    car.rotation.y = 1.2;
    blockers.push(car);
    createFire(scene, new Vector3(-11, heightAt(-11, 4) + 1, 4), 1);
    const car2 = car.clone("car2");
    place(car2, 4, -11);
    car2.rotation.y = -0.4;
    blockers.push(car2);
    const car3 = car.clone("car3");
    place(car3, -1.5, 15);
    car3.rotation.y = 2.8;
    blockers.push(car3);

    const tree = createDeadTree(scene, lib);
    tree.position.y = -100;
    for (let i = 0; i < 45; i++) {
        const a = random() * Math.PI * 2;
        const r = 16 + random() * 34;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (Math.abs(x) < 6 || (Math.abs(x) < 12 && z > 18)) continue; // keep the road and bunker clear
        const t = tree.createInstance(`tree${i}`);
        place(t, x, z);
        t.rotation.y = random() * 6;
        t.scaling.setAll(0.7 + random() * 0.7);
        t.checkCollisions = r < 31;
        shadows.addShadowCaster(t);
    }

    for (const mesh of blockers) {
        mesh.checkCollisions = true;
        mesh.receiveShadows = true;
        shadows.addShadowCaster(mesh);
    }

    // =========================================
    // Keycard on a crate by the burning car
    // =========================================

    const keyCrate = createCrate(scene, lib, 1, "keyCrate");
    place(keyCrate, -8, 7.5, 0.5);
    keyCrate.checkCollisions = true;
    shadows.addShadowCaster(keyCrate);
    const keycard = MeshBuilder.CreateBox(
        "keycard",
        { width: 0.35, height: 0.03, depth: 0.5 },
        scene
    );
    keycard.material = lib.cyanGlow;
    const keyBase = keyCrate.position.y + 0.9;
    keycard.position.set(keyCrate.position.x, keyBase, keyCrate.position.z);
    const keyLight = new PointLight("keyLight", keycard.position.clone(), scene);
    keyLight.diffuse = new Color3(0.3, 0.85, 1);
    keyLight.range = 5;
    keyLight.intensity = 0.8;
    if (gameState.hasKeycard) {
        keycard.setEnabled(false);
        keyLight.setEnabled(false);
    }

    const medkit = createMedkit(scene, lib);
    place(medkit, 12, -14, 0.8);

    // =========================================
    // Player, zombies, HUD
    // =========================================

    const player = await Player.create(scene, {
        position: new Vector3(0, heightAt(0, -24), -24),
        heading: 0,
        heightAt,
        bounds: { minX: -29, maxX: 29, minZ: -29, maxZ: 25 },
        shadows
    });

    const zombies = [
        [-6, -8],
        [8, 1],
        [-15, 11],
        [12, 18],
        [4, 19],
        [-4, 9],
        [14, -18]
    ].map(
        ([x, z]) =>
            new Zombie(scene, {
                position: new Vector3(x, 0, z),
                target: () => player.position,
                heightAt,
                shadows,
                speed: 1.8,
                aggroRange: 13,
                wanderRadius: 4
            })
    );

    const sounds = new SoundBank(scene)
        .add("wind", AUDIO.wind, { loop: true, volume: 0.6 })
        .add("music", AUDIO.music, { loop: true, volume: 0.45 })
        .add("pickup", AUDIO.pickup, { volume: 0.8 })
        .add("hit", AUDIO.hit)
        .add("groan", AUDIO.groan, { volume: 0.6 })
        .add("click", AUDIO.click, { volume: 0.6 });

    let level: Level | null = null;
    const hud = new Hud(scene, { onPause: () => level?.togglePause() });
    level = new Level({
        scene,
        manager,
        player,
        zombies,
        hud,
        sounds,
        sceneIndex: SCENES.outskirts,
        medkits: [medkit]
    });

    const updateObjective = () => {
        hud.setCounter(
            gameState.hasKeycard ? "KEYCARD: FOUND" : "KEYCARD: MISSING",
            gameState.hasKeycard
        );
        hud.setObjective(
            gameState.hasKeycard
                ? "Get to the bunker door (north)"
                : "Search the burning car for a keycard"
        );
    };
    updateObjective();
    hud.showMessage("THE OUTSKIRTS", 3);

    // =========================================
    // Keycard pickup (distance check)
    // =========================================

    let time = 0;
    scene.onBeforeRenderObservable.add(() => {
        time += engine.getDeltaTime() / 1000;
        if (keycard.isEnabled()) {
            keycard.rotation.y += 0.03;
            keycard.position.y = keyBase + Math.sin(time * 2) * 0.1;
            if (!level?.over && flatDistance(player.position, keycard.position) < 1.7) {
                gameState.hasKeycard = true;
                keycard.setEnabled(false);
                keyLight.setEnabled(false);
                sounds.play("pickup");
                hud.showMessage("KEYCARD FOUND", 2);
                updateObjective();
            }
        }
        doorLight.intensity = 0.8 + Math.abs(Math.sin(time * 3)) * 0.8;
    });

    // =========================================
    // Door trigger -> switch scene (ActionManager event)
    // =========================================

    const doorTrigger = MeshBuilder.CreateBox(
        "doorTrigger",
        { width: 3, height: 3, depth: 1.6 },
        scene
    );
    place(doorTrigger, 0, 25, 1.5);
    doorTrigger.isVisible = false;
    doorTrigger.isPickable = false;
    let lockedCooldown = 0;
    const tryEnterBunker = () => {
        if (level?.over) return;
        if (gameState.hasKeycard) {
            level?.finish();
            sounds.play("click");
            hud.showMessage("ENTERING THE BUNKER...", 2);
            manager.setSceneIndex(SCENES.bunker);
        } else if (lockedCooldown <= 0) {
            hud.showMessage("LOCKED - FIND THE KEYCARD", 2.5);
            lockedCooldown = 3;
        }
    };
    doorTrigger.actionManager = new ActionManager(scene);
    doorTrigger.actionManager.registerAction(
        new ExecuteCodeAction(
            {
                trigger: ActionManager.OnIntersectionEnterTrigger,
                parameter: { mesh: player.hitbox, usePreciseIntersection: false }
            },
            tryEnterBunker
        )
    );
    // Back-up check in case the player stops right at the door
    scene.onBeforeRenderObservable.add(() => {
        lockedCooldown -= engine.getDeltaTime() / 1000;
        if (flatDistance(player.position, doorTrigger.position) < 1.3) tryEnterBunker();
    });

    return scene;
}
