import { HavokPlugin, Scene, Vector3 } from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";
import havokWasmUrl from "@babylonjs/havok/lib/esm/HavokPhysics.wasm?url";


type HavokInit = (options: { locateFile: () => string }) => Promise<unknown>;

let havok: Promise<unknown> | null = null;


// Loads the Havok physics engine (once) and turns physics on for a scene.
export async function enablePhysics(
    scene: Scene,
    gravity = new Vector3(0, -9.81, 0)
): Promise<void> {
    havok ??= (HavokPhysics as unknown as HavokInit)({ locateFile: () => havokWasmUrl });
    const instance = await havok;
    scene.enablePhysics(gravity, new HavokPlugin(true, instance));
}
