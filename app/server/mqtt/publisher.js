const {MQTT_URL, MQTT_TOPIC} = require('../env')
const createClient = require('./createClient')
const {Point} = require('@influxdata/influxdb-client')
const {generateValue} = require('./util/generateValue')
const {parentPort} = require('worker_threads')

let sendDataHandle = -1
const GPX_SPEED_MODIFIER = 100

const measurements = [
  {name: 'Temperature', period: 30, min: 0, max: 40},
  {name: 'Humidity', period: 90, min: 0, max: 99},
  {name: 'Pressure', period: 20, min: 970, max: 1050},
  {name: 'CO2', period: 1, min: 400, max: 3000},
  {name: 'TVOC', period: 1, min: 250, max: 2000},
]

let gpxData
require('fs').readFile('./apis/gpxData.json', (_err, data) => {
  gpxData = JSON.parse(data.toString('utf-8'))
})

const MONTH_MILLIS = 30 * 24 * 60 * 60 * 1000

const generateGPXData = (data, time) => {
  const len = data.length
  const index =
    Math.floor(
      ((time % MONTH_MILLIS) / MONTH_MILLIS) * GPX_SPEED_MODIFIER * len
    ) % len
  const entry = data[index]

  return entry
}

parentPort.on('message', async (data) => {
  if (!(MQTT_URL && MQTT_TOPIC))
    throw new Error('MQTT_URL and MQTT_TOPIC not specified')

  clearInterval(sendDataHandle)

  if (!data.running) {
    sendDataHandle = -1
    return
  }

  const client = await createClient()
  console.log('Publishing to', MQTT_TOPIC, 'at', MQTT_URL)
  const sendData = async () => {
    const point = new Point('environment')
    const now = Date.now()
    measurements.forEach(({name, max, min, period}) => {
      point.floatField(name, generateValue(period, min, max, now))
    })
    if (gpxData) {
      const [lat, lon] = generateGPXData(gpxData, Date.now())
      point.floatField('Lat', lat)
      point.floatField('Lon', lon)
    }
    point
      .tag('TemperatureSensor', 'virtual_TemperatureSensor')
      .tag('HumiditySensor', 'virtual_HumiditySensor')
      .tag('PressureSensor', 'virtual_PressureSensor')
      .tag('CO2Sensor', 'virtual_CO2Sensor')
      .tag('TVOCSensor', 'virtual_TVOCSensor')
      .tag('GPSSensor', 'virtual_GPSSensor')
      .tag('clientId', 'virtual_device')
    point.timestamp(now * 10 ** 6)
    const influxLineProtocolData = point.toLineProtocol()
    try {
      await client.publish(MQTT_TOPIC, influxLineProtocolData)
    } catch (e) {
      console.error('Unable to publish data: ', e)
    }
  }

  await sendData()
  sendDataHandle = setInterval(sendData, data.sendInterval)
})
