import GreenSquares from "../img/greenSquares.png";
import BigGreenBoxes from "../img/bigGreenSquares.png"
import { LastNRuns } from "./RunHistory";
import { Trans, useTranslation } from "react-i18next";

export default function HomePage() {
    const { t } = useTranslation();
    return (
        <div className="homepage-background-images"
            style={{
                background: `url(${BigGreenBoxes}), url(${GreenSquares})`,
                backgroundRepeat: "no-repeat, no-repeat",
                backgroundPosition: "left bottom, right top",
                backgroundSize: "500px, 256px",
                overflow: "show",
                paddingBottom: "225px",
            }}>
        <div>
            <div className="home-page-content">
                <div className="title-container">
                    <h1 className="home-page-pre-title"
                    >BON in a Box</h1>
                    <h1 className="home-page-title"
                    >{t("home.title")}</h1>
                </div>
                <p style={{
                    lineHeight: "1.75",
                    textAlign: "justify"
                }} >
                    {t("home.description")}
                </p>
                <p>
                    <Trans i18nKey="home.developedBy" components={{ brand: <a href="https://geobon.org" /> }} />
                </p>
            </div>
        </div>

        <div className="green-separator"></div>
        <div className="home-page-content" >

            <div className="home-page-subtitle">{t("home.featured")}</div>

            <div className="pipeline-columns">

            <div className="column">    {/* left column */}
                <ul className="pipeline-bullets"> {/* change to a dropdown menu (kinda) */}
                    <li className="dna-bullet">
                        <div className="home-tooltip right">
                            {t("home.geneticDiversity")}
                            <div className="tooltip-wrapper">
                                <div className="tooltiptext">
                                    {t("home.geneticQuestion")} <br></br>
                                    <a href="https://boninabox.geobon.org/indicator?i=GeneticDiversity" target="_blank">{t("home.moreInfo")}</a>      |       <a href="/pipeline-form/GenesFromSpace>ToolComponents>GetIndicators>GFS_Indicators">{t("home.runPipeline")}</a>
                                </div>
                            </div>
                        </div>

                    </li>
                    <li className="paw-bullet">
                        <div className="home-tooltip right">
                            {t("home.redList")}
                            <div className="tooltip-wrapper">
                                <div className="tooltiptext"
                                    >{t("home.redListQuestion")}<br></br>
                                    <a href="https://boninabox.geobon.org/indicator?i=RLI" target="_blank">{t("home.moreInfo")}</a>      |       <a href="/pipeline-form/RLI_pipeline>IUCN_RLI_pipeline">{t("home.runPipeline")}</a>
                                </div>
                            </div>
                        </div>
                    </li>
                    <li className="graph-bullet">
                        <div className="home-tooltip right">
                            {t("home.protectedConnected")}
                            <div className="tooltip-wrapper">
                                <div className="tooltiptext"
                                    >{t("home.protectedQuestion")}<br></br>
                                    <a href="https://boninabox.geobon.org/indicator?i=ProtConn" target="_blank">{t("home.moreInfo")}</a>      |       <a href="/pipeline-form/Protconn-pipeline>ProtConn_pipeline">{t("home.runPipeline")}</a>
                                </div>
                            </div>
                        </div>

                    </li>
                </ul>
            </div>

            <div className="column">    {/* right column */}
                <ul className="pipeline-bullets">
                <li className="tree-bullet">
                        <div className="home-tooltip left">{t("home.habitat")}
                            <div className="tooltip-wrapper">
                                <div className="tooltiptext"
                                    >{t("home.habitatQuestion")} <br></br>
                                    <a href="https://boninabox.geobon.org/indicator?i=SHI" target="_blank">{t("home.moreInfo")}</a>      |       <a href="/pipeline-form/SHI>SHI_GFW">{t("home.runPipeline")}</a>
                                </div>
                            </div>
                        </div>

                    </li>

                    <li className="world-bullet">
                        <div className="home-tooltip left">
                            {t("home.distribution")}
                            <div className="tooltip-wrapper">
                                <div className="tooltiptext"
                                    >{t("home.distributionQuestion")}<br></br>
                                    <a href="https://boninabox.geobon.org/indicator?i=SDM" target="_blank">{t("home.moreInfo")}</a>      |       <a href="/pipeline-form/SDM>SDM_BRT">{t("home.runPipeline")}</a>
                                </div>
                            </div>
                        </div>

                    </li>


                    <li className="leaf-bullet">
                        <div className="home-tooltip left">
                            {t("home.intactness")}
                            <div className="tooltip-wrapper">
                                <div className="tooltiptext"
                                    >{t("home.intactnessQuestion")}<br></br>
                                    <a href="https://boninabox.geobon.org/indicator?i=BII" target="_blank">{t("home.moreInfo")}</a>      |       <a href="/pipeline-form/BII>BII">{t("home.runPipeline")}</a>
                                </div>
                            </div>
                        </div>
                    </li>
                </ul>

                <p style={{ float: "right" }}>
                    <a href="/pipeline-form">{t("home.viewAll")}</a>
                </p>
            </div>


            </div>
                <LastNRuns n={4} />
            </div>


        </div>

    );
}