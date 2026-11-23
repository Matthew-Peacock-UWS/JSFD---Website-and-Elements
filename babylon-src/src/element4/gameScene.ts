import { Engine, GlowLayer, Mesh, MeshBuilder, Scene, Vector3 } from "@babylonjs/core";
import { AUDIO } from "../shared/assets";
import { SoundBank } from "../shared/audio";
import { addFlicker, addFog, createNightLighting, createSkybox } from "../shared/environment";
import { Hud } from "../shared/hud";
import { MaterialLibrary } from "../shared/materials";
import { Player } from "../shared/player";
import {
    createAmmoCan,
    createBarrel,
    createCarWreck,
    createCrate,
    createHouse,
    createLampPost,
    createMedkit
} from "../shared/props";
import { SceneManager } from "../shared/sceneManager";
import { flatDistance } from "../shared/util";
import { Zombie } from "../shared/zombie";


const SIZE = 50;
const TOTAL_SUPPLIES = 8;
const ZOMBIE_DAMAGE = 20;


// The game: collect 8 supplies while zombies chase you. Collisions update the GUI.
export async function createGameScene(engine: Engine, manager: SceneManager): Promise<Scene> {
    const scene = new Scene(engine);
    addFog(scene, 0.03, "#161a17");
    createSkybox(scene);
    const { shadows } = createNightLighting(scene, 0.7, 0.35);
    new GlowLayer("glow", scene).intensity = 0.7;
    const lib = new MaterialLibrary(scene);

    // =========================================
    // Compound
    // =========================================

    const ground = MeshBuilder.CreateGround("ground", { width: SIZE, height: SIZE }, scene);
    ground.material = lib.ground(10);
    ground.receiveShadows = true;

    const wallH = 2.8;
    for (const [x, z, w, d] of [
        [0, SIZE / 2, SIZE, 0.6],
        [0, -SIZE / 2, SIZE, 0.6],
        [SIZE / 2, 0, 0.6, SIZE],
        [-SIZE / 2, 0, 0.6, SIZE]
    ]) {
        const wall = MeshBuilder.CreateBox("wall", { width: w, height: wallH, depth: d }, scene);
        wall.position.set(x, wallH / 2, z);
        wall.material = lib.brick(Math.max(w, d), wallH);
        wall.checkCollisions = true;
        wall.receiveShadows = true;
    }

    // Obstacles: houses, cars, crates, barrels (all block the player and zombies)
    const obstacles: Mesh[] = [];
    const house = createHouse(scene, lib);
    [
        [-14, -10, 0.2],
        [13, 12, Math.PI + 0.3],
        [-12, 14, Math.PI / 2]
    ].forEach(([x, z, r], i) => {
        const h = i === 0 ? house : house.clone(`house${i}`);
        h.position.set(x, 0, z);
        h.rotation.y = r;
        obstacles.push(h);
    });
    const car = createCarWreck(scene, lib);
    car.position.set(6, 0, -8);
    car.rotation.y = 0.8;
    obstacles.push(car);
    const car2 = car.clone("car2");
    car2.position.set(-3, 0, 6);
    car2.rotation.y = -0.3;
    obstacles.push(car2);
    [
        [2, -14],
        [3.2, -14.3],
        [-18, 2],
        [16, -2],
        [16, -3.2]
    ].forEach(([x, z], i) => {
        const crate = createCrate(scene, lib, 1.2, `crate${i}`);
        crate.position.set(x, 0.6, z);
        crate.rotation.y = i;
        obstacles.push(crate);
    });
    [
        [9, 3],
        [-7, -2],
        [19, 18]
    ].forEach(([x, z], i) => {
        const barrel = createBarrel(scene, lib, `barrel${i}`);
        barrel.position.set(x, 0.55, z);
        obstacles.push(barrel);
    });
    for (const mesh of obstacles) {
        mesh.checkCollisions = true;
        shadows.addShadowCaster(mesh);
    }

    for (const [x, z, r] of [
        [-20, -20, Math.PI / 4],
        [20, -20, Math.PI * 0.75],
        [0, 20, -Math.PI / 2]
    ] as [number, number, number][]) {
        const lamp = createLampPost(scene, lib, new Vector3(x, 0, z), r);
        lamp.light.range = 18;
        addFlicker(scene, lamp.light, 1.1, 0.4);
    }

    // =========================================
    // Player & HUD
    // =========================================

    const player = await Player.create(scene, {
        position: new Vector3(0, 0, -18),
        shadows,
        speed: 3.2
    });

    const sounds = new SoundBank(scene)
        .add("music", AUDIO.music, { loop: true, volume: 0.5 })
        .add("wind", AUDIO.wind, { loop: true, volume: 0.4 })
        .add("pickup", AUDIO.pickup, { volume: 0.8 })
        .add("hit", AUDIO.hit, { volume: 0.9 })
        .add("groan", AUDIO.groan, { volume: 0.6 })
        .add("click", AUDIO.click, { volume: 0.6 });

    let paused = false;
    let gameOver = false;
    const hud = new Hud(scene, { onPause: () => togglePause() });

    // =========================================
    // Supplies
    // =========================================

    const supplyPositions = [
        [-20, -18],
        [18, -20],
        [-19, 8],
        [20, 6],
        [0, 2],
        [-8, 20],
        [14, 20],
        [9, -12]
    ];
    const medkit = createMedkit(scene, lib);
    const ammo = createAmmoCan(scene, lib);
    medkit.position.y = -100;
    ammo.position.y = -100;
    const supplies = supplyPositions.map(([x, z], i) => {
        const item = (i % 2 === 0 ? medkit : ammo).createInstance(`supply${i}`);
        item.position.set(x, 0.8, z);
        shadows.addShadowCaster(item);
        return item;
    });

    // =========================================
    // Zombies
    // =========================================

    const zombies = [
        [-20, 20],
        [20, 20],
        [-20, -5],
        [20, -12],
        [0, 14]
    ].map(
        ([x, z]) =>
            new Zombie(scene, {
                position: new Vector3(x, 0, z),
                target: () => player.position,
                speed: 1.7,
                aggroRange: 16,
                wanderRadius: 5,
                shadows
            })
    );

    // =========================================
    // Game state
    // =========================================

    let collected = 0;
    let health = 100;
    let hurtCooldown = 0;
    let groanTimer = 3;
    hud.setHealth(health);
    hud.setCounter(`SUPPLIES 0 / ${TOTAL_SUPPLIES}`);
    hud.setObjective("Find the medkits and ammo");
    hud.showMessage("Collect all the supplies", 3);

    function setActive(on: boolean) {
        player.enabled = on;
        zombies.forEach(z => (z.active = on));
    }

    function togglePause() {
        if (gameOver) return;
        sounds.play("click");
        paused = !paused;
        setActive(!paused);
        if (paused) {
            hud.showPanel("PAUSED", "Take a breath.", [
                { label: "RESUME", primary: true, onClick: () => togglePause() },
                { label: "RESTART", onClick: () => manager.setSceneIndex(1) },
                { label: "MAIN MENU", onClick: () => manager.setSceneIndex(0) }
            ]);
        } else {
            hud.hidePanel();
        }
    }

    function endGame(won: boolean) {
        gameOver = true;
        setActive(false);
        if (won) {
            player.playAnimation("Samba");
            hud.showPanel(
                "ALL SUPPLIES SECURED",
                "You made it through the night. For now.",
                [
                    { label: "PLAY AGAIN", primary: true, onClick: () => manager.setSceneIndex(1) },
                    { label: "MAIN MENU", onClick: () => manager.setSceneIndex(0) }
                ],
                "#7dff8a"
            );
        } else {
            hud.showPanel(
                "YOU DIDN'T MAKE IT",
                `You collected ${collected} of ${TOTAL_SUPPLIES} supplies.`,
                [
                    { label: "TRY AGAIN", primary: true, onClick: () => manager.setSceneIndex(1) },
                    { label: "MAIN MENU", onClick: () => manager.setSceneIndex(0) }
                ],
                "#ff4a3a"
            );
        }
    }

    // =========================================
    // Collisions -> GUI
    // =========================================

    let time = 0;
    scene.onBeforeRenderObservable.add(() => {
        const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);
        time += dt;

        // Supplies spin and bob
        supplies.forEach((s, i) => {
            if (!s.isEnabled()) return;
            s.rotation.y += dt * 1.5;
            s.position.y = 0.8 + Math.sin(time * 2 + i) * 0.15;
        });
        if (paused || gameOver) return;

        // Player touches a supply -> collect it and update the counter
        for (const supply of supplies) {
            if (supply.isEnabled() && flatDistance(player.position, supply.position) < 1.1) {
                supply.setEnabled(false);
                collected++;
                sounds.play("pickup");
                hud.setCounter(`SUPPLIES ${collected} / ${TOTAL_SUPPLIES}`, true);
                if (collected === TOTAL_SUPPLIES) endGame(true);
                else hud.showMessage(`${TOTAL_SUPPLIES - collected} to go`, 1.5);
            }
        }

        // Zombie touches the player -> lose health, flash the screen
        hurtCooldown -= dt;
        let nearest = Infinity;
        for (const zombie of zombies) {
            const d = zombie.distanceTo(player.position);
            nearest = Math.min(nearest, d);
            if (d < 1 && hurtCooldown <= 0) {
                health -= ZOMBIE_DAMAGE;
                hurtCooldown = 1;
                sounds.play("hit");
                hud.flashDamage();
                hud.setHealth(health);
                if (health <= 0) endGame(false);
            }
        }

        // Zombies groan when they're close
        groanTimer -= dt;
        if (nearest < 8 && groanTimer <= 0) {
            sounds.play("groan");
            groanTimer = 3 + Math.random() * 3;
        }
        hud.setObjective(nearest < 8 ? "Something's close..." : "Find the medkits and ammo");
    });

    return scene;
}
