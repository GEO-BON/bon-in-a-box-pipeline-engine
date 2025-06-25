#! /bin/bash
# some files should not change after the client is generated, run this to restore them
git restore .babelrc package.json src/model/InfoInputsValue.js src/model/InfoOutputsValue.js ../package-lock.json
