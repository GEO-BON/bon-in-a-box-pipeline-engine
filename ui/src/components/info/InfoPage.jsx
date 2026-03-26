import * as BonInABoxScriptService from "bon_in_a_box_script_service";
import gplImg from "../../img/gplv3-127x51.png";
import Versions from "./Versions";
import HPCStatus from "./HPCStatus";

export const api = new BonInABoxScriptService.DefaultApi();

export default function InfoPage() {

  return (
    <>
      <h2>License</h2>
      <table>
        <tbody>
          <tr>
            <td style={{ border: 'none', padding: 0 }}>
              The BON in a Box pipeline engine and modelling tool are licensed under GPL-v3.<br />
              Make sure to review the attribution guidelines for the platform.
            </td>
            <td style={{ border: 'none', padding: "0 0 0 5px" }}>
              <a href="https://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank">
                <img src={gplImg} style={{ verticalAlign: "top" }} />
              </a>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>Pipelines and scripts have their own licenses</strong>, specified in their metadata.<br />
        Make sure to review the attribution guidelines for pipelines and scripts.
      </p>

      <h2>HPC Status</h2>
      <p>
        BON in a Box instances can delegate jobs to a High Performance Computer (HPC) when configured in runner.env.
        Only the scripts that are marked as supporting HPC in their metadata will be sent.
      </p>
      <HPCStatus />

      <h2>Server versions</h2>
      <Versions />
    </>
  );
}
