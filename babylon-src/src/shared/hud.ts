import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Rectangle, StackPanel, TextBlock } from "@babylonjs/gui";
import { createUI, makeButton, makeSoundButton, makeText, RED } from "./gui";


export interface PanelButton {
    label: string;
    onClick: () => void;
    primary?: boolean;
}


// In-game GUI: health bar, counter, objective, sound and pause buttons,
// centre-screen messages, a red damage flash and pop-up panels (pause / game over / win).
// Scene events call these methods so the GUI changes in response to what happens.
export class Hud {
    readonly ui: AdvancedDynamicTexture;
    private healthFill: Rectangle;
    private healthText: TextBlock;
    private counter: TextBlock;
    private objective: TextBlock;
    private message: TextBlock;
    private flash: Rectangle;
    private panel: Rectangle | null = null;
    private messageTime = 0;
    private counterPulse = 0;

    constructor(scene: Scene, opts: { onPause?: () => void } = {}) {
        this.ui = createUI(scene, "hud");

        // Status box (top left)
        const box = new Rectangle("statusBox");
        box.width = "330px";
        box.height = "128px";
        box.thickness = 0;
        box.background = "rgba(0, 0, 0, 0.55)";
        box.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        box.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        box.left = "24px";
        box.top = "24px";
        this.ui.addControl(box);

        const accent = new Rectangle("accent");
        accent.width = "4px";
        accent.thickness = 0;
        accent.background = RED;
        accent.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        box.addControl(accent);

        const stack = new StackPanel("statusStack");
        stack.paddingLeft = "22px";
        stack.paddingTop = "12px";
        stack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        stack.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        box.addControl(stack);

        this.healthText = makeText("healthLabel", "HEALTH 100", {
            size: 12,
            color: "#aaaaaa",
            width: 290,
            align: "left",
            height: 20
        });
        stack.addControl(this.healthText);

        const bar = new Rectangle("healthBar");
        bar.width = "286px";
        bar.height = "14px";
        bar.thickness = 0;
        bar.background = "#333333";
        bar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        stack.addControl(bar);

        this.healthFill = new Rectangle("healthFill");
        this.healthFill.width = 1;
        this.healthFill.thickness = 0;
        this.healthFill.background = RED;
        this.healthFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        bar.addControl(this.healthFill);

        this.counter = makeText("counter", "", {
            size: 22,
            bold: true,
            width: 290,
            align: "left",
            height: 40
        });
        stack.addControl(this.counter);

        this.objective = makeText("objective", "", {
            size: 14,
            color: "#cccccc",
            width: 290,
            align: "left",
            height: 22
        });
        stack.addControl(this.objective);

        // Buttons (top right)
        const buttons = new StackPanel("hudButtons");
        buttons.isVertical = false;
        buttons.height = "42px";
        buttons.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        buttons.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        buttons.top = "24px";
        buttons.left = "-24px";
        buttons.spacing = 10;
        this.ui.addControl(buttons);

        buttons.addControl(makeSoundButton(scene, { width: 150, height: 42, fontSize: 14 }));
        if (opts.onPause) {
            const pause = makeButton("pauseButton", "PAUSE", {
                width: 110,
                height: 42,
                fontSize: 14
            });
            pause.onPointerClickObservable.add(() => opts.onPause?.());
            buttons.addControl(pause);
        }

        // Centre message
        this.message = makeText("message", "", { size: 30, bold: true, height: 60, width: 900 });
        this.message.top = "-120px";
        this.message.shadowColor = "black";
        this.message.shadowBlur = 8;
        this.message.alpha = 0;
        this.ui.addControl(this.message);

        // Damage flash
        this.flash = new Rectangle("damageFlash");
        this.flash.thickness = 0;
        this.flash.background = RED;
        this.flash.alpha = 0;
        this.flash.isHitTestVisible = false;
        this.ui.addControl(this.flash);

        scene.onBeforeRenderObservable.add(() => {
            const dt = scene.getEngine().getDeltaTime() / 1000;
            if (this.flash.alpha > 0) this.flash.alpha = Math.max(0, this.flash.alpha - dt * 1.5);
            if (this.messageTime > 0) {
                this.messageTime -= dt;
                this.message.alpha = Math.min(1, this.messageTime * 2);
            }
            if (this.counterPulse > 0) {
                this.counterPulse = Math.max(0, this.counterPulse - dt * 2);
                this.counter.color = this.counterPulse > 0 ? "#7dff8a" : "white";
                this.counter.scaleX = this.counter.scaleY = 1 + this.counterPulse * 0.15;
            }
        });
    }

    setHealth(value: number): void {
        const v = Math.max(0, Math.min(100, value));
        this.healthFill.width = v / 100;
        this.healthFill.background = v > 35 ? RED : "#ff4a3a";
        this.healthText.text = `HEALTH ${Math.round(v)}`;
    }

    setCounter(text: string, pulse = false): void {
        this.counter.text = text;
        if (pulse) this.counterPulse = 1;
    }

    setObjective(text: string): void {
        this.objective.text = text;
    }

    showMessage(text: string, seconds = 2.5): void {
        this.message.text = text;
        this.messageTime = seconds;
        this.message.alpha = 1;
    }

    flashDamage(): void {
        this.flash.alpha = 0.45;
    }

    get panelOpen(): boolean {
        return this.panel !== null;
    }

    // Full-screen panel with a title, subtitle and buttons.
    showPanel(title: string, subtitle: string, buttons: PanelButton[], titleColor = "white"): void {
        this.hidePanel();
        const panel = new Rectangle("panel");
        panel.thickness = 0;
        panel.background = "rgba(0, 0, 0, 0.72)";
        this.ui.addControl(panel);

        const stack = new StackPanel("panelStack");
        stack.spacing = 12;
        panel.addControl(stack);

        stack.addControl(
            makeText("panelTitle", title, {
                size: 54,
                bold: true,
                color: titleColor,
                height: 80,
                width: 900
            })
        );
        stack.addControl(
            makeText("panelSubtitle", subtitle, {
                size: 18,
                color: "#cccccc",
                height: 60,
                width: 640,
                wrap: true
            })
        );
        buttons.forEach((b, i) => {
            const button = makeButton(`panelButton${i}`, b.label, { primary: b.primary });
            button.onPointerClickObservable.add(() => b.onClick());
            stack.addControl(button);
        });
        this.panel = panel;
    }

    hidePanel(): void {
        this.panel?.dispose();
        this.panel = null;
    }
}
