import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons'
import {Button, Tooltip} from 'antd'
import React from 'react'

type TDynamicDashboardTitleProps = {
  dashboardKey: string
  isEditing: boolean
  setIsEditing: (v: boolean) => void
  onEditCancel: () => void
  onEditAccept: () => void
  onDeleteDashboard: () => void
  newName: string, setNewName: (v: string) => void
}

export const DynamicDashboardTitle: React.FC<TDynamicDashboardTitleProps> = (
  props
) => {
  const {
    dashboardKey,
    isEditing,
    setIsEditing,
    onDeleteDashboard,
    onEditAccept,
    onEditCancel,newName, setNewName
  } = props

  const editable = (
    <div style={{width: '100%'}}>
      {dashboardKey}{' '}
{/*     
      <Input
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        style={{width: 'auto'}}
      />
*/}
      <Tooltip title={'Cancel editing'}>
        <Button
          size="small"
          type="text"
          icon={<CloseOutlined />}
          onClick={onEditCancel}
        ></Button>
      </Tooltip>
      <Tooltip title={'Save changes'} color="green">
        <Button
          size="small"
          type="text"
          style={{color: 'green'}}
          icon={<CheckOutlined />}
          onClick={onEditAccept}
        ></Button>
      </Tooltip>
      <Tooltip title={'Delete dashboard'} color="red">
        <Button
          size="small"
          type="text"
          icon={<DeleteOutlined />}
          onClick={onDeleteDashboard}
          danger
        ></Button>
      </Tooltip>
    </div>
  )

  const fixed = (
    <>
      {dashboardKey}{' '}
      <Tooltip title={'Edit dashboard'}>
        <Button
          size="small"
          type="text"
          icon={<EditOutlined />}
          onClick={() => setIsEditing(true)}
        ></Button>
      </Tooltip>
    </>
  )

  return <>{isEditing ? editable : fixed}</>
}

DynamicDashboardTitle.displayName = 'DynamicDashboardTitle'
