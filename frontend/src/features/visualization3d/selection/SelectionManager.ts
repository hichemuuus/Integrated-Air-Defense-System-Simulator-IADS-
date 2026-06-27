/* SelectionManager
 * Responsibility: Track which entity is selected in the 3D view.
 * Data flow:
 *   Click handlers read instanceId from InstancedMesh events,
 *   look up entity ID via slot mapping, and store in _selectedId.
 *   EntityManager reads _selectedId in useFrame to position the
 *   outline indicator and label anchor.
 * Performance: All state is ref-based — no React re-renders.
 *   Slot mapping is written once per frame in EntityManager.
 *   Click events are user-triggered and rare.
 */

const _selectedId = { current: -1 }

const _slotToEntityId = new Map<string, number>()

export function getSelectedId(): number {
  return _selectedId.current
}

export function setSelected(id: number): void {
  _selectedId.current = id
}

export function clearSelection(): void {
  _selectedId.current = -1
}

export function isSelected(id: number): boolean {
  return _selectedId.current === id
}

export function registerSlotMapping(category: number, slot: number, entityId: number): void {
  _slotToEntityId.set(`${category}:${slot}`, entityId)
}

export function clearSlotMappings(): void {
  _slotToEntityId.clear()
}

export function entityIdFromSlot(category: number, slot: number): number | undefined {
  return _slotToEntityId.get(`${category}:${slot}`)
}
