import React, { useEffect, useRef, useState } from 'react';

/**
 * Automatic horizontal and vertical resizing of textarea
 * @param {textarea} input
 */
function resize(input, keepWidth) {
  input.style.height = 0;
  input.style.height = input.scrollHeight + "px";

  if (!keepWidth) {
    input.style.width = "auto";
    input.style.width = input.scrollWidth + "px";
  }
}

export default function AutoResizeTextArea({ keepWidth, className, onChange, defaultValue, value, ...props }) {

  const textAreaRef = useRef(null);

  // Initial size
  useEffect(() => {
    resize(textAreaRef.current, keepWidth);
  }, [value, defaultValue, keepWidth]);

  return (
    <textarea
      value={value}
      defaultValue={defaultValue}
      className={(className ? className + ' ' : '') + 'autoResize'}
      ref={textAreaRef}
      onChange={(e) => {
        resize(e.target, keepWidth);

        // Forwarding onChange event
        if (typeof onChange === 'function') {
          onChange(e)
        }
      }}
      {...props}
    />
  );
}

export function ControlledTextArea({ defaultValue, ...props }) {

  const [fieldValue, setFieldValue] = useState(defaultValue || '')

  useEffect(() => {
    setFieldValue(defaultValue)
  }, [defaultValue, setFieldValue])

  return (
    <AutoResizeTextArea
      value={fieldValue}
      onChange={e => setFieldValue(e.target.value)}
      {...props}
    />
  );
}
