import { createEngine, showError } from "../shared/engine";
import { SceneManager } from "../shared/sceneManager";
import { createBunkerScene } from "./bunkerScene";
import { createEndingScene } from "./endingScene";
import { createEscapeMenu } from "./menuScene";
import { createOutskirtsScene } from "./outskirtsScene";


// =========================================
// Element 5 - Escape
// =========================================
// Two original scenes linked by GUI buttons and scene events:
//   0 Menu (GUI)  ->  1 The Outskirts  --(walk into the bunker door with the keycard)-->
//   2 The Bunker  --(reach the radio)-->  3 Rescue (GUI)  ->  play again / menu

try {
    const engine = createEngine();
    const manager = new SceneManager(engine, [
        createEscapeMenu,
        createOutskirtsScene,
        createBunkerScene,
        createEndingScene
    ]);
    manager.setSceneIndex(0);
} catch (error) {
    showError(error);
}
