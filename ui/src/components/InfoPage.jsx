import * as BonInABoxScriptService from "bon_in_a_box_script_service";
import gplImg from "../img/gplv3-127x51.png";
import Versions from "./Versions";

export const api = new BonInABoxScriptService.DefaultApi();

export default function InfoPage() {

  return (
    <>
      <h2>Lincense</h2>
      <table>
        <tbody>
          <tr>
            <td style={{border: 'none'}}>
            <a href="https://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank">
                <img src={gplImg} style={{ verticalAlign: "top" }} />
              </a>
            </td>
            <td style={{border: 'none'}}>
              The BON in a Box pipeline engine and modelling tool are licensed under GPL-v3<br />
              Make sure to review the attribution guidelines for the platform.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>Pipelines and scripts have their own licenses</strong>, specified in their metadata.<br/>
        Make sure to review the attribution guidelines for pipelines and scripts.
      </p>

      <h2>Server versions</h2>
      <Versions />
    </>
  );
}
