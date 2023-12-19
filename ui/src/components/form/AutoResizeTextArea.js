import React, { useEffect, useRef } from 'react';

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

  // Override value if default value changes
  useEffect(() => {
    textAreaRef.current.value = defaultValue || '';
  }, [defaultValue]);

  // Initial size
  useEffect(() => {
    resize(textAreaRef.current, keepWidth);
  }, [keepWidth]);

  return (
    <textarea
      className={(className ? className + ' ' : '') + 'autoResize'}
      ref={textAreaRef}
      defaultValue={defaultValue}
      onChange={(e) => {
        resize(e.target, keepWidth);
      }}
      {...props}
    />
  );
}
