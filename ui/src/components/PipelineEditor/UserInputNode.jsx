import { Handle, Position } from '@xyflow/react';
import { useTranslation } from "react-i18next";

// props content, see https://reactflow.dev/docs/api/nodes/custom-nodes/#passed-prop-types
export default function UserInputNode({ id, data, type }) {
  const { t } = useTranslation();

  return (
    <div className='userInput dragHandle'>
      <div style={{display: 'inline'}}>
        {data.label ? data.label : t("editor.userInput")} ({data.type})
      </div>
      <button className='arrowDownButton' title={t("editor.options")} onClick={(e) => data.onPopupMenu(e, id, type)} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}