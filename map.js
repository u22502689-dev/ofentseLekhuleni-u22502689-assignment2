const map = L.map("map");
map.attributionControl.addAttribution("Boundaries: Municipal Demarcation Board, 2018");

let layer;   // the municipality shapes on the map

// Teal for Region 1, orange for Region 2, grey for everything else
function shapeStyle(feature) {
  const code = feature.properties.CAT_B;
  if (code === state.a) return { fillColor: "#0f766e", fillOpacity: 0.9, color: "#111", weight: 2 };
  if (code === state.b) return { fillColor: "#d97706", fillOpacity: 0.9, color: "#111", weight: 2 };
  return { fillColor: "#94a3b8", fillOpacity: 0.5, color: "#ffffff", weight: 1 };
}

// Called by chart.js whenever a dropdown changes
function refreshMapStyle() {
  if (layer) layer.setStyle(shapeStyle);
}

fetch("data/MDB_Local_Municipal_Boundary_2018.geojson")
  .then(response => {
    if (!response.ok) throw new Error("Could not load the GeoJSON file");
    return response.json();
  })
  .then(geo => {
    layer = L.geoJSON(geo, {
      style: shapeStyle,
      onEachFeature: (feature, shape) => {
        shape.bindTooltip(feature.properties.MUNICNAME);   // name on hover
      }
    }).addTo(map);

    map.fitBounds(layer.getBounds());
  })
  .catch(error => console.error("Map error:", error));