import { Button } from "@follow/components/ui/button/index.js"
import { Label } from "@follow/components/ui/label/index.js"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import { useModalStack } from "~/components/ui/modal/stacked/hooks"
import { AITaskList, AITaskModal, useCanCreateNewAITask } from "~/modules/ai-task"

export const TaskSchedulingSection = () => {
  const { present } = useModalStack()
  const canCreateNewTask = useCanCreateNewAITask()
  const { t } = useTranslation("ai")

  const handleCreateTask = useCallback(() => {
    present({
      title: t("tasks.modal.new_title"),
      content: () => <AITaskModal />,
    })
  }, [present, t])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label className="text-text text-sm font-medium">{t("tasks.manage.title")}</Label>
          <div className="text-text-secondary text-xs">
            {t("tasks.manage.desc")}
            {!canCreateNewTask && (
              <span className="text-red"> {t("tasks.manage.limit_reached")}</span>
            )}
          </div>
        </div>

        <Button
          disabled={!canCreateNewTask}
          size={"sm"}
          variant={"outline"}
          onClick={handleCreateTask}
        >
          <i className="i-mgc-add-cute-re mr-2 size-4" />
          {t("tasks.actions.new_task")}
        </Button>
      </div>

      <AITaskList />
    </div>
  )
}
