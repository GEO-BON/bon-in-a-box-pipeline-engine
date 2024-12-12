/**
    BON in a Box pipeline engine and modeling tool
    Copyright (C) 2024, GEO BON

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { useEffect, useState } from "react";
import { Spinner } from "./Spinner";
import * as BonInABoxScriptService from "bon_in_a_box_script_service";

export const api = new BonInABoxScriptService.DefaultApi();

export default function Versions() {
  let [versions, setVersions] = useState();
  useEffect(() => {
    api.getVersions((error, _, response) => {
      if (response && response.text) setVersions(response.text);
      else if (error) setVersions(error.toString());
      else setVersions(null);
    });
  }, []);

  return (
    <p style={{ whiteSpace: "pre-wrap" }}>
      {versions ? versions : <Spinner />}
    </p>
  );
}
