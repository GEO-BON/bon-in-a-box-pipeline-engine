
import { useEffect, useRef } from 'react';
var _lang = require('lodash/lang');

export const useEffectIfChanged = (callback, dependencies) => {
    const prevDependenciesRef = useRef(dependencies);
  
  
    // Use effect if dependencies changed
    useEffect(() => {
      const dependenciesChanged =
        dependencies.length !== prevDependenciesRef.current.length ||
        dependencies.some((dep, index) => !_lang.isEqual(dep, prevDependenciesRef.current[index]));
  
      if (dependenciesChanged) {
        callback();
        prevDependenciesRef.current = dependencies;
      } else {
        console.log("did not change")
      }
    }, [dependencies, callback]);
  };