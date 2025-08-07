import GreenSquares from "../img/greenSquares.png";
import BigGreenBoxes from "../img/bigGreenSquares.png"
import { LastNRuns } from "./RunHistory";

export default function HomePage() {

    return (
        <div
            style={{background: `url(${BigGreenBoxes})`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "left bottom",
            backgroundSize: "500px",
            overflow: "show",
            paddingBottom: "225px"}}>
        <div>
            <img
                src={GreenSquares}
                alt="Green Squares"
                style={{ width: '225px', height: 'auto', float: "right", alignContent: "right", marginRight : "-30px"}}
            />

            <div className="home-page-content">
                <div className="title-container">
                    <h1 className="home-page-title"
                        style={{ marginTop: "30px" , marginBottom: "10px"}}
                    >The BON in a Box Pipeline Engine</h1>
                </div>
                <p style={{
                    lineHeight: "1.75",
                    textAlign: "justify"
                }} >
                    The BON in a Box modelling tool is an open tool aiming to enhance the capacity of
                    Biodiversity Observation Networks and countries to report on biodiversity effectively.

                    It connects individual analyses scripts into automated pipelines that convert data into
                    Essential Biodiversity Variables (EBVs) and indicators.

                    These community-built pipelines can analyze public or user datasets, and can be
                    shared for auditability, reproducibility, and transparency.
                </p>
                <p>
                    Developed by <a href="https://geobon.org">GEO BON</a>.
                </p>
            </div>
        </div>

        <div className="green-separator"></div>
        <div className="home-page-content" >

            <div className="home-page-subtitle">FEATURED PIPELINES</div>

            <div className="pipeline-columns">

            <div className="column">    {/* left column */}
                <ul className="pipeline-bullets"> {/* change to a dropdown menu (kinda) */}
                    <li className="dna-bullet">
                        <div className="home-tooltip right">
                            Genetic Diversity Indicator
                            <div className="tooltip-wrapper">
                                <div className="tooltiptext">
                                    Are populations maintaining genetic diversity? <br></br>
                                    <a href="https://boninabox.geobon.org/indicator?i=GeneticDiversity" target="_blank">More info</a>      |       <a href="/pipeline-form/GenesFromSpace>ToolComponents>GetIndicators>GFS_Indicators">Run pipeline</a>
                                </div>
                            </div>
                        </div>

                    </li>
                    <li className="paw-bullet">
                        <div className="home-tooltip right">
                            Red List Index
                            <div className="tooltip-wrapper">
                                <div className="tooltiptext"
                                    >Is there recovery of threatened species?<br></br>
                                    <a href="https://boninabox.geobon.org/indicator?i=RLI" target="_blank">More info</a>      |       <a href="/pipeline-form/RLI_pipeline>IUCN_RLI_pipeline">Run pipeline</a>
                                </div>
                            </div>
                        </div>
                    </li>
                    <li className="graph-bullet">
                        <div className="home-tooltip right">
                            Protected Connected Index
                            <div className="tooltip-wrapper">
                                <div className="tooltiptext"
                                    >How much area is covered by well-connected protected areas?<br></br>
                                    <a href="https://boninabox.geobon.org/indicator?i=ProtConn" target="_blank">More info</a>      |       <a href="/pipeline-form/Protconn-pipeline>ProtConn_pipeline">Run pipeline</a>
                                </div>
                            </div>
                        </div>

                    </li>
                </ul>
            </div>

            <div className="column">    {/* right column */}
                <ul className="pipeline-bullets">
                <li className="tree-bullet">
                        <div className="home-tooltip left">Species Habitat Index
                            <div className="tooltip-wrapper">
                                <div className="tooltiptext"
                                    >Are species losing or gaining habitat? <br></br>
                                    <a href="https://boninabox.geobon.org/indicator?i=SHI" target="_blank">More info</a>      |       <a href="/pipeline-form/SHI_pipeline">Run pipeline</a>
                                </div>
                            </div>
                        </div>

                    </li>

                    <li className="world-bullet">
                        <div className="home-tooltip left">
                            Species Distribution Models with Boosted Regression Trees
                            <div className="tooltip-wrapper">
                                <div className="tooltiptext"
                                    >Where are species likely to be?<br></br>
                                    <a href="https://boninabox.geobon.org/indicator?i=SDM" target="_blank">More info</a>      |       <a href="/pipeline-form/SDM>SDM_BRT">Run pipeline</a>
                                </div>
                            </div>
                        </div>

                    </li>


                    <li className="leaf-bullet">
                        <div className="home-tooltip left">
                            Biodiversity Intactness Index
                            <div className="tooltip-wrapper">
                                <div className="tooltiptext"
                                    >How much are species abundances changing?<br></br>
                                    <a href="https://boninabox.geobon.org/indicator?i=BII" target="_blank">More info</a>      |       <a href="/pipeline-form/BII>BII">Run pipeline</a>
                                </div>
                            </div>
                        </div>
                    </li>
                </ul>

                <p style={{ float: "right" }}>
                    <a href="/pipeline-form">View All</a>
                </p>
            </div>


            </div>
                <LastNRuns n={3} />
        </div>

        </div>

      );
}