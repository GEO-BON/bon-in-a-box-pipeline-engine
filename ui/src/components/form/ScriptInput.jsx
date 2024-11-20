import React, { useEffect, useState } from 'react';
import AutoResizeTextArea from './AutoResizeTextArea'
import Select from 'react-select';

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

  if(!type) {
    return <p className='error'>Input does not declare a type!</p>
  }

  if (type.startsWith("options")) {
    if (options) {
      const optionObjects = options.map(choice => {return {value: choice, label: choice}} )
      const menuPortal = (baseStyles, state) => ({
        ...baseStyles,
        zIndex: 2000 /* z-index options dropdown */
      })

      return <Select {...passedProps}
        value={optionObjects.filter((option) => fieldValue.includes(option.value))}
        isMulti={type === "options[]"}
        options={optionObjects}
        isDisabled={passedProps.disabled}
        menuPortalTarget={document.body}
        className='react-select'
        styles={passedProps.disabled ? {
          control: (baseStyles) => ({ ...baseStyles, backgroundColor: "transparent" }),
          multiValueRemove: (baseStyles) => ({ ...baseStyles, display: "none" }),
          container: (baseStyles ) => ({ ...baseStyles, width: 'max-content'}),
          menu: (baseStyles) => ({ ...baseStyles, width: 'max-content'}),
          menuPortal
        } : {
          menuPortal
        }}
        onChange={chosen => {
          const newValue = Array.isArray(chosen) ? chosen.map(option => option.value) : chosen.value
          setFieldValue(newValue)
          onValueUpdated(newValue)
        }}
      />

    } else {
      return <span className='ioWarning'>Options not defined</span>
    }
  }

  if (type.endsWith('[]')) {
    const onUpdateArray = event => {
      const newValue = event.target.value
      if (!newValue || newValue === "") {
        onValueUpdated([])
      } else {
        onValueUpdated(event.target.value.split(',').map(v => v.trim()))
      }
    }

    return <AutoResizeTextArea {...passedProps}
      value={joinIfArray(fieldValue)}
      onChange={e => setFieldValue(e.target.value)}
      placeholder={ARRAY_PLACEHOLDER}
      keepWidth={true}
      cols={cols}
      onBlur={onUpdateArray}
      onKeyDown={(e) => e.ctrlKey && onUpdateArray(e)}
    />
  }

  switch (type) {

    case 'boolean':
      return <input type='checkbox' {...passedProps}
        checked={fieldValue}
        onChange={e => {
          setFieldValue(e.target.checked)
          onValueUpdated(e.target.checked)
        }} />

    case 'int':
      return <input type='number' {...passedProps}
        value={fieldValue}
        onChange={e => {
          setFieldValue(e.target.value)
          onValueUpdated(parseInt(e.target.value))
        }}
        placeholder={CONSTANT_PLACEHOLDER} />

    case 'float':
      return <input type='number' step="any" {...passedProps}
        value={fieldValue}
        onChange={e => {
          setFieldValue(e.target.value)
          onValueUpdated(parseFloat(e.target.value))
        }}
        className={`input-float ${passedProps.className ? passedProps.className : ''}`}
        placeholder={CONSTANT_PLACEHOLDER} />

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
        props.onKeyDown = (e) => e.ctrlKey && updateValue(e)
        return <AutoResizeTextArea keepWidth={true} cols={cols} {...props} />
      } else {
        return <input type='text' {...props}
          onKeyDown={e => { if (e.key === "Enter" || e.ctrlKey) updateValue(e) }} />
      }
  }
}