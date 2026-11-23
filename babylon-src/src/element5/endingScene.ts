import {
    ArcRotateCamera,
    Color3,
    Engine,
    GlowLayer,
    MeshBuilder,
    Scene,
    SpotLight,
    TransformNode,
    Vector3
} from "@babylonjs/core";
import { Control, StackPanel } from "@babylonjs/gui";
import { AUDIO } from "../shared/assets";
import { SoundBank } from "../shared/audio";
import { addFog, createNightLighting, createSkybox } from "../shared/environment";
import { createUI, makeButton, makeSoundButton, makeText, RED } from "../shared/gui";
import { MaterialLibrary } from "../shared/materials";
import { Player } from "../shared/player";
import { createSandbagWall } from "../shared/props";
import { SceneManager } from "../shared/sceneManager";
import { gameState, SCENES } from "./gameState";


// Rescue: a helicopter arrives, the survivor celebrates, then play again or go to the menu.
export async function createEndingScene(engine: Engine, manager: SceneManager): Promise<Scene> {
    const scene = new Scene(engine);
    addFog(scene, 0.025, "#1b2120");
    createSkybox(scene);
    const { shadows } = createNightLighting(scene, 0.6, 0.35);
    new GlowLayer("glow", scene).intensity = 0.8;
    const lib = new MaterialLibrary(scene);

    const ground = MeshBuilder.CreateGround("ground", { width: 80, height: 80 }, scene);
    ground.material = lib.ground(10);
    ground.receiveShadows = true;
    const pad = MeshBuilder.CreateCylinder(
        "helipad",
        { diameter: 8, height: 0.06, tessellation: 40 },
        scene
    );
    pad.position.y = 0.03;
    pad.material = lib.concrete;
    pad.receiveShadows = true;
    for (const [x, z, r] of [
        [-6, 3, 0.5],
        [6, -2, -0.4]
    ]) {
        const bags = createSandbagWall(scene, lib, 5);
        bags.position.set(x, 0, z);
        bags.rotation.y = r;
        shadows.addShadowCaster(bags);
    }

    // Survivor celebrating on the helipad
    const player = await Player.create(scene, {
        position: Vector3.Zero(),
        heading: Math.PI,
        shadows
    });
    player.enabled = false;
    player.camera.detachControl();
    player.playAnimation("Samba");

    // Helicopter built from simple shapes, hovering with a spinning rotor
    const heli = new TransformNode("helicopter", scene);
    heli.position.set(0, 9, 8);
    const body = MeshBuilder.CreateSphere("heliBody", { diameter: 2.4, segments: 16 }, scene);
    body.scaling.set(1, 0.85, 1.6);
    body.parent = heli;
    body.material = lib.blackMetal;
    const tail = MeshBuilder.CreateCylinder(
        "heliTail",
        { diameterTop: 0.2, diameterBottom: 0.5, height: 4.5 },
        scene
    );
    tail.rotation.x = Math.PI / 2;
    tail.position.z = 3.6;
    tail.parent = heli;
    tail.material = lib.blackMetal;
    const rotor = MeshBuilder.CreateBox("rotor", { width: 7, height: 0.05, depth: 0.25 }, scene);
    rotor.position.y = 1.2;
    rotor.parent = heli;
    rotor.material = lib.metal;
    const rotor2 = rotor.clone("rotor2");
    rotor2.rotation.y = Math.PI / 2;
    rotor2.parent = rotor;
    rotor2.position.set(0, 0, 0);
    const tailRotor = MeshBuilder.CreateBox(
        "tailRotor",
        { width: 0.05, height: 1.4, depth: 0.15 },
        scene
    );
    tailRotor.position.set(0.3, 0.2, 5.8);
    tailRotor.parent = heli;
    tailRotor.material = lib.metal;
    const beacon = MeshBuilder.CreateSphere("heliBeacon", { diameter: 0.2 }, scene);
    beacon.position.set(0, -1, -1);
    beacon.parent = heli;
    beacon.material = lib.redLight;
    shadows.addShadowCaster(body);
    shadows.addShadowCaster(tail);

    // Searchlight pointing down at the survivor
    const searchlight = new SpotLight(
        "searchlight",
        new Vector3(0, -1, -1.2),
        new Vector3(0, -1, -0.9),
        Math.PI / 7,
        2,
        scene
    );
    searchlight.parent = heli;
    searchlight.diffuse = new Color3(1, 0.97, 0.85);
    searchlight.intensity = 3;
    searchlight.range = 40;

    const camera = new ArcRotateCamera(
        "endCamera",
        -Math.PI / 2.3,
        1.2,
        12,
        new Vector3(0, 2, 0),
        scene
    );
    scene.activeCamera = camera;

    let time = 0;
    scene.onBeforeRenderObservable.add(() => {
        const dt = engine.getDeltaTime() / 1000;
        time += dt;
        rotor.rotation.y += dt * 18;
        tailRotor.rotation.x += dt * 25;
        heli.position.y = 9 + Math.sin(time * 1.2) * 0.3;
        heli.rotation.z = Math.sin(time * 0.8) * 0.04;
        beacon.isVisible = Math.sin(time * 5) > 0;
        camera.alpha += dt * 0.08;
    });

    new SoundBank(scene).add("music", AUDIO.music, { loop: true, volume: 0.5 });

    // =========================================
    // GUI
    // =========================================

    const ui = createUI(scene, "ending");
    const stack = new StackPanel("endStack");
    stack.width = "520px";
    stack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    stack.left = "60px";
    stack.top = "-60px";
    stack.spacing = 10;
    ui.addControl(stack);

    stack.addControl(
        makeText("endKicker", "RESCUE IS INBOUND", {
            size: 14,
            color: "#aaaaaa",
            width: 520,
            align: "left",
            height: 24
        })
    );
    stack.addControl(
        makeText("endTitle", "YOU ESCAPED", {
            size: 72,
            bold: true,
            width: 520,
            align: "left",
            height: 84
        })
    );
    stack.addControl(
        makeText(
            "endStats",
            `Time ${gameState.elapsed()}   ·   Health ${Math.max(0, gameState.health)}`,
            {
                size: 18,
                color: RED,
                bold: true,
                width: 520,
                align: "left",
                height: 34
            }
        )
    );

    const again = makeButton("playAgain", "PLAY AGAIN", { primary: true });
    again.onPointerClickObservable.add(() => {
        gameState.reset();
        manager.setSceneIndex(SCENES.outskirts);
    });
    const menu = makeButton("toMenu", "MAIN MENU");
    menu.onPointerClickObservable.add(() => manager.setSceneIndex(SCENES.menu));
    for (const b of [again, menu, makeSoundButton(scene)]) {
        b.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        stack.addControl(b);
    }

    return scene;
}
