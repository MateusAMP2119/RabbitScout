"use client"

// The RabbitMQ rabbit as one blocky orange mesh: breathes and twitches an ear while idle, hops on click,
// and can be told to hop or spin from outside through its ref.
import { useEffect, useImperativeHandle, useRef, type Ref } from "react"
import * as THREE from "three"

type Block = [number, number, number, number, number, number]

// Sizes from the 1000 px RabbitMQ logo, 100 px = 1 unit
const HEAD_W = 6.38
const HEAD_H = 4.05
const DEPTH = 4.6
const CARVE = 0.84
const EYE_SIZE = 1.28
const EYE_Y = HEAD_H / 2 + (659.5 - 723) / 100
const EYE_GAP = 1.1
const EAR_START = (181 - 500) / 100
const EAR_W = 1.36 * 1.8
const EAR_H = 2.7 * 1.8
const EAR_THICK = 1.12
const EAR_LEAN = THREE.MathUtils.degToRad(-15)
const EAR_SPREAD = THREE.MathUtils.degToRad(10)
const JOINT = 0.2
// The camera from the playground page, raised with its target to leave room for a hop
const LIFT = 1.2
const CAMERA = new THREE.Vector3(39.858, 11.723 + LIFT, -29.397)
const TARGET = new THREE.Vector3(0, (HEAD_H + EAR_H) / 2 + 0.4 + LIFT, 0)

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}
const rand = (a: number, b: number) => a + Math.random() * (b - a)

function earWeights(y: number, z: number) {
  // body up to the head top, a short joint, then the ear moves as one rigid block
  const u = y - HEAD_H
  if (u <= 1e-4) return { index: [0, 0, 0, 0], weight: [1, 0, 0, 0] }
  const base = smooth(0, JOINT, u)
  return { index: [0, z > 0 ? 1 : 2, 0, 0], weight: [1 - base, base, 0, 0] }
}

function buildGeometry() {
  // 1. the head and ear blocks, and the two eye holes carved into the front
  const solids: Block[] = [[-HEAD_W / 2, HEAD_W / 2, 0, HEAD_H, -DEPTH / 2, DEPTH / 2]]
  for (const z0 of [DEPTH / 2 - EAR_THICK, -DEPTH / 2]) {
    solids.push([EAR_START, EAR_START + EAR_W, HEAD_H, HEAD_H + EAR_H, z0, z0 + EAR_THICK])
  }
  const holes: Block[] = [1, -1].map((side) => {
    const c = side * (EYE_GAP / 2 + EYE_SIZE / 2)
    return [HEAD_W / 2 - CARVE, HEAD_W / 2 + 1, EYE_Y, EYE_Y + EYE_SIZE, c - EYE_SIZE / 2, c + EYE_SIZE / 2]
  })
  // 2. one grid through every block edge, plus the top of the ear joint
  const breaks: number[][] = [[], [], []]
  for (const b of [...solids, ...holes]) for (let a = 0; a < 3; a++) breaks[a].push(b[2 * a], b[2 * a + 1])
  breaks[1].push(HEAD_H + JOINT)
  const grid = breaks.map((list) => [...new Set(list.map((v) => Math.round(v * 1e5) / 1e5))].sort((p, q) => p - q))
  const [nx, ny, nz] = grid.map((g) => g.length - 1)
  // 3. a cell is filled when its centre is inside a block and outside every eye hole
  const inside = (b: Block, p: number[]) =>
    p[0] > b[0] && p[0] < b[1] && p[1] > b[2] && p[1] < b[3] && p[2] > b[4] && p[2] < b[5]
  const filled = new Uint8Array(nx * ny * nz)
  const at = (i: number, j: number, k: number) =>
    i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz ? 0 : filled[(i * ny + j) * nz + k]
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    const p = [(grid[0][i] + grid[0][i + 1]) / 2, (grid[1][j] + grid[1][j + 1]) / 2, (grid[2][k] + grid[2][k + 1]) / 2]
    filled[(i * ny + j) * nz + k] = solids.some((b) => inside(b, p)) && !holes.some((b) => inside(b, p)) ? 1 : 0
  }
  // 4. emit only the faces between a filled cell and an empty one, so head and ears are one surface
  const pos: number[] = [], skinIndex: number[] = [], skinWeight: number[] = []
  const quad = (corners: number[][]) => {
    for (const c of [0, 1, 2, 0, 2, 3]) {
      const [x, y, z] = corners[c]
      pos.push(x, y, z)
      const w = earWeights(y, z)
      skinIndex.push(...w.index)
      skinWeight.push(...w.weight)
    }
  }
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    if (!at(i, j, k)) continue
    const [x0, x1, y0, y1, z0, z1] = [grid[0][i], grid[0][i + 1], grid[1][j], grid[1][j + 1], grid[2][k], grid[2][k + 1]]
    if (!at(i + 1, j, k)) quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]])
    if (!at(i - 1, j, k)) quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]])
    if (!at(i, j + 1, k)) quad([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]])
    if (!at(i, j - 1, k)) quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]])
    if (!at(i, j, k + 1)) quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]])
    if (!at(i, j, k - 1)) quad([[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]])
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndex, 4))
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeight, 4))
  geometry.computeVertexNormals()
  return geometry
}

function buildRabbit(material: THREE.Material) {
  // 1. one mesh for head and ears together
  const mesh = new THREE.SkinnedMesh(buildGeometry(), material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  // 2. bones: the body scales from the ground; each ear hinges on the head's top outer edge
  const body = new THREE.Bone()
  mesh.add(body)
  const ears = [1, -1].map((side) => {
    const bone = new THREE.Bone()
    bone.position.set(EAR_START + EAR_W / 2, HEAD_H, (side * DEPTH) / 2)
    mesh.add(bone)
    return { bone, side, restX: bone.position.x, restZ: bone.position.z }
  })
  mesh.updateMatrixWorld(true)
  mesh.bind(new THREE.Skeleton([body, ...ears.map((e) => e.bone)]))
  return { mesh, body, ears }
}

const HOP = { crouch: 0.14, air: 0.52, land: 0.4, height: 2.4 }

function hopPose(t: number) {
  // 1. crouch before the jump, ears tipping forward
  if (t < HOP.crouch) {
    const k = Math.sin(((t / HOP.crouch) * Math.PI) / 2)
    return { y: 0, sy: 1 - 0.18 * k, ear: -0.15 * k, air: 0 }
  }
  // 2. in the air: stretched while fast, ears trailing back on the way up and lifting on the way down
  t -= HOP.crouch
  if (t < HOP.air) {
    const k = t / HOP.air
    return { y: HOP.height * 4 * k * (1 - k), sy: 1 + 0.14 * Math.abs(1 - 2 * k), ear: 0.3 * (1 - 2 * k), air: k }
  }
  // 3. landing: squash, wobble and settle, ears flopping forward
  t -= HOP.air
  if (t < HOP.land) {
    const k = t / HOP.land, fade = (1 - k) ** 2
    return { y: 0, sy: 1 - 0.22 * fade * Math.cos(k * Math.PI * 2.5), ear: -0.3 * fade * Math.cos(k * Math.PI * 3), air: 1 }
  }
  return null
}

type Kick = { t0: number; x: number; z: number }

function ring(kicks: Kick[], t: number, key: "x" | "z") {
  // damped wobble summed over every twitch still ringing
  let sum = 0
  for (const k of kicks) {
    const dt = t - k.t0
    if (dt >= 0) sum += k[key] * Math.exp(-6 * dt) * Math.sin(30 * dt)
  }
  return sum
}

export type RabbitMarkHandle = {
  /** One hop, unless one is already under way */
  hop: () => void
  /** Spin jumps one after another until the returned stop is called; stop's promise settles once the last one has landed */
  spin: () => () => Promise<void>
}

export function RabbitMark({ className, ref: handle }: { className?: string; ref?: Ref<RabbitMarkHandle> }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const controls = useRef<RabbitMarkHandle>(null)
  useImperativeHandle(handle, () => ({
    hop: () => controls.current?.hop(),
    spin: () => controls.current?.spin() ?? (() => Promise.resolve()),
  }), [])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    // 1. renderer, scene and the playground camera
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 100)
    camera.position.copy(CAMERA)
    camera.lookAt(TARGET)

    // 2. lights from the front and above, and a ground that only shows the shadow
    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3029, 0.9))
    const key = new THREE.DirectionalLight(0xffffff, 2.6)
    key.position.set(10, 13, 6)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 50 })
    key.shadow.normalBias = 0.02
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xffe2cc, 0.5)
    fill.position.set(-8, 4, -6)
    scene.add(fill)
    const shadowMaterial = new THREE.ShadowMaterial({ opacity: 0.28 })
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), shadowMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    // 3. the rabbit
    const material = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.85, flatShading: true })
    const rabbit = buildRabbit(material)
    scene.add(rabbit.mesh)

    // 4. hops, and the playground's spin jump: a hop with a full turn in the air.
    //    While a spin is wanted, each spin jump lands straight into the next one.
    const idle = !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let jump: { t0: number; spin: boolean } | null = null
    let wantSpin = false, spinId = 0
    const landed: (() => void)[] = []
    let now = 0
    const startHop = () => {
      if (!jump) jump = { t0: now, spin: false }
    }
    const spin = () => {
      if (!idle) return () => Promise.resolve()
      const id = ++spinId
      wantSpin = true
      // a hop already under way finishes first, then the spin jumps start
      if (!jump) jump = { t0: now, spin: true }
      return () => {
        if (id === spinId) wantSpin = false
        return jump?.spin ? new Promise<void>((done) => landed.push(done)) : Promise.resolve()
      }
    }

    // 5. one frame: breathe and twitch an ear while idle, hop or spin jump when asked, pose the bones
    const kicks: Kick[][] = [[], []]
    let nextTwitch = rand(1.5, 4)
    const pose = (t: number) => {
      now = t
      if (idle && t >= nextTwitch) {
        const i = Math.floor(Math.random() * 2)
        kicks[i].push({ t0: t, x: (i === 0 ? 1 : -1) * 0.12, z: -0.25 })
        nextTwitch = t + rand(2, 5)
      }
      let hop = jump && hopPose(t - jump.t0)
      if (jump && !hop) {
        // landed: jump again while a spin is wanted, otherwise settle
        jump = wantSpin ? { t0: t, spin: true } : null
        hop = jump && hopPose(0)
        if (!jump) landed.splice(0).forEach((done) => done())
      }
      const sy = (hop ? hop.sy : 1) * (idle ? 1 + 0.012 * Math.sin((t * Math.PI * 2) / 3.4) : 1)
      const sxz = 1 / Math.sqrt(sy)
      rabbit.mesh.position.y = hop ? hop.y : 0
      rabbit.mesh.rotation.y = hop && jump?.spin ? Math.PI * 2 * smooth(0, 1, hop.air) : 0
      rabbit.body.scale.set(sxz, sy, sxz)
      rabbit.ears.forEach((ear, i) => {
        while (kicks[i].length && t - kicks[i][0].t0 > 1.5) kicks[i].shift()
        ear.bone.position.set(ear.restX * sxz, HEAD_H * sy, ear.restZ * sxz)
        const lean = EAR_LEAN + ring(kicks[i], t, "z") + (hop ? hop.ear : 0)
        ear.bone.rotation.set(ear.side * EAR_SPREAD + ring(kicks[i], t, "x"), 0, lean)
      })
      renderer.render(scene, camera)
    }

    // 6. a click on the rabbit makes it hop
    const raycaster = new THREE.Raycaster()
    const onClick = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      const at = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(at, camera)
      if (raycaster.intersectObject(rabbit.mesh, false).length) startHop()
    }
    canvas.addEventListener("click", onClick)
    controls.current = { hop: startHop, spin }

    // 7. size the drawing to the canvas as laid out, whenever its box changes
    const resize = new ResizeObserver(() => {
      if (!canvas.clientWidth || !canvas.clientHeight) return
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
      camera.aspect = canvas.clientWidth / canvas.clientHeight
      camera.updateProjectionMatrix()
    })
    resize.observe(canvas)

    // 8. draw every frame, so hops and spins show
    renderer.setAnimationLoop((ms) => pose(ms / 1000))

    return () => {
      controls.current = null
      landed.splice(0).forEach((done) => done())
      canvas.removeEventListener("click", onClick)
      resize.disconnect()
      renderer.setAnimationLoop(null)
      rabbit.mesh.geometry.dispose()
      rabbit.mesh.skeleton.dispose()
      ground.geometry.dispose()
      material.dispose()
      shadowMaterial.dispose()
      renderer.dispose()
    }
  }, [])

  return <canvas ref={ref} className={className} role="img" aria-label="RabbitMQ rabbit, click to hop" />
}
