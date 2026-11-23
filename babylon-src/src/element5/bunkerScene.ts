import {
    ActionManager,
    Color3,
    Engine,
    ExecuteCodeAction,
    GlowLayer,
    HemisphericLight,
    Mesh,
    MeshBuilder,
    PointLight,
    Scene,
    ShadowGenerator,
    SpotLight,
    TransformNode,
    Vector3
} from "@babylonjs/core";
import { AUDIO } from "../shared/assets";
import { SoundBank } from "../shared/audio";
import { addFlicker, addFog } from "../shared/environment";
import { Hud } from "../shared/hud";
import { MaterialLibrary } from "../shared/materials";
import { Player } from "../shared/player";
import { createBarrel, createCrate, createMedkit } from "../shared/props";
import { SceneManager } from "../shared/sceneManager";
import { Zombie } from "../shared/zombie";
import { SCENES } from "./gameState";
import { Level } from "./level";


// =========================================
// Scene 2 - the Bunker
// =========================================
// Indoor level built from boxes: a long corridor with side rooms, flickering lights
// and a rotating red emergency light. Reach the radio at the far end - its trigger
// switches to the Rescue scene. Health carries over from the Outskirts.

const WALL_H = 3.6;


// [centre x, centre z, width (x), depth (z)]
const WALLS: [number, number, number, number][] = [
    // outer walls
    [-7, 0, 0.4, 44],
    [7, 0, 0.4, 44],
    [0, -22, 14.4, 0.4],
    [0, 22, 14.4, 0.4],
    // left partition with doorways at z -12..-9 and 2..5
    [-2.5, -17, 0.3, 10],
    [-2.5, -3.5, 0.3, 11],
    [-2.5, 13.5, 0.3, 17],
    // right partition with doorways at z -4..-1 and 10..13
    [2.5, -13, 0.3, 18],
    [2.5, 4.5, 0.3, 11],
    [2.5, 17.5, 0.3, 9],
    // walls splitting the side rooms
    [-4.75, -3, 4.5, 0.3],
    [4.75, 4, 4.5, 0.3]
];


export async function createBunkerScene(engine: Engine, manager: SceneManager): Promise<Scene> {
    const scene = new Scene(engine);
    addFog(scene, 0.06, "#060707");
    new GlowLayer("glow", scene).intensity = 1;
    const lib = new MaterialLibrary(scene);

    // =========================================
    // Lighting (6 lights max)
    // =========================================

    const ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
    ambient.intensity = 0.18;
    ambient.diffuse = new Color3(0.6, 0.7, 0.8);
    ambient.groundColor = new Color3(0.05, 0.05, 0.05);

    const ceilingLights: [number, number, number][] = [
        [0, -14, 1.3],
        [0, 2, 1.1],
        [-4.75, 9, 0.8],
        [4.75, -9, 0.8]
    ];
    const lights = ceilingLights.map(([x, z, intensity], i) => {
        const fitting = MeshBuilder.CreateBox(
            "lightFitting",
            { width: 1.4, height: 0.08, depth: 0.3 },
            scene
        );
        fitting.position.set(x, WALL_H - 0.1, z);
        fitting.material = lib.warmLight;
        const light = new PointLight(`ceilingLight${i}`, new Vector3(x, WALL_H - 0.4, z), scene);
        light.diffuse = new Color3(0.85, 0.95, 1);
        light.range = 14;
        addFlicker(scene, light, intensity, i === 1 ? 0.8 : 0.3, i === 1 ? 2.5 : 1);
        return light;
    });

    // Shadows from the first corridor light
    const shadows = new ShadowGenerator(512, lights[0]);
    shadows.usePoissonSampling = true;
    shadows.darkness = 0.4;

    // =========================================
    // Floor and walls
    // =========================================

    const floor = MeshBuilder.CreateGround("floor", { width: 14, height: 44 }, scene);
    floor.material = lib.metalFloor(6);
    floor.receiveShadows = true;

    for (const [x, z, w, d] of WALLS) {
        const wall = MeshBuilder.CreateBox("wall", { width: w, height: WALL_H, depth: d }, scene);
        wall.position.set(x, WALL_H / 2, z);
        wall.material = lib.brick(Math.max(w, d), WALL_H);
        wall.checkCollisions = true;
        wall.receiveShadows = true;
    }

    // Hazard stripe along the corridor floor
    for (const x of [-2.2, 2.2]) {
        const stripe = MeshBuilder.CreateBox(
            "stripe",
            { width: 0.25, height: 0.01, depth: 43 },
            scene
        );
        stripe.position.set(x, 0.01, 0);
        stripe.material = lib.hazard;
    }

    // =========================================
    // Clutter
    // =========================================

    const clutter: Mesh[] = [];
    [
        [1, -6, 1.1],
        [-1.3, 6, 1.1],
        [1.2, 11, 0.9],
        [-5.5, -20, 1.2],
        [5.5, 20, 1.2],
        [-6, 20.5, 1],
        [6, -20.5, 1]
    ].forEach(([x, z, s], i) => {
        const crate = createCrate(scene, lib, s, `crate${i}`);
        crate.position.set(x, s / 2, z);
        crate.rotation.y = i * 0.7;
        clutter.push(crate);
    });
    [
        [-1.6, -1],
        [-6.2, 1],
        [6.2, 7],
        [6.3, 7.9]
    ].forEach(([x, z], i) => {
        const barrel = createBarrel(scene, lib, `barrel${i}`);
        barrel.position.set(x, 0.55, z);
        clutter.push(barrel);
    });
    // Lockers along the side rooms
    for (let i = 0; i < 4; i++) {
        const locker = MeshBuilder.CreateBox(
            "locker",
            { width: 0.6, height: 2, depth: 0.5 },
            scene
        );
        locker.position.set(-6.5, 1, -14 + i * 0.65);
        locker.material = lib.metal;
        clutter.push(locker);
    }
    for (const mesh of clutter) {
        mesh.checkCollisions = true;
        shadows.addShadowCaster(mesh);
    }

    // =========================================
    // Radio room (goal)
    // =========================================

    const desk = MeshBuilder.CreateBox("desk", { width: 2.4, height: 0.9, depth: 1 }, scene);
    desk.position.set(0, 0.45, 20.8);
    desk.material = lib.metal;
    desk.checkCollisions = true;
    const radio = MeshBuilder.CreateBox("radio", { width: 1, height: 0.5, depth: 0.5 }, scene);
    radio.position.set(0, 1.15, 20.9);
    radio.material = lib.blackMetal;
    const radioLed = MeshBuilder.CreateSphere("radioLed", { diameter: 0.08 }, scene);
    radioLed.position.set(0.35, 1.25, 20.64);
    radioLed.material = lib.toxic;
    const antenna = MeshBuilder.CreateCylinder("antenna", { diameter: 0.03, height: 1.2 }, scene);
    antenna.position.set(-0.4, 1.9, 20.9);
    antenna.material = lib.blackMetal;

    // Rotating red emergency light above the radio
    const sirenPivot = new TransformNode("sirenPivot", scene);
    sirenPivot.position.set(0, WALL_H - 0.4, 19.5);
    const siren = MeshBuilder.CreateCylinder("siren", { diameter: 0.3, height: 0.3 }, scene);
    siren.position.copyFrom(sirenPivot.position);
    siren.material = lib.redLight;
    const sirenLight = new SpotLight(
        "sirenLight",
        Vector3.Zero(),
        new Vector3(1, -0.4, 0),
        Math.PI / 2.5,
        4,
        scene
    );
    sirenLight.parent = sirenPivot;
    sirenLight.diffuse = new Color3(1, 0.1, 0.05);
    sirenLight.intensity = 2.2;
    sirenLight.range = 18;

    // Medkits in the side rooms
    const medkit = createMedkit(scene, lib);
    medkit.position.set(-5, 0.6, -18);
    const medkit2 = medkit.clone("medkit2");
    medkit2.position.set(5, 0.6, 17);

    // =========================================
    // Player, zombies, HUD
    // =========================================

    const player = await Player.create(scene, {
        position: new Vector3(0, 0, -19.5),
        heading: 0,
        shadows,
        camera: { radius: 5, minRadius: 2.5, maxRadius: 7, collisions: true }
    });

    const zombies = [
        [-4.5, -15],
        [5, -16],
        [-5, 12],
        [5, 8],
        [0, 14]
    ].map(
        ([x, z]) =>
            new Zombie(scene, {
                position: new Vector3(x, 0, z),
                target: () => player.position,
                shadows,
                speed: 1.9,
                aggroRange: 9,
                wanderRadius: 2
            })
    );

    const sounds = new SoundBank(scene)
        .add("music", AUDIO.music, { loop: true, volume: 0.6 })
        .add("door", AUDIO.door, { playWhenReady: true })
        .add("pickup", AUDIO.pickup, { volume: 0.8 })
        .add("hit", AUDIO.hit)
        .add("groan", AUDIO.groan, { volume: 0.7 })
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
        sceneIndex: SCENES.bunker,
        medkits: [medkit, medkit2]
    });
    hud.setCounter("THE BUNKER");
    hud.setObjective("Reach the radio at the far end");
    hud.showMessage("THE BUNKER", 3);

    // =========================================
    // Motion
    // =========================================

    let time = 0;
    scene.onBeforeRenderObservable.add(() => {
        const dt = engine.getDeltaTime() / 1000;
        time += dt;
        sirenPivot.rotation.y += dt * 2.5;
        siren.rotation.y += dt * 2.5;
        radioLed.isVisible = Math.sin(time * 6) > 0;
        for (const kit of [medkit, medkit2]) kit.rotation.y += dt * 1.5;
    });

    // =========================================
    // Radio trigger -> Rescue scene
    // =========================================

    const radioTrigger = MeshBuilder.CreateBox(
        "radioTrigger",
        { width: 3.5, height: 3, depth: 1.6 },
        scene
    );
    radioTrigger.position.set(0, 1.5, 19.4);
    radioTrigger.isVisible = false;
    radioTrigger.isPickable = false;
    const reachRadio = () => {
        if (level?.over) return;
        level?.finish();
        hud.showMessage("MAYDAY... MAYDAY...", 2);
        sounds.play("pickup");
        setTimeout(() => manager.setSceneIndex(SCENES.ending), 1200);
    };
    radioTrigger.actionManager = new ActionManager(scene);
    radioTrigger.actionManager.registerAction(
        new ExecuteCodeAction(
            {
                trigger: ActionManager.OnIntersectionEnterTrigger,
                parameter: { mesh: player.hitbox, usePreciseIntersection: false }
            },
            reachRadio
        )
    );
    scene.onBeforeRenderObservable.add(() => {
        if (Math.abs(player.position.x) < 1.6 && player.position.z > 19) reachRadio();
    });

    return scene;
}
