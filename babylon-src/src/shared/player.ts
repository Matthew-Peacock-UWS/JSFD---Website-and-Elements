import {
    AnimationGroup,
    ArcRotateCamera,
    Mesh,
    MeshBuilder,
    PhysicsAggregate,
    PhysicsBody,
    PhysicsMotionType,
    PhysicsShapeType,
    PointerEventTypes,
    Scene,
    SceneLoader,
    ShadowGenerator,
    Vector3
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { PLAYER_MODEL } from "./assets";
import { KeyInput } from "./input";
import { colorMaterial } from "./materials";
import { clamp, lerpAngle } from "./util";


export interface PlayerOptions {
    position: Vector3;
    // Direction the player faces at the start (radians, 0 = +z).
    heading?: number;
    // Walking speed in metres per second.
    speed?: number;
    // Returns the ground height at x/z (for height-map terrain).
    heightAt?: (x: number, z: number) => number;
    // Keeps the player inside a rectangle.
    bounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
    // Adds an animated physics body so the player can push physics objects.
    physicsPush?: boolean;
    shadows?: ShadowGenerator;
    camera?: { radius?: number; minRadius?: number; maxRadius?: number; collisions?: boolean };
}

const HEIGHT = 1.8;


// Third-person player: an imported, animated character (HVGirl.glb) moved with the keyboard.
//  W / Up     walk forward        S / Down  walk back
//  A, D / Left, Right  turn        Shift     run
// Walls block the player through moveWithCollisions; physics objects are pushed by an
// animated capsule body that follows the player.
export class Player {
    // Empty parent mesh that is moved and rotated - the model hangs off it.
    readonly root: Mesh;
    // Invisible box around the player for trigger and intersection checks.
    readonly hitbox: Mesh;
    readonly camera: ArcRotateCamera;
    enabled = true;
    heading: number;
    speed: number;
    turnSpeed = 2.6;

    private input: KeyInput;
    private animations: AnimationGroup[] = [];
    private anims: { idle?: AnimationGroup; walk?: AnimationGroup; back?: AnimationGroup } = {};
    private currentAnim?: AnimationGroup;
    private body?: PhysicsBody;
    private bodyMesh?: Mesh;
    private groundY: number;
    private userOrbiting = false;

    private constructor(
        private scene: Scene,
        private opts: PlayerOptions
    ) {
        this.heading = opts.heading ?? 0;
        this.speed = opts.speed ?? 3;
        this.groundY = opts.position.y;
        this.input = new KeyInput(scene);

        this.root = new Mesh("player", scene);
        this.root.ellipsoid = new Vector3(0.35, HEIGHT / 2, 0.35);
        this.root.ellipsoidOffset = new Vector3(0, HEIGHT / 2, 0);

        this.hitbox = MeshBuilder.CreateBox(
            "playerHitbox",
            { width: 0.7, height: HEIGHT, depth: 0.7 },
            scene
        );
        this.hitbox.parent = this.root;
        this.hitbox.position.y = HEIGHT / 2;
        this.hitbox.isVisible = false;
        this.hitbox.isPickable = false;

        // Third-person camera that orbits a point at head height
        const cameraTarget = new Mesh("cameraTarget", scene);
        cameraTarget.parent = this.root;
        cameraTarget.position.y = 1.4;

        const c = opts.camera ?? {};
        this.camera = new ArcRotateCamera(
            "playerCamera",
            -Math.PI / 2 - this.heading,
            1.15,
            c.radius ?? 7,
            Vector3.Zero(),
            scene
        );
        this.camera.setTarget(cameraTarget, false, false, true);
        this.camera.lowerRadiusLimit = c.minRadius ?? 3;
        this.camera.upperRadiusLimit = c.maxRadius ?? 12;
        this.camera.lowerBetaLimit = 0.35;
        this.camera.upperBetaLimit = 1.45;
        this.camera.wheelDeltaPercentage = 0.01;
        this.camera.panningSensibility = 0;
        this.camera.minZ = 0.1;
        this.camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput"); // arrow keys move the player instead
        if (c.collisions) {
            this.camera.checkCollisions = true;
            this.camera.collisionRadius = new Vector3(0.3, 0.3, 0.3);
        }
        this.camera.attachControl(true);
        scene.activeCamera = this.camera;

        // Remember when the user is dragging the camera so we don't fight them
        scene.onPointerObservable.add(info => {
            if (info.type === PointerEventTypes.POINTERDOWN) this.userOrbiting = true;
            if (info.type === PointerEventTypes.POINTERUP) this.userOrbiting = false;
        });

        scene.onBeforeRenderObservable.add(() => this.update());
    }

    // Loads the character model and places the player.
    static async create(scene: Scene, opts: PlayerOptions): Promise<Player> {
        const player = new Player(scene, opts);
        await player.loadModel();
        player.setPosition(opts.position, player.heading);
        if (opts.physicsPush) player.addPhysicsBody();
        return player;
    }

    get position(): Vector3 {
        return this.root.position;
    }

    setPosition(position: Vector3, heading = this.heading): void {
        this.root.position.copyFrom(position);
        this.groundY = position.y;
        this.heading = heading;
        this.root.rotation.y = heading;
        this.camera.alpha = -Math.PI / 2 - heading;
    }

    // Plays one of the model's animations by name, e.g. "Samba".
    playAnimation(name: string, loop = true): void {
        const group = this.animations.find(g => g.name.toLowerCase() === name.toLowerCase());
        if (group) this.play(group, 1, loop);
    }

    private async loadModel(): Promise<void> {
        try {
            const result = await SceneLoader.ImportMeshAsync(
                "",
                PLAYER_MODEL.rootUrl,
                PLAYER_MODEL.file,
                this.scene
            );
            const model = result.meshes[0];
            model.parent = this.root;

            // Scale the model to 1.8 m tall and stand its feet on y = 0
            model.computeWorldMatrix(true);
            let { min, max } = model.getHierarchyBoundingVectors(true);
            const size = max.y - min.y;
            model.scaling.scaleInPlace(isFinite(size) && size > 0.01 ? HEIGHT / size : 0.1);
            model.computeWorldMatrix(true);
            ({ min, max } = model.getHierarchyBoundingVectors(true));
            model.position.y -= min.y;

            result.meshes.forEach(m => {
                m.isPickable = false;
                // Let the character be lit by up to 6 lights (the default is 4)
                const mat = m.material as unknown as { maxSimultaneousLights?: number } | null;
                if (mat && mat.maxSimultaneousLights !== undefined) mat.maxSimultaneousLights = 6;
            });
            this.opts.shadows?.addShadowCaster(model, true);

            this.animations = result.animationGroups;
            const find = (re: RegExp) => this.animations.find(g => re.test(g.name));
            this.anims = {
                idle: find(/idle/i),
                walk: find(/^walk(ing)?$/i) ?? find(/walk/i),
                back: find(/back/i)
            };
            this.animations.forEach(g => g.stop());
            this.play(this.anims.idle);
        } catch (error) {
            // No internet? Use a simple stand-in so the scene still works.
            console.warn("Player model failed to load, using a placeholder", error);
            this.createPlaceholder();
        }
    }

    private createPlaceholder(): void {
        const body = MeshBuilder.CreateCapsule(
            "placeholderBody",
            { height: 1.5, radius: 0.3 },
            this.scene
        );
        body.position.y = 0.75;
        body.material = colorMaterial(this.scene, "placeholderMat", "#d8c8a8");
        body.parent = this.root;
        const head = MeshBuilder.CreateSphere("placeholderHead", { diameter: 0.35 }, this.scene);
        head.position.y = 1.62;
        head.material = body.material;
        head.parent = this.root;
        const nose = MeshBuilder.CreateBox("facing", { size: 0.12 }, this.scene);
        nose.position.set(0, 1.62, 0.2);
        nose.parent = this.root;
        this.opts.shadows?.addShadowCaster(body);
        this.opts.shadows?.addShadowCaster(head);
    }

    private addPhysicsBody(): void {
        const capsule = MeshBuilder.CreateCapsule(
            "playerBody",
            { height: HEIGHT, radius: 0.35 },
            this.scene
        );
        capsule.isVisible = false;
        capsule.isPickable = false;
        capsule.position = this.root.position.add(new Vector3(0, HEIGHT / 2, 0));
        const aggregate = new PhysicsAggregate(
            capsule,
            PhysicsShapeType.CAPSULE,
            { mass: 1, friction: 0.5 },
            this.scene
        );
        aggregate.body.setMotionType(PhysicsMotionType.ANIMATED); // moved by code, pushes dynamic bodies
        aggregate.body.disablePreStep = false; // copy the mesh position into the physics world each step
        this.body = aggregate.body;
        this.bodyMesh = capsule;
    }

    private play(group: AnimationGroup | undefined, speedRatio = 1, loop = true): void {
        if (!group) return;
        if (this.currentAnim !== group) {
            this.currentAnim?.stop();
            group.start(loop, speedRatio, group.from, group.to, false);
            this.currentAnim = group;
        } else {
            group.speedRatio = speedRatio;
        }
    }

    private update(): void {
        const dt = Math.min(this.scene.getEngine().getDeltaTime() / 1000, 0.05);
        let move = 0;
        let turn = 0;
        if (this.enabled) {
            if (this.input.isDown("KeyW", "ArrowUp")) move += 1;
            if (this.input.isDown("KeyS", "ArrowDown")) move -= 1;
            if (this.input.isDown("KeyA", "ArrowLeft")) turn -= 1;
            if (this.input.isDown("KeyD", "ArrowRight")) turn += 1;
        }
        const running = move > 0 && this.input.isDown("ShiftLeft", "ShiftRight");
        const before = this.root.position.clone();

        // Turn, then move in the direction the player is facing
        this.heading += turn * this.turnSpeed * dt;
        this.root.rotation.y = this.heading;
        if (move !== 0) {
            const speed = move > 0 ? this.speed * (running ? 1.7 : 1) : this.speed * 0.5;
            const step = new Vector3(
                Math.sin(this.heading),
                0,
                Math.cos(this.heading)
            ).scaleInPlace(speed * dt * move);
            this.root.moveWithCollisions(step);
        }

        // Stay inside the play area and on the ground
        const b = this.opts.bounds;
        if (b) {
            this.root.position.x = clamp(this.root.position.x, b.minX, b.maxX);
            this.root.position.z = clamp(this.root.position.z, b.minZ, b.maxZ);
        }
        this.root.position.y = this.opts.heightAt
            ? this.opts.heightAt(this.root.position.x, this.root.position.z)
            : this.groundY;

        // Animation follows the movement
        if (
            this.enabled ||
            this.currentAnim === this.anims.walk ||
            this.currentAnim === this.anims.back
        ) {
            if (move > 0) this.play(this.anims.walk, running ? 1.7 : 1);
            else if (move < 0) this.play(this.anims.back ?? this.anims.walk, 1);
            else if (turn !== 0) this.play(this.anims.walk, 0.7);
            else this.play(this.anims.idle);
        }

        // Camera swings in behind the player while walking (unless the user is dragging it)
        if (move !== 0 && !this.userOrbiting) {
            this.camera.alpha = lerpAngle(
                this.camera.alpha,
                -Math.PI / 2 - this.heading,
                Math.min(1, dt * 2.5)
            );
        }

        // Keep the physics body with the player
        if (this.body && this.bodyMesh && dt > 0) {
            this.bodyMesh.position.set(
                this.root.position.x,
                this.root.position.y + HEIGHT / 2,
                this.root.position.z
            );
            this.body.setLinearVelocity(this.root.position.subtract(before).scaleInPlace(1 / dt));
        }
    }
}
