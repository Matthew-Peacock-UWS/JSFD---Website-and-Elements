// All asset URLs in one place. Importing them lets Vite copy them into the build
// with the correct relative paths.

import ground from "../assets/textures/ground.jpg";
import concrete from "../assets/textures/concrete.jpg";
import crate from "../assets/textures/crate.jpg";
import rust from "../assets/textures/rust.jpg";
import brick from "../assets/textures/brick.jpg";
import metal from "../assets/textures/metal.jpg";
import bark from "../assets/textures/bark.jpg";
import planks from "../assets/textures/planks.jpg";
import roof from "../assets/textures/roof.jpg";
import hazard from "../assets/textures/hazard.png";
import flare from "../assets/textures/flare.png";
import splat from "../assets/textures/splat.png";
import heightmap from "../assets/textures/heightmap.png";


import skyPx from "../assets/skybox/sky_px.jpg";
import skyPy from "../assets/skybox/sky_py.jpg";
import skyPz from "../assets/skybox/sky_pz.jpg";
import skyNx from "../assets/skybox/sky_nx.jpg";
import skyNy from "../assets/skybox/sky_ny.jpg";
import skyNz from "../assets/skybox/sky_nz.jpg";


import wind from "../assets/audio/wind.mp3";
import music from "../assets/audio/music.mp3";
import pickup from "../assets/audio/pickup.mp3";
import hit from "../assets/audio/hit.mp3";
import groan from "../assets/audio/groan.mp3";
import door from "../assets/audio/door.mp3";
import click from "../assets/audio/click.mp3";


export const TEXTURES = {
    ground,
    concrete,
    crate,
    rust,
    brick,
    metal,
    bark,
    planks,
    roof,
    hazard,
    flare,
    splat,
    heightmap
};


// Skybox faces in the order CubeTexture.CreateFromImages expects: +x, +y, +z, -x, -y, -z
export const SKYBOX = [skyPx, skyPy, skyPz, skyNx, skyNy, skyNz];

export const AUDIO = { wind, music, pickup, hit, groan, door, click };


// Animated character from the official Babylon.js asset library (Idle / Walking / WalkingBack / Samba).
export const PLAYER_MODEL = {
    rootUrl: "https://assets.babylonjs.com/meshes/",
    file: "HVGirl.glb"
};


// Direction of the moon painted on the skybox - the moonlight shines from here.
export const MOON_DIRECTION = { x: 0.35, y: 0.42, z: 0.84 };
