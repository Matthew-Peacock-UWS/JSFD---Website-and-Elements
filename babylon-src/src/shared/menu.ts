import {
    ArcRotateCamera,
    Engine,
    GlowLayer,
    Scene,
    ShadowGenerator,
    Vector3
} from "@babylonjs/core";
import { Control, Rectangle, StackPanel } from "@babylonjs/gui";
import { AUDIO } from "./assets";
import { SoundBank } from "./audio";
import { addFog, createNightLighting, createSkybox } from "./environment";
import { createUI, FONT, makeButton, makeSoundButton, makeText, RED } from "./gui";
import { MaterialLibrary } from "./materials";


export interface MenuOptions {
    kicker: string;
    title: string;
    titleAccent: string;
    tagline: string;
    startLabel: string;
    onStart: () => void;
    howToPlay: string[];
    // Builds the 3D scenery behind the menu.
    backdrop: (
        scene: Scene,
        lib: MaterialLibrary,
        shadows: ShadowGenerator
    ) => void | Promise<void>;
}


// Main menu scene: a slowly orbiting 3D backdrop with a GUI menu on the left.
// Audio starts OFF and is switched on with the SOUND button.
export async function createMenuScene(engine: Engine, o: MenuOptions): Promise<Scene> {
    const scene = new Scene(engine);
    addFog(scene, 0.035);
    createSkybox(scene);
    const { shadows } = createNightLighting(scene, 0.8, 0.35);
    new GlowLayer("glow", scene).intensity = 0.7;

    // Camera slowly circles the backdrop (no user control on the menu)
    const camera = new ArcRotateCamera(
        "menuCamera",
        -Math.PI / 2.4,
        1.22,
        13,
        new Vector3(1.5, 1.4, 0),
        scene
    );
    scene.onBeforeRenderObservable.add(() => {
        camera.alpha += (engine.getDeltaTime() / 1000) * 0.06;
    });

    const lib = new MaterialLibrary(scene);
    await o.backdrop(scene, lib, shadows);

    const sounds = new SoundBank(scene)
        .add("music", AUDIO.music, { loop: true, volume: 0.6 })
        .add("click", AUDIO.click, { volume: 0.6 });

    // =========================================
    // GUI
    // =========================================

    const ui = createUI(scene, "menu");

    const side = new Rectangle("menuSide");
    side.width = "560px";
    side.thickness = 0;
    side.background = "rgba(8, 9, 9, 0.78)";
    side.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    ui.addControl(side);

    const stack = new StackPanel("menuStack");
    stack.width = "460px";
    stack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.left = "60px";
    side.addControl(stack);

    stack.addControl(
        makeText("kicker", o.kicker.toUpperCase(), {
            size: 13,
            color: "#999999",
            width: 460,
            align: "left",
            height: 30
        })
    );
    const title = makeText("title", o.title, {
        size: 84,
        bold: true,
        width: 460,
        align: "left",
        height: 90
    });
    stack.addControl(title);
    const accent = makeText("titleAccent", o.titleAccent, {
        size: 84,
        bold: true,
        color: RED,
        width: 460,
        align: "left",
        height: 96
    });
    stack.addControl(accent);
    stack.addControl(
        makeText("tagline", o.tagline, {
            size: 17,
            color: "#cccccc",
            width: 420,
            align: "left",
            height: 70,
            wrap: true
        })
    );

    const spacer = new Rectangle("spacer");
    spacer.height = "24px";
    spacer.thickness = 0;
    stack.addControl(spacer);

    const start = makeButton("startButton", o.startLabel, { primary: true, width: 300 });
    const sound = makeSoundButton(scene, { width: 300 });
    const help = makeButton("helpButton", "HOW TO PLAY", { width: 300 });
    for (const button of [start, sound, help]) {
        button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        button.paddingBottom = "12px";
        button.height = "62px";
        stack.addControl(button);
    }

    // "How to play" panel
    const helpPanel = new Rectangle("helpPanel");
    helpPanel.width = "460px";
    helpPanel.height = `${170 + o.howToPlay.length * 30}px`;
    helpPanel.thickness = 0;
    helpPanel.background = "rgba(0, 0, 0, 0.85)";
    helpPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    helpPanel.left = "-80px";
    helpPanel.isVisible = false;
    ui.addControl(helpPanel);

    const helpStack = new StackPanel("helpStack");
    helpStack.width = "380px";
    helpPanel.addControl(helpStack);
    helpStack.addControl(
        makeText("helpTitle", "HOW TO PLAY", {
            size: 26,
            bold: true,
            width: 380,
            align: "left",
            height: 56
        })
    );
    o.howToPlay.forEach((line, i) => {
        const t = makeText(`helpLine${i}`, line, {
            size: 16,
            color: "#dddddd",
            width: 380,
            align: "left",
            height: 30
        });
        t.fontFamily = FONT;
        helpStack.addControl(t);
    });
    const close = makeButton("closeHelp", "CLOSE", { width: 160, height: 44, fontSize: 15 });
    close.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    close.paddingTop = "16px";
    close.height = "60px";
    helpStack.addControl(close);

    // Menu responses
    start.onPointerClickObservable.add(() => {
        sounds.play("click");
        o.onStart();
    });
    sound.onPointerClickObservable.add(() => sounds.play("click"));
    help.onPointerClickObservable.add(() => {
        sounds.play("click");
        helpPanel.isVisible = !helpPanel.isVisible;
    });
    close.onPointerClickObservable.add(() => {
        sounds.play("click");
        helpPanel.isVisible = false;
    });

    return scene;
}
