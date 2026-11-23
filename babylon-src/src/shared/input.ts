import { Scene } from "@babylonjs/core";


// Keyboard state for a scene. Uses KeyboardEvent.code ("KeyW", "ArrowUp"...)
// so WASD works on any keyboard layout. Removed automatically when the scene is disposed.
export class KeyInput {
    private keys = new Set<string>();

    private onDown = (e: KeyboardEvent) => {
        this.keys.add(e.code);
        if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
    };
    private onUp = (e: KeyboardEvent) => this.keys.delete(e.code);
    private onBlur = () => this.keys.clear();

    constructor(scene: Scene) {
        window.addEventListener("keydown", this.onDown);
        window.addEventListener("keyup", this.onUp);
        window.addEventListener("blur", this.onBlur);
        scene.onDisposeObservable.addOnce(() => this.dispose());
    }

    isDown(...codes: string[]): boolean {
        return codes.some(code => this.keys.has(code));
    }

    dispose(): void {
        window.removeEventListener("keydown", this.onDown);
        window.removeEventListener("keyup", this.onUp);
        window.removeEventListener("blur", this.onBlur);
        this.keys.clear();
    }
}
