import { useSortable } from "@dnd-kit/sortable";
import { CSS } from '@dnd-kit/utilities';
import { ControlledTextArea } from "../form/AutoResizeTextArea";
import ScriptInput from "../form/ScriptInput";



export function IOListItem({ io, id, valueEdited, setter, className, expand }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: id });

    const style = {
        transform: CSS.Transform.toString({
            ...transform,
            scaleX: 1,
            scaleY: 1,
        }),
        transition,
        position: isDragging ? "relative" : "inherit",
        zIndex: isDragging ? 1000 : 0, /* Dragged element above the rest */
    };

    return <div ref={setNodeRef} {...attributes} style={style}
        className={"ioListItem" + (isDragging ? " dragging" : "") + (expand ? " expanded" : " collapsed")}>
        <table>
            <tbody>
                <tr>
                    <td {...listeners} className="draggable reorder-drag">⣿</td>
                    <td className={className}>
                        <ControlledTextArea className="label" keepWidth={true}
                            onBlur={e => valueEdited(e.target.value, "label", io, setter)}
                            onKeyDown={(e) => { if (e.ctrlKey) valueEdited(e.target.value, "label", io, setter) }}
                            onInput={preventNewLines}
                            defaultValue={io.label}
                        />

                        {expand && <>
                            <ControlledTextArea className="description" keepWidth={true}
                                onBlur={e => valueEdited(e.target.value, "description", io, setter)}
                                onKeyDown={(e) => { if (e.ctrlKey) valueEdited(e.target.value, "description", io, setter) }}
                                defaultValue={io.description} />

                            {io.type &&
                                <>
                                    <span className="example-tag">Example: </span>
                                    <ScriptInput type={io.type}
                                        className="example"
                                        value={io.example}
                                        options={io.options}
                                        onValueUpdated={(value) => valueEdited(value, "example", io, setter)}
                                        size="small"
                                        keepWidth={true}
                                    />
                                </>
                            }
                        </>}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
}

function preventNewLines(event) {
    event.target.value = event.target.value.replaceAll("\n", "")
}