// State that carries over between the Escape scenes.
export const SCENES = { menu: 0, outskirts: 1, bunker: 2, ending: 3 } as const;


export const gameState = {
    health: 100,
    hasKeycard: false,
    startTime: 0,

    // Called when a new run starts from the menu or "Play again".
    reset(): void {
        this.health = 100;
        this.hasKeycard = false;
        this.startTime = performance.now();
    },

    elapsed(): string {
        const seconds = Math.round((performance.now() - this.startTime) / 1000);
        return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    }
};
