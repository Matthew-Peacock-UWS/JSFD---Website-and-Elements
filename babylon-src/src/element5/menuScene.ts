import { Engine, MeshBuilder, Scene, Vector3 } from "@babylonjs/core";
import { createFire } from "../shared/environment";
import { createMenuScene } from "../shared/menu";
import { createCarWreck, createDeadTree, createSandbagWall } from "../shared/props";
import { SceneManager } from "../shared/sceneManager";
import { Zombie } from "../shared/zombie";
import { gameState, SCENES } from "./gameState";


// Escape main menu - a burning car on an empty road. START begins a new run.
export function createEscapeMenu(engine: Engine, manager: SceneManager): Promise<Scene> {
    return createMenuScene(engine, {
        kicker: "Element 05 · Multiple scenes",
        title: "ESCAPE",
        titleAccent: "THE DEAD",
        tagline: "The town has fallen. Find the keycard, get into the bunker and radio for rescue.",
        startLabel: "START",
        onStart: () => {
            gameState.reset();
            manager.setSceneIndex(SCENES.outskirts);
        },
        howToPlay: [
            "W A S D / Arrow keys — move and turn",
            "Shift — run   ·   Drag the mouse — look",
            "1. Find the glowing keycard",
            "2. Walk into the bunker door",
            "3. Reach the radio at the end of the bunker",
            "Medkits restore health. Avoid the zombies."
        ],
        backdrop: (scene, lib, shadows) => {
            const ground = MeshBuilder.CreateGround("ground", { width: 60, height: 60 }, scene);
            ground.material = lib.ground(8);
            ground.receiveShadows = true;
            const road = MeshBuilder.CreateGround("road", { width: 5, height: 60 }, scene);
            road.position.y = 0.02;
            road.material = lib.concrete;
            road.receiveShadows = true;

            const car = createCarWreck(scene, lib);
            car.position.set(1, 0, 0);
            car.rotation.y = 0.6;
            shadows.addShadowCaster(car);
            createFire(scene, new Vector3(2.2, 1, 0.8), 0.9);

            const bags = createSandbagWall(scene, lib, 6);
            bags.position.set(-3, 0, 3);
            bags.rotation.y = 0.4;
            shadows.addShadowCaster(bags);

            const tree = createDeadTree(scene, lib);
            tree.position.set(6, 0, 5);
            shadows.addShadowCaster(tree);

            for (const [x, z, h] of [
                [-2, -2.5, 0.9],
                [4.5, -3, 2.6]
            ]) {
                const zombie = new Zombie(scene, {
                    position: new Vector3(x, 0, z),
                    shadows,
                    collisions: false
                });
                zombie.active = false;
                zombie.heading = h;
            }
        }
    });
}
