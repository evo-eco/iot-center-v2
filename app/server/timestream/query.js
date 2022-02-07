// @ts-check
const AWS = require('aws-sdk')
const https = require('https')

// TODO: check if credentials set
// setup credentials by https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html

/**
 * @typedef { "VARCHAR"
 *  | "BOOLEAN" | "BIGINT" | "DOUBLE" | "TIMESTAMP" | "DATE" | "TIME" | "INTERVAL_DAY_TO_SECOND" | "INTERVAL_YEAR_TO_MONTH" | "UNKNOWN" | "INTEGER"
 * } ScalarType
 */

/**
 * @typedef {object} Type Contains the data type of a column in a query result set. The data type can be scalar or complex. The supported scalar data types are integers, Boolean, string, double, timestamp, date, time, and intervals. The supported complex data types are arrays, rows, and timeseries.
 * @property {ColumnInfo} [ArrayColumnInfo] Indicates if the column is an array.
 * @property {ColumnInfo[]} [RowColumnInfo] Indicates if the column is a row.
 * @property {ScalarType} [ScalarType] Indicates if the column is of type string, integer, Boolean, double, timestamp, date, time.
 * @property {ColumnInfo} [TimeSeriesMeasureValueColumnInfo] Indicates if the column is a timeseries data type.
 */

/**
 * @typedef {object} ColumnInfo Contains the metadata for query results such as the column names, data types, and other attributes.
 * @property {string} Name The name of the result set column. The name of the result set is available for columns of all data types except for arrays.
 * @property {Type} Type The data type of the result set column. The data type can be a scalar or complex. Scalar data types are integers, strings, doubles, Booleans, and others. Complex data types are types such as arrays, rows, and others.
 */

/**
 * @typedef {object} TimeSeriesDataPoint The timeseries data type represents the values of a measure over time. A time series is an array of rows of timestamps and measure values, with rows sorted in ascending order of time. A TimeSeriesDataPoint is a single data point in the time series. It represents a tuple of (time, measure value) in a time series.
 * @property {string} Time The timestamp when the measure value was collected.
 * @property {Datum} Value The measure value for the data point.
 */

/**
 * @typedef {object} Datum Datum represents a single data point in a query result.
 * @property {Datum} [ArrayValue] Indicates if the data point is an array.
 * @property {boolean} [NullValue] Indicates if the data point is null.
 * @property {Row} [RowValue] Indicates if the data point is a row.
 * @property {string} [ScalarValue] Indicates if the data point is a scalar value such as integer, string, double, or Boolean.
 * @property {TimeSeriesDataPoint[]} [TimeSeriesValue] Indicates if the data point is a timeseries data type.
 */

/**
 * @typedef {object} Row Represents a single row in the query results.
 * @property {Datum[]} Data List of data points in a single row of the result set.
 */

/**
 * JSON.stringify given object or "" when fails (cyclic object etc.)
 * @param {*} obj
 */
const tryStringify = (obj) => {
  try {
    return JSON.stringify(obj)
  } catch (e) {
    return ''
  }
}

const AWS_CLIENT_REGION = 'us-east-2'

const agent = new https.Agent({
  maxSockets: 5000,
})

const queryClient = new AWS.TimestreamQuery({
  maxRetries: 10,
  region: AWS_CLIENT_REGION,
  httpOptions: {
    timeout: 20000,
    agent,
  },
  convertResponseTypes: true,
})

/**
 * remove types from names
 * @param {Record<string, *>} row
 */
const entryMergeValues = (row) => {
  /** @type {Record<string, *>} */ const newRow = {}
  Object.entries(row).forEach(([key, value]) => {
    const keyNoType = key.split('::')[0]
    if (
      !(keyNoType in newRow) ||
      newRow[keyNoType] === undefined ||
      newRow[keyNoType] === null
    )
      newRow[keyNoType] = value
  })
  return newRow
}

/**
 * @param {string} query
 */
async function getAllRows(query, nextToken = undefined) {
  let response
  try {
    response = await queryClient
      .query({
        QueryString: query,
        NextToken: nextToken,
      })
      .promise()
  } catch (err) {
    console.error('Error while querying:', err)
    throw err
  }

  const nextPagePromise = response.NextToken
    ? getAllRows(query, response.NextToken)
    : Promise.resolve([])
  const responseParsed = parseQueryResult(response)
  const nextPage = await nextPagePromise

  return responseParsed.concat(nextPage)
}

function parseQueryResult(response) {
  // const queryStatus = response.QueryStatus
  // console.log('Current query status: ' + JSON.stringify(queryStatus))

  /** @type {ColumnInfo[]} */ const columnInfo = response.ColumnInfo
  /** @type {Row[]} */ const rows = response.Rows

  return rows.map(parseRow.bind(undefined, columnInfo)).map(entryMergeValues)
}

/**
 * @param {ColumnInfo[]} tableInfo
 * @param {Row} row
 */
function parseRow(tableInfo, row) {
  const data = row.Data
  /** @type {Record<string, *>} */ const rowOutput = {}

  for (let i = 0; i < data.length; i++) {
    const {Name, Type} = tableInfo[i]
    const datum = data[i]
    rowOutput[Name] = parseDatum(Type, datum)
  }

  return rowOutput
}

/**
 * @param {Type} columnType
 * @param {Datum} datum
 */
function parseDatum(columnType, datum) {
  if ('NullValue' in datum && datum.NullValue === true) {
    return null
  } else if ('ScalarType' in columnType) {
    return parseScalarType(columnType.ScalarType, datum.ScalarValue)
  } else if ('TimeSeriesMeasureValueColumnInfo' in columnType) {
    return parseTimeSeries(columnType, datum)
  } else if ('ArrayColumnInfo' in columnType) {
    return parseArray(columnType.ArrayColumnInfo, datum.ArrayValue)
  } else if ('RowColumnInfo' in columnType) {
    const rowColumnInfo = columnType.RowColumnInfo
    const rowValues = datum.RowValue
    return parseRow(rowColumnInfo, rowValues)
  }

  throw new Error(`unknown type of Datum ${tryStringify(columnType)}`)
}

/**
 * @param {ScalarType} scalarType
 * @param {string} scalarValue
 * @returns {boolean | number | string | Date}
 */
function parseScalarType(scalarType, scalarValue) {
  if (
    scalarType === 'BIGINT' ||
    scalarType === 'DOUBLE' ||
    scalarType === 'INTEGER'
  )
    return +scalarValue
  else if (scalarType === 'BOOLEAN') return !!scalarValue
  else if (scalarType === 'DATE' || scalarType === 'TIMESTAMP')
    return new Date(scalarValue)
  else if (scalarType === 'VARCHAR') return scalarValue
  throw new Error(`unknow scalar type ${tryStringify(scalarType)}`)
}

function parseTimeSeries(/* type, datum */) {
  throw new Error('parseTimeSeries not implemented')
  // const timeSeriesOutput = []
  // datum.TimeSeriesValue.forEach(function (dataPoint) {
  //   timeSeriesOutput.push(
  //     `{time=${dataPoint.Time}, value=${parseDatum(
  //       type.TimeSeriesMeasureValueColumnInfo,
  //       dataPoint.Value
  //     )}}`
  //   )
  // })

  // return `[${timeSeriesOutput.join(', ')}]`
}

function parseArray(/* arrayColumnInfo, arrayValues */) {
  throw new Error('parseArray not implemented')
  // const arrayOutput = []
  // arrayValues.forEach(function (datum) {
  //   arrayOutput.push(parseDatum(arrayColumnInfo, datum))
  // })
  // return `[${arrayOutput.join(', ')}]`
}

module.exports = {
  queryTimestream: getAllRows,
}
