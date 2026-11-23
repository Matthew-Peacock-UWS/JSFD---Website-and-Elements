import { createEngine, showError } from "../shared/engine";
import { SceneManager } from "../shared/sceneManager";
import { createGameScene } from "./gameScene";
import { createMenu } from "./menuScene";


// =========================================
// Element 4 - Dead Ground
// =========================================
// GUI menu system -> interactive scene. Collisions with supplies and zombies
// update the GUI (counter, health bar, damage flash). Audio is off until the
// player turns it on with a GUI button; music and sound effects follow scene events.
//
// Scene 0: main menu      Scene 1: the game

try {
    const engine = createEngine();
    const manager = new SceneManager(engine, [createMenu, createGameScene]);
    manager.setSceneIndex(0);
} catch (error) {
    showError(error);
}
