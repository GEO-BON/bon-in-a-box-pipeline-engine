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

export default function AutoResizeTextArea({ defaultValue, keepWidth, className, ...props }) {

  const textAreaRef = useRef(null);
  const [value, setValue] = useState(defaultValue || ''); // Initialize with defaultValue prop

  useEffect(() => {
    setValue(defaultValue || '');
  }, [defaultValue]);

  useEffect(() => {
    resize(textAreaRef.current, keepWidth);
  }, [value, keepWidth]);

  return (
    <textarea
      className={(className ? className + ' ' : '') + 'autoResize'}
      ref={textAreaRef}
      value={value} // Use value instead of defaultValue
      onChange={(e) => {
        setValue(e.target.value); // Update state when the value changes
        resize(e.target, keepWidth);
      }}
      {...props}
    />
  );
}
