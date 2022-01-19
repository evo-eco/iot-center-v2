
export type DashboardCellLayout = {
  /** position from left 0-11 */
  x: number
  /** position from top */
  y: number
  /** width - x coord */
  w: number
  /** height - y coord */
  h: number
}

export type DashboardCellType = 'svg' | 'plot' | 'geo'

export type DashboardCellSvg = {
  type: 'svg'
  layout: DashboardCellLayout
  field: string | string[]
  file: string
}

// TODO: add to schema
export type DashboardCellGeoOpts = {
  zoom?: number
  dragable?: boolean
}

export type DashboardCellGeo = {
  type: 'geo'
  layout: DashboardCellLayout
  latField: string
  lonField: string
  Live: DashboardCellGeoOpts
  Past: DashboardCellGeoOpts
}

export type DashboardCellPlotType = 'gauge' | 'line'

export type DashboardCellPlotGauge = {
  type: 'plot'
  layout: DashboardCellLayout
  plotType: 'gauge'
  field: string
  label: string
  range: {
    min: number
    max: number
  }
  unit: string
  decimalPlaces: number
}

export type DashboardCellPlotLine = {
  layout: DashboardCellLayout
  type: 'plot'
  plotType: 'line'
  field: string | string[]
  label: string
}

export type DashboardCellPlot = DashboardCellPlotGauge | DashboardCellPlotLine

export type DashboardCell = DashboardCellSvg | DashboardCellPlot | DashboardCellGeo

// TODO: height/width and other props of react grid
export type DashboardLayoutDefiniton = { cells: DashboardCell[] }


export const CELL_TYPES: readonly DashboardCellType[] = ['plot', 'geo', 'svg']
export const PLOT_TYPES: readonly DashboardCellPlotType[] = ['line', 'gauge']

export const isDashboarCellSvg = (c: DashboardCell): c is DashboardCellSvg => {
  return c.type === 'svg'
}
