import { Engine, Scene, Sound } from "@babylonjs/core";


// Audio starts OFF on every page. It is turned on by a GUI button, which also
// satisfies the browser rule that sound can only start after a user action.
// The on/off setting is shared by every scene on the page.

type Listener = (on: boolean) => void;
let audioOn = false;
const listeners = new Set<Listener>();


export function isAudioOn(): boolean {
    return audioOn;
}


export function setAudioOn(on: boolean): void {
    audioOn = on;
    if (on) Engine.audioEngine?.unlock();
    listeners.forEach(listener => listener(on));
}


export function onAudioChange(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}


interface SoundOptions {
    loop?: boolean;
    volume?: number;
    // Play once as soon as it has loaded (if audio is on) - e.g. an arrival sound.
    playWhenReady?: boolean;
}


// The sounds used by one scene. Looping sounds start/stop with the audio setting.
export class SoundBank {
    private sounds = new Map<string, Sound>();
    private loops: string[] = [];

    constructor(private scene: Scene) {
        const unsubscribe = onAudioChange(on => (on ? this.startLoops() : this.stopAll()));
        scene.onDisposeObservable.addOnce(() => unsubscribe());
    }

    add(name: string, url: string, o: SoundOptions = {}): this {
        const sound = new Sound(
            name,
            url,
            this.scene,
            () => {
                if (audioOn && (o.loop || o.playWhenReady)) sound.play();
            },
            { loop: o.loop ?? false, autoplay: false, volume: o.volume ?? 1 }
        );
        this.sounds.set(name, sound);
        if (o.loop) this.loops.push(name);
        return this;
    }

    // Plays a sound effect (ignored while audio is off).
    play(name: string): void {
        const sound = this.sounds.get(name);
        if (audioOn && sound?.isReady()) sound.play();
    }

    private startLoops(): void {
        for (const name of this.loops) {
            const sound = this.sounds.get(name);
            if (sound?.isReady() && !sound.isPlaying) sound.play();
        }
    }

    private stopAll(): void {
        this.sounds.forEach(sound => sound.stop());
    }
}
