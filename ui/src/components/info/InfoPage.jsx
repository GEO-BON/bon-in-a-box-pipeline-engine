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
      <p>
        Please use the following citation to reference the BON in a Box pipeline engine:
      </p>
      <cite>
        Jory Griffith, Jean-Michel Lord, Michael D Catchen, Maria Isabel Arce-Plata, F Guillaume Blanchet,
        Mathusan Chandramohan, M Camila Diaz-Corzo, Dominique Gravel, César Gutiérrez, Isabelle S Helfenstein,
        Sean Hoban, Jamie M Kass, Linda Laikre, Guillaume Larocque, Deborah M Leigh, Brian Leung,
        Alicia Mastretta-Yanes, Katie L Millette, Maria Alejandra Molina Berbeo, Dat Nguyen, Kari E Norman,
        María Helena Olaya-Rodríguez, Simon Pahls, Kaitlyn Pereira, Pedro R Peres-Neto, Timothée Poisot,
        Laura J Pollock, Juan Carlos Rey-Velasco, Victor J Rincon-Parra, Claudia Roeoesli, François Rousseu,
        Lina María Sánchez-Clavijo, Meredith C Schuman, Oliver Selmoni, Jessica M da Silva, Erika Suarez-Valencia,
        Thilina D Surasinghe, Eren Turak, Luis Fernando Urbina, Sarah Valentin, Noah Wightman, Juan Zuloaga,
        Maria Cecilia Londoño, Andrew Gonzalez. 2026. BON in a Box: An Open and Collaborative Platform for Biodiversity
        Monitoring, Indicator Calculation, and Reporting. BioScience. 76(4):345-358. <a href="https://academic.oup.com/bioscience/article/76/4/345/8424339">
        https://doi.org/10.1093/biosci/biaf189</a>
      </cite>

      <h2>HPC Status</h2>
      <p>
        BON in a Box instances can delegate jobs to a High Performance Computer (HPC) when configured in runner.env.
        Only the scripts that are marked as supporting HPC in their metadata will be sent.
      </p>
      <HPCStatus />

      <h2>Server versions</h2>
      <div style={{ paddingBottom: '40px' }}>
        <Versions />
      </div>
    </>
  );
}
