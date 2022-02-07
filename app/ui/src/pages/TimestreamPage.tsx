import React, {FunctionComponent, useEffect, useRef, useState} from 'react'
import {RouteComponentProps} from 'react-router-dom'
import PageContent, {Message} from './PageContent'
import {
  Button,
  Card,
  Select,
  Tooltip,
  Row,
  Col,
  Collapse,
  Empty,
  Divider,
} from 'antd'
import {Line, Gauge, GaugeOptions, LineOptions} from '@antv/g2plot'
import CollapsePanel from 'antd/lib/collapse/CollapsePanel'
import {IconRefresh, IconSettings, colorLink, colorPrimary} from '../styles'
import {
  DiagramEntryPoint,
  DataManager,
  ManagedG2Plot,
  ManagedMap,
} from '../util/realtime'
import {
  DataManagerContextProvider,
  ManagedComponentReact,
} from '../util/realtime/react'
import {DeviceInfo} from './DevicesPage'
import {VIRTUAL_DEVICE} from '../App'

/*
 ********************************************
 * This page is adaptation of RealtimePage *
 ********************************************
 */

type TimestreamMeasurement = {
  measure_name: string
  time: string
  measure_value: number
}
const timestreamMeasurementToDiagramEntryPoint = (
  measurement: TimestreamMeasurement
): DiagramEntryPoint => ({
  key: measurement.measure_name,
  time: +new Date(measurement.time),
  value: measurement.measure_value,
})

const fetchDeviceTimestreamMeasurements = async (
  clientId: string,
  agoTimeMS: number
): Promise<DiagramEntryPoint[]> => {
  console.log(
    '/timestream/query?' + new URLSearchParams({clientId, agoTimeMS} as any)
  )

  const res = (await (
    await fetch(
      '/timestream/query?' + new URLSearchParams({clientId, agoTimeMS} as any)
    )
  ).json()) as TimestreamMeasurement[]

  return res.map(timestreamMeasurementToDiagramEntryPoint)
}

// fetchDeviceDataFieldLast replaced by taking data from fetchDeviceMeasurements

// we have replaced giraffe with non-react library to handle faster rerendering

type MeasurementDefinition = {
  min: number
  max: number
  unit: string
  decimalPlaces?: number
}

const measurementsDefinitions: Record<string, MeasurementDefinition> = {
  Temperature: {
    min: -10,
    max: 50,
    unit: '°C',
    decimalPlaces: 1,
  },
  Humidity: {
    min: 0,
    max: 100,
    unit: '%',
  },
  Pressure: {
    min: 800,
    max: 1100,
    unit: 'hPa',
  },
  CO2: {
    min: 300,
    max: 3500,
    unit: 'ppm',
  },
  TVOC: {
    min: 200,
    max: 2200,
    unit: '',
  },
}
const fields = Object.keys(measurementsDefinitions)

/** gauges style based on mesurement definitions */
const gaugesPlotOptions: Record<
  string,
  Omit<GaugeOptions, 'percent'>
> = Object.fromEntries(
  Object.entries(measurementsDefinitions).map(
    ([measurement, {max, min, unit, decimalPlaces}]) => [
      measurement,
      {
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
            formatter: (v) => (+v * (max - min) + min).toFixed(0),
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
            formatter: (x) =>
              x
                ? `${(+x.percent * (max - min) + min).toFixed(
                    decimalPlaces ?? 0
                  )}${unit}`
                : '',
            style: {},
            offsetY: 30,
          },
        },
        height: 150,
        padding: [0, 0, 10, 0],
        // renderer: "svg"
      },
    ]
  )
)

/** line plots style based on mesurement definitions */
const linePlotOptions: Record<
  string,
  Omit<LineOptions, 'data'>
> = Object.fromEntries(
  Object.keys(measurementsDefinitions).map((measurement) => [
    measurement,
    {
      height: 200,
      legend: false,
      lineStyle: {
        color: colorPrimary,
        lineWidth: 4,
      },
    },
  ])
)

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

const timeMsFromTimeOptions = (value: string): number => {
  const s = 1000
  const m = 60 * s
  const h = 60 * m
  const d = 24 * h

  return (
    [
      {timeMs: 5 * m, value: '-5m'},
      {timeMs: 15 * m, value: '-15m'},
      {timeMs: 1 * h, value: '-1h'},
      {timeMs: 6 * h, value: '-6h'},
      {timeMs: 1 * d, value: '-1d'},
      {timeMs: 3 * d, value: '-3d'},
      {timeMs: 7 * d, value: '-7d'},
      {timeMs: 30 * d, value: '-30d'},
    ].find((x) => x.value === value)?.timeMs ?? 5 * m
  )
}

interface PropsRoute {
  deviceId?: string
}

interface Props {
  helpCollapsed: boolean
}

const TimestreamPage: FunctionComponent<
  RouteComponentProps<PropsRoute> & Props
> = ({match, history, helpCollapsed}) => {
  const deviceId = match.params.deviceId ?? VIRTUAL_DEVICE
  // loading is defaultly false because we don't load data when page load.
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<Message | undefined>()
  const [dataStamp, setDataStamp] = useState(0)
  const [devices, setDevices] = useState<DeviceInfo[] | undefined>(undefined)
  const [timeStart, setTimeStart] = useState(timeOptions[0].value)

  const manager = useRef(new DataManager()).current

  // const isVirtualDevice = deviceId === VIRTUAL_DEVICE

  // unlike before, data don't have to be in react state.

  // #region realtime

  /** plot is showed with fixed time range if set */
  const retentionTimeMs = Infinity

  useEffect(() => {
    manager.retentionTimeMs = retentionTimeMs
  }, [retentionTimeMs, manager])

  /** Push data to manager */
  const updateData = useRef((points: DiagramEntryPoint[] | undefined) => {
    if (points?.length) manager.updateData(points)
  }).current

  /** Clear data in manager */
  const clearData = useRef(() => {
    manager.updateData(undefined)
  }).current

  useEffect(clearData, [deviceId, clearData])

  // #endregion realtime

  // fetch device configuration and data
  useEffect(() => {
    // we don't use fetchDeviceLastValues
    //   Gauge plots will handle last walue selection for us

    const fetchData = async () => {
      setLoading(true)
      clearData()
      try {
        const table = await fetchDeviceTimestreamMeasurements(
          deviceId,
          timeMsFromTimeOptions(timeStart)
        )
        console.log(`timestream fetched data len ${table.length}`)
        updateData(table)
      } catch (e) {
        console.error(e)
        setMessage({
          title: 'Cannot load device data',
          description: String(e),
          type: 'error',
        })
      }
      setLoading(false)
    }

    fetchData()
  }, [dataStamp, deviceId, timeStart, updateData, clearData])

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

    fetchDevices()
  }, [])

  /*
    Rendering plots with minilibrary written in util/realtime/
    This time, data isn't pass by state but by calling callback (got by onUpdaterChange) 
    which allows us to update plot more frequently with better performance.
    All plots has to be rendered whole time because we need to have updater function from it. (so we use display 'none' instead of conditional rendering)
  */
  const renderGauge = (column: string) => (
    <ManagedComponentReact
      component={ManagedG2Plot}
      keys={column}
      props={{ctor: Gauge, options: gaugesPlotOptions[column]}}
    />
  )

  // gaugeLastTimeMessage not implemented

  const gauges = (
    <Row gutter={[22, 22]}>
      {fields.map((column, i) => {
        return (
          <Col
            sm={helpCollapsed ? 24 : 24}
            md={helpCollapsed ? 12 : 24}
            xl={helpCollapsed ? 6 : 12}
            key={i}
          >
            <Card title={column}>{renderGauge(column)}</Card>
          </Col>
        )
      })}
    </Row>
  )

  const plotDivider = (
    <Divider style={{color: 'rgba(0, 0, 0, .2)'}} orientation="right"></Divider>
  )

  const geo = (
    <div
      style={{
        height: '500px',
        minWidth: '200px',
      }}
    >
      <ManagedComponentReact
        component={ManagedMap}
        keys={['Lat', 'Lon']}
        props={{}}
      />
    </div>
  )

  const renderPlot = (column: string) => (
    <ManagedComponentReact
      component={ManagedG2Plot}
      keys={column}
      props={{ctor: Line, options: linePlotOptions[column]}}
    />
  )

  const plots = (() => {
    return (
      <>
        <Row gutter={[0, 24]}>
          {fields.map((field, i) => (
            <Col xs={24} key={i}>
              <Collapse defaultActiveKey={[i]}>
                <CollapsePanel key={i} header={field}>
                  {renderPlot(field)}
                </CollapsePanel>
              </Collapse>
            </Col>
          ))}
        </Row>
      </>
    )
  })()

  const pageControls = (
    <>
      <Tooltip title="Choose device" placement="left">
        <Select
          showSearch
          value={deviceId}
          placeholder={'select device to show'}
          showArrow={true}
          filterOption={true}
          // goes to realtime page (instead of dashboard)
          onChange={(key) => history.push(`/timestream/${key}`)}
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

      <Tooltip title={'Choose time'} placement="left">
        <Select
          value={timeStart}
          onChange={setTimeStart}
          style={{minWidth: 100}}
          loading={loading}
          disabled={loading}
        >
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
          disabled={loading}
          loading={loading}
          onClick={() => setDataStamp(dataStamp + 1)}
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

  return (
    <PageContent
      title={<>Timestream Dashboard</>}
      titleExtra={pageControls}
      message={message}
      spin={loading}
      forceShowScroll={true}
    >
      <DataManagerContextProvider value={manager}>
        {true ? (
          <>
            {gauges}
            {plotDivider}
            {geo}
            {plots}
          </>
        ) : (
          <Card>
            <Empty />
          </Card>
        )}
      </DataManagerContextProvider>
    </PageContent>
  )
}

export default TimestreamPage
