"use client";

import React, { useEffect, useRef } from "react";

export default function DotMatrixBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Try WebGL rendering, fallback to 2D Canvas
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });
    
    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      if (gl) gl.viewport(0, 0, width, height);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("resize", handleResize);

    if (gl) {
      const VS = `
        attribute vec2 a_pos;
        void main() {
          gl_Position = vec4(a_pos, 0.0, 1.0);
        }
      `;

      const FS = `
        precision highp float;
        uniform vec2 u_res;
        uniform float u_time;
        uniform vec2 u_mouse;

        void main() {
          vec2 st = gl_FragCoord.xy / u_res.xy;
          st.x *= u_res.x / u_res.y;

          // Grid dot calculation
          float spacing = 28.0;
          vec2 gridPos = mod(gl_FragCoord.xy + u_mouse * 12.0, spacing) - vec2(spacing * 0.5);
          float dist = length(gridPos);

          // Breathing pulse
          float pulse = 0.5 + 0.5 * sin(u_time * 1.5 + st.x * 2.0 + st.y * 2.0);
          
          float radius = 1.2 + pulse * 0.6;
          float alpha = smoothstep(radius, radius - 0.8, dist) * (0.15 + pulse * 0.12);

          // Vignette fade towards edges
          vec2 centerDist = gl_FragCoord.xy / u_res.xy - vec2(0.5);
          float vignette = 1.0 - smoothstep(0.2, 0.75, length(centerDist));

          // Fulcrum Amber tone: RGB (251, 191, 36) -> (0.98, 0.75, 0.14)
          vec3 dotColor = mix(vec3(0.98, 0.75, 0.14), vec3(0.96, 0.62, 0.07), st.y);
          
          gl_FragColor = vec4(dotColor, alpha * vignette);
        }
      `;

      const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
        const shader = gl.createShader(type);
        if (!shader) return null;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
      };

      const vertShader = createShader(gl, gl.VERTEX_SHADER, VS);
      const fragShader = createShader(gl, gl.FRAGMENT_SHADER, FS);

      if (vertShader && fragShader) {
        const program = gl.createProgram();
        if (program) {
          gl.attachShader(program, vertShader);
          gl.attachShader(program, fragShader);
          gl.linkProgram(program);
          gl.useProgram(program);

          const positionBuffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
            gl.STATIC_DRAW
          );

          const posLocation = gl.getAttribLocation(program, "a_pos");
          gl.enableVertexAttribArray(posLocation);
          gl.vertexAttribPointer(posLocation, 2, gl.FLOAT, false, 0, 0);

          const resUniform = gl.getUniformLocation(program, "u_res");
          const timeUniform = gl.getUniformLocation(program, "u_time");
          const mouseUniform = gl.getUniformLocation(program, "u_mouse");

          gl.viewport(0, 0, width, height);

          let startTime = performance.now();

          const render = () => {
            mouseX += (targetMouseX - mouseX) * 0.05;
            mouseY += (targetMouseY - mouseY) * 0.05;

            const elapsed = (performance.now() - startTime) / 1000;
            gl.uniform2f(resUniform, width, height);
            gl.uniform1f(timeUniform, elapsed);
            gl.uniform2f(mouseUniform, mouseX, mouseY);

            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.drawArrays(gl.TRIANGLES, 0, 6);
            animationFrameId = requestAnimationFrame(render);
          };

          render();
        }
      }
    } else {
      // 2D Canvas Fallback
      const ctx = canvas.getContext("2d");
      if (ctx) {
        let time = 0;
        const render2D = () => {
          time += 0.02;
          mouseX += (targetMouseX - mouseX) * 0.05;
          mouseY += (targetMouseY - mouseY) * 0.05;

          ctx.clearRect(0, 0, width, height);
          const spacing = 30;
          ctx.fillStyle = "rgba(251, 191, 36, 0.18)";

          for (let x = spacing / 2; x < width; x += spacing) {
            for (let y = spacing / 2; y < height; y += spacing) {
              const dx = x - (width / 2 + mouseX * 20);
              const dy = y - (height / 2 + mouseY * 20);
              const dist = Math.sqrt(dx * dx + dy * dy);
              const pulse = Math.sin(time + dist * 0.01) * 0.5 + 0.5;

              ctx.beginPath();
              ctx.arc(x, y, 1 + pulse * 0.8, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          animationFrameId = requestAnimationFrame(render2D);
        };
        render2D();
      }
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 0,
        opacity: 0.85,
      }}
    />
  );
}
