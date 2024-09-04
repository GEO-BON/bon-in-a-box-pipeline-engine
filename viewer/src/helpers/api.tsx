/* eslint-disable no-return-assign */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable dot-notation */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-bitwise */
/* eslint-disable no-underscore-dangle */
/* eslint-disable radix */
/* eslint-disable no-nested-ternary */
import axios from "axios";
import _ from "underscore";

interface ITranslation {
  /**
   * text in frech
   */
  vernacular_fr: string;

  /**
   * text in english
   */
  vernacular_en: string;
}

/**
 *
 * @param {*} i18next i18next
 * @param {*} translations translations
 * @param {*} source source
 * @returns obj
 */
export const addTranslation = async (
  i18next: any,
  translations: any,
  source: any
) => {
  const resources: any = {
    en: { translation: {} },
    fr: { translation: {} },
  };

  if (source.length !== undefined) {
    source.map((item: ITranslation) => {
      const key: string = item["vernacular_fr"] || "";
      resources["en"]["translation"][key] = item["vernacular_en"];
      resources["fr"]["translation"][key] = item["vernacular_fr"];
      return item;
    });
  }

  resources.en.translation = {
    ...resources.en.translation,
    ...translations.en.translation,
  };
  resources.fr.translation = {
    ...resources.fr.translation,
    ...translations.fr.translation,
  };

  i18next.addResourceBundle(
    "en",
    "translation",
    resources.en.translation,
    true,
    true
  );
  i18next.addResourceBundle(
    "fr",
    "translation",
    resources.fr.translation,
    true,
    true
  );
  return resources;
};

export const GetStac = async (endpoint: string, paramObj: any) => {
  let result;
  const base_url = "https://io.biodiversite-quebec.ca/stac" as string;
  try {
    result = await axios({
      method: "get",
      baseURL: `${base_url}${endpoint}`,
      params: { limit: 100 },
    });
  } catch (error) {
    result = { data: null };
  }
  return result;
};

export const GetStacSearch = async (searchObj: any) => {
  let result;
  const base_url = "https://io.biodiversite-quebec.ca/stac/search" as string;
  try {
    result = await axios({
      method: "post",
      baseURL: `${base_url}`,
      data: searchObj,
    });
  } catch (error) {
    result = { data: null };
  }
  return result;
};

export const GetCOGStats = async (link: any, logTransform: boolean) => {
  let result;
  let expression = "b1*(b1>0)";
  if (logTransform) {
    expression = "sqrt(b1)";
  }
  const obj = {
    expression: expression,
    url: link,
  };
  const base_url = `/tiler/cog/statistics`;
  try {
    result = await axios({ method: "get", url: base_url, params: obj });
  } catch (error) {
    console.log(error);
    result = { data: null };
  }
  return result;
};

export const GetCOGStatsGeojson = async (link: any, geojson: any) => {
  let result;
  const obj = { url: link };
  const base_url = `/tiler/cog/statistics`;
  try {
    result = await axios({
      method: "post",
      baseURL: base_url,
      withCredentials: false,
      data: geojson,
      params: obj,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.log(error);
    result = { data: null };
  }
  return result;
};

export const GetCOGBounds = async (link: any) => {
  let result;
  const obj = {
    url: link,
  };
  const base_url = `/tiler/cog/bounds`;
  try {
    result = await axios({ method: "get", url: base_url, params: obj });
  } catch (error) {
    console.log(error);
    result = { data: null };
  }
  return result;
};

export const GetCountryList = async () => {
  let result;
  const base_url = `https://geoio.biodiversite-quebec.ca/country_list`;
  try {
    result = await axios({
      method: "get",
      url: base_url,
      params: {},
      /*headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },*/
    });
  } catch (error) {
    console.log(error);
    result = { data: null };
  }
  return result;
};

export const GetStateList = async (country_name: string) => {
  let result;
  const base_url = `https://geoio.biodiversite-quebec.ca/state_list`;
  try {
    result = await axios({
      method: "get",
      url: base_url,
      params: { country_name: country_name },
    });
  } catch (error) {
    console.log(error);
    result = { data: null };
  }
  return result;
};

export const GetCountryStats = async (
  country_name: string,
  cog_url: string
) => {
  let result;
  const base_url = `https://geoio.biodiversite-quebec.ca/country_stats`;
  const params = {
    country_name: country_name,
    cog_url: cog_url,
  };
  try {
    result = await axios({
      method: "get",
      url: base_url,
      params: params,
    });
  } catch (error) {
    console.log(error);
    result = { data: null };
  }
  return result.data;
};

export const GetCountryGeojson = async (country_name: string) => {
  let result;
  const base_url = `https://geoio.biodiversite-quebec.ca/country_geojson`;
  const params = {
    country_name: country_name,
  };
  try {
    result = await axios({
      method: "get",
      url: base_url,
      params: params,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.log(error);
    result = { data: null };
  }
  return result;
};

export const GetStateGeojson = async (
  state_name: string,
  country_name: string
) => {
  let result;
  const base_url = `https://geoio.biodiversite-quebec.ca/state_geojson`;
  const params = {
    state_name: state_name,
    country_name: country_name,
  };
  try {
    result = await axios({
      method: "get",
      url: base_url,
      params: params,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.log(error);
    result = { data: null };
  }
  return result;
};

export const GetMultipleCOGStatsGeojson2 = async (
  geojson: any,
  cog_urls: any
) => {
  return axios
    .all(
      cog_urls.map((cu: any) => {
        const obj = { url: cu.url, year: cu.year }; //Year is not a param but used here to be passed down
        const base_url = `/tiler/cog/statistics`;
        let result: any = {};
        try {
          result = axios({
            method: "post",
            baseURL: base_url,
            withCredentials: false,
            data: geojson,
            params: obj,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch (error) {
          console.log(error);
          result = { data: null };
        }
        return result;
      })
    )
    .then((responses) => {
      const resp: any = {};
      responses.map((m: any) => {
        const y: any = new URLSearchParams(m.request.responseURL).get("year");
        resp[y] = [];
        m.data.features.map((f: any) => {
          resp[y].push(f.properties);
        });
      });
      return resp;
    });
};

export const GetMultipleCOGStatsGeojson = async (
  geojson: any,
  cog_urls: any
) => {
  let result;
  const base_url = `https://geoio.biodiversite-quebec.ca/geojson_stats_many_urls`;
  const data = {
    cog_urls: cog_urls,
    geojson: geojson,
  };
  try {
    result = await axios({
      method: "post",
      url: base_url,
      data: data,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.log(error);
    result = { data: null };
  }
  return result;
};
