import {DashboardLayoutDefiniton} from '.'
import {asArray} from '../realtime'

/**
 * returns fields for given layout
 */
export const getLayoutDefinitonFields = (
  layout: DashboardLayoutDefiniton | undefined
): string[] => {
  if (!layout) return []
  const fields = new Set<string>()

  layout.cells.forEach((cell) => {
    if (cell.type === 'plot') {
      asArray(cell.field).forEach((f) => fields.add(f))
    } else if (cell.type === 'geo') {
      fields.add(cell.latField)
      fields.add(cell.lonField)
    } else if (cell.type === 'svg') {
      asArray(cell.field).forEach((f) => fields.add(f))
    }
  })

  return Array.from(fields).sort()
}
