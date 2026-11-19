
# BON in a Box Biodiversity Evaluation Engine

**Open-source software for running reproducible biodiversity analyses through the Biodiversity Evaluation Engine (BEE).**

## Overview

[BON in a Box](https://boninabox.geobon.org/) is an open-source platform developed by [GEO BON](https://geobon.org) to support biodiversity monitoring, indicator calculation, and reporting. It provides tools to help researchers, practitioners, and decision-makers access biodiversity data, conduct analyses, and generate information relevant to biodiversity assessment and conservation planning, including the Kunming-Montreal Global Biodiversity Framework (KMGBF).

The **Biodiversity Evaluation Engine (BEE)** is a component of BON in a Box that allows users to run computational workflows to calculate biodiversity indicators, Essential Biodiversity Variables (EBVs), and other biodiversity analysis outputs.

This repository contains the **software infrastructure and user interface for BEE**, including the components responsible for configuring, executing, and managing computational workflows and their results.

The biodiversity analysis pipelines themselves are maintained separately in the [BON in a Box Pipelines repository](https://github.com/GEO-BON/bon-in-a-box-pipelines).

## How BEE works

BEE provides an interface for running reproducible computational workflows, called *pipelines*, without requiring users to execute the underlying scripts manually.

Each pipeline combines a series of computational steps that transform input data into biodiversity analysis outputs. Through BEE, users can:

- **Explore available pipelines** for biodiversity indicators, EBVs, and other analyses.
- **Configure analyses** by selecting a geographic area, specifying parameters, and providing input datasets.
- **Run pipelines** using publicly available or user-provided data.
- **Explore and download results**, including outputs from individual processing steps.
- **Create or modify workflows** to adapt existing methods or develop new analyses.

BEE supports pipelines composed of scripts written in R, Python, and Julia. The engine manages the execution of these scripts and the transfer of data between computational steps.

The software is open-source and designed to support transparent, reproducible, and adaptable biodiversity analyses.

## Using BEE

BEE can be accessed online or installed locally.

- **[Online BEE platform](https://auth.bee.geobon.org/)** — Access the online beta version of BEE.
- **[User documentation](https://geo-bon.github.io/bon-in-a-box-pipeline-engine/)** — Instructions for using BEE, configuring and running analyses, and working with pipelines.
- **[Installation guide](https://geo-bon.github.io/bon-in-a-box-pipeline-engine/how_to_install.html)** — Instructions for installing and running BEE locally.
- **[Browse available pipelines](https://boninabox.geobon.org/browse-pipelines)** — Explore the biodiversity analyses available through BON in a Box.

## Repository structure

This repository contains the software components required to run and interact with BEE. Key directories include:

- [`ui/`](ui/) — User interface for configuring and managing analyses.
- [`viewer/`](viewer/) — Components for displaying and exploring analysis results.
- [`script-server/`](script-server/) — Pipeline orchestration and script execution management.
- [`python-api/`](python-api/) — API services supporting the platform.
- [`http-proxy/`](http-proxy/) — Web server and routing configuration.
- [`docs_source/`](docs_source/) — Source files for the user documentation.

For details on the software architecture, development environment, and deployment process, see the [developer documentation](README-dev.md).

## Additional resources

- [BON in a Box website](https://boninabox.geobon.org/) — Learn about the broader BON in a Box platform.
- [BON in a Box Pipelines repository](https://github.com/GEO-BON/bon-in-a-box-pipelines) — Explore the computational workflows executed by BEE.
- [User documentation](https://geo-bon.github.io/bon-in-a-box-pipeline-engine/) — Guides for using and installing BEE.
- [Developer documentation](README-dev.md) — Technical documentation for contributing to and developing BEE.

## Citation

If you use BON in a Box in your research or applications, please cite:

> Jory Griffith, Jean-Michel Lord, Michael D Catchen, Maria Isabel Arce-Plata,
> F Guillaume Blanchet, Mathusan Chandramohan, M Camila Diaz-Corzo, Dominique
> Gravel, César Gutiérrez, Isabelle S Helfenstein, Sean Hoban, Jamie M Kass,
> Linda Laikre, Guillaume Larocque, Deborah M Leigh, Brian Leung, Alicia
> Mastretta-Yanes, Katie L Millette, Maria Alejandra Molina Berbeo, Dat Nguyen,
> Kari E Norman, María Helena Olaya-Rodríguez, Simon Pahls, Kaitlyn Pereira, Pedro
> R Peres-Neto, Timothée Poisot, Laura J Pollock, Juan Carlos Rey-Velasco, Victor
> J Rincon-Parra, Claudia Roeoesli, François Rousseu, Lina María Sánchez-Clavijo,
> Meredith C Schuman, Oliver Selmoni, Jessica M da Silva, Erika Suarez-Valencia,
> Thilina D Surasinghe, Eren Turak, Luis Fernando Urbina, Sarah Valentin, Noah
> Wightman, Juan Zuloaga, Maria Cecilia Londoño, Andrew Gonzalez. 2026. BON in a
> Box: An Open and Collaborative Platform for Biodiversity Monitoring, Indicator
> Calculation, and Reporting. *BioScience*. 76(4):345–358.
> https://doi.org/10.1093/biosci/biaf189

---

*A GEO BON project, born from a collaboration between McGill University, the Humboldt Institute, Université de Sherbrooke, Concordia University, and Université de Montréal, with seed funding from Microsoft.*

