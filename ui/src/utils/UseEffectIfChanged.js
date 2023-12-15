
import { useEffect, useRef } from 'react';
var array = require('lodash/array');

export const useEffectIfChanged = (callback, dependencies) => {
    const prevDependenciesRef = useRef(dependencies);
  
  
    // Use effect if dependencies changed
    useEffect(() => {
      const dependenciesChanged =
        dependencies.length !== prevDependenciesRef.current.length ||
        dependencies.some((dep, index) => array.isEqual(dep, prevDependenciesRef.current[index]));
  
      if (dependenciesChanged) {
        console.log("changed!")
        callback();
        prevDependenciesRef.current = dependencies;
      } else {
        console.log("did not change")
      }
    }, [dependencies, callback]);
  };