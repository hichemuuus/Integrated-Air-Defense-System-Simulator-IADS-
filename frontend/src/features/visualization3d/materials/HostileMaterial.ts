import { MeshPhongMaterial } from 'three'

const material = new MeshPhongMaterial({
  color: 0xef4444,
  emissive: 0x7f1d1d,
  emissiveIntensity: 0.3,
  shininess: 30,
})

export default material
