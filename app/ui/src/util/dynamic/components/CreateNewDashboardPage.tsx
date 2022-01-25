import React from 'react'
import {UploadOutlined} from '@ant-design/icons'
import {Card, Upload, Button, Input} from 'antd'
import {FunctionComponent, useEffect, useState} from 'react'
import Markdown from '../../Markdown'
import Modal from 'antd/lib/modal/Modal'

export const DASHBOARD_SELECT_CREATE_NEW_OPTION = 'create new'

const upload = (name: string, text: string) =>
  fetch(`/api/dynamic/upload/${name}`, {
    body: text,
    method: 'POST',
  })

export const CreateNewDashboardPage: FunctionComponent<{
  onEdit: () => void
}> = ({onEdit}) => {
  const [helpText, setHelpText] = useState('')
  useEffect(() => {
    // load markdown from file
    const fetchMarkdown = async () => {
      try {
        const [txt, dir] = await Promise.all([
          fetch('/help/DynamicDashboardPage.md').then((x) => x.text()),
          fetch('/api/dynamic/dir').then((x) => x.text()),
        ])
        setHelpText(
          (txt ?? '').startsWith('<!')
            ? 'HELP NOT FOUND'
            : txt.replace('{Dynamic Dir}', dir)
        )
      } catch (e) {
        console.error(e)
      }
    }

    fetchMarkdown()
  }, [])

  const [newPageName, setNewPageName] = useState<string>()

  return (
    <>
      <Modal
        visible={typeof newPageName === 'string'}
        onCancel={() => setNewPageName(undefined)}
        onOk={() => {
          upload(`${newPageName}.json`, `{"cells":[]}`).then(x=>onEdit())
          setNewPageName(undefined)
        }}
      >
        <Input
          value={newPageName}
          onChange={(e) => setNewPageName(e.target.value)}
        />
      </Modal>
      <Card
        title="How to create new dynamic dashboard"
        extra={
          <>
            <Button onClick={() => setNewPageName('')}>Empty</Button>

            <Upload
              accept=".json,.svg"
              multiple={true}
              beforeUpload={(file) => {
                const reader = new FileReader()
                reader.onload = (e) => {
                  const text = (e?.target?.result as string | undefined) ?? ''
                  upload(file.name, text).then(x=>onEdit())
                }
                reader.readAsText(file)

                return false
              }}
            >
              <Button icon={<UploadOutlined />}>Upload</Button>
            </Upload>
          </>
        }
      >
        <Markdown source={helpText} />
      </Card>
    </>
  )
}
