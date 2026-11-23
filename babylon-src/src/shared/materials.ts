import { Color3, Scene, StandardMaterial, Texture } from "@babylonjs/core";
import { TEXTURES } from "./assets";


export interface TextureOptions {
    uScale?: number;
    vScale?: number;
    specular?: number;
    tint?: Color3;
    emissive?: Color3;
    hasAlpha?: boolean;
}


// A StandardMaterial with a diffuse texture.
export function textureMaterial(
    scene: Scene,
    name: string,
    url: string,
    o: TextureOptions = {}
): StandardMaterial {
    const mat = new StandardMaterial(name, scene);
    const tex = new Texture(url, scene);
    tex.uScale = o.uScale ?? 1;
    tex.vScale = o.vScale ?? 1;
    tex.hasAlpha = o.hasAlpha ?? false;
    mat.diffuseTexture = tex;
    if (o.tint) mat.diffuseColor = o.tint;
    if (o.emissive) mat.emissiveColor = o.emissive;
    const s = o.specular ?? 0.04;
    mat.specularColor = new Color3(s, s, s);
    mat.maxSimultaneousLights = 6;
    return mat;
}


// A plain coloured StandardMaterial (hex colours like "#4a5d3a").
export function colorMaterial(
    scene: Scene,
    name: string,
    hex: string,
    emissiveHex?: string,
    specular = 0.05
): StandardMaterial {
    const mat = new StandardMaterial(name, scene);
    mat.diffuseColor = Color3.FromHexString(hex);
    if (emissiveHex) mat.emissiveColor = Color3.FromHexString(emissiveHex);
    mat.specularColor = new Color3(specular, specular, specular);
    mat.maxSimultaneousLights = 6;
    return mat;
}


// Shared materials for a scene. Each one is only created the first time it is used,
// so a scene only loads the textures it needs.
export class MaterialLibrary {
    private cache = new Map<string, StandardMaterial>();

    constructor(private scene: Scene) {}

    private get(key: string, make: () => StandardMaterial): StandardMaterial {
        let mat = this.cache.get(key);
        if (!mat) {
            mat = make();
            this.cache.set(key, mat);
        }
        return mat;
    }

    get concrete() {
        return this.get("concrete", () =>
            textureMaterial(this.scene, "concrete", TEXTURES.concrete, { uScale: 6, vScale: 6 })
        );
    }
    get concreteSmall() {
        return this.get("concreteSmall", () =>
            textureMaterial(this.scene, "concreteSmall", TEXTURES.concrete)
        );
    }
    get crate() {
        return this.get("crate", () => textureMaterial(this.scene, "crate", TEXTURES.crate));
    }
    get rust() {
        return this.get("rust", () =>
            textureMaterial(this.scene, "rust", TEXTURES.rust, { specular: 0.15 })
        );
    }
    get bark() {
        return this.get("bark", () =>
            textureMaterial(this.scene, "bark", TEXTURES.bark, { vScale: 3 })
        );
    }
    get planks() {
        return this.get("planks", () =>
            textureMaterial(this.scene, "planks", TEXTURES.planks, { uScale: 2 })
        );
    }
    get roof() {
        return this.get("roof", () =>
            textureMaterial(this.scene, "roof", TEXTURES.roof, { uScale: 3, vScale: 2 })
        );
    }
    get metal() {
        return this.get("metal", () =>
            textureMaterial(this.scene, "metal", TEXTURES.metal, { specular: 0.3 })
        );
    }
    get hazard() {
        return this.get("hazard", () =>
            textureMaterial(this.scene, "hazard", TEXTURES.hazard, { uScale: 3 })
        );
    }

    get darkWood() {
        return this.get("darkWood", () => colorMaterial(this.scene, "darkWood", "#3b2a1d"));
    }
    get boards() {
        return this.get("boards", () => colorMaterial(this.scene, "boards", "#8a7454"));
    }
    get window() {
        return this.get("window", () => colorMaterial(this.scene, "window", "#0b0d0e", "#05070a"));
    }
    get litWindow() {
        return this.get("litWindow", () =>
            colorMaterial(this.scene, "litWindow", "#2a2010", "#a0702a")
        );
    }
    get sandbag() {
        return this.get("sandbag", () => colorMaterial(this.scene, "sandbag", "#8b7d5c"));
    }
    get stone() {
        return this.get("stone", () =>
            textureMaterial(this.scene, "stone", TEXTURES.concrete, {
                tint: new Color3(0.75, 0.78, 0.74)
            })
        );
    }
    get blackMetal() {
        return this.get("blackMetal", () =>
            colorMaterial(this.scene, "blackMetal", "#1d1f21", undefined, 0.3)
        );
    }
    get tyre() {
        return this.get("tyre", () => colorMaterial(this.scene, "tyre", "#141414"));
    }
    get warmLight() {
        return this.get("warmLight", () =>
            colorMaterial(this.scene, "warmLight", "#ffd9a0", "#ffcf80")
        );
    }
    get redLight() {
        return this.get("redLight", () =>
            colorMaterial(this.scene, "redLight", "#ff2a1a", "#ff2a1a")
        );
    }
    get toxic() {
        return this.get("toxic", () => colorMaterial(this.scene, "toxic", "#5dff6a", "#3cff50"));
    }
    get white() {
        return this.get("white", () => colorMaterial(this.scene, "white", "#e8e8e4"));
    }
    get medRed() {
        return this.get("medRed", () => colorMaterial(this.scene, "medRed", "#c0201a", "#5a0805"));
    }
    get cyanGlow() {
        return this.get("cyanGlow", () =>
            colorMaterial(this.scene, "cyanGlow", "#40e0ff", "#30c8ff")
        );
    }

    // Ground texture tiled to suit the size of the mesh.
    ground(tiles: number) {
        return this.get(`ground${tiles}`, () =>
            textureMaterial(this.scene, `ground${tiles}`, TEXTURES.ground, {
                uScale: tiles,
                vScale: tiles
            })
        );
    }

    // Brick texture tiled for a wall of the given length and height (metres).
    brick(length: number, height: number) {
        const u = Math.max(1, Math.round(length / 3));
        const v = Math.max(1, Math.round(height / 2));
        return this.get(`brick${u}x${v}`, () =>
            textureMaterial(this.scene, `brick${u}x${v}`, TEXTURES.brick, { uScale: u, vScale: v })
        );
    }

    // Metal floor texture tiled for the given size.
    metalFloor(tiles: number) {
        return this.get(`metalFloor${tiles}`, () =>
            textureMaterial(this.scene, `metalFloor${tiles}`, TEXTURES.metal, {
                uScale: tiles,
                vScale: tiles,
                specular: 0.2
            })
        );
    }
}
