import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, Button, Control, TextBlock } from "@babylonjs/gui";
import { isAudioOn, onAudioChange, setAudioOn } from "./audio";


// GUI styling shared by every scene - matches the website (monochrome + blood red).

export const FONT = "Arial, Helvetica, sans-serif";
export const RED = "#b3261e";


// Full-screen GUI layer, scaled as if the screen were 720 px tall.
export function createUI(scene: Scene, name = "ui"): AdvancedDynamicTexture {
    const ui = AdvancedDynamicTexture.CreateFullscreenUI(name, true, scene);
    ui.idealHeight = 720;
    return ui;
}


export interface ButtonOptions {
    width?: number;
    height?: number;
    primary?: boolean;
    fontSize?: number;
}


// Square, bold button. Primary buttons are red.
export function makeButton(name: string, label: string, o: ButtonOptions = {}): Button {
    const button = Button.CreateSimpleButton(name, label);
    const background = o.primary ? RED : "rgba(0, 0, 0, 0.55)";
    const hover = o.primary ? "#d33a2f" : "rgba(255, 255, 255, 0.15)";
    button.width = `${o.width ?? 260}px`;
    button.height = `${o.height ?? 50}px`;
    button.color = "white";
    button.background = background;
    button.thickness = o.primary ? 0 : 2;
    button.cornerRadius = 0;
    button.fontFamily = FONT;
    button.fontSize = o.fontSize ?? 18;
    button.fontWeight = "bold";
    button.pointerEnterAnimation = () => (button.background = hover);
    button.pointerOutAnimation = () => (button.background = background);
    button.pointerDownAnimation = () => (button.alpha = 0.8);
    button.pointerUpAnimation = () => (button.alpha = 1);
    return button;
}


export interface TextOptions {
    size?: number;
    color?: string;
    bold?: boolean;
    width?: number;
    height?: number;
    align?: "left" | "center" | "right";
    wrap?: boolean;
}


export function makeText(name: string, text: string, o: TextOptions = {}): TextBlock {
    const block = new TextBlock(name, text);
    const size = o.size ?? 18;
    block.fontFamily = FONT;
    block.fontSize = size;
    block.color = o.color ?? "white";
    if (o.bold) block.fontWeight = "bold";
    block.height = `${o.height ?? Math.round(size * 1.5)}px`;
    if (o.width) block.width = `${o.width}px`;
    block.textWrapping = o.wrap ?? false;
    block.textHorizontalAlignment = {
        left: Control.HORIZONTAL_ALIGNMENT_LEFT,
        center: Control.HORIZONTAL_ALIGNMENT_CENTER,
        right: Control.HORIZONTAL_ALIGNMENT_RIGHT
    }[o.align ?? "center"];
    return block;
}


// "SOUND: OFF / ON" toggle. Turning it on unlocks and starts the audio.
export function makeSoundButton(scene: Scene, o: ButtonOptions = {}): Button {
    const label = () => `SOUND: ${isAudioOn() ? "ON" : "OFF"}`;
    const button = makeButton("soundButton", label(), o);
    button.onPointerClickObservable.add(() => setAudioOn(!isAudioOn()));
    const unsubscribe = onAudioChange(() => {
        if (button.textBlock) button.textBlock.text = label();
    });
    scene.onDisposeObservable.addOnce(() => unsubscribe());
    return button;
}


// Small corner sound button for scenes without a menu (Element 2).
export function addCornerSoundButton(scene: Scene, ui: AdvancedDynamicTexture): Button {
    const button = makeSoundButton(scene, { width: 170, height: 42, fontSize: 15 });
    button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    button.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    button.left = "-24px";
    button.top = "-24px";
    ui.addControl(button);
    return button;
}
