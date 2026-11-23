import {
    Color3,
    Color4,
    CubeTexture,
    DirectionalLight,
    GroundMesh,
    HemisphericLight,
    Mesh,
    MeshBuilder,
    ParticleSystem,
    PointLight,
    Scene,
    ShadowGenerator,
    StandardMaterial,
    Texture,
    Vector3
} from "@babylonjs/core";
import { MOON_DIRECTION, SKYBOX, TEXTURES } from "./assets";


// 360-degree night sky: a large cube with the six skybox images on the inside.
export function createSkybox(scene: Scene): Mesh {
    const skybox = MeshBuilder.CreateBox("skyBox", { size: 1000 }, scene);
    const mat = new StandardMaterial("skyBoxMat", scene);
    mat.backFaceCulling = false;
    mat.reflectionTexture = CubeTexture.CreateFromImages(SKYBOX, scene);
    mat.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
    mat.diffuseColor = new Color3(0, 0, 0);
    mat.specularColor = new Color3(0, 0, 0);
    mat.disableLighting = true;
    skybox.material = mat;
    skybox.infiniteDistance = true;
    skybox.applyFog = false;
    skybox.isPickable = false;
    return skybox;
}


// Thick night fog - sets the atmosphere and hides the edges of the world.
export function addFog(scene: Scene, density = 0.02, hex = "#1a1f1b"): void {
    const color = Color3.FromHexString(hex);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = density;
    scene.fogColor = color;
    scene.clearColor = new Color4(color.r, color.g, color.b, 1);
}


export interface NightLighting {
    ambient: HemisphericLight;
    moon: DirectionalLight;
    shadows: ShadowGenerator;
}


// Dim ambient light plus moonlight from the moon's position on the skybox, with soft shadows.
export function createNightLighting(
    scene: Scene,
    moonIntensity = 0.7,
    ambientIntensity = 0.3
): NightLighting {
    const ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
    ambient.intensity = ambientIntensity;
    ambient.diffuse = Color3.FromHexString("#8fa3b8");
    ambient.groundColor = Color3.FromHexString("#1d2119");
    ambient.specular = Color3.Black();

    const towardsMoon = new Vector3(
        MOON_DIRECTION.x,
        Math.max(MOON_DIRECTION.y, 0.75),
        MOON_DIRECTION.z
    ).normalize();
    const moon = new DirectionalLight("moon", towardsMoon.scale(-1), scene);
    moon.position = towardsMoon.scale(60);
    moon.intensity = moonIntensity;
    moon.diffuse = Color3.FromHexString("#c8d8e8");
    moon.specular = Color3.FromHexString("#334455");

    const shadows = new ShadowGenerator(2048, moon);
    shadows.usePercentageCloserFiltering = true;
    shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    shadows.bias = 0.002;
    shadows.normalBias = 0.02;
    shadows.darkness = 0.35;

    return { ambient, moon, shadows };
}


export interface TerrainOptions {
    size?: number;
    subdivisions?: number;
    maxHeight?: number;
    tiles?: number;
    material: StandardMaterial;
}


// Terrain generated from a greyscale height map. Resolves once the heights are ready.
export function createTerrain(scene: Scene, o: TerrainOptions): Promise<GroundMesh> {
    return new Promise(resolve => {
        const ground = MeshBuilder.CreateGroundFromHeightMap(
            "terrain",
            TEXTURES.heightmap,
            {
                width: o.size ?? 140,
                height: o.size ?? 140,
                subdivisions: o.subdivisions ?? 120,
                minHeight: 0,
                maxHeight: o.maxHeight ?? 14,
                onReady: mesh => {
                    mesh.material = o.material;
                    mesh.receiveShadows = true;
                    mesh.isPickable = false;
                    resolve(mesh);
                }
            },
            scene
        );
        ground.material = o.material;
    });
}


// Flickering light, e.g. a failing street lamp or fire.
export function addFlicker(
    scene: Scene,
    light: PointLight,
    base: number,
    amount = 0.35,
    speed = 1
): void {
    let t = Math.random() * 100;
    let cut = 0;
    scene.onBeforeRenderObservable.add(() => {
        t += (scene.getEngine().getDeltaTime() / 1000) * speed;
        if (cut > 0) {
            cut -= scene.getEngine().getDeltaTime() / 1000;
            light.intensity = base * 0.1;
            return;
        }
        if (Math.random() < 0.004 * speed) cut = 0.05 + Math.random() * 0.15; // occasional drop-out
        light.intensity =
            base * (1 - amount / 2 + amount * (0.5 + 0.5 * Math.sin(t * 13) * Math.sin(t * 7.3)));
    });
}


// Fire particle effect with a flickering orange light.
export function createFire(
    scene: Scene,
    position: Vector3,
    scale = 1
): { particles: ParticleSystem; light: PointLight } {
    const flare = new Texture(TEXTURES.flare, scene);

    const fire = new ParticleSystem("fire", 500, scene);
    fire.particleTexture = flare;
    fire.emitter = position.clone();
    fire.minEmitBox = new Vector3(-0.35, 0, -0.35).scale(scale);
    fire.maxEmitBox = new Vector3(0.35, 0.1, 0.35).scale(scale);
    fire.color1 = new Color4(1, 0.55, 0.1, 1);
    fire.color2 = new Color4(1, 0.25, 0.05, 1);
    fire.colorDead = new Color4(0.2, 0, 0, 0);
    fire.minSize = 0.25 * scale;
    fire.maxSize = 0.8 * scale;
    fire.minLifeTime = 0.25;
    fire.maxLifeTime = 0.8;
    fire.emitRate = 260;
    fire.blendMode = ParticleSystem.BLENDMODE_ONEONE;
    fire.gravity = new Vector3(0, 3, 0);
    fire.direction1 = new Vector3(-0.3, 1, -0.3);
    fire.direction2 = new Vector3(0.3, 1.5, 0.3);
    fire.minEmitPower = 0.4;
    fire.maxEmitPower = 1.2;
    fire.updateSpeed = 0.016;
    fire.start();

    const smoke = new ParticleSystem("smoke", 200, scene);
    smoke.particleTexture = flare;
    smoke.emitter = position.add(new Vector3(0, 0.8 * scale, 0));
    smoke.minEmitBox = new Vector3(-0.3, 0, -0.3).scale(scale);
    smoke.maxEmitBox = new Vector3(0.3, 0, 0.3).scale(scale);
    smoke.color1 = new Color4(0.12, 0.12, 0.12, 0.4);
    smoke.color2 = new Color4(0.08, 0.08, 0.08, 0.3);
    smoke.colorDead = new Color4(0, 0, 0, 0);
    smoke.minSize = 0.8 * scale;
    smoke.maxSize = 2 * scale;
    smoke.minLifeTime = 1.5;
    smoke.maxLifeTime = 3;
    smoke.emitRate = 40;
    smoke.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    smoke.gravity = new Vector3(0.3, 1.2, 0);
    smoke.direction1 = new Vector3(-0.2, 1, -0.2);
    smoke.direction2 = new Vector3(0.2, 1, 0.2);
    smoke.minEmitPower = 0.3;
    smoke.maxEmitPower = 0.6;
    smoke.start();

    const light = new PointLight("fireLight", position.add(new Vector3(0, 1 * scale, 0)), scene);
    light.diffuse = Color3.FromHexString("#ff8a2a");
    light.specular = Color3.FromHexString("#552200");
    light.range = 14 * scale;
    addFlicker(scene, light, 1.4, 0.5, 1.5);

    return { particles: fire, light };
}
