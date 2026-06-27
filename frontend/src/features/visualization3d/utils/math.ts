import { Euler, Quaternion, Matrix4, Vector3, MathUtils } from 'three'

export const _euler = new Euler()
export const _quat = new Quaternion()
export const _mat4 = new Matrix4()
export const _vec3 = new Vector3()

export function headingToQuaternion(headingDeg: number, target: Quaternion): void {
  const rad = MathUtils.degToRad(headingDeg)
  _euler.set(0, -rad, 0)
  target.setFromEuler(_euler)
}

export function identityQuaternion(target: Quaternion): void {
  target.set(0, 0, 0, 1)
}
