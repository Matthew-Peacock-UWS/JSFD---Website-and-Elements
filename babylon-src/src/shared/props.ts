import { Mesh, MeshBuilder, PointLight, Quaternion, Scene, Color3, Vector3 } from "@babylonjs/core";
import { MaterialLibrary } from "./materials";


// Props for the zombie-survival world. Most are built from several primitive
// meshes and then combined with Mesh.MergeMeshes, so each prop is one mesh
// (one draw call) that can be cloned or instanced cheaply.
// Merged props have their base at y = 0 so they sit on the ground.


// Merge parts into one mesh, keeping each part's material (multi-material).
function merge(name: string, parts: Mesh[]): Mesh {
    const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, true);
    if (!merged) throw new Error(`Could not merge ${name}`);
    merged.name = name;
    return merged;
}


// Points a cylinder from `base` in direction `dir` (used for tree branches).
function alignCylinder(mesh: Mesh, base: Vector3, dir: Vector3, length: number): void {
    const d = dir.normalizeToNew();
    const q = new Quaternion();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), d, q);
    mesh.rotationQuaternion = q;
    mesh.position = base.add(d.scale(length / 2));
}


// Boarded-up house: plank walls, tiled roof, door and boarded windows (front faces -z).
export function createHouse(scene: Scene, lib: MaterialLibrary, name = "house"): Mesh {
    const W = 3,
        D = 2.6,
        H = 2;
    const parts: Mesh[] = [];

    const walls = MeshBuilder.CreateBox("walls", { width: W, height: H, depth: D }, scene);
    walls.position.y = H / 2;
    walls.material = lib.planks;
    parts.push(walls);

    // Triangular prism roof (village tutorial technique)
    const r = (D + 0.4) / Math.sqrt(3);
    const roof = MeshBuilder.CreateCylinder(
        "roof",
        { diameter: r * 2, height: W + 0.4, tessellation: 3 },
        scene
    );
    roof.scaling.x = 0.5;
    roof.rotation.z = Math.PI / 2;
    roof.position.y = H + (r / 2) * 0.5;
    roof.material = lib.roof;
    parts.push(roof);

    const door = MeshBuilder.CreateBox("door", { width: 0.7, height: 1.3, depth: 0.06 }, scene);
    door.position.set(0, 0.65, -D / 2 - 0.03);
    door.material = lib.darkWood;
    parts.push(door);

    for (const x of [-0.95, 0.95]) {
        const win = MeshBuilder.CreateBox(
            "window",
            { width: 0.6, height: 0.55, depth: 0.04 },
            scene
        );
        win.position.set(x, 1.2, -D / 2 - 0.02);
        win.material = lib.window;
        parts.push(win);
        for (const angle of [0.45, -0.35]) {
            const board = MeshBuilder.CreateBox(
                "board",
                { width: 0.78, height: 0.1, depth: 0.04 },
                scene
            );
            board.position.set(x, 1.2, -D / 2 - 0.06);
            board.rotation.z = angle;
            board.material = lib.boards;
            parts.push(board);
        }
    }

    const chimney = MeshBuilder.CreateBox(
        "chimney",
        { width: 0.35, height: 1, depth: 0.35 },
        scene
    );
    chimney.position.set(W / 2 - 0.5, H + 0.6, 0.4);
    chimney.material = lib.stone;
    parts.push(chimney);

    const house = merge(name, parts);
    house.receiveShadows = true;
    return house;
}


// Ruined church - a larger focal point for the town.
export function createChurch(scene: Scene, lib: MaterialLibrary): Mesh {
    const parts: Mesh[] = [];
    const nave = MeshBuilder.CreateBox("nave", { width: 5, height: 3.5, depth: 8 }, scene);
    nave.position.y = 1.75;
    nave.material = lib.stone;
    parts.push(nave);

    const r = 5.6 / Math.sqrt(3);
    const roof = MeshBuilder.CreateCylinder(
        "naveRoof",
        { diameter: r * 2, height: 8.3, tessellation: 3 },
        scene
    );
    roof.scaling.x = 0.55;
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.y = 3.5 + (r / 2) * 0.55;
    roof.material = lib.roof;
    parts.push(roof);

    const tower = MeshBuilder.CreateBox("tower", { width: 2.2, height: 7, depth: 2.2 }, scene);
    tower.position.set(0, 3.5, -4.6);
    tower.material = lib.stone;
    parts.push(tower);

    const spire = MeshBuilder.CreateCylinder(
        "spire",
        { diameterTop: 0, diameterBottom: 3, height: 3.5, tessellation: 4 },
        scene
    );
    spire.rotation.y = Math.PI / 4;
    spire.position.set(0, 8.75, -4.6);
    spire.material = lib.roof;
    parts.push(spire);

    const door = MeshBuilder.CreateBox(
        "churchDoor",
        { width: 1.2, height: 2.2, depth: 0.1 },
        scene
    );
    door.position.set(0, 1.1, -5.72);
    door.material = lib.darkWood;
    parts.push(door);

    for (const z of [-2, 0.5, 3]) {
        for (const x of [-2.52, 2.52]) {
            const win = MeshBuilder.CreateBox(
                "churchWindow",
                { width: 0.06, height: 1.4, depth: 0.7 },
                scene
            );
            win.position.set(x, 2, z);
            win.material = lib.litWindow;
            parts.push(win);
        }
    }

    const church = merge("church", parts);
    church.receiveShadows = true;
    return church;
}


// Dead tree: tapered trunk with bare branches.
export function createDeadTree(
    scene: Scene,
    lib: MaterialLibrary,
    name = "deadTree",
    seed = 1
): Mesh {
    const parts: Mesh[] = [];
    const trunk = MeshBuilder.CreateCylinder(
        "trunk",
        { diameterTop: 0.14, diameterBottom: 0.5, height: 4.5, tessellation: 8 },
        scene
    );
    trunk.position.y = 2.25;
    parts.push(trunk);

    const branches = [
        { h: 2.4, a: 0.3 + seed, tilt: 0.9, l: 1.8 },
        { h: 3.0, a: 2.4 + seed, tilt: 0.7, l: 1.5 },
        { h: 3.5, a: 4.3 + seed, tilt: 0.8, l: 1.2 },
        { h: 1.8, a: 5.4 + seed, tilt: 1.1, l: 1.4 }
    ];
    for (const b of branches) {
        const dir = new Vector3(
            Math.cos(b.a) * Math.sin(b.tilt),
            Math.cos(b.tilt),
            Math.sin(b.a) * Math.sin(b.tilt)
        );
        const branch = MeshBuilder.CreateCylinder(
            "branch",
            { diameterTop: 0.02, diameterBottom: 0.14, height: b.l, tessellation: 6 },
            scene
        );
        alignCylinder(branch, new Vector3(0, b.h, 0), dir, b.l);
        parts.push(branch);
    }

    const tree = Mesh.MergeMeshes(parts, true, true);
    if (!tree) throw new Error("Could not merge tree");
    tree.name = name;
    tree.material = lib.bark;
    return tree;
}


// Gravestone - rounded slab (variant 0) or cross (variant 1).
export function createTombstone(scene: Scene, lib: MaterialLibrary, variant = 0): Mesh {
    const parts: Mesh[] = [];
    if (variant === 0) {
        const slab = MeshBuilder.CreateBox("slab", { width: 0.6, height: 0.7, depth: 0.14 }, scene);
        slab.position.y = 0.35;
        const top = MeshBuilder.CreateCylinder(
            "slabTop",
            { diameter: 0.6, height: 0.14, tessellation: 16 },
            scene
        );
        top.rotation.x = Math.PI / 2;
        top.position.y = 0.7;
        parts.push(slab, top);
    } else {
        const upright = MeshBuilder.CreateBox(
            "upright",
            { width: 0.14, height: 1.1, depth: 0.14 },
            scene
        );
        upright.position.y = 0.55;
        const bar = MeshBuilder.CreateBox("bar", { width: 0.6, height: 0.14, depth: 0.14 }, scene);
        bar.position.y = 0.78;
        parts.push(upright, bar);
    }
    const stone = Mesh.MergeMeshes(parts, true);
    if (!stone) throw new Error("Could not merge tombstone");
    stone.name = variant === 0 ? "tombstone" : "cross";
    stone.material = lib.stone;
    return stone;
}


// Two posts and two rails, 2 m long - clone it to build fences.
export function createFenceSegment(scene: Scene, lib: MaterialLibrary): Mesh {
    const parts: Mesh[] = [];
    for (const x of [-1, 1]) {
        const post = MeshBuilder.CreateBox(
            "post",
            { width: 0.12, height: 1.1, depth: 0.12 },
            scene
        );
        post.position.set(x, 0.55, 0);
        parts.push(post);
    }
    for (const y of [0.4, 0.85]) {
        const rail = MeshBuilder.CreateBox("rail", { width: 2, height: 0.08, depth: 0.05 }, scene);
        rail.position.y = y;
        rail.rotation.z = (Math.random() - 0.5) * 0.08;
        parts.push(rail);
    }
    const fence = Mesh.MergeMeshes(parts, true);
    if (!fence) throw new Error("Could not merge fence");
    fence.name = "fence";
    fence.material = lib.darkWood;
    return fence;
}


// Street lamp with a point light. Returns the mesh and its light.
export function createLampPost(
    scene: Scene,
    lib: MaterialLibrary,
    position: Vector3,
    rotationY = 0
): { mesh: Mesh; light: PointLight } {
    const pole = MeshBuilder.CreateCylinder(
        "pole",
        { diameterTop: 0.1, diameterBottom: 0.18, height: 3.6, tessellation: 8 },
        scene
    );
    pole.position.y = 1.8;
    pole.material = lib.blackMetal;
    const arm = MeshBuilder.CreateBox("arm", { width: 0.9, height: 0.07, depth: 0.07 }, scene);
    arm.position.set(0.42, 3.5, 0);
    arm.material = lib.blackMetal;
    const head = MeshBuilder.CreateBox(
        "lampHead",
        { width: 0.4, height: 0.16, depth: 0.28 },
        scene
    );
    head.position.set(0.82, 3.4, 0);
    head.material = lib.warmLight;

    const lamp = merge("lampPost", [pole, arm, head]);
    lamp.position = position;
    lamp.rotation.y = rotationY;

    const light = new PointLight("lampLight", new Vector3(0.82, 3.1, 0), scene);
    light.parent = lamp;
    light.diffuse = Color3.FromHexString("#ffcf8a");
    light.specular = Color3.FromHexString("#332211");
    light.range = 12;
    light.intensity = 0.9;
    return { mesh: lamp, light };
}


// Burnt-out car. Base at y = 0, length along x.
export function createCarWreck(scene: Scene, lib: MaterialLibrary): Mesh {
    const parts: Mesh[] = [];
    const body = MeshBuilder.CreateBox("carBody", { width: 3.8, height: 0.7, depth: 1.7 }, scene);
    body.position.y = 0.65;
    body.material = lib.rust;
    const cabin = MeshBuilder.CreateBox("cabin", { width: 2, height: 0.6, depth: 1.5 }, scene);
    cabin.position.set(-0.25, 1.3, 0);
    cabin.material = lib.rust;
    const glass = MeshBuilder.CreateBox("glass", { width: 2.02, height: 0.4, depth: 1.3 }, scene);
    glass.position.set(-0.25, 1.32, 0);
    glass.material = lib.window;
    parts.push(body, cabin, glass);
    for (const [x, z] of [
        [1.25, 0.82],
        [-1.25, 0.82],
        [1.25, -0.82]
    ]) {
        const wheel = MeshBuilder.CreateCylinder(
            "wheel",
            { diameter: 0.7, height: 0.28, tessellation: 14 },
            scene
        );
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(x, 0.35, z);
        wheel.material = lib.tyre;
        parts.push(wheel);
    }
    const car = merge("carWreck", parts);
    car.rotation.z = 0.04; // sitting on a flat tyre
    car.receiveShadows = true;
    return car;
}


// Curved wall of sandbags.
export function createSandbagWall(scene: Scene, lib: MaterialLibrary, bags = 6): Mesh {
    const parts: Mesh[] = [];
    for (let row = 0; row < 3; row++) {
        const count = bags - row;
        for (let i = 0; i < count; i++) {
            const bag = MeshBuilder.CreateSphere("bag", { diameter: 1, segments: 6 }, scene);
            bag.scaling.set(0.75, 0.28, 0.42);
            bag.position.set((i - (count - 1) / 2) * 0.7, 0.14 + row * 0.25, 0);
            bag.rotation.y = (Math.random() - 0.5) * 0.15;
            parts.push(bag);
        }
    }
    const wall = Mesh.MergeMeshes(parts, true);
    if (!wall) throw new Error("Could not merge sandbags");
    wall.name = "sandbags";
    wall.material = lib.sandbag;
    return wall;
}


// Wooden supply crate (centred on its origin).
export function createCrate(scene: Scene, lib: MaterialLibrary, size = 1, name = "crate"): Mesh {
    const crate = MeshBuilder.CreateBox(name, { size }, scene);
    crate.material = lib.crate;
    crate.receiveShadows = true;
    return crate;
}


// Rusty oil drum (centred on its origin, 1.1 m tall).
export function createBarrel(scene: Scene, lib: MaterialLibrary, name = "barrel"): Mesh {
    const barrel = MeshBuilder.CreateCylinder(
        name,
        { diameter: 0.75, height: 1.1, tessellation: 18 },
        scene
    );
    barrel.material = lib.rust;
    barrel.receiveShadows = true;
    return barrel;
}


// First-aid kit pickup (centred).
export function createMedkit(scene: Scene, lib: MaterialLibrary): Mesh {
    const box = MeshBuilder.CreateBox("medBox", { width: 0.6, height: 0.38, depth: 0.4 }, scene);
    box.material = lib.white;
    const crossA = MeshBuilder.CreateBox(
        "crossA",
        { width: 0.3, height: 0.09, depth: 0.42 },
        scene
    );
    crossA.position.y = 0.02;
    crossA.material = lib.medRed;
    const crossB = MeshBuilder.CreateBox(
        "crossB",
        { width: 0.09, height: 0.3, depth: 0.42 },
        scene
    );
    crossB.position.y = 0.02;
    crossB.material = lib.medRed;
    return merge("medkit", [box, crossA, crossB]);
}


// Ammo can pickup (centred).
export function createAmmoCan(scene: Scene, lib: MaterialLibrary): Mesh {
    const can = MeshBuilder.CreateBox("can", { width: 0.55, height: 0.38, depth: 0.28 }, scene);
    can.material = lib.rust;
    const handle = MeshBuilder.CreateBox(
        "handle",
        { width: 0.3, height: 0.06, depth: 0.08 },
        scene
    );
    handle.position.y = 0.24;
    handle.material = lib.blackMetal;
    const stripe = MeshBuilder.CreateBox(
        "stripe",
        { width: 0.56, height: 0.06, depth: 0.29 },
        scene
    );
    stripe.material = lib.hazard;
    return merge("ammo", [can, handle, stripe]);
}
