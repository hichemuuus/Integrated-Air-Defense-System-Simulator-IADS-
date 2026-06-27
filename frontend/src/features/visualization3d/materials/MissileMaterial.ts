import { MeshPhongMaterial } from 'three'

const material = new MeshPhongMaterial({
  color: 0xfbbf24,
  emissive: 0x78350f,
  emissiveIntensity: 0.4,
  shininess: 20,
})

export default material
