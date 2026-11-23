import { InstancedMesh, Mesh, Scene } from "@babylonjs/core";
import { SoundBank } from "../shared/audio";
import { Hud } from "../shared/hud";
import { Player } from "../shared/player";
import { SceneManager } from "../shared/sceneManager";
import { flatDistance } from "../shared/util";
import { Zombie } from "../shared/zombie";
import { gameState, SCENES } from "./gameState";


const ZOMBIE_DAMAGE = 15;
const MEDKIT_HEAL = 30;


export interface LevelOptions {
    scene: Scene;
    manager: SceneManager;
    player: Player;
    zombies: Zombie[];
    hud: Hud;
    sounds: SoundBank;
    // Index of this scene, so "Try again" can reload it.
    sceneIndex: number;
    medkits?: (Mesh | InstancedMesh)[];
}


// Gameplay shared by both Escape levels: zombie damage, medkits, pause menu and death.
// Health is stored in gameState so it carries over from the Outskirts into the Bunker.
export class Level {
    paused = false;
    over = false;
    private hurtCooldown = 0;
    private groanTimer = 2;

    constructor(private o: LevelOptions) {
        o.hud.setHealth(gameState.health);
        o.scene.onBeforeRenderObservable.add(() => this.update());
    }

    setActive(on: boolean): void {
        this.o.player.enabled = on;
        this.o.zombies.forEach(z => (z.active = on));
    }

    togglePause(): void {
        if (this.over) return;
        this.o.sounds.play("click");
        this.paused = !this.paused;
        this.setActive(!this.paused);
        if (this.paused) {
            this.o.hud.showPanel("PAUSED", `Time ${gameState.elapsed()}`, [
                { label: "RESUME", primary: true, onClick: () => this.togglePause() },
                { label: "RESTART LEVEL", onClick: () => this.restart() },
                { label: "MAIN MENU", onClick: () => this.o.manager.setSceneIndex(SCENES.menu) }
            ]);
        } else {
            this.o.hud.hidePanel();
        }
    }

    // Locks the controls (used while switching to the next scene).
    finish(): void {
        this.over = true;
        this.setActive(false);
    }

    private restart(): void {
        gameState.health = 100;
        if (this.o.sceneIndex === SCENES.outskirts) gameState.hasKeycard = false;
        this.o.manager.setSceneIndex(this.o.sceneIndex);
    }

    private die(): void {
        this.finish();
        this.o.hud.showPanel(
            "YOU DIDN'T MAKE IT",
            "The dead got you. Try again?",
            [
                { label: "TRY AGAIN", primary: true, onClick: () => this.restart() },
                { label: "MAIN MENU", onClick: () => this.o.manager.setSceneIndex(SCENES.menu) }
            ],
            "#ff4a3a"
        );
    }

    private update(): void {
        if (this.paused || this.over) return;
        const dt = Math.min(this.o.scene.getEngine().getDeltaTime() / 1000, 0.05);
        const { player, hud, sounds } = this.o;

        // Medkits
        for (const kit of this.o.medkits ?? []) {
            if (kit.isEnabled() && flatDistance(player.position, kit.position) < 1.2) {
                kit.setEnabled(false);
                gameState.health = Math.min(100, gameState.health + MEDKIT_HEAL);
                hud.setHealth(gameState.health);
                hud.showMessage(`+${MEDKIT_HEAL} HEALTH`, 1.5);
                sounds.play("pickup");
            }
        }

        // Zombie attacks
        this.hurtCooldown -= dt;
        let nearest = Infinity;
        for (const zombie of this.o.zombies) {
            const d = zombie.distanceTo(player.position);
            nearest = Math.min(nearest, d);
            if (d < 1 && this.hurtCooldown <= 0) {
                gameState.health -= ZOMBIE_DAMAGE;
                this.hurtCooldown = 1;
                hud.flashDamage();
                hud.setHealth(gameState.health);
                sounds.play("hit");
                if (gameState.health <= 0) this.die();
            }
        }

        this.groanTimer -= dt;
        if (nearest < 8 && this.groanTimer <= 0) {
            sounds.play("groan");
            this.groanTimer = 3 + Math.random() * 3;
        }
    }
}
