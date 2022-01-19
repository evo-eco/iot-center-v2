import React, {FunctionComponent, useEffect, useState, useCallback} from 'react'
import {Collapse, Row, Select} from 'antd'
import {Col, Form, Input, Button} from 'antd'
import ButtonGroup from 'antd/lib/button/button-group'

import Modal from 'antd/lib/modal/Modal'
import {
  DashboardLayoutDefiniton,
  DashboardCell,
  CELL_TYPES,
  DashboardCellType,
  DashboardCellPlotType,
  PLOT_TYPES,
  DashboardCellPlotGauge,
} from '.'
import {
  DashboardCellComponent,
  useSvgStrings,
} from '../../pages/DynamicDashboardPage'
import CollapsePanel from 'antd/lib/collapse/CollapsePanel'

const labelCol = {xs: 8}
const wrapperCol = Object.fromEntries(
  Object.entries(labelCol).map(([k, v]) => [k, 24 - v])
)

const getDefaultLayout = () => ({x: 0, y: 10000 - 1, w: 24, h: 3})

const getcellDefaults = (
  type?: DashboardCellType,
  plotType?: DashboardCellPlotType
): DashboardCell => {
  const layout = getDefaultLayout()

  if (type === 'geo') {
    return {
      type: 'geo',
      latField: 'Lat',
      lonField: 'Lon',
      layout,
      Live: {},
      Past: {},
    }
  } else if (type === 'svg')
    return {
      type: 'svg',
      field: [],
      file: '',
      layout,
    }
  else {
    if (plotType === 'gauge') {
      return {
        type: 'plot',
        plotType: 'gauge',
        field: '',
        decimalPlaces: 2,
        label: '',
        range: {min: 0, max: 100},
        unit: '%',
        layout,
      }
    } else
      return {
        type: 'plot',
        plotType: 'line',
        field: [],
        label: 'label',
        layout,
      }
  }
}

type CellEditProps = {
  layoutDefinition?: DashboardLayoutDefiniton
  editedCellIndex?: number
  onCancel?: () => void
  onDone?: (l: DashboardLayoutDefiniton) => void
}

export const CellEdit: FunctionComponent<CellEditProps> = ({
  editedCellIndex,
  layoutDefinition,
  onCancel,
  onDone,
}) => {
  const [cell, setCell] = useState<DashboardCell | undefined>(getcellDefaults())

  useEffect(() => {
    const cell =
      typeof editedCellIndex === 'number'
        ? layoutDefinition?.cells[editedCellIndex]
        : undefined
    setCell(cell ? JSON.parse(JSON.stringify(cell)) : getcellDefaults())
  }, [editedCellIndex, layoutDefinition])

  const onOk = useCallback(() => {
    debugger
    if (!cell) return
    const layoutCpy = JSON.parse(
      JSON.stringify(layoutDefinition)
    ) as DashboardLayoutDefiniton
    layoutCpy.cells[editedCellIndex!] = cell
    onDone?.(layoutCpy)
  }, [cell, layoutDefinition, editedCellIndex])

  const setCellProp = (prop: string, value: any) => {
    setCell((c) => c && {...c, [prop]: value})
  }

  const callbackDirect = (prop: string) => (value: any) => {
    setCellProp(prop, value)
  }

  const callbackHtmlEvent = (prop: string, isNumber = false) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!isNumber) setCellProp(prop, e.target.value)
    else {
      const number = +e.target.value
      setCellProp(prop, Number.isNaN(number) ? 0 : number)
    }
  }

  const fieldsSelect = (
    <Select
      mode="tags"
      value={(cell as any)?.field}
      onChange={callbackDirect('field')}
    ></Select>
  )

  return (
    <>
      <Modal
        title="Edit cell"
        visible={typeof editedCellIndex === 'number'}
        {...{onCancel, onOk}}
      >
        <Form {...{labelCol, wrapperCol}}>
          <Form.Item label="type">
            <Select
              size="small"
              value={cell?.type || 'plot'}
              onChange={(v) => {
                setCell(getcellDefaults(v))
              }}
              style={{minWidth: 100}}
            >
              {CELL_TYPES.map((key) => (
                <Select.Option key={key} value={key}>
                  {key}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {cell?.type === 'plot' ? (
            <>
              <Form.Item label="plot type">
                <Select
                  value={cell.plotType}
                  onChange={(v) => {
                    setCell(getcellDefaults(cell.type, v))
                  }}
                  options={PLOT_TYPES.map((value) => ({value}))}
                ></Select>
              </Form.Item>
              <Form.Item label="label">
                <Input
                  value={cell.label}
                  onChange={callbackHtmlEvent('label')}
                ></Input>
              </Form.Item>
            </>
          ) : undefined}

          {cell?.type === 'plot' && cell?.plotType === 'gauge' ? (
            <>
              <Form.Item label="field">
                <Input
                  value={cell.field}
                  onChange={callbackHtmlEvent('field')}
                ></Input>
              </Form.Item>
              <Form.Item label="range">
                <Row style={{width: '100%'}}>
                  <Col xs={12}>
                    <Input
                      value={cell.range.min || 0}
                      onChange={(v) =>
                        setCell(
                          ((c: DashboardCellPlotGauge) =>
                            c &&
                            ({
                              ...c,
                              range: {...c.range, min: +v.target.value},
                            } as any)) as any
                        )
                      }
                    ></Input>
                  </Col>
                  <Col xs={12}>
                    <Input
                      value={cell.range.max || 0}
                      onChange={(v) =>
                        setCell(
                          ((c: DashboardCellPlotGauge) =>
                            c &&
                            ({
                              ...c,
                              range: {...c.range, max: +v.target.value},
                            } as any)) as any
                        )
                      }
                    ></Input>
                  </Col>
                </Row>
              </Form.Item>
              <Form.Item label="decimal places">
                <Input
                  type={'number'}
                  value={cell.decimalPlaces}
                  onChange={callbackHtmlEvent('decimalPlaces', true)}
                ></Input>
              </Form.Item>
              <Form.Item label="unit">
                <Input
                  value={cell.unit}
                  onChange={callbackHtmlEvent('unit')}
                ></Input>
              </Form.Item>
            </>
          ) : undefined}

          {cell?.type === 'plot' && cell?.plotType === 'line' ? (
            <>
              <Form.Item label="fields">{fieldsSelect}</Form.Item>
            </>
          ) : undefined}

          {cell?.type === 'geo' ? (
            <>
              <Form.Item label="lat field">
                <Input
                  value={cell.latField}
                  onChange={callbackHtmlEvent('latField')}
                ></Input>
              </Form.Item>
              <Form.Item label="lon field">
                <Input
                  value={cell.lonField}
                  onChange={callbackHtmlEvent('lonField')}
                ></Input>
              </Form.Item>
            </>
          ) : undefined}

          {cell?.type === 'svg' ? (
            <>
              <Form.Item label="fields">{fieldsSelect}</Form.Item>
              <Form.Item label="file">
                <Input
                  value={cell.file}
                  onChange={callbackHtmlEvent('file')}
                ></Input>
              </Form.Item>
            </>
          ) : undefined}
        </Form>
        <div />
        <Collapse>
          <CollapsePanel key={0} header={`code for cell with index ${editedCellIndex}`}>
            <code style={{whiteSpace: 'pre'}}>
              {JSON.stringify(cell, undefined, 2)}
            </code>
          </CollapsePanel>
        </Collapse>
      </Modal>
    </>
  )
}
