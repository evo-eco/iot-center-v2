import React, {
  FunctionComponent,
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react'
import {RouteComponentProps} from 'react-router-dom'
import {Button, Select, Tooltip} from 'antd'
import PageContent, {Message} from './PageContent'
import {IconRefresh, IconSettings, colorLink, colorPrimary} from '../styles'
import ReactGridLayoutFixed from '../util/ReactGridLayoutFixed'

import {
  flux,
  fluxDuration,
  fluxExpression,
  InfluxDB,
} from '@influxdata/influxdb-client'
import {GaugeOptions, LineOptions, Datum} from '@antv/g2plot'
import {Table as GiraffeTable} from '@influxdata/giraffe'
import {VIRTUAL_DEVICE} from '../App'
import {DeviceInfo} from './DevicesPage'
import {
  DataManagerDataChangedCallback,
  DiagramEntryPoint,
} from '../util/realtime'
import {queryTable} from '../util/queryTable'
import {
  asArray,
  DataManager,
  ManagedG2Plot,
  ManagedMap,
  ManagedSvg,
  MinAndMax,
} from '../util/realtime'
import {DataManagerContextProvider, useWebSocket} from '../util/realtime/react'
import {PlusOutlined, SettingOutlined} from '@ant-design/icons'
import {ManagedComponentReact} from '../util/realtime/react/ManagedComponentReact'
import {
  DashboardCellPlotGauge,
  DashboardCellPlotLine,
  DashboardCellPlot,
  DashboardCellLayout,
  DashboardLayoutDefiniton,
  DashboardCell,
  isDashboarCellSvg,
} from '../util/dynamic/types'
import {
  deleteDashboard,
  fetchDashboard,
  fetchDashboardKeys,
  uploadDashboard,
  useFields,
  useLoading,
  useRefresh,
  useSvgStrings,
} from '../util/dynamic'
import {
  CreateNewDashboardPage,
  DASHBOARD_SELECT_CREATE_NEW_OPTION,
  DynamicDashboardTitle,
  CellEdit,
} from '../util/dynamic/components'

// TODO: escalations instead of console.error
// TODO: file upload JSON definition of dashboardu with JSON schema for validation
// TODO: svg upload with escape for script for secure usage
// TODO: time component shows current server time
// TODO: optional fields - defaults filling functions
// TODO: add comments to json schema

/*
 ********************************************
 * This page is adaptation of DashboardPage *
 ********************************************
 */

interface DeviceConfig {
  influx_url: string
  influx_org: string
  influx_token: string
  influx_bucket: string
  id: string
}

const fetchDeviceConfig = async (deviceId: string): Promise<DeviceConfig> => {
  const response = await fetch(
    `/api/env/${deviceId}?register=${deviceId === VIRTUAL_DEVICE}`
  )
  if (response.status >= 300) {
    const text = await response.text()
    throw new Error(`${response.status} ${text}`)
  }
  const deviceConfig: DeviceConfig = await response.json()
  if (!deviceConfig.influx_token) {
    throw new Error(`Device '${deviceId}' is not authorized!`)
  }
  return deviceConfig
}

const fetchDeviceFields = async (
  config: DeviceConfig,
  timeStart = '-30d'
): Promise<string[]> => {
  const {
    // influx_url: url, // use '/influx' proxy to avoid problem with InfluxDB v2 Beta (Docker)
    influx_token: token,
    influx_org: org,
    influx_bucket: bucket,
    id,
  } = config
  const queryApi = new InfluxDB({url: '/influx', token}).getQueryApi(org)
  const result = await queryTable(
    queryApi,
    flux`
    import "influxdata/influxdb/schema"
    schema.fieldKeys(
      bucket: ${bucket},
      predicate: (r) => r["_measurement"] == "environment" and r["clientId"] == ${id},
      start: ${fluxDuration(timeStart)}
    )
    `
  )
  return result?.getColumn('_value', 'string') ?? []
}

const fetchDeviceMeasurements = async (
  config: DeviceConfig,
  timeStart = '-30d',
  fields: string[]
): Promise<GiraffeTable> => {
  const {
    // influx_url: url, // use '/influx' proxy to avoid problem with InfluxDB v2 Beta (Docker)
    influx_token: token,
    influx_org: org,
    influx_bucket: bucket,
    id,
  } = config
  const queryApi = new InfluxDB({url: '/influx', token}).getQueryApi(org)
  const fieldsExpression = fields
    .map((field) => `r["_field"] == "${field}"`)
    .join(' or ')
  const result = await queryTable(
    queryApi,
    flux`
  from(bucket: ${bucket})
    |> range(start: ${fluxDuration(timeStart)})
    |> filter(fn: (r) => r._measurement == "environment")
    |> filter(fn: (r) => r.clientId == ${id})
    |> filter(fn: (r) => ${fluxExpression(fieldsExpression)})`
  )
  return result
}

// fetchDeviceDataFieldLast replaced by taking data from fetchDeviceMeasurements

// we have replaced giraffe with non-react library to handle faster rerendering

/** gauges style based on mesurement definitions */
const gaugesPlotOptionsFor = ({
  decimalPlaces,
  range: {max, min},
  unit,
  layout: {h},
}: DashboardCellPlotGauge): Omit<GaugeOptions, 'percent'> & MinAndMax => ({
  min,
  max,
  range: {
    ticks: [0, 1],
    color: `l(0) 0:${colorPrimary} 1:${colorLink}`,
    width: 15,
  },
  indicator: {
    pointer: {
      style: {stroke: 'gray'},
    },
    pin: {
      style: {stroke: 'gray'},
    },
  },
  axis: {
    position: 'bottom',
    label: {
      formatter: (v: string) => (+v * (max - min) + min).toFixed(0),
      offset: -30,
      style: {
        fontSize: 12,
        fontWeight: 900,
        fontFamily: 'Rubik',
        fill: '#55575E',
        shadowColor: 'white',
      },
    },
    tickLine: {
      // length: 10,
      style: {
        lineWidth: 3,
      },
    },
    subTickLine: {
      count: 9,
      // length: 10,
      style: {
        lineWidth: 1,
      },
    },
  },
  statistic: {
    content: {
      formatter: (x: Datum | undefined) =>
        x
          ? `${(+x.percent * (max - min) + min).toFixed(
              decimalPlaces ?? 0
            )}${unit}`
          : '',
      style: {},
      offsetY: 30,
    },
  },
  height: 80 * h - 28,
  padding: [0, 0, 10, 0],
  renderer: 'svg',
})

/** line plots style based on mesurement definitions */
const linePlotOptionsFor = ({
  layout: {h},
}: DashboardCellPlotLine): Omit<LineOptions, 'data'> => ({
  height: 80 * h - 28,
  legend: false,
  lineStyle: {
    color: colorPrimary,
    lineWidth: 4,
  },
})

const plotOptionsFor = (
  opts: DashboardCellPlot & {layout: DashboardCellLayout}
) => {
  if (opts.plotType === 'gauge') return gaugesPlotOptionsFor(opts)
  if (opts.plotType === 'line') return linePlotOptionsFor(opts)
  throw `Invalid plot cell type! ${JSON.stringify((opts as any)?.plotType)}`
}

// #region Realtime

/** Data returned from websocket in line-protocol-like shape */
type RealtimePoint = {
  measurement: string
  tagPairs: string[]
  fields: Record<string, number | boolean | string>
  timestamp: string
}
type RealtimeSubscription = {
  /** influxdb measurement value */
  measurement: string
  /** tag format 'tagName=tagValue'. Point is sent to client when matches all tags. */
  tags: string[]
}

const host =
  process.env.NODE_ENV === `development`
    ? window.location.hostname + ':5000'
    : window.location.host
const wsAddress = `ws://${host}/mqtt`

/** length of unix time with milliseconds precision */
const MILLIS_TIME_LENGTH = 13
/** Transform timestamps to millis for point. (Points can have different precission) */
const pointTimeToMillis = (p: RealtimePoint): RealtimePoint => ({
  ...p,
  timestamp: p.timestamp
    .substr(0, MILLIS_TIME_LENGTH)
    .padEnd(MILLIS_TIME_LENGTH, '0'),
})

/**
 * subscribes for data to servers broker.js via websocket
 * when any subscription present
 */
const useRealtimeData = (
  subscriptions: RealtimeSubscription[],
  onReceivePoints: (pts: RealtimePoint[]) => void
) => {
  const wsInit = useCallback<(ws: WebSocket) => void>(
    (ws) => {
      ws.onopen = () => ws.send('subscribe:' + JSON.stringify(subscriptions))
      ws.onmessage = (response) =>
        onReceivePoints(
          (JSON.parse(response.data) as RealtimePoint[]).map(pointTimeToMillis)
        )
    },
    [subscriptions, onReceivePoints]
  )
  useWebSocket(wsInit, wsAddress, !!subscriptions.length)
}

// transformations for both InfluxDB and Realtime sources so we can use them same way independently of the source

/** transformation for realtime data returned by websocket */
const realtimePointToDiagrameEntryPoint = (points: RealtimePoint[]) => {
  const newData: DiagramEntryPoint[] = []

  for (const p of points) {
    const fields = p.fields
    const time = Math.floor(+p.timestamp)

    for (const key in fields) {
      const value = fields[key] as number
      newData.push({key, time, value})
    }
  }

  return newData
}

/** transformation for field based giraffe table */
const giraffeTableToDiagramEntryPoints = (
  table: GiraffeTable | undefined
): DiagramEntryPoint[] => {
  if (!table) return []
  const length = table.length
  const timeCol =
    table.getColumn('_time', 'number') ||
    table.getColumn('_start', 'number') ||
    table.getColumn('_stop', 'number')
  const fieldCol = table.getColumn('_field', 'string')
  const valueCol = table.getColumn('_value', 'number')
  if (!timeCol || !fieldCol || !valueCol) return []

  const data: DiagramEntryPoint[] = Array(length)

  for (let i = length; i--; ) {
    data[i] = {key: fieldCol[i], time: timeCol[i], value: valueCol[i]}
  }

  let newLength = data.length
  for (let i = data.length; i--; ) {
    if (data[i].value == null || data[i].time == null) {
      newLength--
      data[i] = data[newLength]
    }
  }
  data.length = newLength

  data.sort((a, b) => a.time - b.time)

  return data
}

// #endregion Realtime

/**
 * definitions for time select. (Live options)
 * realtime options contains retention to be used in plots
 */
const timeOptionsRealtime: {
  label: string
  value: string
  realtimeRetention: number
}[] = [
  {label: 'Live 10s', value: '-10s', realtimeRetention: 10_000},
  {label: 'Live 30s', value: '-30s', realtimeRetention: 30_000},
  {label: 'Live 1m', value: '-1m', realtimeRetention: 60_000},
]

/**
 * definitions for time select. (Past options)
 */
const timeOptions: {label: string; value: string}[] = [
  {label: 'Past 5m', value: '-5m'},
  {label: 'Past 15m', value: '-15m'},
  {label: 'Past 1h', value: '-1h'},
  {label: 'Past 6h', value: '-6h'},
  {label: 'Past 1d', value: '-1d'},
  {label: 'Past 3d', value: '-3d'},
  {label: 'Past 7d', value: '-7d'},
  {label: 'Past 30d', value: '-30d'},
]

const getIsRealtime = (timeStart: string) =>
  timeOptionsRealtime.some((x) => x.value === timeStart)

interface PropsRoute {
  deviceId?: string
  dashboard?: string
}

interface Props {
  helpCollapsed: boolean
  mqttEnabled: boolean | undefined
}

/** Selects source based on timeStart, normalize and feed data into DataManager */
const useSource = (
  deviceId: string,
  timeStart: string,
  fields: string[],
  dataStamp: number
) => {
  const [state, setState] = useState({
    loading: false,
    manager: new DataManager(),
    availableFields: [] as string[],
  })

  const addAvailableFields = (fields: string[]) => {
    setState((s) =>
      fields.some((x) => !s.availableFields.some((y) => x === y))
        ? {
            ...s,
            availableFields: s.availableFields
              .concat(
                fields.filter((x) => !s.availableFields.some((y) => x === y))
              )
              .sort(),
          }
        : s
    )
  }

  useEffect(() => {
    const manager = state.manager
    const updateAvailableFields: DataManagerDataChangedCallback = (e) => {
      addAvailableFields(e.changedKeys)
    }
    manager.addOnChange(updateAvailableFields)

    return () => manager.removeOnChange(updateAvailableFields)
  }, [state.manager])

  const isRealtime = getIsRealtime(timeStart)

  // #region realtime

  const [subscriptions, setSubscriptions] = useState<RealtimeSubscription[]>([])
  // updaters are functions that updates plots outside of react state

  /** plot is showed with fixed time range if set */
  const retentionTimeMs = isRealtime
    ? timeOptionsRealtime[
        timeOptionsRealtime.findIndex((x) => x.value === timeStart)
      ].realtimeRetention
    : Infinity

  useEffect(() => {
    state.manager.retentionTimeMs = retentionTimeMs
  }, [retentionTimeMs, state.manager])

  useEffect(() => {
    setSubscriptions(
      isRealtime
        ? [{measurement: 'environment', tags: [`clientId=${deviceId}`]}]
        : []
    )
  }, [deviceId, isRealtime])

  const updateData = useCallback(
    (points: DiagramEntryPoint[] | undefined) => {
      if (points?.length) state.manager.updateData(points)
    },
    [state.manager]
  )

  /** Clear data and resets received data fields state */
  const clearData = useRef(() => {
    state.manager.updateData(undefined)
  }).current

  useRealtimeData(
    subscriptions,
    useRef((points: RealtimePoint[]) => {
      updateData(realtimePointToDiagrameEntryPoint(points))
    }).current
  )

  useEffect(() => {
    if (isRealtime) clearData()
  }, [isRealtime, clearData])
  useEffect(clearData, [deviceId, clearData])

  // #endregion realtime

  // fetch device configuration and data
  useEffect(() => {
    const fetchData = async () => {
      clearData()
      setState((s) => (!s.loading ? {...s, loading: true} : s))
      try {
        const config = await fetchDeviceConfig(deviceId)
        const table = await fetchDeviceMeasurements(config, timeStart, fields)
        const dataPoints = giraffeTableToDiagramEntryPoints(table)
        updateData(dataPoints)
        const availableFields = await fetchDeviceFields(config, timeStart)
        addAvailableFields(availableFields)
      } catch (e) {
        console.error(e)
      } finally {
        setState((s) => (s.loading ? {...s, loading: false} : s))
      }
    }

    // fetch data only if not in realtime mode
    if (!isRealtime) fetchData()
    else
      setState((s) =>
        s.availableFields.length ? {...s, availableFields: []} : s
      )
  }, [
    deviceId,
    timeStart,
    isRealtime,
    dataStamp,
    fields,
    clearData,
    updateData,
  ])

  return state
}

export const DashboardCellComponent: FunctionComponent<{
  cell: DashboardCell
  svgStrings: Record<string, string>
}> = ({cell, svgStrings}) => {
  return (
    <div style={{height: '100%', width: '100%', backgroundColor: 'white'}}>
      <div
        style={{
          height: 28,
          paddingLeft: 10,
          paddingTop: 5,
          // borderBottomColor:"gray", borderBottomWidth:"1px", borderBottomStyle:"solid"
        }}
      >
        {'label' in cell ? cell.label : ''}
      </div>
      <div
        style={{
          height: 'calc(100% - 28px)',
          width: '100%',
          padding: '0px 20px 20px 20px',
        }}
      >
        {cell.type === 'plot' ? (
          <ManagedComponentReact
            component={ManagedG2Plot}
            keys={asArray(cell.field)}
            props={{ctor: cell.plotType, options: plotOptionsFor(cell)}}
          />
        ) : undefined}
        {cell.type === 'geo' ? (
          <ManagedComponentReact
            component={ManagedMap}
            keys={[cell.latField, cell.lonField]}
            props={{}}
          />
        ) : undefined}
        {cell.type === 'svg' ? (
          <ManagedComponentReact
            component={ManagedSvg}
            keys={asArray(cell.field)}
            // TODO: add renderer option into definition file
            props={{svgString: svgStrings[cell.file], renderer: 'svg'}}
          />
        ) : undefined}
      </div>
    </div>
  )
}

type DashboardLayoutProps = {
  layoutDefinition: DashboardLayoutDefiniton
  svgStrings?: Record<string, string>
  onLayoutChanged?: (l: DashboardLayoutDefiniton) => void
  onCellEdit?: (i: number) => void
  isEditing: boolean
}

/**
 * render dashboard cells for layout, data passed by context
 */
const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  layoutDefinition,
  svgStrings = {},
  onLayoutChanged = () => undefined,
  onCellEdit = () => undefined,
  isEditing,
}) => {
  const {cells} = layoutDefinition

  return (
    <ReactGridLayoutFixed
      cols={12}
      rowHeight={80}
      onLayoutChange={(e) => {
        const layoutCopy = {...layoutDefinition}
        let changed = false
        layoutCopy.cells = cells.map((cell, i) => ({
          ...cell,
          layout: (() => {
            const {x, y, w, h} = e[i]
            const newLayout = {x, y, w, h}
            if (
              cell.layout.x !== x ||
              cell.layout.y !== y ||
              cell.layout.w !== w ||
              cell.layout.h !== h
            ) {
              changed = true
            }

            return newLayout
          })(),
        }))
        // TODO: remove this after comparator done
        if (changed) onLayoutChanged(layoutCopy)
        else onLayoutChanged(layoutDefinition)
      }}
      isDraggable={isEditing}
      isResizable={isEditing}
    >
      {cells.map((cell, i) => (
        <div
          key={JSON.stringify({cell, i})}
          data-grid={cell.layout}
          style={{position: 'relative'}}
        >
          {isEditing ? (
            <Button
              size="small"
              icon={<SettingOutlined />}
              style={{position: 'absolute', right: 10, top: 10}}
              onClick={() => {
                onCellEdit(i)
              }}
            />
          ) : undefined}
          <DashboardCellComponent {...{cell, svgStrings}} />
        </div>
      ))}

      <div
        key={cells.length}
        data-grid={{
          x: 0,
          y: 10000,
          w: 24,
          h: 3,
          isDraggable: false,
          isResizable: false,
        }}
        style={{position: 'relative'}}
      >
        <Button
          icon={<PlusOutlined />}
          type="dashed"
          style={{width: '100%', height: '100%', borderWidth: '3px'}}
          onClick={() => {
            onCellEdit(cells.length)
          }}
        ></Button>
      </div>
    </ReactGridLayoutFixed>
  )
}

const DynamicDashboardPage: FunctionComponent<
  RouteComponentProps<PropsRoute> & Props
> = ({match, history, mqttEnabled}) => {
  const deviceId = match.params.deviceId ?? VIRTUAL_DEVICE
  const layoutKey = match.params.dashboard ?? DASHBOARD_SELECT_CREATE_NEW_OPTION

  const {loading, callWithLoading} = useLoading()
  const [isEditing, setIsEditing] = useState(false)
  useEffect(() => {
    setIsEditing(false)
  }, [layoutKey])
  const [message, setMessage] = useState<Message | undefined>()
  const {refreshToken: dataRefreshToken, refresh: refreshData} = useRefresh()
  const [devices, setDevices] = useState<DeviceInfo[] | undefined>(undefined)
  const [timeStart, setTimeStart] = useState(timeOptionsRealtime[0].value)

  // Layout selection
  const {
    refreshToken: layoutKeyRefreshToken,
    refresh: refreshKeys,
  } = useRefresh()
  const [layoutKeys, setLayoutKeys] = useState<string[]>([])
  // const [layoutKey, setLayoutKey] = useState<string>()
  const [laoutDefinitions, setLayoutDefinitions] = useState<
    Record<string, DashboardLayoutDefiniton>
  >({})

  const layoutDefinitionOriginal = laoutDefinitions[layoutKey || '']
  const setLayoutDefinitionOriginal = useCallback((
    key: string,
    value: DashboardLayoutDefiniton
  ) => setLayoutDefinitions((c) => ({...c, [key]: value})), [])

  const [layoutDefinition, setLayoutDefinition] = useState<DashboardLayoutDefiniton>(
    layoutDefinitionOriginal
  )
  useEffect(() => {
    setLayoutDefinition(layoutDefinitionOriginal)
  }, [layoutDefinitionOriginal])

  // select first layout if none selected
  useEffect(() => {
    if (layoutKeys) {
      if (match.params.dashboard === undefined && layoutKeys[0] !== undefined) {
        history.replace(`/dynamic/${deviceId}/${layoutKeys[0]}`)
      } else if (
        !layoutKeys.some((x) => x === layoutKey) ||
        layoutKey !== DASHBOARD_SELECT_CREATE_NEW_OPTION
      ) {
        history.replace(`/dynamic/${deviceId}/${layoutKeys[0]}`)
      }
    }
  }, [match.params.dashboard, layoutKeys])

  useEffect(() => {
    const fetchLaoutKeys = async () => {
      const keys = await fetchDashboardKeys()
      setLayoutKeys(keys)
      // setLayoutKey(keys[0])
    }

    callWithLoading(fetchLaoutKeys)
  }, [callWithLoading, layoutKeyRefreshToken])

  useEffect(() => {
    const fetchLaoutConfig = async () => {
      if (
        !layoutKey ||
        layoutKey === DASHBOARD_SELECT_CREATE_NEW_OPTION ||
        layoutDefinition
      )
        return
      const config = await fetchDashboard(layoutKey)
      setLayoutDefinitionOriginal(layoutKey, config);
    }

    callWithLoading(fetchLaoutConfig)
  }, [layoutKey, layoutDefinition, callWithLoading])

  const isRealtime = getIsRealtime(timeStart)

  const fields = useFields(layoutDefinition)

  const svgKeys =
    layoutDefinition?.cells.filter(isDashboarCellSvg).map((x) => x.file) || []

  const svgStrings = useSvgStrings(svgKeys)

  const {loading: loadingSource, manager, availableFields} = useSource(
    deviceId,
    timeStart,
    fields,
    dataRefreshToken
  )

  // Default time selected to Past when mqtt not configured
  useEffect(() => {
    if (mqttEnabled === false) {
      setTimeStart(timeOptions[0].value)
    }
  }, [mqttEnabled])

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await fetch('/api/devices')
        if (response.status >= 300) {
          const text = await response.text()
          throw new Error(`${response.status} ${text}`)
        }
        const data = await response.json()
        setDevices(data)
      } catch (e) {
        setMessage({
          title: 'Cannot fetch data',
          description: String(e),
          type: 'error',
        })
      }
    }

    callWithLoading(fetchDevices)
  }, [callWithLoading])

  const save = useCallback(() => {
    ;(async () => {
      await uploadDashboard(layoutKey, layoutDefinition)
      setLayoutDefinitionOriginal(layoutKey, layoutDefinition);
      setIsEditing(false)
    })()
  }, [layoutDefinition, layoutDefinitionOriginal, layoutKey])

  const [editedCellIndex, setEditedCellIndex] = useState<number | undefined>()

  const onDeleteDashboard = useCallback(() => {
    const del = async () => {
      await deleteDashboard(layoutKey)
      refreshKeys()
    }

    del()
  }, [layoutKey])

  const pageControls = (
    <>
      <Tooltip title={'Choose dashboard'} placement="left">
        <Select
          value={layoutKey}
          onChange={(key) => history.push(`/dynamic/${deviceId}/${key}`)}
          style={{minWidth: 100}}
          loading={loadingSource || mqttEnabled === undefined}
          disabled={loadingSource}
        >
          {layoutKeys.map((key) => (
            <Select.Option key={key} value={key}>
              {key}
            </Select.Option>
          ))}
          <Select.Option
            key={DASHBOARD_SELECT_CREATE_NEW_OPTION}
            value={DASHBOARD_SELECT_CREATE_NEW_OPTION}
            style={{background: '#00d019', color: 'black'}}
          >
            {DASHBOARD_SELECT_CREATE_NEW_OPTION}
          </Select.Option>
        </Select>
      </Tooltip>

      <Tooltip title="Choose device" placement="left">
        <Select
          showSearch
          value={deviceId}
          placeholder={'select device to show'}
          showArrow={true}
          filterOption={true}
          // goes to dynamic page (instead of dashboard)
          onChange={(key) => history.push(`/dynamic/${key}`)}
          style={{minWidth: 200, width: 350, marginRight: 10}}
          loading={!devices}
          disabled={!devices}
        >
          {devices &&
            devices.map(({deviceId}) => (
              <Select.Option key={deviceId} value={deviceId}>
                {deviceId}
              </Select.Option>
            ))}
        </Select>
      </Tooltip>

      <Tooltip
        title={
          (mqttEnabled === false ? 'MQTT not configured on server! ' : '') +
          'Choose time'
        }
        placement="left"
      >
        <Select
          value={timeStart}
          onChange={setTimeStart}
          style={{minWidth: 100}}
          loading={loadingSource || mqttEnabled === undefined}
          disabled={loadingSource}
        >
          {timeOptionsRealtime.map(({label, value}) => (
            <Select.Option
              disabled={mqttEnabled === false}
              key={value}
              value={value}
            >
              {label}
            </Select.Option>
          ))}
          {timeOptions.map(({label, value}) => (
            <Select.Option key={value} value={value}>
              {label}
            </Select.Option>
          ))}
        </Select>
      </Tooltip>

      <Tooltip title="Reload Device Data">
        <Button
          // disable refresh when in realtime mode
          disabled={loadingSource || isRealtime}
          loading={loadingSource}
          onClick={refreshData}
          style={{marginLeft: 10}}
          icon={<IconRefresh />}
        />
      </Tooltip>

      <Tooltip title="Go to device settings" placement="topRight">
        <Button
          type="primary"
          icon={<IconSettings />}
          style={{marginLeft: 10}}
          href={`/devices/${deviceId}`}
        ></Button>
      </Tooltip>
    </>
  )

  const onEditCancel = useCallback(() => {
    setLayoutDefinition(layoutDefinitionOriginal)
    setIsEditing(false)
  }, [])

  const unusedFields =
    layoutKey === DASHBOARD_SELECT_CREATE_NEW_OPTION
      ? ''
      : availableFields.filter((x) => !fields.some((y) => y === x)).join(', ')

  const onEditLayoutKey = useCallback(() => {
    refreshKeys()
  }, [])

  return (
    <PageContent
      title={
        <DynamicDashboardTitle
          dashboardKey={layoutKey ?? ''}
          {...{isEditing, setIsEditing}}
          onEditAccept={save}
          onEditCancel={onEditCancel}
          onDeleteDashboard={onDeleteDashboard}
        />
      }
      titleExtra={pageControls}
      message={message}
      spin={loading || loadingSource}
      forceShowScroll={true}
    >
      <div
        style={{
          position: 'absolute',
          zIndex: 2,
          right: 0,
          top: -12,
          color: 'gray',
        }}
      >
        {unusedFields?.length ? `unused fields: ${unusedFields}` : ''}
      </div>
      <DataManagerContextProvider value={manager}>
        <CellEdit
          {...{layoutDefinition, editedCellIndex, availableFields}}
          onDone={(l) => {
            setLayoutDefinition(l)
            setEditedCellIndex(undefined)
          }}
          onCancel={() => {
            setEditedCellIndex(undefined)
          }}
        />
        {layoutDefinition ? (
          <DashboardLayout
            {...{layoutDefinition, svgStrings}}
            onLayoutChanged={setLayoutDefinition}
            onCellEdit={setEditedCellIndex}
            isEditing={isEditing}
          />
        ) : undefined}
      </DataManagerContextProvider>

      {layoutKey === DASHBOARD_SELECT_CREATE_NEW_OPTION ? (
        <CreateNewDashboardPage onEdit={onEditLayoutKey} />
      ) : undefined}
    </PageContent>
  )
}

export default DynamicDashboardPage
