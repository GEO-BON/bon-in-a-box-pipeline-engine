import { useSortable } from "@dnd-kit/sortable";
import { CSS } from '@dnd-kit/utilities';
import { ControlledTextArea } from "../form/AutoResizeTextArea";
import ScriptInput from "../form/ScriptInput";



export function IOListItem({ io, id, valueEdited, setter, className }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: id });

    const style = {
        transform: CSS.Transform.toString({ ...transform, scaleX: 1, scaleY: 1 }),
        transition,
    };

    return <div ref={setNodeRef} style={style} className={"ioListItem" + (isDragging ? " dragging" : "")}>
        <table>
            <tbody>
                <tr>
                    <td {...attributes} {...listeners} className="draggable reorder-drag">⣿</td>
                    <td className={className}>
                        <ControlledTextArea className="label" keepWidth={true}
                            onBlur={e => valueEdited(e.target.value, "label", io, setter)}
                            onInput={preventNewLines}
                            defaultValue={io.label} />

                        <ControlledTextArea className="description" keepWidth={true}
                            onBlur={e => valueEdited(e.target.value, "description", io, setter)}
                            defaultValue={io.description} />

                        {io.type &&
                            <>
                                <span className="example-tag">Example: </span>
                                <ScriptInput type={io.type} value={io.example} options={io.options}
                                    onValueUpdated={(value) => valueEdited(value, "example", io, setter)} />
                            </>
                        }
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
}

function preventNewLines(event) {
    event.target.value = event.target.value.replaceAll("\n", "")
}