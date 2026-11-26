import { Handle, Position } from "@xyflow/react";
import ScriptInput from "../form/ScriptInput";
import { useTranslation } from "react-i18next";

// props content, see https://reactflow.dev/docs/api/nodes/custom-nodes/#passed-prop-types
export default function ConstantNode({ id, data, type }) {
  const { t } = useTranslation();
  return (
    <div className={`constant constant-${data.type.toLowerCase()}`}>
      <div className="dragHandle behindInput"></div>
      <table>
        <tbody>
          <tr>
            <td className="left-gutter">
              <p>{data.type}</p>
            </td>
            <td>
              <ScriptInput
                id={id}
                type={data.type}
                value={data.value}
                options={data.options}
                onValueUpdated={(v) => data.onConstantValueChange(id, v)}
                size="small"
                keepWidth={false}
              />
            </td>
            <td className="right-gutter">
              <button
                className="arrowDownButton"
                title={t("editor.options")}
                onClick={(e) => data.onPopupMenu(e, id, type)}
              />
            </td>
          </tr>
        </tbody>
      </table>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}
