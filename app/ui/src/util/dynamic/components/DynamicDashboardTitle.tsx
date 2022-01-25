import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons'
import {Button, Input, Tooltip} from 'antd'
import React, {useState} from 'react'
import {useCallback} from 'react'
import {useEffect} from 'react'
import { deleteDashboard, fetchDashboard, fetchDashboardKeys, uploadDashboard } from ".."

type TDynamicDashboardTitleProps = {
  dashboardKey: string
  isEditing: boolean
  setIsEditing: (v: boolean) => void
  onEditCancel: () => void
  onEditAccept: () => void
  onDeleteDashboard: () => void
}

export const DynamicDashboardTitle: React.FC<TDynamicDashboardTitleProps> = (
  props
) => {
  const {dashboardKey, isEditing, setIsEditing, onDeleteDashboard, onEditAccept,onEditCancel} = props

  const [newName, setNewName] = useState('')

  useEffect(() => {
    if (isEditing) {
      setNewName(dashboardKey)
    }
  }, [isEditing])

  const editable = (
    <div style={{width: '100%'}}>
      <Input
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        style={{width: 'auto'}}
      ></Input>
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
        style={{color:"green"}}
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
