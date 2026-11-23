import { Engine, Scene } from "@babylonjs/core";
import { setLoading, showError } from "./engine";


// A function that builds one scene. The manager is passed in so the scene can switch to another.
export type SceneFactory = (engine: Engine, manager: SceneManager) => Promise<Scene>;


// Multiple scenes (week 10 approach):
// scenes are stored in an array and setSceneIndex() switches between them.
// It can be called from a GUI button or from a scene event such as a collision trigger.
export class SceneManager {
    private current: Scene | null = null;
    private index = -1;
    private switching = false;

    constructor(
        private engine: Engine,
        private scenes: SceneFactory[]
    ) {
        // Only the active scene is rendered
        engine.runRenderLoop(() => {
            if (this.current?.activeCamera) this.current.render();
        });
    }

    get sceneIndex(): number {
        return this.index;
    }

    setSceneIndex(index: number): void {
        if (this.switching || index < 0 || index >= this.scenes.length) return;
        this.switching = true;
        // Wait until the current frame has finished before disposing the old scene,
        // as this is often called from inside that scene's own update loop.
        setTimeout(() => void this.load(index), 0);
    }

    private async load(index: number): Promise<void> {
        setLoading(true);
        const old = this.current;
        this.current = null;
        old?.dispose();

        try {
            const scene = await this.scenes[index](this.engine, this);
            await scene.whenReadyAsync();
            this.current = scene;
            this.index = index;
            setLoading(false);
        } catch (error) {
            showError(error);
        } finally {
            this.switching = false;
        }
    }
}
