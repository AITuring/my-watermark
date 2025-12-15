import React, { useRef, useState, Suspense, useMemo } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { Points, PointMaterial, Preload, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { TextureLoader } from 'three'

function Galaxy() {
  const ref = useRef<THREE.Points>(null!)
  const count = 5000

  const [positions, colors] = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const color = new THREE.Color()

    for (let i = 0; i < count; i++) {
      const r = 200 + Math.random() * 300
      const theta = Math.random() * 2 * Math.PI
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      // Galaxy colors: Blue, Purple, Pink
      const choice = Math.random()
      if (choice > 0.66) {
          color.set("#1a237e") // Deep Blue
      } else if (choice > 0.33) {
          color.set("#4a148c") // Purple
      } else {
          color.set("#880e4f") // Pink/Magenta
      }

      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    return [positions, colors]
  }, [])

  useFrame((state, delta) => {
    ref.current.rotation.y += delta / 500
  })

  return (
    <group>
      <Points ref={ref} positions={positions} colors={colors} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          vertexColors
          size={3}
          sizeAttenuation={true}
          depthWrite={false}
          opacity={0.4}
          blending={THREE.AdditiveBlending}
        />
      </Points>
    </group>
  )
}

function Stars(props: any) {
  const ref = useRef<THREE.Points>(null!)
  const [sphere] = useState(() => {
    const positions = new Float32Array(7000 * 3)
    for (let i = 0; i < 7000; i++) {
      const r = 40 + 30 * Math.cbrt(Math.random())
      const theta = Math.random() * 2 * Math.PI
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
    }
    return positions
  })

  useFrame((state, delta) => {
    ref.current.rotation.x -= delta / 50
    ref.current.rotation.y -= delta / 60
  })

  return (
    <group rotation={[0, 0, Math.PI / 4]}>
      <Points ref={ref} positions={sphere} stride={3} frustumCulled={false} {...props}>
        <PointMaterial
          transparent
          color="#fff"
          size={0.15}
          sizeAttenuation={true}
          depthWrite={false}
          opacity={0.8}
        />
      </Points>
    </group>
  )
}

function Sun() {
  const sunTexture = useLoader(TextureLoader, '/sun.jpg') as THREE.Texture

  return (
    <group>
      {/* Core Sun */}
      <mesh>
        <sphereGeometry args={[2.5, 64, 64]} />
        <meshStandardMaterial
            map={sunTexture}
            emissiveMap={sunTexture}
            emissive="#FFD700"
            emissiveIntensity={2}
            color="#FDB813"
        />
        <pointLight distance={100} intensity={4} color="#FFD700" decay={1} />
      </mesh>
    </group>
  )
}

function OrbitPath({ distance }: { distance: number }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[distance - 0.03, distance + 0.03, 128]} />
      <meshBasicMaterial color="#ffffff" opacity={0.3} transparent side={THREE.DoubleSide} />
    </mesh>
  )
}

function Planet({ distance, size, color, speed, offset, hasRing, textureUrl, ringConfig }: any) {
  const ref = useRef<THREE.Mesh>(null!)
  const texture = useLoader(TextureLoader, textureUrl || '/moon.jpg') as THREE.Texture

  const { innerScale = 1.4, outerScale = 2.2, rotation = [Math.PI / 2.2, 0, 0] } = ringConfig || {}

  useFrame((state) => {
    const t = state.clock.getElapsedTime() * speed + offset
    ref.current.position.x = Math.cos(t) * distance
    ref.current.position.z = Math.sin(t) * distance
    ref.current.rotation.y += 0.02
  })

  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[size, 64, 64]} />
        <meshStandardMaterial
          map={texture}
          color={color}
          roughness={0.3}
          metalness={0.6}
          emissive={color}
          emissiveIntensity={0.1}
        />
        {hasRing && (
          <mesh rotation={rotation}>
            <ringGeometry args={[size * innerScale, size * outerScale, 64]} />
            <meshStandardMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.8} emissive={color} emissiveIntensity={0.1} />
          </mesh>
        )}
      </mesh>
    </group>
  )
}

function SolarSystem() {
  const planets = [
    { name: 'Mercury', distance: 2.5, size: 0.1, color: '#A5A5A5', speed: 0.8, offset: 0, textureUrl: '/moon.jpg' },
    { name: 'Venus', distance: 3.5, size: 0.2, color: '#E3BB76', speed: 0.6, offset: 2, textureUrl: '/moon.jpg' },
    { name: 'Earth', distance: 5.0, size: 0.22, color: '#ffffff', speed: 0.4, offset: 4, textureUrl: '/earth.jpg' },
    { name: 'Mars', distance: 6.5, size: 0.15, color: '#DD4C39', speed: 0.3, offset: 1, textureUrl: '/moon.jpg' },
    { name: 'Jupiter', distance: 9.0, size: 0.6, color: '#D9A066', speed: 0.15, offset: 3, textureUrl: '/moon.jpg' },
    { name: 'Saturn', distance: 12.0, size: 0.5, color: '#F4D03F', speed: 0.1, offset: 5, hasRing: true, textureUrl: '/moon.jpg', ringConfig: { innerScale: 1.4, outerScale: 2.2, rotation: [Math.PI / 2.2, 0, 0] } },
    { name: 'Uranus', distance: 14.5, size: 0.4, color: '#4FD0E7', speed: 0.08, offset: 6, hasRing: true, textureUrl: '/moon.jpg', ringConfig: { innerScale: 1.4, outerScale: 1.6, rotation: [0, 0, 0] } },
    { name: 'Neptune', distance: 16.5, size: 0.38, color: '#4b70dd', speed: 0.06, offset: 7, textureUrl: '/moon.jpg' },
  ]

  return (
    <group position={[10, -8, 0]} rotation={[0.2, 0, 0]}>
      <Sun />
      {planets.map((planet, i) => (
        <React.Fragment key={i}>
          <Planet {...planet} />
          <OrbitPath distance={planet.distance} />
        </React.Fragment>
      ))}
    </group>
  )
}

interface ThreeLandingProps {
    getRootProps: any;
    getInputProps: any;
}

export default function ThreeLanding({ getRootProps, getInputProps }: ThreeLandingProps) {
  return (
    <div className="fixed inset-0 bg-slate-950 overflow-hidden z-10">
      <div className="absolute inset-0 z-0 bg-black">
        {/* @ts-ignore */}
        <Canvas camera={{ position: [0, 12, 20], fov: 40 }}>
            <ambientLight intensity={1.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <Suspense fallback={null}>
                <Galaxy />
                <Stars />
                <SolarSystem />
                <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 2} minPolarAngle={Math.PI / 4} autoRotate autoRotateSpeed={0.5} />
                <Preload all />
            </Suspense>
        </Canvas>
      </div>

      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
         <div className="pointer-events-auto">
             <div
                {...getRootProps()}
                className="group relative flex flex-col items-center justify-center p-12 transition-all duration-300 hover:scale-105 cursor-pointer"
             >
                <input {...getInputProps()} />
                <div className="absolute inset-0 bg-black/40 rounded-full blur-xl group-hover:bg-black/60 transition-all duration-500" />

                <div className="relative bg-white/[0.02] backdrop-blur-[2px] border border-white/10 px-8 py-5 rounded-2xl shadow-lg overflow-hidden group-hover:border-white/20 transition-all duration-500">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10 flex flex-col items-center gap-2">
                        <div className="p-2 rounded-full bg-white/5 text-blue-200 group-hover:text-white group-hover:bg-blue-500/20 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" x2="12" y1="3" y2="15" />
                            </svg>
                        </div>
                        <div className="text-sm font-medium text-white/80 tracking-wide">
                            选择图片
                        </div>
                    </div>
                </div>
             </div>
         </div>
      </div>
    </div>
  )
}
