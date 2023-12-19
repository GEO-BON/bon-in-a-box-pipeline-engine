import React, { useEffect, useState } from 'react';
import AutoResizeTextArea from './AutoResizeTextArea'

export const ARRAY_PLACEHOLDER = 'Array (comma-separated)';
export const CONSTANT_PLACEHOLDER = 'Constant';

function joinIfArray(value) {
  return value &&
    typeof value.join === 'function' ? value.join(', ') : value
}

export default function ScriptInput({ type, value, options, onValueUpdated, cols, ...passedProps }) {

  const [fieldValue, setFieldValue] = useState(value || '')

  useEffect(() => {
    setFieldValue(value || '')
  }, [value])

  if (type.endsWith('[]')) {
    return <AutoResizeTextArea {...passedProps}
      value={joinIfArray(fieldValue)}
      onChange={e => setFieldValue(e.target.value)}
      placeholder={ARRAY_PLACEHOLDER}
      keepWidth={true}
      cols={cols}
      onBlur={e => {
        const newValue = e.target.value
        if (!newValue || newValue === "") {
          onValueUpdated([])
        } else {
          onValueUpdated(e.target.value.split(',').map(v => v.trim()))
        }
      }}
    />
  }

  switch (type) {
    case 'options':
      if (options) {
        return <select {...passedProps}
          value={fieldValue}
          onChange={e => {
            setFieldValue(e.target.value)
            onValueUpdated(e.target.value)
          }}>
          <option hidden></option> {/* Allows the box to be empty when value not set */}
          {options.map(choice =>
            <option key={choice} value={choice}>{choice}</option>
          )}
        </select>

      } else {
        return <span className='ioWarning'>Options not defined</span>
      }

    case 'boolean':
      return <input type='checkbox' {...passedProps}
        checked={fieldValue}
        onChange={e => {
          setFieldValue(e.target.checked)
          onValueUpdated(e.target.checked)
        }} />

    case 'int':
      return <input type='text' {...passedProps}
        value={fieldValue}
        onChange={e => setFieldValue(e.target.value)}
        placeholder={CONSTANT_PLACEHOLDER}
        onKeyDown={e => { if (e.key === "Enter") onValueUpdated(parseInt(e.target.value)) }}
        onBlur={e => onValueUpdated(parseInt(e.target.value))} />

    case 'float':
      return <input type='text' {...passedProps}
        value={fieldValue}
        onChange={e => setFieldValue(e.target.value)}
        placeholder={CONSTANT_PLACEHOLDER}
        onKeyDown={e => { if (e.key === "Enter") onValueUpdated(parseFloat(e.target.value)) }}
        onBlur={e => onValueUpdated(parseFloat(e.target.value))} />

    default:
      // use null if empty or a string representation of null
      const updateValue = e => onValueUpdated(/^(null)?$/i.test(e.target.value) ? null : e.target.value)

      const props = {
        value: fieldValue,
        onChange: e => setFieldValue(e.target.value),
        placeholder: 'null',
        onBlur: updateValue,
        ...passedProps
      }

      if (fieldValue && fieldValue.includes("\n")) {
        return <AutoResizeTextArea {...props} />
      } else {
        return <input type='text' {...props}
          onKeyDown={e => { if (e.key === "Enter") updateValue(e) }} />
      }
  }
}
