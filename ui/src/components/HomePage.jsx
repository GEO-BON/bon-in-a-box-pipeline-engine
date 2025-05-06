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
                    >The BON in a Box Modeling Tool</h1>
                </div>
                <p style={{
                    lineHeight: "1.75",
                    textAlign: "justify",
                    textJustify: "inter-word",
                    fontSize : "16px",
                }} >
                    As a whole, the <a href="https://boninabox.geobon.org/index">BON in a Box</a> platform is
                    designed to facilitate the establishment and operation of <b>Biodiversity Observation Networks
                    (BONs)</b>. It does so by providing a pipeline engine aiming to enhance the capacity of BONs and
                    countries to report on biodiversity effectively. It runs user-contributed code on a shared
                    infrastructure, the outputs of which can be shared for auditability, reproducibility,
                    and transparency.
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
                        <div className="home-tooltip">
                            Genetic Diversity Indicator
                            <span className="tooltiptext-right"
                                >Are populations maintaining genetic diversity? <br></br>
                                <a href="https://boninabox.geobon.org/indicator?i=GeneticDiversity" target="_blank">More info</a>      |       <a href="/pipeline-form/GenesFromSpace>ToolComponents>GetIndicators>GFS_Indicators">Run pipeline</a>
                            </span>
                        </div>

                    </li>
                    <li className="paw-bullet">
                        <div className="home-tooltip">
                            Red List Index
                            <span className="tooltiptext-right"
                                >Is there recovery of threatened species?<br></br>
                                <a href="https://boninabox.geobon.org/indicator?i=RLI" target="_blank">More info</a>      |       <a href="/pipeline-form/RLI_pipeline>IUCN_RLI_pipeline">Run pipeline</a>
                            </span>
                        </div>
                    </li>
                    <li className="graph-bullet">
                        <div className="home-tooltip">
                            Protected Connected Index
                            <span className="tooltiptext-right"
                                >How much area is covered by well-connected protected areas?<br></br>
                                <a href="https://boninabox.geobon.org/indicator?i=ProtConn" target="_blank">More info</a>      |       <a href="/pipeline-form/Protconn-pipeline>ProtConn_pipeline">Run pipeline</a>
                            </span>
                        </div>

                    </li>
                </ul>
            </div>

            <div className="column">    {/* right column */}
                <ul className="pipeline-bullets">
                <li className="tree-bullet">
                        <div className="home-tooltip">Species Habitat Index
                            <span className="tooltiptext-left"
                                >Are species losing or gaining habitat? <br></br>
                                <a href="https://boninabox.geobon.org/indicator?i=SHI" target="_blank">More info</a>      |       <a href="/pipeline-form/SHI_pipeline">Run pipeline</a>
                            </span>
                        </div>

                    </li>

                    <li className="world-bullet">
                        <div className="home-tooltip">
                            Species Distribution Models - ewlgcpSDM (mapSpecies)          
                            <span className="tooltiptext-left"
                                >Where are species likely to be?<br></br>
                                <a href="https://boninabox.geobon.org/indicator?i=SDM" target="_blank">More info</a>      |       <a href="/pipeline-form/SDM>SDM_ewlgcp">Run pipeline</a>
                            </span>
                        </div>

                    </li>



                    <li className="leaf-bullet">
                        <div className="home-tooltip">
                            Biodiversity Intactness Index
                            <span className="tooltiptext-left"
                                >How much are species abundances changing?<br></br>
                                <a href="https://boninabox.geobon.org/indicator?i=BII" target="_blank">More info</a>      |       <a href="/pipeline-form/BII>BII">Run pipeline</a>
                            </span>
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