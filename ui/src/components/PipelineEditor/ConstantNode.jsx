import { Handle, Position } from "react-flow-renderer/nocss";
import ScriptInput from "../form/ScriptInput";

// props content, see https://reactflow.dev/docs/api/nodes/custom-nodes/#passed-prop-types
export default function ConstantNode({ id, data, type }) {
  return (
    <div className={`constant constant-${data.type}`}>
      <table>
        <tbody>
          <tr>
            <td className="dragHandle constant-name">
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
            <td className="dragHandle">
              <button
                className="arrowDownButton"
                title="options"
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
