import axios from "axios";
import _ from "underscore";

export const GetPipelineIO = async (pipeline_id: string) => {
  let result: any = { data: { outputs: [] } };
  try {
    result = await axios({
      method: "get",
      baseURL: `/pipeline/${pipeline_id}.json/info`,
    });
  } catch (error) {
    result = { data: {} };
  }
  return result.data;
};

export const GetPipelineRunOutputs = async (pipeline_run_id: string) => {
  let result: any = { data: {} };
  try {
    result = await axios({
      method: "get",
      baseURL: `/pipeline/${pipeline_run_id}/outputs`,
    });
  } catch (error) {
    result = { data: {} };
  }
  return result.data;
};

export const GetPipelineRunInputs = async (pipeline_run_id: string) => {
  let result: any = { data: {} };
  try {
    result = await axios({
      method: "get",
      baseURL: `/output/${pipeline_run_id.replaceAll(">", "/")}/input.json`,
    });
  } catch (error) {
    result = { data: {} };
  }
  return result.data;
};

export const GetScriptDescription = async (script_id: string) => {
  let result: any = { data: {} };
  try {
    result = await axios({
      method: "get",
      baseURL: `/script/${script_id}.yml/info`,
    });
  } catch (error) {
    result = { data: {} };
  }
  return result.data;
};

export const GetScriptOutputs = async (script_run_output_path: string) => {
  let result = { data: {} };
  try {
    result = await axios({
      method: "get",
      baseURL: `/output/${script_run_output_path}/output.json`,
    });
  } catch (error) {
    result = { data: {} };
  }
  return result.data;
};

export const createPipeline4Display = async (pipeline_run_id: string) => {
  const pipeline_id = pipeline_run_id.split(">").slice(0, -1).join(">");

  return GetPipelineIO(pipeline_id).then((po: any) => {
    return GetPipelineRunOutputs(pipeline_run_id).then((pro: any) => {
      return Promise.allSettled(
        Object.keys(po.outputs).map(async (p: any) => {
          const script = p.split("|")[0];
          const output = p.split("|")[1];
          if (script in pro) {
            const script_run_output_path = pro[script];
            return await GetScriptOutputs(script_run_output_path).then(
              (out: any) => {
                return {
                  ...po.outputs[p],
                  outputs: `${out[output]}`,
                };
              }
            );
          }
          return await GetPipelineRunInputs(pipeline_run_id).then(
            (inputs: any) => {
              if (script in inputs) {
                let inp = inputs[script];
                if (Array.isArray(inp)) {
                  inp = inputs[script].join(",");
                }
                return {
                  ...po.outputs[p],
                  outputs: inp,
                };
              } else {
                return { outputs: [] };
              }
            }
          );
        })
      ).then((prom: any) => {
        let desc: any = {
          name: "",
          author: "",
          description: "",
          external_link: "",
          pipeline_outputs: [],
          pipeline_inputs_desc: po.inputs,
        };
        if (po.description) {
          desc = {
            name: po.name,
            author: po.author,
            description: po.description,
            external_link: po.external_link,
            pipeline_outputs: [],
            pipeline_inputs_desc: po.inputs,
          };
        }
        prom.forEach((f: any) => {
          desc.pipeline_outputs.push(f.value);
        });
        return desc;
      });
    });
  });
};

export const GetJSON = async (path: string) => {
  let result = { data: {} };
  try {
    result = await axios({
      method: "get",
      baseURL: path,
    });
  } catch (error) {
    result = { data: {} };
  }
  return result.data;
};
