import { NavLink } from "react-router-dom";
import GreenSquares from "../img/greenSquares.png";
import BigGreenBoxes from "../img/bigGreenSquares.png"
import Tooltip from "@mui/material/Tooltip";
 
export default function HomePage() {
    return (
        <div>
        <div>
            <img  
                src={GreenSquares} 
                alt="Green Squares" 
                className="medium-icons"
                style={{ width: '225px', height: 'auto', float: "right", alignContent: "right", marginRight : "-30px"}} 
            />
            {/* style={{ width: '230px', height: 'auto' ,right: "0", position: "absolute"}} /> */}

            <div className="home-page-content">
                <div className="title-container">
                    <h1 className="home-page-title" 
                        style={{ marginTop: "30px" , marginBottom: "10px"}}
                    >The BON in a Box Modeling Tool</h1>

                    {/* <img 
                        src={LeavesIcon} 
                        alt="Leaves icon" 
                        className="medium-icons"
                        style={{ width: '90px', height: 'auto' , alignContent: "center"}} /> */}
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
                        <div className="tooltip">
                            Genetic Diversity Indicator
                            <span className="tooltiptext-right"
                                >Are populations maintaining genetic diversity? <br></br>
                                <a href="https://boninabox.geobon.org/indicator?i=GeneticDiversity" target="_blank">More info</a>      |       <a href="/pipeline-form/GenesFromSpace>ToolComponents>GetIndicators>GFS_Indicators">Run pipeline</a>
                            </span>    
                        </div>
                        {/* <NavLink 
                            // to="/pipeline-form"
                            to="/pipeline-form/GenesFromSpace>ToolComponents>GetIndicators>GFS_Indicators"
                            className="pipelines-link"
                            >
                            Genetic Diversity Indicator
                        </NavLink> */}
                    </li>
                    <li className="paw-bullet">
                        <div className="tooltip">
                            Red List Index
                            <span className="tooltiptext-right"
                                >Is there recovery of threatened species?<br></br>
                                <a href="https://boninabox.geobon.org/indicator?i=RLI" target="_blank">More info</a>      |       <a href="/pipeline-form/RLI_pipeline>IUCN_RLI_pipeline">Run pipeline</a>
                            </span>    
                        </div>
                            {/* <NavLink 
                                // to="/pipeline-form/"
                                to="/pipeline-form/RLI_pipeline>IUCN_RLI_pipeline"
                                className="pipelines-link"
                            > 
                            Red List Index
                        </NavLink> */}
                    </li>
                    <li className="graph-bullet">
                        <div className="tooltip">
                            Protected Connected Index
                            <span className="tooltiptext-right"
                                >How much area is covered by well-connected protected areas?<br></br>
                                <a href="https://boninabox.geobon.org/indicator?i=ProtConn" target="_blank">More info</a>      |       <a href="/pipeline-form/Protconn-pipeline>ProtConn_pipeline">Run pipeline</a>
                            </span>    
                        </div>
                        {/* <NavLink 
                            // to="/pipeline-form/"
                            to="/pipeline-form/Protconn-pipeline>ProtConn_pipeline"
                            className="pipelines-link"
                        >
                            Protected Connected Index
                        </NavLink> */}
                    </li> 
                </ul>
            </div>

            <div className="column">    {/* right column */}
                <ul className="pipeline-bullets"> 
                <li className="tree-bullet">
                        <div className="tooltip">Species Habitat Index
                            <span className="tooltiptext-left"
                                >Are species losing or gaining habitat? <br></br>
                                <a href="https://boninabox.geobon.org/indicator?i=SHI" target="_blank">More info</a>      |       <a href="/pipeline-form/SHI_pipeline">Run pipeline</a>
                            </span>    
                        </div>
                            
                            {/* <NavLink 
                                to="/pipeline-form/SHI_pipeline"
                                className="pipelines-link"
                            >
                            Species Habitat Index
                        </NavLink> */}
                    </li>

                    <li className="world-bullet">
                        <div className="tooltip">
                            Species Distribution Models - ewlgcpSDM (mapSpecies)
                            <span className="tooltiptext-left"
                                >Where are species likely to be?<br></br>
                                <a href="https://boninabox.geobon.org/indicator?i=SDM" target="_blank">More info</a>      |       <a href="/pipeline-form/SDM>SDM_ewlgcp">Run pipeline</a>
                            </span>    
                        </div>
                            {/* <NavLink 
                                to="/pipeline-form/SDM>SDM_ewlgcp"
                                className="pipelines-link" 
                            >
                            Species Distribution Models - ewlgcpSDM (mapSpecies)
                        </NavLink> */}
                    </li>

                    {/* <li className="pin-bullet">
                        <div className="tooltip">
                            Sampling Prioritization
                            <span className="tooltiptext-left"
                                style={{ whiteSpace : "pre-wrap"}}
                                >Where should you sample to improve biodiversity knowledge?<br></br>
                                <a href="https://boninabox.geobon.org">More info</a>      |       <a href="/pipeline-form">Run pipeline</a>
                            </span>    
                        </div>
                    </li>  */}

                    <li className="leaf-bullet">
                        <div className="tooltip">
                            Biodiversity Intactness Index
                            <span className="tooltiptext-left"
                                >How much are species abundances changing?<br></br>
                                <a href="https://boninabox.geobon.org/indicator?i=BII" target="_blank">More info</a>      |       <a href="/pipeline-form/BII>BII">Run pipeline</a>
                            </span>    
                        </div>
                        {/* <NavLink 
                            to="/pipeline-form/BII>BII"
                            className="pipelines-link"
                        >
                            Biodiversity Intactness Index
                        </NavLink> */}
                    </li>
                </ul>

                <p style={{ float: "right" }}>
                    <a href="/pipeline-form">View All</a>
                </p>  
            </div>

            </div>
        </div>


        <div>
          <img
            src={BigGreenBoxes}
            style={{
              position: "relative",
              bottom: 0,
              left: 0,
              width: "500px",
              marginLeft : "-30px",
              marginTop : "-400px",
              opacity: 0.35,
              zIndex: 0, // making sure it's under everything
              pointerEvents: "none", 
            }}
          >
          </img>
        </div>
        </div>
        
      );
}