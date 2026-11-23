import { Engine, MeshBuilder, Scene, Vector3 } from "@babylonjs/core";
import { addFlicker } from "../shared/environment";
import { createMenuScene } from "../shared/menu";
import {
    createDeadTree,
    createFenceSegment,
    createLampPost,
    createTombstone
} from "../shared/props";
import { SceneManager } from "../shared/sceneManager";
import { Zombie } from "../shared/zombie";


// Main menu with a graveyard behind it. START switches to scene 1 (the game).
export function createMenu(engine: Engine, manager: SceneManager): Promise<Scene> {
    return createMenuScene(engine, {
        kicker: "Element 04 · BabylonJS GUI",
        title: "DEAD",
        titleAccent: "GROUND",
        tagline: "Collect every supply in the compound before the dead catch up with you.",
        startLabel: "PLAY",
        onStart: () => manager.setSceneIndex(1),
        howToPlay: [
            "W A S D / Arrow keys — move and turn",
            "Shift — run",
            "Drag the mouse — look around",
            "Walk into supplies to collect them",
            "Zombies hurt you if they touch you",
            "Collect all 8 supplies to win"
        ],
        backdrop: (scene, lib, shadows) => {
            const ground = MeshBuilder.CreateGround("ground", { width: 60, height: 60 }, scene);
            ground.material = lib.ground(8);
            ground.receiveShadows = true;

            const stone = createTombstone(scene, lib, 0);
            const cross = createTombstone(scene, lib, 1);
            stone.position.y = -100;
            cross.position.y = -100;
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 4; col++) {
                    const g =
                        (row + col) % 2
                            ? stone.createInstance("grave")
                            : cross.createInstance("grave");
                    g.position.set(-2 + col * 1.8, 0, -2 + row * 2.2);
                    g.rotation.set(
                        (Math.random() - 0.5) * 0.2,
                        Math.PI + (Math.random() - 0.5) * 0.3,
                        (Math.random() - 0.5) * 0.2
                    );
                    shadows.addShadowCaster(g);
                }
            }

            const fence = createFenceSegment(scene, lib);
            for (let i = 0; i < 6; i++) {
                const f = i === 0 ? fence : fence.clone(`fence${i}`);
                f.position.set(-3.5 + i * 2, 0, -4.2);
            }

            const tree = createDeadTree(scene, lib);
            tree.position.set(7, 0, 3);
            const tree2 = tree.clone("tree2");
            tree2.position.set(-6, 0, 5);
            tree2.rotation.y = 2;
            shadows.addShadowCaster(tree);
            shadows.addShadowCaster(tree2);

            const lamp = createLampPost(scene, lib, new Vector3(5, 0, -3), Math.PI);
            addFlicker(scene, lamp.light, 1, 0.6);

            const zombie = new Zombie(scene, {
                position: new Vector3(2, 0, 1.2),
                shadows,
                collisions: false
            });
            zombie.active = false;
            zombie.heading = -0.6;
        }
    });
}
