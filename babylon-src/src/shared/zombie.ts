import {
    Mesh,
    MeshBuilder,
    Observer,
    Scene,
    ShadowGenerator,
    StandardMaterial,
    TransformNode,
    Vector3
} from "@babylonjs/core";
import { colorMaterial } from "./materials";
import { flatDistance, lerpAngle } from "./util";


// Procedural zombie built from primitive meshes, with a shambling walk animation
// (legs, arms and body driven by sine waves) and simple chase / wander behaviour.


interface ZombieMaterials {
    skin: StandardMaterial;
    shirts: StandardMaterial[];
    pants: StandardMaterial;
    eyes: StandardMaterial;
}

const materialCache = new WeakMap<Scene, ZombieMaterials>();


function zombieMaterials(scene: Scene): ZombieMaterials {
    let m = materialCache.get(scene);
    if (!m) {
        m = {
            skin: colorMaterial(scene, "zombieSkin", "#7d9a6a"),
            shirts: [
                colorMaterial(scene, "shirt1", "#5b4a3a"),
                colorMaterial(scene, "shirt2", "#3d4f5f"),
                colorMaterial(scene, "shirt3", "#6e2e2a")
            ],
            pants: colorMaterial(scene, "zombiePants", "#2c2d33"),
            eyes: colorMaterial(scene, "zombieEyes", "#ff2a1a", "#ff2a1a")
        };
        materialCache.set(scene, m);
    }
    return m;
}


export interface ZombieOptions {
    position: Vector3;
    // Returns the position to chase (usually the player), or null.
    target?: () => Vector3 | null;
    speed?: number;
    aggroRange?: number;
    stopDistance?: number;
    // Wander around the start position when not chasing (0 = stand still).
    wanderRadius?: number;
    heightAt?: (x: number, z: number) => number;
    shadows?: ShadowGenerator;
    // Use moveWithCollisions so walls block the zombie.
    collisions?: boolean;
}


export class Zombie {
    readonly root: Mesh;
    // When false the zombie stands still and only sways.
    active = true;
    isChasing = false;
    heading = Math.random() * Math.PI * 2;

    private speed: number;
    private aggroRange: number;
    private stopDistance: number;
    private home: Vector3;
    private wanderTarget: Vector3;
    private wanderTimer = 0;
    private idlePhase = Math.random() * 10;
    private walkPhase = 0;
    private body: TransformNode;
    private legs: TransformNode[] = [];
    private arms: TransformNode[] = [];
    private observer: Observer<Scene> | null;

    constructor(
        private scene: Scene,
        private opts: ZombieOptions
    ) {
        this.speed = opts.speed ?? 1.5;
        this.aggroRange = opts.aggroRange ?? 12;
        this.stopDistance = opts.stopDistance ?? 0.7;
        this.home = opts.position.clone();
        this.wanderTarget = this.home.clone();

        this.root = new Mesh("zombie", scene);
        this.root.position = opts.position.clone();
        this.root.ellipsoid = new Vector3(0.35, 0.85, 0.35);
        this.root.ellipsoidOffset = new Vector3(0, 0.85, 0);

        const m = zombieMaterials(scene);
        const shirt = m.shirts[Math.floor(Math.random() * m.shirts.length)];

        // Legs pivot at the hips so they can swing
        for (const side of [-1, 1]) {
            const hip = new TransformNode("hip", scene);
            hip.parent = this.root;
            hip.position.set(side * 0.14, 0.8, 0);
            const leg = MeshBuilder.CreateBox(
                "leg",
                { width: 0.2, height: 0.8, depth: 0.22 },
                scene
            );
            leg.parent = hip;
            leg.position.y = -0.4;
            leg.material = m.pants;
            this.legs.push(hip);
        }

        // Upper body sways as a group
        this.body = new TransformNode("zombieBody", scene);
        this.body.parent = this.root;

        const torso = MeshBuilder.CreateBox(
            "torso",
            { width: 0.55, height: 0.72, depth: 0.3 },
            scene
        );
        torso.parent = this.body;
        torso.position.y = 1.16;
        torso.rotation.x = 0.12; // hunched forward
        torso.material = shirt;

        const head = MeshBuilder.CreateSphere("head", { diameter: 0.38, segments: 10 }, scene);
        head.parent = this.body;
        head.position.set(0, 1.68, 0.08);
        head.rotation.z = (Math.random() - 0.5) * 0.6; // tilted head
        head.material = m.skin;

        for (const side of [-1, 1]) {
            const eye = MeshBuilder.CreateSphere("eye", { diameter: 0.06, segments: 6 }, scene);
            eye.parent = head;
            eye.position.set(side * 0.08, 0.03, 0.16);
            eye.material = m.eyes;
        }

        // Arms reach forward, classic zombie pose
        for (const side of [-1, 1]) {
            const shoulder = new TransformNode("shoulder", scene);
            shoulder.parent = this.body;
            shoulder.position.set(side * 0.36, 1.42, 0.05);
            const arm = MeshBuilder.CreateBox(
                "arm",
                { width: 0.15, height: 0.15, depth: 0.7 },
                scene
            );
            arm.parent = shoulder;
            arm.position.z = 0.33;
            arm.material = side < 0 ? m.skin : shirt;
            this.arms.push(shoulder);
        }

        this.root.getChildMeshes().forEach(child => (child.isPickable = false));
        opts.shadows?.addShadowCaster(this.root, true);

        this.observer = scene.onBeforeRenderObservable.add(() => this.update());
    }

    get position(): Vector3 {
        return this.root.position;
    }

    distanceTo(point: Vector3): number {
        return flatDistance(this.root.position, point);
    }

    dispose(): void {
        this.scene.onBeforeRenderObservable.remove(this.observer);
        this.observer = null;
        this.root.dispose();
    }

    private update(): void {
        const dt = Math.min(this.scene.getEngine().getDeltaTime() / 1000, 0.05);
        this.idlePhase += dt;
        let direction: Vector3 | null = null;
        let speed = this.speed;
        this.isChasing = false;

        if (this.active) {
            const target = this.opts.target?.() ?? null;
            if (target) {
                const d = this.distanceTo(target);
                if (d < this.aggroRange) {
                    this.isChasing = true;
                    if (d > this.stopDistance) {
                        direction = new Vector3(
                            target.x - this.root.position.x,
                            0,
                            target.z - this.root.position.z
                        ).normalize();
                    }
                }
            }
            if (!this.isChasing && this.opts.wanderRadius) {
                this.wanderTimer -= dt;
                if (this.wanderTimer <= 0 || this.distanceTo(this.wanderTarget) < 0.5) {
                    const a = Math.random() * Math.PI * 2;
                    const r = Math.random() * this.opts.wanderRadius;
                    this.wanderTarget = this.home.add(
                        new Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)
                    );
                    this.wanderTimer = 4 + Math.random() * 5;
                }
                if (this.distanceTo(this.wanderTarget) > 0.5) {
                    direction = new Vector3(
                        this.wanderTarget.x - this.root.position.x,
                        0,
                        this.wanderTarget.z - this.root.position.z
                    ).normalize();
                    speed *= 0.35;
                }
            }
        }

        if (direction) {
            this.heading = lerpAngle(
                this.heading,
                Math.atan2(direction.x, direction.z),
                Math.min(1, dt * 4)
            );
            const step = new Vector3(
                Math.sin(this.heading),
                0,
                Math.cos(this.heading)
            ).scaleInPlace(speed * dt);
            if (this.opts.collisions === false) this.root.position.addInPlace(step);
            else this.root.moveWithCollisions(step);
            this.walkPhase += dt * (2 + speed * 2.5);
        }
        this.root.rotation.y = this.heading;
        if (this.opts.heightAt) {
            this.root.position.y = this.opts.heightAt(this.root.position.x, this.root.position.z);
        }

        // Shambling animation
        const walking = direction !== null;
        const swing = walking ? Math.sin(this.walkPhase) * 0.55 : 0;
        this.legs[0].rotation.x = swing;
        this.legs[1].rotation.x = -swing;
        this.arms.forEach((arm, i) => {
            arm.rotation.x =
                -0.15 +
                Math.sin(this.idlePhase * 2 + i * 1.7) * 0.1 +
                (walking ? Math.sin(this.walkPhase + i) * 0.12 : 0);
        });
        this.body.rotation.z =
            Math.sin(this.idlePhase * 1.6) * 0.07 +
            (walking ? Math.sin(this.walkPhase * 0.5) * 0.08 : 0);
        this.body.position.y = walking ? Math.abs(Math.sin(this.walkPhase)) * 0.05 : 0;
    }
}
