import * as BonInABoxScriptService from "bon_in_a_box_script_service";
import gplImg from "../../img/gplv3-127x51.png";
import Versions from "./Versions";
import HPCStatus from "./HPCStatus";
import K8sStatus from "./K8sStatus";
import { Trans, useTranslation } from "react-i18next";

export const api = new BonInABoxScriptService.DefaultApi();

export default function InfoPage() {
  const { t } = useTranslation();

  return (
    <>
      <h2>{t("info.license")}</h2>
      <table>
        <tbody>
          <tr>
            <td style={{ border: 'none', padding: 0 }}>
              {t("info.engineLicense")}<br />
              {t("info.platformAttribution")}
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
        <Trans i18nKey="info.ownLicensesSentence" components={{ strong: <strong /> }} />
        <br />
        {t("info.pipelineAttribution")}
      </p>
      <p>
        {t("info.citation")}
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

      <h2>{t("info.serverVersions")}</h2>
      <Versions />

      <h2>{t("info.cloudStatus")}</h2>
      <p>
        <Trans i18nKey="info.cloudDescription" components={{ code: <code /> }} />
      </p>
      <K8sStatus />

      <h2>{t("info.hpcStatus")}</h2>
      <p>
        <Trans i18nKey="info.hpcDescription" components={{ code: <code /> }} />
      </p>
      <HPCStatus />
      <div style={{ height: '40px' }}></div>
    </>
  );
}
