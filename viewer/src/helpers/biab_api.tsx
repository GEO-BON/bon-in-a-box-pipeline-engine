import axios from "axios";
import _ from "underscore";
import { getBreadcrumbs, getScriptOutput } from "./IOId";
import { GetCOGInfo } from "./api";

const SUPPORTED_LANGUAGES = ["en", "fr"];
let languagePromise: Promise<string> | null = null;

/**
 * Language for pipeline text: the geobon_lang cookie shared with the main UI and
 * other GEO BON sites (read through the server, it is HttpOnly), else the browser language.
 */
export const GetContentLanguage = (): Promise<string> => {
  if (!languagePromise) {
    languagePromise = axios
      .get("/api/language")
      .then((response) => response.data?.language)
      .catch(() => null)
      .then((saved) => {
        if (SUPPORTED_LANGUAGES.includes(saved)) return saved;
        const browser = (navigator.languages || [navigator.language])
          .map((language) => language?.toLowerCase().split("-")[0])
          .find((language) => SUPPORTED_LANGUAGES.includes(language));
        return browser || "en";
      });
  }
  return languagePromise;
};

export const GetPipelineIO = async (pipeline_id: string) => {
  let result: any = { data: { outputs: [] } };
  try {
    // Translated pipeline text when available; scripts stay in English.
    const lang = await GetContentLanguage();
    result = await axios({
      method: "get",
      baseURL: `/pipeline/${pipeline_id}.json/info`,
      params: lang === "en" ? {} : { lang },
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
          const script = getBreadcrumbs(p);
          const output = getScriptOutput(p);
          if (script in pro) {
            const script_run_output_path = pro[script];
            return await GetScriptOutputs(script_run_output_path).then( // TODO: Should not call GetScriptOutputs multiple times, use scriptDescriptionStore from the "ui" folder
              (out: any) => {
                const value = out[output];
                return {
                  ...po.outputs[p],
                  // Keep chooser objects (location, crsBBox, ...) as objects
                  outputs:
                    value !== null && typeof value === "object" && !Array.isArray(value)
                      ? value
                      : `${value}`, // TODO should be out[output] && `${out[output]}` to avoid having "undefined" strings
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
        return Promise.allSettled(
          prom.map(async (f: any) => {
            return await preprocess(f.value).then((v) => {
              return v;
            });
          })
        ).then((pr: any) => {
          desc.pipeline_outputs = pr.map((p: any) => p.value);
          return desc;
        });
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

const preprocess = async (value: any) => {
  if (value.type.includes("tif")) {
    let out = await Promise.all(
      value.outputs.split(",").map(async (t: any) => {
        return await GetCOGInfo(t).then((res) => {
          const outs = res.data.band_descriptions.map((b: any) => {
            let desc = b[0];
            if (b.length > 1 && typeof b[1] !== "object" && b[1] !== "") {
              desc = b[1];
            }
            return {
              type: value.type,
              url: t,
              band_id: b[0],
              description: `${t.split("/").pop()} - ${desc}`,
            };
          });
          return outs;
        });
      })
    );
    return { ...value, outputs: out.flat() };
  }
  return value;
};
