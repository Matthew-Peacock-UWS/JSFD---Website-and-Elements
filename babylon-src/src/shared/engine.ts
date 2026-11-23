import { Engine, Scene } from "@babylonjs/core";


// Creates the Babylon engine on the page's canvas and keeps it sized to the window.
export function createEngine(): Engine {
    const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    const engine = new Engine(canvas, true, { stencil: true, audioEngine: true }, true);
    window.addEventListener("resize", () => engine.resize());

    // Each scene has its own GUI sound button, so hide Babylon's default "unmute" icon
    const audio = Engine.audioEngine as unknown as { useCustomUnlockedButton?: boolean } | null;
    if (audio) audio.useCustomUnlockedButton = true;

    return engine;
}


export function setLoading(visible: boolean): void {
    document.getElementById("loading")?.classList.toggle("hidden", !visible);
}


// Shows an error on the loading screen instead of failing silently.
export function showError(error: unknown): void {
    console.error(error);
    const loading = document.getElementById("loading");
    if (!loading) return;
    loading.classList.remove("hidden");
    loading.innerHTML = `<p>Something went wrong loading this scene</p><p class="error">${String(error)}</p>`;
}


// Runs a single-scene page: build the scene, wait until it's ready, then render it every frame.
export async function runScene(createScene: (engine: Engine) => Promise<Scene>): Promise<void> {
    try {
        const engine = createEngine();
        const scene = await createScene(engine);
        await scene.whenReadyAsync();
        setLoading(false);
        engine.runRenderLoop(() => scene.render());
    } catch (error) {
        showError(error);
    }
}


// Fades the HTML info panel after a few seconds so it doesn't cover the scene.
export function fadeInfoPanel(delayMs = 6000): void {
    const info = document.getElementById("info");
    if (info) setTimeout(() => info.classList.add("faded"), delayMs);
}
