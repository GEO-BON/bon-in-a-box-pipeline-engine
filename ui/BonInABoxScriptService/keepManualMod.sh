#! /bin/bash
# some files should not change after the client is generated, run this to restore them
# (src/ApiClient.js is protected by .openapi-generator-ignore)
cd "$(dirname "$0")"
git restore .babelrc package.json src/model/InfoInputsValue.js src/model/InfoOutputsValue.js
