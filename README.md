# Municipal Economic Dashboard (South Africa)

GMT 320 Assignment 2
Interactive dashboard that compares SOuth African municipalities using Spatial Economic Activity Data (SEAD-SA)

## SEAD SA Municipality Datasets:
**Source:** https://spatialtaxdata.org.za/download-data-landing

1. Municipal_FTE(csv) - Number of FTE employees per municipality and year

2. Municipal_Gini(csv) - Gini coefficient per municipality and year

3. Municipal_MedianIncome(csv) - Median income (rand) per municipality and year

4. MDB_Local_Municipal_Boundary_2018(geojson) - Municipality boundaries, used for the map

Explanation of measures:
- **Gini coefficient** shows how unequally income is spread in a municipality. 0 means everyone earns the same and 1 means one person earns everything.
- **Median income** is the middle income in a municipality: half of earners are above it and half below.
- **FTE employees** is the number of jobs counted as full-time equivalents. Two half-time jobs count as one FTE.


**Boundaries:** Municipal Demarcation Board, *Local Municipalities 2018*

## What the dashboard does
 
**Controls:** choose two municipalities (Region 1 and Region 2), a measure, a year and a minimum number of FTE employees

**Summary indicators:**
- total FTE employees for the selected year
- median of the municipal median incomes
- mean Gini coefficient
- change in the chosen measure for Region 1 since 2014

**Visualisations:**
- **Map:** shows all municipalities and highlights Region 1 and Region 2. Hover over a municipality to see its name.
- **Line chart:** shows how the chosen measure changes over the years for the two regions, compared with the median of all municipalities.
- **Bar chart:** ranks the top 10 municipalities for the chosen measure and year, and shows where the two selected regions fall.
- **Bubble chart:** plots median income against Gini coefficient for every municipality, with bubble size showing FTE employees. It shows whether municipalities with higher incomes are more or less equal.

## Files
 
index.html     page structure
style.css      styling and responsive layout
data.js        loads and merges the CSV files, statistics
chart.js       controls, summary indicators and charts
map.js         map and highlighted regions
data/          CSV and GeoJSON files
