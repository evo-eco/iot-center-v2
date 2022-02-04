const AWS = require('aws-sdk')
const https = require('https')

const AWS_CLIENT_REGION = 'us-east-2'

const agent = new https.Agent({
  maxSockets: 5000,
})

const writeClient = new AWS.TimestreamWrite({
  maxRetries: 10,
  region: AWS_CLIENT_REGION,
  httpOptions: {
    timeout: 20000,
    agent,
  },
})

const constants = {
  DATABASE_NAME: 'iot_center_v2',
  TABLE_NAME: 'Table1',
}

/** length of unix time with milliseconds precision */
const MILLIS_TIME_LENGTH = 13

/**
 * Transform timestamps to millis for point. (Points can have different precission)
 *
 * @param {string} timestamp
 */
const pointTimeToMillis = (timestamp) =>
  timestamp.substring(0, MILLIS_TIME_LENGTH).padEnd(MILLIS_TIME_LENGTH, '0')

/**
 * @param {string} tagPair
 */
const parseTagPair = (tagPair) => {
  const splitted = tagPair.split('=')
  const Name = splitted[0]
  const Value = splitted.slice(1).join('=')
  return {Name, Value}
}

/**
 * @param {Point} point
 */
const pointToAWSRecords = (point) =>
  Object.entries(point.fields).map(([name, value]) => ({
    Dimensions: point.tagPairs
      .map(parseTagPair)
      .concat({Name: 'measurement', Value: point.measurement}),
    MeasureName: name,
    MeasureValue: `${value}`,
    MeasureValueType: 'DOUBLE',
    Time: pointTimeToMillis(point.timestamp),
  }))

/**
 * @param {Point[]} points
 */
async function writePointsTimeStream(points) {
  // process.stdout.write(
  //   `Writing ${points.length
  //     .toString(10)
  //     .padStart(6)} points to AWS Timestream\n`
  // )

  const params = {
    DatabaseName: constants.DATABASE_NAME,
    TableName: constants.TABLE_NAME,
    Records: points.flatMap(pointToAWSRecords),
  }

  const request = writeClient.writeRecords(params)

  await request.promise()
  // .then((x) => {
  //   process.stdout.write(`Write done!\n`)
  //   return x
  // })
}

module.exports = writePointsTimeStream
