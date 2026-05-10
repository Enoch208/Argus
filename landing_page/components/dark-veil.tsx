"use client";

import { useEffect, useRef } from "react";

/**
 * Mouse-reactive CPPN mesh-gradient backdrop. Ported from the f.html reference
 * with two additions:
 *   - `uMouse` uniform fed by a pointermove listener — the gradient warps
 *     toward the cursor on the parent element.
 *   - reduced-motion users get a static frame (no rAF loop).
 *
 * Isolated as the page's only client component so the rest of the page is
 * server-rendered.
 */
const VERTEX = /* glsl */ `
  attribute vec2 position;
  void main(){gl_Position=vec4(position,0.0,1.0);}
`;

const FRAGMENT = /* glsl */ `
  #ifdef GL_ES
  precision lowp float;
  #endif
  uniform vec2 uResolution;
  uniform vec2 uMouse;
  uniform float uTime; uniform float uHueShift; uniform float uNoise;
  uniform float uScan; uniform float uScanFreq; uniform float uWarp;
  uniform float uMouseStrength;
  vec4 buf[8]; float rand(vec2 c){return fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453);}
  mat3 rgb2yiq=mat3(0.299,0.587,0.114,0.596,-0.274,-0.322,0.211,-0.523,0.312);
  mat3 yiq2rgb=mat3(1.0,0.956,0.621,1.0,-0.272,-0.647,1.0,-1.106,1.703);
  vec3 hueShiftRGB(vec3 col,float deg){vec3 yiq=rgb2yiq*col;float rad=radians(deg);float cosh=cos(rad),sinh=sin(rad);vec3 yiqShift=vec3(yiq.x,yiq.y*cosh-yiq.z*sinh,yiq.y*sinh+yiq.z*cosh);return clamp(yiq2rgb*yiqShift,0.0,1.0);}
  vec4 sigmoid(vec4 x){return 1./(1.+exp(-x));}
  vec4 cppn(vec2 c,float i0,float i1,float i2){
      buf[6]=vec4(c.x,c.y,0.39+i0,0.36+i1); buf[7]=vec4(0.14+i2,length(c),0.,0.);
      buf[0]=sigmoid(mat4(6.5,-3.6,0.7,-1.1,2.4,3.1,1.2,0.06,-5.4,-6.1,1.8,-4.7,6.0,-5.5,-0.9,3.2)*buf[6]+mat4(0.8,-5.7,3.9,1.6,-0.2,0.5,-1.7,-5.3,0.,0.,0.,0.,0.,0.,0.,0.)*buf[7]+vec4(0.2,1.1,-1.7,5.0));
      buf[1]=sigmoid(mat4(-3.3,-6.0,0.5,-4.4,0.8,1.7,5.6,1.6,2.4,-3.5,1.7,6.3,3.3,8.2,1.1,-1.1)*buf[6]+mat4(5.2,-13.0,0.0,15.8,2.9,3.1,-0.8,-1.6,0.,0.,0.,0.,0.,0.,0.,0.)*buf[7]+vec4(-5.9,-6.5,-0.8,1.5));
      buf[2]=sigmoid(mat4(-15.2,8.0,-2.4,-1.9,-5.9,4.3,2.6,1.2,-7.3,6.7,5.2,5.9,5.0,8.9,-1.7,-1.1)*buf[6]+mat4(-11.9,-11.6,6.1,11.2,2.1,-6.2,-1.7,-0.7,0.,0.,0.,0.,0.,0.,0.,0.)*buf[7]+vec4(-4.1,-3.2,-4.5,-3.6));
      buf[3]=sigmoid(mat4(3.1,-13.7,1.8,3.2,0.6,12.7,1.9,0.5,-0.0,4.4,1.4,1.8,5.0,13.0,3.3,-4.5)*buf[6]+mat4(-0.1,7.7,-3.1,4.7,0.6,3.7,-0.8,-0.3,0.,0.,0.,0.,0.,0.,0.,0.)*buf[7]+vec4(-1.1,-21.6,0.7,1.2));
      buf[0]=sigmoid(mat4(1.6,1.3,2.9,0.,-1.8,-1.4,-3.5,0.,-1.3,-1.0,-2.3,0.,0.2,0.2,0.4,0.)*buf[0]+mat4(-0.6,-0.5,-0.9,0.,0.1,0.1,0.1,0.,-2.9,-2.5,-4.9,0.,1.4,1.1,2.5,0.)*buf[1]+mat4(-1.2,-1.0,-2.1,0.,-0.7,-0.5,-1.4,0.,0.1,0.1,0.2,0.,0.9,0.8,1.2,0.)*buf[2]+mat4(-2.4,-1.9,-4.3,0.,-22.6,-18.0,-41.9,0.,0.6,0.5,1.1,0.,-1.5,-1.3,-2.6,0.)*buf[3]+vec4(-1.5,-3.6,0.2,0.));
      return vec4(buf[0].xyz,1.);
  }
  void main(){
      vec2 uv=(gl_FragCoord.xy/uResolution.xy)*2.-1.; uv.y*=-1.;
      // Mouse pull. uMouse is in -1..1 (already mapped on the JS side).
      vec2 toMouse = uv - uMouse;
      float d = length(toMouse);
      vec2 pull = -toMouse * exp(-d*1.4) * uMouseStrength;
      uv += pull;
      uv += uWarp*vec2(sin(uv.y*6.2+uTime*0.5),cos(uv.x*6.2+uTime*0.5))*0.05;
      vec4 col=cppn(uv,0.3*sin(0.8*uTime),0.3*sin(1.2*uTime),0.3*sin(0.9*uTime));
      col.rgb=hueShiftRGB(col.rgb,uHueShift);
      col.rgb*=2.5;
      col.rgb*=1.-(sin(gl_FragCoord.y*uScanFreq)*0.5+0.5)*uScan;
      col.rgb+=(rand(gl_FragCoord.xy+uTime)-0.5)*uNoise;
      gl_FragColor=vec4(clamp(col.rgb,0.,1.),1.);
  }
`;

export function DarkVeil({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let disposed = false;
    let visible = true;
    let lastFrame = 0;
    let cleanup: (() => void) | null = null;

    // Mouse target lives in -1..1; we lerp toward it each frame for momentum.
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let strength = 0;

    (async () => {
      const { Renderer, Program, Mesh, Triangle, Vec2 } = await import("ogl");
      if (disposed) return;

      const renderer = new Renderer({
        dpr: Math.min(window.devicePixelRatio, 1.25),
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: "low-power",
      });
      const gl = renderer.gl;
      const geometry = new Triangle(gl);

      const program = new Program(gl, {
        vertex: VERTEX,
        fragment: FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: new Vec2() },
          uMouse: { value: new Vec2(0, 0) },
          uMouseStrength: { value: 0 },
          uHueShift: { value: 220 }, // cool/violet for Argus
          uNoise: { value: 0.04 },
          uScan: { value: 0 },
          uScanFreq: { value: 0 },
          uWarp: { value: 1.6 },
        },
      });
      const mesh = new Mesh(gl, { geometry, program });

      let lastW = 0;
      let lastH = 0;
      const resize = () => {
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        if (w === lastW && h === lastH) return;
        lastW = w;
        lastH = h;
        renderer.setSize(w, h);
        program.uniforms.uResolution.value.set(w, h);
      };
      resize();

      const ro = new ResizeObserver(resize);
      ro.observe(parent);

      const onMove = (e: PointerEvent) => {
        const r = parent.getBoundingClientRect();
        target.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        target.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
        strength = 0.85;
      };
      const onLeave = () => {
        strength = 0;
      };
      parent.addEventListener("pointermove", onMove, { passive: true });
      parent.addEventListener("pointerleave", onLeave);

      const io = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
          if (visible && !raf && !reduced) raf = requestAnimationFrame(loop);
        },
        { threshold: 0.05 },
      );
      io.observe(parent);

      const start = performance.now();
      const loop = (now = performance.now()) => {
        if (disposed) return;
        if (!visible) {
          raf = 0;
          return;
        }
        if (!reduced && now - lastFrame < 32) {
          raf = requestAnimationFrame(loop);
          return;
        }
        lastFrame = now;
        const t = (now - start) / 1000;
        // Ease toward the target so the warp feels weighted, not jittery.
        current.x += (target.x - current.x) * 0.08;
        current.y += (target.y - current.y) * 0.08;
        // Strength relaxes back to a small idle value when no pointer.
        const idle = 0.18;
        const effective =
          program.uniforms.uMouseStrength.value +
          ((strength || idle) - program.uniforms.uMouseStrength.value) * 0.05;

        program.uniforms.uTime.value = t * 2.5;
        program.uniforms.uMouse.value.set(current.x, current.y);
        program.uniforms.uMouseStrength.value = effective;

        renderer.render({ scene: mesh });
        raf = reduced ? 0 : requestAnimationFrame(loop);
      };
      loop();

      cleanup = () => {
        parent.removeEventListener("pointermove", onMove);
        parent.removeEventListener("pointerleave", onLeave);
        io.disconnect();
        ro.disconnect();
        cancelAnimationFrame(raf);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      };
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanup?.();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`w-full h-full mix-blend-screen pointer-events-none [transform:translateZ(0)] ${className}`}
    />
  );
}
